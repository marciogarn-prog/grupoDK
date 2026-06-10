/**
 * E2E demo: CRLV NOVO â€” protocolo sem CRLV: depÃ³sito â†’ pesquisa â†’ importar
 * â†’ Confirmar â†’ Enviar ao cliente â†’ nuvem â†’ app cliente. Limpeza no fim.
 * node grupodkempreendimentos/scripts/test-crlv-envio-novo-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const TAG = `E2ECRLV${Date.now()}`;

const results = [];
const pageErrors = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));
page.on("pageerror", (e) => pageErrors.push(String(e?.message || e).slice(0, 200)));

let caso = null;
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
  record("login admin portal demo", true);
  await page.waitForTimeout(2500);

  /* escolher protocolo ATIVO sem CRLV */
  caso = await page.evaluate(() => {
    const dig = (s) => String(s ?? "").replace(/\D/g, "");
    const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    let locs = [];
    let docs = [];
    try { locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]"); } catch { locs = []; }
    try { docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]"); } catch { docs = []; }
    const comCrlv = new Set(
      docs
        .filter((d) => d.excluido !== true && /crlv/i.test(String(d.tipo || d.origemDepositoCategoria || d.nome || "")))
        .map((d) => norm(d.numeroContrato))
    );
    const ativa = (l) => !String(l.fim || l.dataFim || "").trim();
    const hit = locs.find((l) => {
      const nc = norm(l.numeroContrato);
      const cpf = dig(l.cpf).slice(0, 11);
      const placa = String(l.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return nc && cpf.length === 11 && placa.length >= 6 && ativa(l) && !comCrlv.has(nc);
    });
    if (!hit) return null;
    return {
      cpfDig: dig(hit.cpf).slice(0, 11),
      proto: norm(hit.numeroContrato),
      placa: String(hit.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    };
  });
  record("protocolo ativo sem CRLV escolhido", Boolean(caso), JSON.stringify(caso));
  if (!caso) throw new Error("nenhum protocolo candidato");

  /* semear CRLV no depÃ³sito */
  const seed = await page.evaluate(
    async ({ tag, placa }) => {
      const pdf = new Blob(
        [new TextEncoder().encode(`%PDF-1.4\n%${tag}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`)],
        { type: "application/pdf" }
      );
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("dk_documentos_blobs_v1", 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains("files")) r.result.createObjectStore("files", { keyPath: "id" });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const id = `doc_${Date.now()}_${tag.toLowerCase()}`;
      const nome = `CRLV-${tag}-${placa}.pdf`;
      await new Promise((res, rej) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put({ id, blob: pdf, nomeArquivo: nome, mimeType: "application/pdf" });
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
      const raw = localStorage.getItem("dk_documentos_deposito_v1");
      const dep = raw ? JSON.parse(raw) : { crlv: [], contrato: [], multa: [] };
      dep.crlv = Array.isArray(dep.crlv) ? dep.crlv : [];
      dep.crlv.push({ id, chave: placa, nomeArquivo: nome, mimeType: "application/pdf", tamanho: pdf.size, criadoEm: new Date().toISOString() });
      localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
      return { ok: true, id, nome };
    },
    { tag: TAG, placa: caso.placa }
  );
  record("CRLV semeado no depÃ³sito", seed.ok === true, seed.nome);

  /* ecrÃ£ cadastro de locaÃ§Ã£o */
  await page.click("#btn-locadora-operacao");
  await page.waitForTimeout(1200);
  await page.click("#btn-operacao-cadastro-locacao");
  await page.waitForTimeout(1000);
  const cpfFmt = `${caso.cpfDig.slice(0, 3)}.${caso.cpfDig.slice(3, 6)}.${caso.cpfDig.slice(6, 9)}-${caso.cpfDig.slice(9)}`;
  await page.fill("#operacaoLocacaoCpf", cpfFmt);
  await page.dispatchEvent("#operacaoLocacaoCpf", "input");
  await page.waitForTimeout(1500);
  const protoSel = await page.evaluate((proto) => {
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const opt = Array.from(sel?.options || []).find((o) => String(o.value).includes(proto));
    if (!opt) return { ok: false, opcoes: Array.from(sel?.options || []).map((o) => o.value).slice(0, 6) };
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }, caso.proto);
  record("protocolo selecionado no cadastro de locaÃ§Ã£o", protoSel.ok === true, JSON.stringify(protoSel).slice(0, 140));
  await page.waitForTimeout(2000);

  /* pesquisar e importar CRLV */
  await page.fill("#operacaoLocacaoDocBuscaCrlv", TAG);
  await page.dispatchEvent("#operacaoLocacaoDocBuscaCrlv", "input");
  await page.waitForTimeout(500);
  await page.click("#operacaoLocacaoDocBuscarCrlvBtn");
  await page.waitForTimeout(1500);
  const imp = await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLocacaoDocumentosListaCrlv");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
    return {
      tem: Boolean(li),
      txt: (ul?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
      msg: document.getElementById("operacaoLocacaoDocumentosMsg")?.textContent?.trim().slice(0, 120) || "",
    };
  }, TAG);
  record("CRLV importado para a vaga", imp.tem === true, imp.tem ? "" : `lista=Â«${imp.txt}Â» msg=Â«${imp.msg}Â»`);

  /* Confirmar */
  await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLocacaoDocumentosListaCrlv");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
    li?.querySelector("[data-loc-doc-confirmar]")?.click();
  }, TAG);
  await page.waitForTimeout(1200);

  /* Enviar para o cliente */
  const antesEnvio = await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLocacaoDocumentosListaCrlv");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
    const b = li?.querySelector("[data-loc-doc-enviar]");
    return { existe: Boolean(b), ativo: b ? !b.disabled : false, label: b?.textContent?.trim() || "" };
  }, TAG);
  record("botÃ£o Enviar ativo apÃ³s Confirmar", antesEnvio.existe && antesEnvio.ativo, JSON.stringify(antesEnvio));

  await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLocacaoDocumentosListaCrlv");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
    li?.querySelector("[data-loc-doc-enviar]")?.click();
  }, TAG);

  const envio = await page
    .waitForFunction(
      (tag) => {
        const ul = document.getElementById("operacaoLocacaoDocumentosListaCrlv");
        const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
        const b = li?.querySelector("[data-loc-doc-enviar]");
        if (b && b.textContent.trim() === "Enviado" && b.disabled) return { done: true, ok: true };
        const msg = document.getElementById("operacaoLocacaoDocumentosMsg")?.textContent || "";
        if (/falha|erro/i.test(msg)) return { done: true, ok: false, msg };
        return false;
      },
      TAG,
      { timeout: 90000 }
    )
    .then((h) => h.jsonValue())
    .catch(() => ({ done: false, ok: false, msg: "timeout 90s" }));
  const msgEnvio = await page.evaluate(() => document.getElementById("operacaoLocacaoDocumentosMsg")?.textContent?.trim().slice(0, 160) || "");
  record("CRLV enviado ao cliente (nuvem confirmada)", envio.ok === true, `${msgEnvio}`);

  record("sem erros de pÃ¡gina (portal)", pageErrors.length === 0, pageErrors.join(" Â· ").slice(0, 200) || "0 erros");

  /* app cliente recebe */
  const ctx2 = await browser.newContext({
    geolocation: { latitude: -9.39, longitude: -40.5 },
    permissions: ["geolocation"],
  });
  const app = await ctx2.newPage();
  await app.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await app.evaluate(({ cpf, proto }) => {
    localStorage.setItem("dk_sessao_cliente_app", JSON.stringify({ cpf, nome: "Teste", loginEm: new Date().toISOString() }));
    sessionStorage.setItem("dk_cliente_app_gate", JSON.stringify({ cpf, proto, ok: true, ts: Date.now() }));
  }, { cpf: caso.cpfDig, proto: caso.proto });
  await app.goto(`${BASE}cliente?adminPreview=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await app.waitForTimeout(2500);
  const pullRes = await app.evaluate(async () => {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge !== "function") return { ok: false, reason: "no_pull_fn" };
    return window.__DK_pullCloudSnapshotSilentMerge({ force: true });
  });
  const appState = await app.evaluate(
    ({ cpfDig, proto, tag }) => {
      const dig = (s) => String(s ?? "").replace(/\D/g, "");
      const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      let docs = [];
      try { docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]"); } catch { docs = []; }
      const crlv = docs.filter(
        (d) =>
          norm(d.numeroContrato) === norm(proto) &&
          dig(d.cpf).slice(0, 11) === cpfDig &&
          d.enviadoCliente === true &&
          d.excluido !== true &&
          /crlv/i.test(String(d.tipo || d.origemDepositoCategoria || d.nome || ""))
      );
      const nosso = crlv.find((d) => String(d.nome || "").includes(tag));
      return {
        crlv: crlv.length,
        nosso: Boolean(nosso),
        b64: nosso ? String(nosso.arquivoBase64 || "").length : 0,
        countFn:
          typeof window.__DK_clienteDocsLocacaoCount === "function"
            ? window.__DK_clienteDocsLocacaoCount(proto, cpfDig, "crlv")
            : -1,
      };
    },
    { cpfDig: caso.cpfDig, proto: caso.proto, tag: TAG }
  );
  record(
    "app cliente recebe o CRLV novo",
    pullRes?.ok === true && appState.nosso && appState.b64 > 50 && appState.countFn >= 1,
    `pull=${pullRes?.ok} src=${pullRes?.source || "-"} crlv=${appState.crlv} b64=${appState.b64} count=${appState.countFn}`
  );
  await ctx2.close();

  /* limpeza */
  const cleanup = await page.evaluate(
    async ({ depId }) => {
      try {
        const docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]");
        const now = Date.now();
        localStorage.setItem(
          "dk_locacao_documentos_v1",
          JSON.stringify(
            docs.map((d) =>
              String(d.origemDepositoId || "") === depId
                ? { ...d, excluido: true, excluidoEm: now, arquivoBase64: "", enviadoCliente: false }
                : d
            )
          )
        );
      } catch { /* ignore */ }
      try {
        const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null");
        if (dep?.crlv) {
          dep.crlv = dep.crlv.filter((e) => String(e.id) !== depId);
          localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
        }
      } catch { /* ignore */ }
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
    { depId: seed.id }
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
