/**
 * E2E demo: botão «Enviar CRLVs aos clientes (todos)» no depósito Documentos.
 * Semeia 2 CRLVs (com blob) para 2 locações ativas sem CRLV, corre a distribuição
 * em massa via UI, valida envio à nuvem + app cliente, e limpa tudo no fim.
 * node grupodkempreendimentos/scripts/test-crlv-massa-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const TAG = `E2EMASSA${Date.now()}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));

let casos = [];
let seedIds = [];
try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    localStorage.removeItem("dk_instalacao_limpa_v1");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => {
    const p = document.getElementById("panel-logado");
    return p && !p.classList.contains("hidden");
  }, { timeout: 45000 });
  record("login admin portal demo", true);
  await page.waitForTimeout(2500);

  /* botão existe */
  const temBtn = await page.evaluate(() => Boolean(document.getElementById("documentosCrlvEnviarTodosBtn")));
  record("botão de envio em massa presente", temBtn);

  /* 2 locações ativas sem CRLV */
  casos = await page.evaluate(() => {
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
    const out = [];
    for (const l of locs) {
      const nc = norm(l.numeroContrato);
      const cpf = dig(l.cpf).slice(0, 11);
      const placa = String(l.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const ativa = !String(l.fim || l.dataFim || "").trim();
      if (!nc || cpf.length !== 11 || placa.length < 6 || !ativa || comCrlv.has(nc)) continue;
      if (out.some((o) => o.nc === nc || o.placa === placa)) continue;
      out.push({ nc, cpf, placa });
      if (out.length >= 2) break;
    }
    return out;
  });
  record("2 locações ativas sem CRLV escolhidas", casos.length === 2, JSON.stringify(casos));
  if (casos.length < 2) throw new Error("sem casos suficientes");

  /* semear blobs no depósito para as 2 placas */
  seedIds = await page.evaluate(
    async ({ tag, placas }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("dk_documentos_blobs_v1", 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains("files")) r.result.createObjectStore("files", { keyPath: "id" });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const raw = localStorage.getItem("dk_documentos_deposito_v1");
      const dep = raw ? JSON.parse(raw) : { crlv: [], contrato: [], multa: [] };
      dep.crlv = Array.isArray(dep.crlv) ? dep.crlv : [];
      const ids = [];
      for (const placa of placas) {
        const pdf = new Blob(
          [new TextEncoder().encode(`%PDF-1.4\n%${tag}-${placa}\n1 0 obj<</Type/Catalog>>endobj\n%%EOF`)],
          { type: "application/pdf" }
        );
        const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const nome = `CRLVDigital_${placa}_${tag}.pdf`;
        await new Promise((res, rej) => {
          const tx = db.transaction("files", "readwrite");
          tx.objectStore("files").put({ id, blob: pdf, nomeArquivo: nome, mimeType: "application/pdf" });
          tx.oncomplete = () => res(true);
          tx.onerror = () => rej(tx.error);
        });
        dep.crlv.push({ id, chave: placa, nomeArquivo: nome, mimeType: "application/pdf", tamanho: pdf.size, criadoEm: new Date().toISOString() });
        ids.push(id);
      }
      localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
      return ids;
    },
    { tag: TAG, placas: casos.map((c) => c.placa) }
  );
  record("2 CRLVs semeados no depósito (com blob)", seedIds.length === 2);

  /* clicar no botão (diálogo aceite automaticamente) */
  await page.evaluate(() => document.getElementById("documentosCrlvEnviarTodosBtn").click());
  const fim = await page
    .waitForFunction(
      () => {
        const t = document.getElementById("documentosCrlvEnviarTodosMsg")?.textContent || "";
        return t.includes("Distribuição concluída") ? t : false;
      },
      { timeout: 420000 }
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  record("distribuição concluída", Boolean(fim), String(fim || "timeout").slice(0, 220));

  const resumo = await page.evaluate((tagNomes) => {
    let docs = [];
    try { docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]"); } catch { docs = []; }
    const nossos = docs.filter((d) => String(d.nome || "").includes(tagNomes) && d.excluido !== true);
    return nossos.map((d) => ({
      nc: d.numeroContrato,
      enviado: d.enviadoCliente === true,
      confirmado: d.conferidoOperador === true,
      b64: String(d.arquivoBase64 || "").length,
    }));
  }, TAG);
  record(
    "2 CRLVs enviados aos clientes",
    resumo.length === 2 && resumo.every((r) => r.enviado && r.confirmado && r.b64 > 30),
    JSON.stringify(resumo)
  );

  /* app cliente do 1.º caso recebe */
  const ctx2 = await browser.newContext();
  const app = await ctx2.newPage();
  await app.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await app.evaluate(({ cpf }) => {
    localStorage.setItem("dk_sessao_cliente_app", JSON.stringify({ cpf, nome: "Teste", loginEm: new Date().toISOString() }));
  }, { cpf: casos[0].cpf });
  await app.goto(`${BASE}cliente?adminPreview=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await app.waitForTimeout(2500);
  const pullRes = await app.evaluate(async () => {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge !== "function") return { ok: false };
    return window.__DK_pullCloudSnapshotSilentMerge({ force: true });
  });
  const appState = await app.evaluate(
    ({ cpfDig, proto, tag }) => {
      const dig = (s) => String(s ?? "").replace(/\D/g, "");
      const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      let docs = [];
      try { docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]"); } catch { docs = []; }
      const nosso = docs.find(
        (d) =>
          norm(d.numeroContrato) === norm(proto) &&
          dig(d.cpf).slice(0, 11) === cpfDig &&
          d.enviadoCliente === true &&
          d.excluido !== true &&
          String(d.nome || "").includes(tag)
      );
      return { tem: Boolean(nosso), b64: nosso ? String(nosso.arquivoBase64 || "").length : 0 };
    },
    { cpfDig: casos[0].cpf, proto: casos[0].nc, tag: TAG }
  );
  record(
    "app cliente recebe CRLV da distribuição",
    pullRes?.ok === true && appState.tem && appState.b64 > 30,
    `pull=${pullRes?.ok} src=${pullRes?.source || "-"} b64=${appState.b64}`
  );
  await ctx2.close();

  /* limpeza: tombstone dos docs + remoção das entradas do depósito + push */
  const cleanup = await page.evaluate(
    async ({ ids, tag }) => {
      try {
        const docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]");
        const now = Date.now();
        localStorage.setItem(
          "dk_locacao_documentos_v1",
          JSON.stringify(
            docs.map((d) =>
              ids.includes(String(d.origemDepositoId || "")) || String(d.nome || "").includes(tag)
                ? { ...d, excluido: true, excluidoEm: now, arquivoBase64: "", enviadoCliente: false }
                : d
            )
          )
        );
      } catch { /* ignore */ }
      try {
        const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null");
        if (dep?.crlv) {
          dep.crlv = dep.crlv.filter((e) => !ids.includes(String(e.id)));
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
    { ids: seedIds, tag: TAG }
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
