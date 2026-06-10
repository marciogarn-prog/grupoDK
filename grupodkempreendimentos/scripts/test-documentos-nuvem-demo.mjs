/**
 * E2E demo: depósito de documentos com ficheiros na NUVEM.
 * 1. Browser A (operador 1): deposita um CRLV → ficheiro sobe para a nuvem.
 * 2. Backfill: ficheiro antigo (só local, sem flag nuvem) é enviado por __DK_documentosSyncNuvem.
 * 3. Browser B (operador 2, computador limpo): abre o mesmo ficheiro a partir da nuvem.
 * Limpeza no fim (depósito + linhas docblob na nuvem).
 * node grupodkempreendimentos/scripts/test-documentos-nuvem-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const SB = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SBK = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const TAG = `E2ENUVEM${Date.now()}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SBK,
      Authorization: `Bearer ${SBK}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  return res;
}

async function loginAdmin(page) {
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
  await page.waitForTimeout(2000);
}

const browser = await chromium.launch({ headless: true });
const idsLimpar = [];
try {
  /* ---------- Browser A: operador que deposita ---------- */
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  pageA.on("dialog", (d) => d.accept().catch(() => {}));
  await loginAdmin(pageA);
  record("login operador A (demo)", true);

  /* 1. depositar CRLV pelo input do depósito */
  const nomePdf = `${TAG}AAA1B23.pdf`;
  await pageA.setInputFiles("#documentosInputCrlv", {
    name: nomePdf,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4\n%${TAG}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`),
  });
  const depositado = await pageA
    .waitForFunction(
      (nome) => {
        try {
          const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null");
          const e = (dep?.crlv || []).find((r) => r.nomeArquivo === nome);
          return e ? { id: e.id, nuvem: e.nuvem === true } : false;
        } catch {
          return false;
        }
      },
      nomePdf,
      { timeout: 60000 }
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  record("CRLV depositado com flag nuvem", Boolean(depositado?.nuvem), JSON.stringify(depositado));
  if (!depositado?.id) throw new Error("depósito falhou");
  idsLimpar.push(depositado.id);

  /* 2. linha docblob existe na nuvem */
  const rowRes = await sbFetch(
    `dk_cloud_snapshots?label=eq.${encodeURIComponent(`docblob:demo:${depositado.id}`)}&select=payload`
  );
  const rows = rowRes.ok ? await rowRes.json() : [];
  const payload = rows[0]?.payload || null;
  record(
    "ficheiro guardado na nuvem (linha docblob)",
    Boolean(payload?.b64) && payload.nomeArquivo === nomePdf,
    `b64len=${String(payload?.b64 || "").length}`
  );

  /* 3. backfill: ficheiro antigo só local (sem flag nuvem) sobe via sync */
  const antigo = await pageA.evaluate(async (tag) => {
    const pdf = new Blob([new TextEncoder().encode(`%PDF-1.4\n%${tag}-ANTIGO\n%%EOF`)], {
      type: "application/pdf",
    });
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("dk_documentos_blobs_v1", 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains("files")) r.result.createObjectStore("files", { keyPath: "id" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const id = `doc_${Date.now()}_${tag.toLowerCase()}old`;
    const nome = `${tag}-ANTIGO-BBB2C34.pdf`;
    await new Promise((res, rej) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put({ id, blob: pdf, nomeArquivo: nome, mimeType: "application/pdf" });
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
    const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null") || { crlv: [], contrato: [], multa: [] };
    dep.crlv.push({ id, chave: "BBB2C34", nomeArquivo: nome, mimeType: "application/pdf", tamanho: pdf.size, criadoEm: new Date().toISOString() });
    localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
    const r = await window.__DK_documentosSyncNuvem();
    const depDepois = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null");
    const e = (depDepois?.crlv || []).find((x) => x.id === id);
    return { id, enviados: r.enviados, pendentes: r.pendentes, nuvem: e?.nuvem === true };
  }, TAG);
  record(
    "backfill envia ficheiro antigo para a nuvem",
    antigo.enviados >= 1 && antigo.nuvem === true,
    JSON.stringify(antigo)
  );
  idsLimpar.push(antigo.id);

  /* resumo mostra contagem na nuvem */
  await pageA.evaluate(() => window.__DK_documentosOnShow && window.__DK_documentosOnShow());
  await pageA.waitForTimeout(2500);
  const resumo = await pageA.evaluate(() => document.getElementById("documentosResumoCrlv")?.textContent || "");
  record("resumo CRLV mostra contagem na nuvem", /na nuvem/.test(resumo), resumo.slice(0, 120));

  await ctxA.close();

  /* ---------- Browser B: outro operador, computador limpo ---------- */
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await loginAdmin(pageB);
  record("login operador B (computador limpo)", true);

  const aberturas = await pageB.evaluate(
    async ({ idNovo, idAntigo }) => {
      const semLocal = await new Promise((res) => {
        const r = indexedDB.open("dk_documentos_blobs_v1", 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains("files")) r.result.createObjectStore("files", { keyPath: "id" });
        };
        r.onsuccess = () => {
          const tx = r.result.transaction("files", "readonly");
          const g = tx.objectStore("files").count();
          g.onsuccess = () => res(g.result === 0);
          g.onerror = () => res(true);
        };
        r.onerror = () => res(true);
      });
      const abrir = async (id) => {
        const row = await window.__DK_documentosObterBlobDoc("crlv", id);
        return row?.blob ? { ok: true, size: row.blob.size, nome: row.nomeArquivo } : { ok: false };
      };
      return { semLocal, novo: await abrir(idNovo), antigo: await abrir(idAntigo) };
    },
    { idNovo: depositado.id, idAntigo: antigo.id }
  );
  record("computador B começa sem ficheiros locais", aberturas.semLocal === true);
  record(
    "operador B abre CRLV novo a partir da nuvem",
    aberturas.novo.ok === true && aberturas.novo.size > 20,
    JSON.stringify(aberturas.novo)
  );
  record(
    "operador B abre CRLV antigo (backfill) a partir da nuvem",
    aberturas.antigo.ok === true && aberturas.antigo.size > 10,
    JSON.stringify(aberturas.antigo)
  );

  /* cache local após abrir da nuvem */
  const cacheado = await pageB.evaluate(async (id) => {
    return new Promise((res) => {
      const r = indexedDB.open("dk_documentos_blobs_v1", 1);
      r.onsuccess = () => {
        const tx = r.result.transaction("files", "readonly");
        const g = tx.objectStore("files").get(id);
        g.onsuccess = () => res(Boolean(g.result?.blob));
        g.onerror = () => res(false);
      };
      r.onerror = () => res(false);
    });
  }, depositado.id);
  record("ficheiro fica em cache local após abrir da nuvem", cacheado === true);

  /* limpeza no browser B: remover entradas do depósito e push */
  await pageB.evaluate(async (ids) => {
    const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null");
    if (dep?.crlv) {
      dep.crlv = dep.crlv.filter((e) => !ids.includes(String(e.id)));
      localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      await window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => null);
    }
  }, idsLimpar);
  await ctxB.close();
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  /* limpeza nuvem: apagar linhas docblob de teste */
  for (const id of idsLimpar) {
    await sbFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(`docblob:demo:${id}`)}`, {
      method: "DELETE",
    }).catch(() => null);
  }
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
