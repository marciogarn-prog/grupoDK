/**
 * E2E demo: fluxo COMPLETO de lançamento de multa
 * depósito → pesquisa → importar → Confirmar → Enviar ao cliente → Cadastrar multa
 * → histórico → app cliente «Ver multas» → limpeza.
 * node grupodkempreendimentos/scripts/test-multa-lancamento-completo-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CASO = { cpf: "104.554.034-06", cpfDig: "10455403406", proto: "2025111301", placa: "UHK6J56" };
const TAG = `E2EFLX${Date.now()}`;

const results = [];
const pageErrors = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));
page.on("pageerror", (e) => pageErrors.push(String(e?.message || e).slice(0, 160)));

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

  /* 1. Semear multa no depósito Documentos */
  const seed = await page.evaluate(
    async ({ tag, chave }) => {
      const pdf = new Blob(
        [new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF")],
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
      const nome = `MULTA-${tag}.pdf`;
      await new Promise((res, rej) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put({ id, blob: pdf, nomeArquivo: nome, mimeType: "application/pdf" });
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
      const raw = localStorage.getItem("dk_documentos_deposito_v1");
      const dep = raw ? JSON.parse(raw) : { crlv: [], contrato: [], multa: [] };
      dep.multa = Array.isArray(dep.multa) ? dep.multa : [];
      dep.multa.push({ id, chave, nomeArquivo: nome, mimeType: "application/pdf", tamanho: pdf.size, criadoEm: new Date().toISOString() });
      localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));
      return { ok: true, id, nome };
    },
    { tag: TAG, chave: `${CASO.placa}-${CASO.cpfDig}` }
  );
  record("multa semeada no depósito", seed.ok === true, seed.nome);

  /* 2. Ecrã Lançamento de multas + pesquisa */
  await page.click("#btn-locadora-operacao");
  await page.waitForTimeout(1000);
  await page.click("#btn-operacao-lancamento-multas");
  await page.waitForTimeout(800);
  await page.fill("#operacaoLancMultasCpf", CASO.cpf);
  await page.dispatchEvent("#operacaoLancMultasCpf", "input");
  await page.waitForTimeout(500);
  await page.click("#operacaoLancMultasConfirmarPesquisaBtn");
  await page.waitForTimeout(1500);
  const protoSel = await page.evaluate((proto) => {
    const sel = document.getElementById("operacaoLancMultasProtocoloSelect");
    const opt = Array.from(sel?.options || []).find((o) => String(o.value).includes(proto));
    if (!opt) return { ok: false, opcoes: Array.from(sel?.options || []).map((o) => o.value).slice(0, 6) };
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }, CASO.proto);
  record("pesquisa confirma protocolo", protoSel.ok === true, JSON.stringify(protoSel).slice(0, 120));
  await page.waitForTimeout(1200);

  /* 3. Importar via pesquisa */
  await page.fill("#operacaoLancMultasDocBusca", TAG);
  await page.dispatchEvent("#operacaoLancMultasDocBusca", "input");
  await page.waitForTimeout(500);
  await page.click("#operacaoLancMultasDocImportBtn");
  await page.waitForTimeout(1500);
  const imp = await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLancMultasDocumentosLista");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
    return { tem: Boolean(li) };
  }, TAG);
  record("multa importada para o protocolo", imp.tem === true);

  /* 4. Confirmar (operador) */
  await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLancMultasDocumentosLista");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
    li?.querySelector("[data-loc-doc-confirmar]")?.click();
  }, TAG);
  await page.waitForTimeout(1200);
  const conf = await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLancMultasDocumentosLista");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
    const enviarBtn = li?.querySelector("[data-loc-doc-enviar]");
    return {
      temEnviar: Boolean(enviarBtn),
      enviarAtivo: enviarBtn ? !enviarBtn.disabled : false,
      txt: (li?.textContent || "").replace(/\s+/g, " ").slice(0, 160),
    };
  }, TAG);
  record("confirmado pelo operador (Enviar ativo)", conf.temEnviar && conf.enviarAtivo, conf.txt.slice(0, 120));

  /* 5. Enviar para o cliente */
  await page.evaluate((tag) => {
    const ul = document.getElementById("operacaoLancMultasDocumentosLista");
    const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
    li?.querySelector("[data-loc-doc-enviar]")?.click();
  }, TAG);
  const enviado = await page
    .waitForFunction(
      (tag) => {
        const ul = document.getElementById("operacaoLancMultasDocumentosLista");
        const li = Array.from(ul?.querySelectorAll("li") || []).find((el) => el.textContent.includes(tag));
        const b = li?.querySelector("[data-loc-doc-enviar]");
        return b && b.textContent.trim() === "Enviado" && b.disabled;
      },
      TAG,
      { timeout: 60000 }
    )
    .then(() => true)
    .catch(() => false);
  record("multa enviada ao cliente (nuvem)", enviado);

  /* 6. Cadastrar a multa (dados + parcelas) */
  const hoje = new Date();
  const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const prox = new Date(hoje.getTime() + 7 * 86400000);
  await page.fill("#operacaoLancMultasDataMulta", fmt(hoje));
  await page.fill("#operacaoLancMultasCodMulta", TAG);
  await page.fill("#operacaoLancMultasDescricao", "Multa E2E - excesso de velocidade");
  await page.fill("#operacaoLancMultasValorMulta", "195,23");
  await page.dispatchEvent("#operacaoLancMultasValorMulta", "input");
  await page.selectOption("#operacaoLancMultasQtdParcelas", "2");
  await page.fill("#operacaoLancMultasDataPrimeiraParcela", fmt(prox));
  await page.dispatchEvent("#operacaoLancMultasDataPrimeiraParcela", "input");
  await page.waitForTimeout(400);
  await page.click("#operacaoLancMultasCadastrarBtn");
  await page.waitForTimeout(800);
  const modalConfirm = await page.evaluate(() => {
    const modal = document.getElementById("portalLancAluguelConfirmModal");
    if (modal && !modal.classList.contains("hidden")) {
      document.getElementById("portalLancAluguelConfirmSimBtn")?.click();
      return "modal";
    }
    return "sem_modal";
  });
  await page.waitForTimeout(2000);
  const cadMsg = await page.evaluate(() => document.getElementById("operacaoLancMultasInlineMsg")?.textContent?.trim() || "");
  const registado = await page.evaluate(
    ({ cpfDig, proto, tag }) => {
      try {
        const locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
        const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        const dig = (s) => String(s ?? "").replace(/\D/g, "");
        const loc = locs.find((l) => dig(l.cpf).slice(0, 11) === cpfDig && norm(l.numeroContrato) === norm(proto));
        const multas = Array.isArray(loc?.portalMultasTransito) ? loc.portalMultasTransito : [];
        const m = multas.find((x) => String(x.codMulta || x.codigoMulta || "").includes(tag));
        return {
          encontrada: Boolean(m),
          parcelas: m?.parcelas?.length || 0,
          docId: m?.locacaoDocumentoId || "",
          totalMultas: multas.length,
        };
      } catch (e) {
        return { encontrada: false, erro: String(e).slice(0, 80) };
      }
    },
    { cpfDig: CASO.cpfDig, proto: CASO.proto, tag: TAG }
  );
  record(
    "multa cadastrada com parcelas e doc vinculado",
    registado.encontrada && registado.parcelas === 2 && Boolean(registado.docId),
    `confirm=${modalConfirm} msg=«${cadMsg.slice(0, 60)}» parcelas=${registado.parcelas} doc=${registado.docId ? "sim" : "não"}`
  );

  /* 7. Histórico mostra a multa */
  const hist = await page.evaluate((tag) => {
    const h = document.getElementById("operacaoLancMultasHistorico");
    const txt = (h?.textContent || "").replace(/\s+/g, " ");
    return { visivel: Boolean(h && !h.classList.contains("hidden")), tem: txt.includes(tag), txt: txt.slice(0, 160) };
  }, TAG);
  record("histórico de multas mostra o registo", hist.tem === true, hist.txt.slice(0, 120));

  record("sem erros de página (portal)", pageErrors.length === 0, pageErrors.join(" · ").slice(0, 160) || "0 erros");

  /* 8. App cliente: multa visível em «Ver multas» */
  const ctx2 = await browser.newContext({
    geolocation: { latitude: -9.39, longitude: -40.5 },
    permissions: ["geolocation"],
  });
  const app = await ctx2.newPage();
  const appErrors = [];
  app.on("pageerror", (e) => appErrors.push(String(e?.message || e).slice(0, 160)));
  await app.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await app.evaluate(({ cpf, proto }) => {
    localStorage.setItem("dk_sessao_cliente_app", JSON.stringify({ cpf, nome: "Teste", loginEm: new Date().toISOString() }));
    sessionStorage.setItem("dk_cliente_app_gate", JSON.stringify({ cpf, proto, ok: true, ts: Date.now() }));
  }, { cpf: CASO.cpfDig, proto: CASO.proto });
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
      try {
        docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]");
      } catch {
        docs = [];
      }
      const multas = docs.filter(
        (d) =>
          norm(d.numeroContrato) === norm(proto) &&
          dig(d.cpf).slice(0, 11) === cpfDig &&
          d.enviadoCliente === true &&
          d.excluido !== true &&
          /multa/i.test(String(d.tipo || d.origemDepositoCategoria || d.nome || ""))
      );
      const nossa = multas.find((d) => String(d.nome || "").includes(tag));
      return {
        multas: multas.length,
        nossa: Boolean(nossa),
        b64: nossa ? String(nossa.arquivoBase64 || "").length : 0,
        countFn:
          typeof window.__DK_clienteDocsLocacaoCount === "function"
            ? window.__DK_clienteDocsLocacaoCount(proto, cpfDig, "multa")
            : -1,
      };
    },
    { cpfDig: CASO.cpfDig, proto: CASO.proto, tag: TAG }
  );
  record(
    "app cliente recebe a multa (Ver multas)",
    pullRes?.ok === true && appState.nossa && appState.b64 > 50 && appState.countFn >= 1,
    `pull=${pullRes?.ok} multas=${appState.multas} b64=${appState.b64} count=${appState.countFn}`
  );
  record("sem erros de página (app cliente)", appErrors.length === 0, appErrors.join(" · ").slice(0, 160) || "0 erros");
  await ctx2.close();

  /* 9. Limpeza: remover registo da multa, tombstone do doc, depósito e push */
  const cleanup = await page.evaluate(
    async ({ cpfDig, proto, tag, depId }) => {
      const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const dig = (s) => String(s ?? "").replace(/\D/g, "");
      try {
        const locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
        const loc = locs.find((l) => dig(l.cpf).slice(0, 11) === cpfDig && norm(l.numeroContrato) === norm(proto));
        if (loc && Array.isArray(loc.portalMultasTransito)) {
          loc.portalMultasTransito = loc.portalMultasTransito.filter(
            (m) => !String(m.codMulta || m.codigoMulta || "").includes(tag)
          );
          loc.updatedAt = Date.now();
          localStorage.setItem("dk_locacoes_cadastro", JSON.stringify(locs));
        }
      } catch {
        /* ignore */
      }
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
      } catch {
        /* ignore */
      }
      try {
        const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null");
        if (dep?.multa) {
          dep.multa = dep.multa.filter((e) => String(e.id) !== depId);
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
    { cpfDig: CASO.cpfDig, proto: CASO.proto, tag: TAG, depId: seed.id }
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
