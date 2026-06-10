/**
 * E2E demo: LanÃ§amento de multas â€” pesquisa no depÃ³sito Documentos (igual CRLV),
 * importaÃ§Ã£o de VÃRIAS multas para o protocolo e limpeza (tombstone) no fim.
 * node grupodkempreendimentos/scripts/test-multas-import-busca-demo.mjs
 */
import { chromium } from "playwright";

const BASE_URL = "https://demo.grupodkempreendimentos.com.br/";
const CASO = { cpf: "104.554.034-06", cpfDig: "10455403406", proto: "2025111301", placa: "UHK6J56" };
const TAG = `E2E-MULTA-${Date.now()}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));

try {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 90000 });
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
  await page.goto(`${BASE_URL}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(
    () => {
      const panel = document.getElementById("panel-logado");
      const btnOp = document.getElementById("btn-locadora-operacao");
      return panel && !panel.classList.contains("hidden") && btnOp && !btnOp.classList.contains("hidden");
    },
    { timeout: 45000 }
  );
  record("login admin portal demo", true);

  /* Semear 2 multas no depÃ³sito Documentos (localStorage + blob em IndexedDB) */
  const seed = await page.evaluate(
    async ({ tag, chave }) => {
      const pdfBytes = new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF"
      );
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const ids = [];
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("dk_documentos_blobs_v1", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("files")) req.result.createObjectStore("files", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const raw = localStorage.getItem("dk_documentos_deposito_v1");
      const dep = raw ? JSON.parse(raw) : { crlv: [], contrato: [], multa: [] };
      dep.multa = Array.isArray(dep.multa) ? dep.multa : [];
      for (let i = 1; i <= 2; i += 1) {
        const id = `doc_${Date.now()}_${tag.toLowerCase()}_${i}`;
        const nome = `${tag}-${i}.pdf`;
        await new Promise((resolve, reject) => {
          const tx = db.transaction("files", "readwrite");
          tx.objectStore("files").put({ id, blob, nomeArquivo: nome, mimeType: "application/pdf" });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
        dep.multa.push({
          id,
          chave,
          nomeArquivo: nome,
          mimeType: "application/pdf",
          tamanho: blob.size,
          criadoEm: new Date().toISOString(),
        });
        ids.push(id);
      }
      localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
      return { ok: true, ids };
    },
    { tag: TAG, chave: `${CASO.placa}-${CASO.cpfDig}` }
  );
  record("2 multas semeadas no depÃ³sito", seed.ok === true, seed.ids.join(","));

  await page.click("#btn-locadora-operacao");
  await page.waitForTimeout(1200);

  const btnMultas = page.locator("#btn-operacao-lancamento-multas");
  await btnMultas.waitFor({ state: "visible", timeout: 20000 });
  await btnMultas.click();
  await page.waitForTimeout(800);

  const cpfInput = page.locator("#operacaoLancMultasCpf");
  await cpfInput.waitFor({ state: "visible", timeout: 20000 });
  await cpfInput.fill(CASO.cpf);
  await cpfInput.dispatchEvent("input");
  await page.waitForTimeout(600);
  await page.click("#operacaoLancMultasConfirmarPesquisaBtn");
  await page.waitForTimeout(1500);

  const protoSel = await page.evaluate((proto) => {
    const sel = document.getElementById("operacaoLancMultasProtocoloSelect");
    if (!sel) return { ok: false, reason: "select_nao_encontrado" };
    const opt = Array.from(sel.options || []).find((o) => String(o.value).includes(proto));
    if (!opt) {
      return {
        ok: false,
        reason: "protocolo_ausente",
        opcoes: Array.from(sel.options || []).map((o) => o.value).slice(0, 8),
      };
    }
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, value: opt.value };
  }, CASO.proto);
  record("protocolo no selector de multas", protoSel.ok === true, JSON.stringify(protoSel).slice(0, 140));
  await page.waitForTimeout(1500);

  const secVisivel = await page.evaluate(() => {
    const sec = document.getElementById("operacaoLancMultasDocumentosDeposito");
    const input = document.getElementById("operacaoLancMultasDocBusca");
    const btn = document.getElementById("operacaoLancMultasDocImportBtn");
    return {
      visivel: Boolean(sec && !sec.classList.contains("hidden")),
      inputAtivo: Boolean(input && !input.disabled),
      btnAtivo: Boolean(btn && !btn.disabled),
      btnLabel: btn ? btn.textContent.trim() : null,
    };
  });
  record(
    "painel de multas com pesquisa ativa",
    secVisivel.visivel && secVisivel.inputAtivo && secVisivel.btnAtivo,
    JSON.stringify(secVisivel)
  );
  record("botÃ£o Â«Importar multaÂ»", secVisivel.btnLabel === "Importar multa", String(secVisivel.btnLabel));

  /* Pesquisar e ver sugestÃµes */
  const busca = page.locator("#operacaoLancMultasDocBusca");
  await busca.fill(`${TAG}-1`);
  await busca.dispatchEvent("input");
  await page.waitForTimeout(500);
  const sugestoes = await page.evaluate(() => {
    const ul = document.getElementById("operacaoLancMultasDocSugestoes");
    return {
      visivel: Boolean(ul && !ul.classList.contains("hidden")),
      n: ul ? ul.querySelectorAll("[data-dep-doc-id]").length : 0,
      texto: ul ? ul.textContent.replace(/\s+/g, " ").trim().slice(0, 120) : "",
    };
  });
  record("sugestÃµes do depÃ³sito aparecem", sugestoes.visivel && sugestoes.n >= 1, JSON.stringify(sugestoes));

  /* Importar multa 1 */
  await page.click("#operacaoLancMultasDocImportBtn");
  await page.waitForTimeout(1200);
  const lista1 = await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLancMultasDocumentosLista");
    const txt = ul ? ul.textContent.replace(/\s+/g, " ").trim() : "";
    return { tem1: txt.includes(`${tag}-1`), texto: txt.slice(0, 200) };
  }, TAG);
  record("multa 1 importada para o protocolo", lista1.tem1, lista1.texto.slice(0, 140));

  /* Importar multa 2 â€” vÃ¡rias multas no mesmo protocolo */
  await busca.fill(`${TAG}-2`);
  await busca.dispatchEvent("input");
  await page.waitForTimeout(400);
  await page.click("#operacaoLancMultasDocImportBtn");
  await page.waitForTimeout(1200);
  const lista2 = await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLancMultasDocumentosLista");
    const txt = ul ? ul.textContent.replace(/\s+/g, " ").trim() : "";
    const itens = ul ? ul.querySelectorAll("li").length : 0;
    return { tem1: txt.includes(`${tag}-1`), tem2: txt.includes(`${tag}-2`), itens, texto: txt.slice(0, 260) };
  }, TAG);
  record(
    "2 multas no mesmo protocolo (vÃ¡rias permitidas)",
    lista2.tem1 && lista2.tem2,
    `itens=${lista2.itens} | ${lista2.texto.slice(0, 160)}`
  );

  /* Visualizar funciona (nÃ£o dÃ¡ Â«Documento nÃ£o encontradoÂ») */
  const verRes = await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLancMultasDocumentosLista");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(`${tag}-1`));
    const btn = li?.querySelector("[data-loc-doc-visualizar]");
    if (!btn) return { ok: false, reason: "botao_nao_encontrado" };
    btn.click();
    return { ok: true };
  }, TAG);
  await page.waitForTimeout(900);
  const msgAposVer = await page.evaluate(() => {
    const msg = document.getElementById("operacaoLancMultasDepositoMsg");
    return msg ? msg.textContent.trim() : "";
  });
  record(
    "Visualizar multa sem erro",
    verRes.ok && !/nÃ£o encontrado/i.test(msgAposVer),
    msgAposVer.slice(0, 120) || "(sem mensagem)"
  );

  /* Limpeza: remover docs do protocolo (tombstone) e do depÃ³sito; push para a nuvem */
  const cleanup = await page.evaluate(
    async ({ ids }) => {
      const idSet = new Set(ids.map(String));
      try {
        const raw = localStorage.getItem("dk_locacao_documentos_v1");
        const arr = raw ? JSON.parse(raw) : [];
        const now = Date.now();
        const out = (Array.isArray(arr) ? arr : []).map((d) =>
          idSet.has(String(d?.origemDepositoId || ""))
            ? { ...d, excluido: true, excluidoEm: now, arquivoBase64: "" }
            : d
        );
        localStorage.setItem("dk_locacao_documentos_v1", JSON.stringify(out));
      } catch {
        /* ignore */
      }
      try {
        const rawDep = localStorage.getItem("dk_documentos_deposito_v1");
        const dep = rawDep ? JSON.parse(rawDep) : null;
        if (dep && Array.isArray(dep.multa)) {
          dep.multa = dep.multa.filter((e) => !idSet.has(String(e?.id || "")));
          localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
        }
      } catch {
        /* ignore */
      }
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        try {
          await window.__DK_pushCloudSnapshotNow({ force: true });
          return { ok: true, pushed: true };
        } catch {
          return { ok: true, pushed: false };
        }
      }
      return { ok: true, pushed: false };
    },
    { ids: seed.ids }
  );
  record("limpeza dos dados de teste", cleanup.ok === true, `push=${cleanup.pushed}`);
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
