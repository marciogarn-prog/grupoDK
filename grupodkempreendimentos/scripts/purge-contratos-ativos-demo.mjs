/**
 * Apaga contratos ATIVOS específicos no ambiente demo (tombstone + blobs).
 * node grupodkempreendimentos/scripts/purge-contratos-ativos-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CHAVES = ["2025102801", "2025111301", "2025111403", "2026021301"];

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
  await page.waitForTimeout(4000);

  const antes = await page.evaluate((chaves) => {
    const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null") || {};
    const arr = Array.isArray(dep.contrato) ? dep.contrato : [];
    return arr
      .filter((e) => chaves.includes(String(e.chave)) && e.excluido !== true)
      .map((e) => ({ id: e.id, chave: e.chave, nome: e.nomeArquivo }));
  }, CHAVES);
  console.log("Contratos a apagar:", JSON.stringify(antes, null, 2));
  if (!antes.length) {
    console.log("Nenhum contrato ativo encontrado — já limpo.");
    process.exit(0);
  }

  const resultado = await page.evaluate(async (chaves) => {
    const readMeta = (name) => {
      const el = document.querySelector(`meta[name="${name}"]`);
      return el ? String(el.getAttribute("content") || "").trim() : "";
    };
    const url = readMeta("dk-supabase-url").replace(/\/$/, "");
    const key = readMeta("dk-supabase-anon-key");
    const channel = window.__DK_DEPLOY_CHANNEL__ === "demo" ? "demo" : "default";
    const docBlobLabel = (id) => `docblob:${channel}:${String(id)}`;

    const dep = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null") || {
      crlv: [],
      contrato: [],
      multa: [],
    };
    dep.contrato = Array.isArray(dep.contrato) ? dep.contrato : [];
    const ids = [];
    const now = new Date().toISOString();
    dep.contrato = dep.contrato.map((e) => {
      if (chaves.includes(String(e.chave)) && e.excluido !== true) {
        ids.push(String(e.id));
        return { ...e, excluido: true, excluidoEm: now };
      }
      return e;
    });
    localStorage.setItem("dk_documentos_deposito_v1", JSON.stringify(dep));

    const blobDeletes = [];
    if (url && key) {
      for (const id of ids) {
        const res = await fetch(
          `${url}/rest/v1/dk_cloud_snapshots?label=eq.${encodeURIComponent(docBlobLabel(id))}`,
          { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` } }
        );
        blobDeletes.push({ id, ok: res.ok });
      }
    }

    let pushOk = false;
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      const r = await window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => null);
      pushOk = Boolean(r?.ok ?? r);
    }

    const restantes = dep.contrato.filter(
      (e) => chaves.includes(String(e.chave)) && e.excluido !== true
    ).length;
    const ativos = dep.contrato.filter((e) => e.excluido !== true).length;

    return { ids, blobDeletes, pushOk, restantes, ativosContrato: ativos };
  }, CHAVES);

  console.log("Resultado:", JSON.stringify(resultado, null, 2));

  await page.waitForTimeout(3000);

  const nuvem = await fetch(`${BASE}api/dk-cloud-snapshot?channel=demo`)
    .then((r) => r.json())
    .catch(() => null);
  const depNuvem =
    typeof nuvem?.payload?.dk_documentos_deposito_v1 === "string"
      ? JSON.parse(nuvem.payload.dk_documentos_deposito_v1)
      : nuvem?.payload?.dk_documentos_deposito_v1;
  const aindaVisiveis = (Array.isArray(depNuvem?.contrato) ? depNuvem.contrato : []).filter(
    (e) => CHAVES.includes(String(e.chave)) && e.excluido !== true
  );
  console.log(
    "Verificação nuvem:",
    aindaVisiveis.length === 0 ? "OK — 0 contratos visíveis" : `FALHA — ${aindaVisiveis.length} restantes`
  );
  if (aindaVisiveis.length) {
    console.log(JSON.stringify(aindaVisiveis.map((e) => ({ id: e.id, chave: e.chave })), null, 2));
    process.exit(1);
  }
  console.log("Limpeza concluída.");
} catch (e) {
  console.error("Erro:", e?.message || e);
  process.exit(1);
} finally {
  await browser.close();
}
