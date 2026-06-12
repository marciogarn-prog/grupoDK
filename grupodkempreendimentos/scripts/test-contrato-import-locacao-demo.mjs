/**
 * E2E demo: contrato importado na locação mostra Visualizar/Confirmar/Enviar/Excluir
 * (paridade com CRLV — inclui PDF nomeado só por protocolo).
 * node grupodkempreendimentos/scripts/test-contrato-import-locacao-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";

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
    const b = document.getElementById("btn-locadora-operacao");
    return p && !p.classList.contains("hidden") && b && !b.classList.contains("hidden");
  }, { timeout: 45000 });
  await page.waitForFunction(
    () =>
      typeof window.__DK_docsLocacaoInferTipo === "function" &&
      typeof window.__DK_refreshOperacaoLocacaoDocumentosUi === "function" &&
      typeof window.__DK_documentosLoadDeposit === "function"
  );

  const infer = await page.evaluate(() => ({
    protoPdf: window.__DK_docsLocacaoInferTipo({ nome: "2026021301.pdf" }),
    crlv: window.__DK_docsLocacaoInferTipo({ nome: "CRLVDigital_X.pdf" }),
  }));
  console.log("inferDocTipo:", infer);

  let ok = true;
  if (infer.protoPdf === "contrato" && infer.crlv === "crlv") {
    console.log("PASS | inferDocTipo reconhece contrato por protocolo.pdf");
  } else {
    console.error("FAIL | inferDocTipo", infer);
    ok = false;
  }

  const caso = await page.evaluate(() => {
    const dig = (s) => String(s ?? "").replace(/\D/g, "");
    const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    let locs = [];
    try {
      locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
    } catch {
      locs = [];
    }
    const ativa = (l) => !String(l.fim || l.dataFim || "").trim();
    const hit = locs.find((l) => {
      const nc = norm(l.numeroContrato);
      const cpf = dig(l.cpf).slice(0, 11);
      return nc && cpf.length === 11 && ativa(l);
    });
    if (!hit) return null;
    return { cpfDig: dig(hit.cpf).slice(0, 11), proto: norm(hit.numeroContrato) };
  });

  if (!caso) {
    console.error("FAIL | nenhuma locação ativa para teste");
    process.exit(1);
  }

  await page.click("#btn-locadora-operacao");
  await page.waitForTimeout(1200);
  await page.click("#btn-operacao-cadastro-locacao");
  await page.waitForTimeout(1000);

  const cpfFmt = `${caso.cpfDig.slice(0, 3)}.${caso.cpfDig.slice(3, 6)}.${caso.cpfDig.slice(6, 9)}-${caso.cpfDig.slice(9)}`;
  await page.fill("#operacaoLocacaoCpf", cpfFmt);
  await page.dispatchEvent("#operacaoLocacaoCpf", "input");
  await page.waitForTimeout(1500);

  await page.evaluate((proto) => {
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const opt = Array.from(sel?.options || []).find((o) => String(o.value).includes(proto));
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, caso.proto);
  await page.waitForTimeout(1500);

  const depId = `doc_e2e_dep_${caso.proto}_${Date.now()}`;
  await page.evaluate(({ proto, cpfDig, depId }) => {
    const dep = window.__DK_documentosLoadDeposit?.() || { crlv: [], contrato: [], multa: [] };
    dep.contrato = (dep.contrato || []).filter((e) => String(e.chave || "") !== proto);
    dep.contrato.unshift({
      id: depId,
      chave: proto,
      nomeArquivo: `${proto}.pdf`,
      mimeType: "application/pdf",
      tamanho: 120,
      criadoEm: new Date().toISOString(),
      nuvem: false,
    });
    localStorage.setItem(window.__DK_documentosStorageKey, JSON.stringify(dep));
    localStorage.setItem("dk_locacao_documentos_v1", "[]");
    window.__DK_refreshOperacaoLocacaoDocumentosUi?.();
  }, { ...caso, depId });

  await page.fill("#operacaoLocacaoDocBuscaContrato", `${caso.proto}.pdf`);
  await page.dispatchEvent("#operacaoLocacaoDocBuscaContrato", "input");
  await page.waitForTimeout(400);
  await page.click("#operacaoLocacaoDocBuscarContratoBtn");
  await page.waitForTimeout(1200);

  const ui = await page.evaluate(({ proto, cpfDig }) => {
    const ul = document.getElementById("operacaoLocacaoDocumentosListaContrato");
    const html = ul?.innerHTML || "";
    let docs = [];
    try {
      docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]");
    } catch {
      docs = [];
    }
    const doc = docs.find(
      (d) =>
        d?.excluido !== true &&
        String(d.numeroContrato || "").includes(proto) &&
        String(d.cpf || "").includes(cpfDig.slice(-4))
    );
    return {
      proto,
      docCount: docs.filter((d) => d?.excluido !== true).length,
      hasOrigemDeposito: Boolean(doc?.origemDepositoId),
      hasVisualizar: html.includes("data-loc-doc-visualizar"),
      hasConfirmar: html.includes("data-loc-doc-confirmar"),
      hasEnviar: html.includes("data-loc-doc-enviar"),
      hasExcluir: html.includes("data-loc-doc-excluir"),
      snippet: html.slice(0, 360),
    };
  }, caso);

  console.log(JSON.stringify(ui, null, 2));

  if (ui.hasOrigemDeposito && ui.hasVisualizar && ui.hasConfirmar && ui.hasEnviar && ui.hasExcluir) {
    console.log("PASS | Importar contrato (sem blob local) → botões Visualizar/Confirmar/Enviar/Excluir");
  } else {
    console.error("FAIL | importar contrato via botão", ui);
    ok = false;
  }

  console.log(ok ? "CONTRATO IMPORT LOCACAO E2E OK" : "CONTRATO IMPORT LOCACAO E2E FAIL");
  process.exit(ok ? 0 : 1);
} finally {
  await browser.close();
}
