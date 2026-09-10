/**
 * Fase 1A — prova de contenção (anónimo bloqueado; dados intactos com credencial de serviço).
 * node grupodkempreendimentos/scripts/test-fase-1a-contencao.mjs
 */
const BASE = process.env.DK_PORTAL_BASE || "https://grupodkempreendimentos.com.br/";
const root = BASE.endsWith("/") ? BASE : `${BASE}/`;
const svc = String(
  process.env.DK_PORTAL_API_SECRET || process.env.DK_BACKUP_SEND_SECRET || process.env.CRON_SECRET || ""
).trim();

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function anon(path, opts = {}) {
  const r = await fetch(`${root}${path}`, { cache: "no-store", ...opts });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

async function authGet(path) {
  const r = await fetch(`${root}${path}`, {
    cache: "no-store",
    headers: svc ? { Authorization: `Bearer ${svc}` } : {},
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

const forbidden = (s) => s === 401 || s === 403;

(async () => {
  const snapGet = await anon("api/dk-cloud-snapshot");
  record("GET anónimo snapshot 401/403", forbidden(snapGet.status), `status=${snapGet.status}`);
  record("GET anónimo snapshot sem payload", !snapGet.j?.payload, "");

  const snapPost = await anon("api/dk-cloud-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: { dk_clientes_cadastro: [] } }),
  });
  record("POST anónimo snapshot falha", forbidden(snapPost.status), `status=${snapPost.status}`);

  const cli = await anon("api/cadastro-clientes");
  record("GET anónimo cadastro-clientes 401/403", forbidden(cli.status), `status=${cli.status}`);
  const loc = await anon("api/cadastro-locacoes");
  record("GET anónimo cadastro-locacoes 401/403", forbidden(loc.status), `status=${loc.status}`);
  const vei = await anon("api/cadastro-veiculos");
  record("GET anónimo cadastro-veiculos 401/403", forbidden(vei.status), `status=${vei.status}`);

  const geo = await anon("api/dk-cliente-geo");
  record("GET anónimo GPS 401/403", forbidden(geo.status), `status=${geo.status}`);
  record("GET anónimo GPS sem lista", !Array.isArray(geo.j?.clientes), "");

  const geoPost = await anon("api/dk-cliente-geo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "cliente_app", cpf: "00000000000", lat: -9, lng: -40 }),
  });
  record("POST anónimo GPS falha", forbidden(geoPost.status), `status=${geoPost.status}`);

  const push = await anon("api/dk-cliente-geo?push=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "notify", cpf: "00000000000", title: "x", body: "y" }),
  });
  record("POST anónimo push notify falha", forbidden(push.status), `status=${push.status}`);

  if (!svc) {
    record("snapshot autenticado (contagens)", false, "sem DK_PORTAL_API_SECRET/DK_BACKUP_SEND_SECRET/CRON_SECRET no ambiente");
  } else {
    const authed = await authGet("api/dk-cloud-snapshot");
    const p = authed.j?.payload || {};
    const c = Array.isArray(p.dk_clientes_cadastro) ? p.dk_clientes_cadastro.length : 0;
    const v = Array.isArray(p.dk_veiculos_cadastro) ? p.dk_veiculos_cadastro.length : 0;
    const l = Array.isArray(p.dk_locacoes_cadastro) ? p.dk_locacoes_cadastro.length : 0;
    record(
      "PCs autorizados leem snapshot (dados não perdidos)",
      authed.status === 200 && authed.j?.ok === true && c >= 385 && v >= 187 && l >= 553,
      `status=${authed.status} c=${c} v=${v} l=${l}`
    );
  }

  const html = await fetch(`${root}`, { cache: "no-store" }).then((r) => r.text());
  record(
    "HTML sem meta de secrets WhatsApp/backup",
    !html.includes('name="dk-whatsapp-send-secret"') && !html.includes('name="dk-backup-send-secret"'),
    ""
  );

  const failed = results.filter((x) => !x.ok);
  console.log(`\nFase 1A: ${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
