/**
 * Validação Fase 1A — sem alterar dados de negócio além de um POST eco do snapshot (merge no-shrink).
 * node grupodkempreendimentos/scripts/test-fase-1a-validacao.mjs
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BACKUP_DIR = path.join(ROOT, "_backup-fase-1a-20260909-214008");
const BASE = (process.env.DK_PORTAL_BASE || "https://grupodkempreendimentos.com.br/").replace(/\/?$/, "/");
const SB_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SB_ANON = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail || "") });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").toUpperCase();
}

function hasDkPayload(j) {
  if (!j || typeof j !== "object") return false;
  if (Array.isArray(j.clientes) && j.clientes.length) return true;
  if (Array.isArray(j.payload?.dk_clientes_cadastro) && j.payload.dk_clientes_cadastro.length) return true;
  if (Array.isArray(j.itens) && j.itens.length) return true;
  if (Array.isArray(j.clientes_cadastro) && j.clientes_cadastro.length) return true;
  const t = JSON.stringify(j);
  return /dk_clientes_cadastro|dk_locacoes_cadastro|dk_veiculos_cadastro/.test(t) && t.length > 400;
}

async function req(pathOrUrl, opts = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  const r = await fetch(url, { cache: "no-store", ...opts });
  const text = await r.text();
  let j = {};
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    j = { _raw: text.slice(0, 200) };
  }
  return { status: r.status, j, text, len: text.length };
}

function forbidden(s) {
  return s === 401 || s === 403;
}

(async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(BACKUP_DIR, "MANIFEST.json"), "utf8").replace(/^\uFEFF/, "")
  );
  const expected = Object.fromEntries(manifest.files.map((f) => [f.name, f]));
  const snapHash = sha256File(path.join(BACKUP_DIR, "snapshot.json"));
  const cliHash = sha256File(path.join(BACKUP_DIR, "clientes.json"));
  const veiHash = sha256File(path.join(BACKUP_DIR, "veiculos.json"));
  const locHash = sha256File(path.join(BACKUP_DIR, "locacoes.json"));
  record(
    "backup íntegro (SHA-256)",
    snapHash === expected.snapshot.sha256 &&
      cliHash === expected.clientes.sha256 &&
      veiHash === expected.veiculos.sha256 &&
      locHash === expected.locacoes.sha256,
    `snapshot=${snapHash === expected.snapshot.sha256}`
  );
  const snapBackup = JSON.parse(
    fs.readFileSync(path.join(BACKUP_DIR, "snapshot.json"), "utf8").replace(/^\uFEFF/, "")
  );
  const pB = snapBackup.payload || {};
  const bC = (pB.dk_clientes_cadastro || []).length;
  const bV = (pB.dk_veiculos_cadastro || []).length;
  const bL = (pB.dk_locacoes_cadastro || []).length;
  record(
    "backup contagens",
    bC === 385 && bV === 187 && bL === 573,
    `c=${bC} v=${bV} l=${bL}`
  );

  const sbHeaders = {
    apikey: SB_ANON,
    Authorization: `Bearer ${SB_ANON}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const sbSelect = await fetch(`${SB_URL}/rest/v1/dk_cloud_snapshots?select=label,updated_at&limit=1`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
  });
  const sbSelectText = await sbSelect.text();
  const sbSelectHasRows =
    sbSelect.ok &&
    (() => {
      try {
        const arr = JSON.parse(sbSelectText);
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return /payload|dk_clientes/.test(sbSelectText);
      }
    })();

  const sbInsert = await fetch(`${SB_URL}/rest/v1/dk_cloud_snapshots`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify({
      label: `fase1a_probe_${Date.now()}`,
      payload: { probe: true },
      updated_at: new Date().toISOString(),
    }),
  });
  const sbInsertText = await sbInsert.text();

  const sbUpdate = await fetch(`${SB_URL}/rest/v1/dk_cloud_snapshots?label=eq.default`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
  const sbUpdateText = await sbUpdate.text();
  const sbUpdateWrote =
    sbUpdate.ok &&
    (() => {
      try {
        const p = JSON.parse(sbUpdateText);
        return Array.isArray(p) ? p.length > 0 : Boolean(p && p.label);
      } catch {
        return sbUpdateText.length > 2 && !/error|denied|rls|policy/i.test(sbUpdateText);
      }
    })();

  const sbDelete = await fetch(`${SB_URL}/rest/v1/dk_cloud_snapshots?label=eq.fase1a_probe_nao_existe`, {
    method: "DELETE",
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
  });
  const sbDeleteText = await sbDelete.text();
  const sbQuota =
    [sbSelect.status, sbInsert.status, sbUpdate.status, sbDelete.status].includes(402) ||
    /exceed_egress_quota/.test(sbSelectText + sbInsertText + sbUpdateText + sbDeleteText);
  record(
    "RLS SELECT anon sem dados (PostgREST)",
    !sbQuota && !sbSelectHasRows,
    `http=${sbSelect.status} ${sbSelectText.slice(0, 120)}`
  );
  record(
    "RLS INSERT anon recusado",
    !sbQuota && sbInsert.status >= 400,
    `http=${sbInsert.status} ${sbInsertText.slice(0, 120)}`
  );
  record(
    "RLS UPDATE anon recusado",
    !sbQuota && (sbUpdate.status >= 400 || !sbUpdateWrote),
    `http=${sbUpdate.status} ${sbUpdateText.slice(0, 120)}`
  );
  record(
    "RLS DELETE anon recusado",
    !sbQuota && sbDelete.status >= 400,
    `http=${sbDelete.status} ${sbDeleteText.slice(0, 120)}`
  );
  record(
    "RLS PostgREST comprovado (não é só quota)",
    !sbQuota && !sbSelectHasRows && sbInsert.status >= 400 && (sbUpdate.status >= 400 || !sbUpdateWrote) && sbDelete.status >= 400,
    sbQuota
      ? "PENDENTE: Supabase 402 exceed_egress_quota — SQL fase-1a-revoke-anon.sql ainda não comprovável"
      : `select=${sbSelect.status} insert=${sbInsert.status} update=${sbUpdate.status} delete=${sbDelete.status}`
  );

  const anonCases = [
    ["GET snapshot", "api/dk-cloud-snapshot", { method: "GET" }],
    ["POST snapshot", "api/dk-cloud-snapshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload: { dk_clientes_cadastro: [] } }) }],
    ["PUT snapshot", "api/dk-cloud-snapshot", { method: "PUT" }],
    ["DELETE snapshot", "api/dk-cloud-snapshot", { method: "DELETE" }],
    ["GET cadastro-clientes", "api/cadastro-clientes", { method: "GET" }],
    ["POST cadastro-clientes", "api/cadastro-clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["PUT cadastro-clientes", "api/cadastro-clientes", { method: "PUT" }],
    ["DELETE cadastro-clientes", "api/cadastro-clientes", { method: "DELETE" }],
    ["GET cadastro-locacoes", "api/cadastro-locacoes", { method: "GET" }],
    ["POST cadastro-locacoes", "api/cadastro-locacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["GET cadastro-veiculos", "api/cadastro-veiculos", { method: "GET" }],
    ["POST cadastro-veiculos", "api/cadastro-veiculos", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["GET geo", "api/dk-cliente-geo", { method: "GET" }],
    ["POST geo", "api/dk-cliente-geo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "cliente_app", cpf: "00000000000", lat: -9, lng: -40 }) }],
    ["POST push notify", "api/dk-cliente-geo?push=1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "notify", cpf: "00000000000", title: "x", body: "y" }) }],
  ];
  for (const [name, p, opts] of anonCases) {
    const r = await req(p, opts);
    record(
      `anónimo ${name} 401/403 sem payload`,
      forbidden(r.status) && !hasDkPayload(r.j),
      `status=${r.status} bytes=${r.len} reason=${r.j?.reason || ""}`
    );
  }

  const funcs = Array.isArray(pB.dk_funcionarios_access) ? pB.dk_funcionarios_access : [];
  const ceo = funcs.find((f) => String(f?.cpf || "").replace(/\D/g, "") === "03037897430") || funcs.find((f) => f?.role === "owner");
  const ceoCpf = String(ceo?.cpf || "").replace(/\D/g, "").slice(0, 11);
  const ceoSenha = String(ceo?.senha || "").trim();
  record("login CEO disponível no backup", Boolean(ceoCpf && ceoSenha), ceoCpf ? "cpf_ok" : "sem_ceo");

  let equipaToken = "";
  if (ceoCpf && ceoSenha) {
    const login = await req("api/dk-portal-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "equipa", cpf: ceoCpf, senha: ceoSenha }),
    });
    equipaToken = String(login.j?.token || "");
    record(
      "login equipa (CEO) emite token",
      login.status === 200 && login.j?.ok === true && Boolean(equipaToken) && !login.j?.funcionario?.senha,
      `status=${login.status} reason=${login.j?.reason || "ok"}`
    );
  } else {
    record("login equipa (CEO) emite token", false, "sem credencial no backup");
  }

  const authH = equipaToken ? { Authorization: `Bearer ${equipaToken}` } : {};
  const snap1 = await req("api/dk-cloud-snapshot", { headers: authH });
  const p1 = snap1.j?.payload || {};
  const c1 = (p1.dk_clientes_cadastro || []).length;
  const v1 = (p1.dk_veiculos_cadastro || []).length;
  const l1 = (p1.dk_locacoes_cadastro || []).length;
  record(
    "GET snapshot autenticado",
    snap1.status === 200 && snap1.j?.ok === true && c1 >= bC && v1 >= bV && l1 >= bL,
    `status=${snap1.status} c=${c1} v=${v1} l=${l1}`
  );

  let postOk = false;
  if (snap1.status === 200 && snap1.j?.payload) {
    const posted = await req("api/dk-cloud-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authH },
      body: JSON.stringify({
        payload: snap1.j.payload,
        updated_at: snap1.j.updated_at || new Date().toISOString(),
      }),
    });
    postOk = posted.status === 200 && posted.j?.ok === true;
    record("POST snapshot autenticado (eco merge)", postOk, `status=${posted.status} keys=${posted.j?.keys || 0}`);
  } else {
    record("POST snapshot autenticado (eco merge)", false, "sem GET prévio");
  }

  const snap2 = await req("api/dk-cloud-snapshot", { headers: authH });
  const p2 = snap2.j?.payload || {};
  const c2 = (p2.dk_clientes_cadastro || []).length;
  const v2 = (p2.dk_veiculos_cadastro || []).length;
  const l2 = (p2.dk_locacoes_cadastro || []).length;
  record(
    "integridade pós-eco >= backup",
    snap2.status === 200 && c2 >= bC && v2 >= bV && l2 >= bL && c2 >= c1 && v2 >= v1 && l2 >= l1,
    `c=${c2} v=${v2} l=${l2}`
  );

  const geoAuth = await req("api/dk-cliente-geo", { headers: authH });
  record(
    "GET GPS só equipa",
    geoAuth.status === 200 && geoAuth.j?.ok === true && Array.isArray(geoAuth.j.clientes),
    `status=${geoAuth.status} n=${geoAuth.j?.total ?? geoAuth.j?.clientes?.length ?? "?"}`
  );

  const locs = Array.isArray(pB.dk_locacoes_cadastro) ? pB.dk_locacoes_cadastro : [];
  const clientes = Array.isArray(pB.dk_clientes_cadastro) ? pB.dk_clientes_cadastro : [];
  let cliTok = "";
  let cliCpf = "";
  for (const loc of locs) {
    const cpf = String(loc?.cpf || "").replace(/\D/g, "").slice(0, 11);
    const proto = String(loc?.numeroContrato || loc?.protocolo || "").trim();
    if (cpf.length !== 11 || !proto) continue;
    const cad = clientes.find((c) => String(c?.cpf || "").replace(/\D/g, "").slice(0, 11) === cpf);
    const senha = String(cad?.senha || "123456").trim() || "123456";
    const lg = await req("api/dk-portal-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "cliente", cpf, senha, protocolo: proto }),
    });
    if (lg.status === 200 && lg.j?.token) {
      cliTok = lg.j.token;
      cliCpf = cpf;
      record("login cliente emite token", true, "token_ok");
      break;
    }
  }
  if (!cliTok) record("login cliente emite token", false, "nenhum par CPF/protocolo aceito");

  if (cliTok) {
    const geoCliBad = await req("api/dk-cliente-geo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cliTok}` },
      body: JSON.stringify({ source: "cliente_app", cpf: "00000000000", lat: -9, lng: -40 }),
    });
    record(
      "POST GPS cliente CPF alheio 403",
      geoCliBad.status === 403 && !hasDkPayload(geoCliBad.j),
      `status=${geoCliBad.status}`
    );
    const geoCliGet = await req("api/dk-cliente-geo", {
      headers: { Authorization: `Bearer ${cliTok}` },
    });
    record(
      "GET GPS com token cliente recusado",
      forbidden(geoCliGet.status) && !hasDkPayload(geoCliGet.j),
      `status=${geoCliGet.status}`
    );
    const pushCli = await req("api/dk-cliente-geo?push=1", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cliTok}` },
      body: JSON.stringify({ action: "notify", cpf: cliCpf, title: "x", body: "y" }),
    });
    record(
      "push notify com token cliente recusado",
      forbidden(pushCli.status) && pushCli.j?.sent !== true,
      `status=${pushCli.status}`
    );
  }

  const html = await fetch(BASE, { cache: "no-store" }).then((r) => r.text());
  const jsUrls = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]).slice(0, 20);
  let pubJs = "";
  for (const u of jsUrls) {
    const abs = u.startsWith("http") ? u : new URL(u, BASE).href;
    if (/jspdf|chart|vendor|miel-layout|estoque-planilha/i.test(abs)) continue;
    if (/app\.js|portal-locadora-ui|portal-supabase|dk-portal-api-auth|cliente-app|dk-oficial/i.test(abs)) {
      pubJs += await fetch(abs, { cache: "no-store" }).then((r) => (r.ok ? r.text() : ""));
    }
  }
  const secretHits = [];
  const scan = html + "\n" + pubJs;
  if (/name="dk-whatsapp-send-secret"/.test(scan)) secretHits.push("meta-whatsapp");
  if (/name="dk-backup-send-secret"/.test(scan)) secretHits.push("meta-backup");
  if (/service_role/i.test(scan) && /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(scan)) {
    secretHits.push("jwt-service-like");
  }
  if (/UPSTASH_REDIS_REST_TOKEN\s*[:=]\s*["'][^"']+["']/.test(scan)) secretHits.push("upstash-token");
  if (/DK_WHATSAPP_SEND_SECRET\s*[:=]\s*["'][^"']+["']/.test(scan)) secretHits.push("wa-secret-value");
  if (/DK_BACKUP_SEND_SECRET\s*[:=]\s*["'][^"']+["']/.test(scan)) secretHits.push("backup-secret-value");
  const hasAnonKey = /dk-supabase-anon-key/.test(html);
  const hasPublishable = /sb_publishable_/.test(html);
  record(
    "HTML/JS público sem secrets de servidor",
    secretHits.length === 0,
    secretHits.join(",") || `anon_public=${hasAnonKey && hasPublishable}`
  );

  const burst = [];
  for (let i = 0; i < 22; i += 1) {
    const r = await req("api/cliente-app-gate");
    burst.push(r.status);
  }
  const saw429 = burst.includes(429);
  const sawNormal = burst.some((s) => s !== 429);
  record(
    "rate limit gate: tráfego normal + 429 na rajada",
    sawNormal && saw429,
    `unicos=${[...new Set(burst)].join(",")} n429=${burst.filter((s) => s === 429).length}`
  );
  const afterRl = await req("api/dk-cloud-snapshot");
  record(
    "rate limit não bypassa auth do snapshot",
    forbidden(afterRl.status) && !hasDkPayload(afterRl.j),
    `status=${afterRl.status}`
  );

  const failed = results.filter((x) => !x.ok);
  console.log(`\nValidação 1A: ${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
