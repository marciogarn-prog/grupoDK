/**
 * Confere Redis + Supabase (label=default) e alinha a cópia oficial:
 * 369 clientes, 186 veículos, 526 locações/protocolos.
 * node grupodkempreendimentos/scripts/verificar-nuvem-oficial-cadastros.mjs
 * node grupodkempreendimentos/scripts/verificar-nuvem-oficial-cadastros.mjs --sync
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const REDIS_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const LABEL = "default";
const EXPECT = { clientes: 369, veiculos: 186, locacoes: 526 };

function counts(p) {
  const c = Array.isArray(p?.dk_clientes_cadastro) ? p.dk_clientes_cadastro : [];
  const v = Array.isArray(p?.dk_veiculos_cadastro) ? p.dk_veiculos_cadastro : [];
  const l = Array.isArray(p?.dk_locacoes_cadastro) ? p.dk_locacoes_cadastro : [];
  const uniqC = new Set(c.map((x) => String(x?.cpf || "").replace(/\D/g, "").slice(0, 11)).filter((d) => d.length === 11));
  const uniqV = new Set(c.length ? v.map((x) => String(x?.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean) : []);
  const uniqL = new Set(l.map((x) => String(x?.numeroContrato || x?.protocolo || "").replace(/\D/g, "")).filter(Boolean));
  return {
    clientes: c.length,
    veiculos: v.length,
    locacoes: l.length,
    uniqC: uniqC.size,
    uniqV: new Set(v.map((x) => String(x?.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean)).size,
    uniqL: uniqL.size,
    retroC: c.filter((x) => x?.cadastroRetroativo === true).length,
    retroL: l.filter((x) => x?.cadastroRetroativo === true).length,
    virgin: p?.dk_oficial_sem_protocolos_v1,
    manual: p?.dk_cadastro_manual_portal_v1,
  };
}

function okCounts(n) {
  return (
    n.clientes === EXPECT.clientes &&
    n.veiculos === EXPECT.veiculos &&
    n.locacoes === EXPECT.locacoes &&
    n.uniqC === EXPECT.clientes &&
    n.uniqV === EXPECT.veiculos &&
    n.uniqL === EXPECT.locacoes
  );
}

async function getRedis() {
  const data = await fetch(`${REDIS_URL}?n=${Date.now()}`).then((r) => r.json());
  if (!data?.ok) throw new Error(data?.error || data?.reason || "GET redis");
  return data;
}

async function supabase(pathRel, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathRel}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status} ${t.slice(0, 240)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) return res.json();
  return null;
}

const redis = await getRedis();
const redisP = redis.payload || {};
const redisN = counts(redisP);
console.log("Redis", redis.label, redis.updated_at, redisN);

let supaRows = [];
try {
  supaRows = await supabase(
    `dk_cloud_snapshots?label=eq.${LABEL}&select=label,updated_at,payload`
  );
} catch (e) {
  console.error("Supabase GET falhou:", e.message || e);
}
const supa = Array.isArray(supaRows) && supaRows[0] ? supaRows[0] : null;
const supaP = supa?.payload || {};
const supaN = counts(supaP);
console.log("Supabase", supa?.label || "(vazio)", supa?.updated_at || "-", supaN);

const redisOk = redis.label === "default" && okCounts(redisN) && redisN.virgin === false;
const supaOk = supa?.label === "default" && okCounts(supaN) && supaN.virgin === false;

console.log("Redis OK:", redisOk, "| Supabase OK:", supaOk);

if (redisOk && supaOk) {
  console.log("OK — cadastros oficiais nas duas nuvens: 369 clientes, 186 veículos, 526 locações.");
  process.exit(0);
}

if (!process.argv.includes("--sync")) {
  console.error("Desalinhado. Rode com --sync para gravar Redis (fonte) no Supabase e repor Redis se preciso.");
  process.exit(1);
}

if (!redisOk) {
  console.error("Redis oficial não tem 369/186/526. Não sincronizo a partir de uma cópia incompleta.");
  process.exit(1);
}

const updatedAt = new Date().toISOString();
const payload = {
  ...redisP,
  dk_oficial_sem_protocolos_v1: false,
  dk_oficial_locacoes_importadas_v1: true,
  dk_cadastro_manual_portal_v1: true,
};

if (supa?.label === "default") {
  await supabase(`dk_cloud_snapshots?label=eq.${LABEL}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ payload, updated_at: updatedAt }),
  });
  console.log("Supabase PATCH default com payload Redis");
} else {
  await supabase("dk_cloud_snapshots", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ label: LABEL, payload, updated_at: updatedAt }),
  });
  console.log("Supabase INSERT default com payload Redis");
}

const afterRows = await supabase(
  `dk_cloud_snapshots?label=eq.${LABEL}&select=label,updated_at,payload`
);
const after = counts(afterRows?.[0]?.payload || {});
console.log("Supabase depois", after);
if (!okCounts(after) || after.virgin !== false) {
  console.error("Supabase ainda desalinhado após sync.");
  process.exit(1);
}
console.log("OK — Redis e Supabase oficiais com 369 clientes, 186 veículos, 526 locações.");
