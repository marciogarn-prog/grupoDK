/**
 * E2E demo: depósito de Contratos dividido em ATIVOS e INATIVOS.
 * 1) Semeia 2 contratos no depósito (legado, sem pasta): um de protocolo de locação
 *    ativa e outro de locação encerrada; verifica resumo e badge na pesquisa.
 * 2) Duas pastas de upload: depositar pela pasta ATIVOS/INATIVOS grava
 *    statusContrato e tem prioridade sobre o estado da locação. Limpeza no fim.
 * node grupodkempreendimentos/scripts/test-contratos-ativos-inativos-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const TAG = `E2ECTR${Date.now()}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    localStorage.removeItem("dk_instalacao_limpa_v1");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => {
    const p = document.getElementById("panel-logado");
    return p && !p.classList.contains("hidden");
  }, { timeout: 45000 });
  await page.waitForTimeout(2500);
  record("login admin demo", true);

  /* escolher um protocolo ATIVO e um INATIVO reais das locações */
  const casos = await page.evaluate(() => {
    const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    let locs = [];
    try { locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]"); } catch { locs = []; }
    const fimDe = (l) => String(l?.fim || l?.dataFim || l?.data_fim || "").trim();
    const ativo = locs.find((l) => norm(l.numeroContrato) && !fimDe(l));
    const inativo = locs.find((l) => norm(l.numeroContrato) && fimDe(l));
    return {
      ativo: ativo ? norm(ativo.numeroContrato) : null,
      inativo: inativo ? norm(inativo.numeroContrato) : null,
    };
  });
  record("protocolos ativo+inativo encontrados", Boolean(casos.ativo && casos.inativo), JSON.stringify(casos));
  if (!casos.ativo || !casos.inativo) throw new Error("sem protocolos candidatos");

  /* semear 2 contratos no depósito (só metadados — basta para o resumo) */
  const seed = await page.evaluate(({ tag, protoAtivo, protoInativo }) => {
    const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null") || { crlv: [], contrato: [], multa: [] };
    dep.contrato = Array.isArray(dep.contrato) ? dep.contrato : [];
    const mk = (suf, chave) => ({
      id: `doc_${Date.now()}_${tag.toLowerCase()}${suf}`,
      chave,
      nomeArquivo: `${chave}.pdf`,
      mimeType: "application/pdf",
      tamanho: 100,
      criadoEm: new Date().toISOString(),
    });
    const a = mk("a", protoAtivo);
    const b = mk("b", protoInativo);
    dep.contrato.push(a, b);
    localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
    return { ids: [a.id, b.id] };
  }, { tag: TAG, protoAtivo: casos.ativo, protoInativo: casos.inativo });

  /* abrir painel Documentos pelo botão real e ler o resumo */
  await page.waitForFunction(() => {
    const b = document.getElementById("btn-locadora-documentos");
    return b && !b.classList.contains("hidden");
  }, { timeout: 30000 });
  await page.click("#btn-locadora-documentos");
  await page.waitForFunction(() => {
    const p = document.getElementById("panel-documentos-locadora");
    return p && !p.classList.contains("hidden");
  }, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const resumo = await page.evaluate(() => document.getElementById("documentosResumoContrato")?.textContent || "");
  const mAtivos = resumo.match(/Contratos ativos:\s*(\d+)/i);
  const mInativos = resumo.match(/Contratos inativos:\s*(\d+)/i);
  record(
    "resumo dividido em ativos e inativos",
    Boolean(mAtivos && mInativos) && Number(mAtivos[1]) >= 1 && Number(mInativos[1]) >= 1,
    resumo.slice(0, 160)
  );

  /* pesquisa de contrato mostra badge ativa/inativa */
  await page.evaluate(() => {
    document.querySelector('input[name="documentosBuscaTipo"][value="contrato"]')?.click();
  });
  await page.fill("#documentosBuscaInput", casos.inativo);
  await page.click("#documentosBuscaBtn");
  await page.waitForTimeout(800);
  const badgeInativo = await page.evaluate(() =>
    (document.getElementById("documentosBuscaResultados")?.textContent || "").includes("locação INATIVA")
  );
  record("pesquisa contrato com badge locação INATIVA", badgeInativo === true);

  await page.fill("#documentosBuscaInput", casos.ativo);
  await page.click("#documentosBuscaBtn");
  await page.waitForTimeout(800);
  const badgeAtivo = await page.evaluate(() =>
    (document.getElementById("documentosBuscaResultados")?.textContent || "").includes("locação ATIVA")
  );
  record("pesquisa contrato com badge locação ATIVA", badgeAtivo === true);

  /* duas pastas de upload: a pasta escolhida define ativo/inativo */
  const pastasVisiveis = await page.evaluate(() => {
    const a = document.getElementById("documentosDropContratoAtivo");
    const i = document.getElementById("documentosDropContratoInativo");
    return Boolean(a && a.offsetParent !== null && i && i.offsetParent !== null);
  });
  record("duas pastas de contratos visíveis (ativos + inativos)", pastasVisiveis);

  const pdfBuf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  const protoFakeIna = `${TAG}INA`;
  const protoFakeAtv = `${TAG}ATV`;
  await page.setInputFiles("#documentosInputContratoInativo", {
    name: `${protoFakeIna}.pdf`,
    mimeType: "application/pdf",
    buffer: pdfBuf,
  });
  await page.waitForTimeout(3000);
  await page.setInputFiles("#documentosInputContratoAtivo", {
    name: `${protoFakeAtv}.pdf`,
    mimeType: "application/pdf",
    buffer: pdfBuf,
  });
  await page.waitForTimeout(3000);

  const flags = await page.evaluate(({ ina, atv }) => {
    const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null") || {};
    const arr = Array.isArray(dep.contrato) ? dep.contrato : [];
    const eIna = arr.find((e) => e.chave === ina);
    const eAtv = arr.find((e) => e.chave === atv);
    return {
      stIna: eIna?.statusContrato || "",
      stAtv: eAtv?.statusContrato || "",
      idIna: eIna?.id || "",
      idAtv: eAtv?.id || "",
    };
  }, { ina: protoFakeIna, atv: protoFakeAtv });
  record("pasta INATIVOS grava statusContrato=inativo", flags.stIna === "inativo", `st=${flags.stIna}`);
  record("pasta ATIVOS grava statusContrato=ativo", flags.stAtv === "ativo", `st=${flags.stAtv}`);

  /* protocolo desconhecido depositado na pasta INATIVOS mostra badge INATIVA (pasta tem prioridade) */
  await page.fill("#documentosBuscaInput", protoFakeIna);
  await page.click("#documentosBuscaBtn");
  await page.waitForTimeout(800);
  const badgePastaInativa = await page.evaluate(() =>
    (document.getElementById("documentosBuscaResultados")?.textContent || "").includes("locação INATIVA")
  );
  record("badge segue a pasta (INATIVA mesmo sem locação)", badgePastaInativa === true);

  /* limpeza dos uploads via botão Excluir (remove local + nuvem) */
  for (const proto of [protoFakeIna, protoFakeAtv]) {
    await page.fill("#documentosBuscaInput", proto);
    await page.click("#documentosBuscaBtn");
    await page.waitForTimeout(600);
    await page.click("#documentosBuscaResultados .documentos-btn-excluir").catch(() => null);
    await page.waitForTimeout(1500);
  }
  const uploadsRestantes = await page.evaluate(({ ina, atv }) => {
    const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null") || {};
    const arr = Array.isArray(dep.contrato) ? dep.contrato : [];
    return arr.filter((e) => e.chave === ina || e.chave === atv).length;
  }, { ina: protoFakeIna, atv: protoFakeAtv });
  record("limpeza dos uploads de pasta", uploadsRestantes === 0, `restantes=${uploadsRestantes}`);

  /* limpeza */
  await page.evaluate(async (ids) => {
    const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null");
    if (dep?.contrato) {
      dep.contrato = dep.contrato.filter((e) => !ids.includes(String(e.id)));
      localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      await window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => null);
    }
  }, seed.ids);
  record("limpeza dos contratos de teste", true);
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
