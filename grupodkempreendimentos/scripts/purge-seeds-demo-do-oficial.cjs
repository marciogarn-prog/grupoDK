/**
 * Remove locações/veículos de seed da DEMO que contaminaram o oficial.
 * Não mexe no canal demo.
 *   node grupodkempreendimentos/scripts/purge-seeds-demo-do-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

const NC_EXCLUIDOS = new Set([
  "2025010101",
  "2025010102",
  "2025010103",
  "2026010101",
  "2026010102",
  "2026010104",
]);
const PLACAS_EXCLUIDAS = new Set(["AAA0A00", "AAA0A01", "AAA0A02", "BBB0B00", "CCC0C00"]);
const CPF_EXCLUIDOS = new Set(["00000000001", "00000000003", "00000000004"]);

function dig(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function nkPlate(s) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function ncKey(l) {
  return dig(l?.numeroContrato || l?.protocolo || "");
}
function isDemoSeedLoc(l) {
  const nc = ncKey(l);
  const placa = nkPlate(l?.placa);
  const cpf = dig(l?.cpf).slice(0, 11);
  if (NC_EXCLUIDOS.has(nc)) return true;
  if (PLACAS_EXCLUIDAS.has(placa) || /^(AAA|BBB|CCC)0[A-C]\d{2}$/i.test(placa)) return true;
  if (CPF_EXCLUIDOS.has(cpf)) return true;
  if (/^TESTE[- ]?\d/i.test(String(l?.nome || "").trim())) return true;
  return false;
}
function isDemoSeedVeiculo(v) {
  const placa = nkPlate(v?.placa);
  return PLACAS_EXCLUIDAS.has(placa) || /^(AAA|BBB|CCC)0[A-C]\d{2}$/i.test(placa);
}

async function readPayload() {
  const redis = await fetch(`${REDIS_SNAPSHOT_URL}?nocache=${Date.now()}`).then((r) => r.json());
  if (redis?.payload) return { payload: redis.payload, source: "redis" };
  throw new Error("Snapshot oficial indisponível");
}

async function pushOfficial(payload) {
  const body = {
    payload,
    updated_at: new Date().toISOString(),
    wipe_keys: [
      "dk_locacoes_cadastro",
      "dk_veiculos_cadastro",
      "dk_portal_veiculos_cadastro",
      "dk_veiculos_frota_planilha",
    ],
  };
  const red = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  if (!red?.ok) throw new Error(red?.error || red?.reason || "Redis POST falhou");
  const patch = await fetch(`${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.${LABEL}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ payload, updated_at: body.updated_at }),
  });
  if (!patch.ok) console.warn("Supabase PATCH", patch.status);
}

async function wipeDemoCloud() {
  const empty = {
    dk_clientes_cadastro: [],
    dk_veiculos_cadastro: [],
    dk_locacoes_cadastro: [],
    dk_portal_clientes_cadastro: [],
    dk_portal_veiculos_cadastro: [],
    dk_veiculos_frota_planilha: [],
    dk_demo_cadastro_10_v1: false,
    dk_cadastro_manual_portal_v1: true,
  };
  const body = {
    payload: empty,
    updated_at: new Date().toISOString(),
    wipe_keys: Object.keys(empty).filter((k) => k.startsWith("dk_")),
  };
  const red = await fetch(`${REDIS_SNAPSHOT_URL}?channel=demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-DK-Deploy-Channel": "demo" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  console.log("demo wipe:", red?.ok ? "OK" : red);
  await fetch(`${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.demo`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return-minimal",
    },
    body: JSON.stringify({ payload: empty, updated_at: body.updated_at }),
  }).catch(() => null);
}

async function main() {
  const { payload, source } = await readPayload();
  const locs = Array.isArray(payload.dk_locacoes_cadastro) ? payload.dk_locacoes_cadastro : [];
  const veis = Array.isArray(payload.dk_veiculos_cadastro) ? payload.dk_veiculos_cadastro : [];
  const keptLocs = locs.filter((l) => !isDemoSeedLoc(l));
  const keptVeis = veis.filter((v) => !isDemoSeedVeiculo(v));
  const removedLocs = locs.filter(isDemoSeedLoc).map((l) => `${ncKey(l)}·${nkPlate(l.placa)}`);
  const removedVeis = veis.filter(isDemoSeedVeiculo).map((v) => nkPlate(v.placa));

  payload.dk_locacoes_cadastro = keptLocs;
  payload.dk_veiculos_cadastro = keptVeis;
  if (Array.isArray(payload.dk_portal_veiculos_cadastro)) {
    payload.dk_portal_veiculos_cadastro = payload.dk_portal_veiculos_cadastro.filter(
      (v) => !isDemoSeedVeiculo(v)
    );
  }
  if (Array.isArray(payload.dk_veiculos_frota_planilha)) {
    payload.dk_veiculos_frota_planilha = payload.dk_veiculos_frota_planilha.filter(
      (v) => !isDemoSeedVeiculo(v)
    );
  }

  console.log({
    source,
    locsBefore: locs.length,
    locsAfter: keptLocs.length,
    removedLocs,
    veisBefore: veis.length,
    veisAfter: keptVeis.length,
    removedVeis,
  });

  await pushOfficial(payload);
  await wipeDemoCloud();
  console.log("OK — seeds demo removidos do oficial; nuvem demo apagada.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
