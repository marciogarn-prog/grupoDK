/**
 * Copia snapshot actual (default) para demo e zera cadastros no oficial.
 *
 *   node grupodkempreendimentos/scripts/backup-demo-zerar-oficial-cadastros.cjs --confirm
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const REDIS_DEFAULT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const REDIS_DEMO_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot?channel=demo";

const WIPE_KEYS = [
  "dk_clientes_cadastro",
  "dk_portal_clientes_cadastro",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_veiculos_frota_planilha",
  "dk_locacoes_cadastro",
  "dk_lancamentos_aluguel",
  "dk_lancamentos_aluguel_cadastro",
];

function counts(payload) {
  return {
    clientes: (payload.dk_clientes_cadastro || []).length,
    portalClientes: (payload.dk_portal_clientes_cadastro || []).length,
    veiculos: (payload.dk_veiculos_cadastro || []).length,
    locacoes: (payload.dk_locacoes_cadastro || []).length,
    lancamentos: (payload.dk_lancamentos_aluguel || []).length,
  };
}

async function supabaseFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(typeof data === "object" && data?.message ? data.message : text);
  return data;
}

async function readDefaultPayload() {
  try {
    const rows = await supabaseFetch(
      "dk_cloud_snapshots?label=eq.default&select=payload,updated_at"
    );
    if (rows[0]?.payload) return { payload: rows[0].payload, source: "supabase" };
  } catch (e) {
    console.warn("Supabase leitura default:", e.message || e);
  }
  const res = await fetch(REDIS_DEFAULT_URL);
  const data = await res.json().catch(() => ({}));
  if (!data?.payload) throw new Error("Snapshot default indisponível");
  return { payload: data.payload, source: "redis" };
}

async function upsertSupabaseLabel(label, payload) {
  const updatedAt = new Date().toISOString();
  const rows = await supabaseFetch(
    `dk_cloud_snapshots?label=eq.${encodeURIComponent(label)}&select=label`
  );
  if (rows.length) {
    await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(label)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload, updated_at: updatedAt }),
    });
  } else {
    await supabaseFetch("dk_cloud_snapshots", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ label, payload, updated_at: updatedAt }),
    });
  }
  return updatedAt;
}

async function postRedis(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || `Redis POST falhou (${url})`);
  return data;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.log(`
ATENÇÃO:
  1) Copia TODOS os dados actuais (default) para demo (Supabase label demo + Redis demo)
  2) Zera clientes, veículos, locações e lançamentos no oficial (default)

Execute:
  node grupodkempreendimentos/scripts/backup-demo-zerar-oficial-cadastros.cjs --confirm
`);
    process.exit(1);
  }

  const { payload, source } = await readDefaultPayload();
  const before = counts(payload);
  console.log("Fonte leitura default:", source);
  console.log("Antes (default):", before);

  const demoCopy = JSON.parse(JSON.stringify(payload));
  demoCopy._dkFullReplaceKeys = [...WIPE_KEYS];
  const demoUpdatedAt = new Date().toISOString();

  let supaDemoOk = false;
  let supaDefaultOk = false;
  try {
    await upsertSupabaseLabel("demo", demoCopy);
    supaDemoOk = true;
  } catch (e) {
    console.warn("Supabase demo:", e.message || e);
  }

  await postRedis(REDIS_DEMO_URL, {
    payload: demoCopy,
    updated_at: demoUpdatedAt,
    replace: true,
  });
  console.log("Redis demo: cópia gravada");

  const wiped = JSON.parse(JSON.stringify(payload));
  for (const k of WIPE_KEYS) wiped[k] = [];
  wiped.dk_cadastro_manual_portal_v1 = true;
  wiped.dk_cadastro_lock_v1 = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const defaultUpdatedAt = new Date().toISOString();

  try {
    await upsertSupabaseLabel("default", wiped);
    supaDefaultOk = true;
  } catch (e) {
    console.warn("Supabase default:", e.message || e);
  }

  await postRedis(REDIS_DEFAULT_URL, {
    payload: wiped,
    wipe_keys: WIPE_KEYS,
    updated_at: defaultUpdatedAt,
  });
  console.log("Redis default: cadastros zerados");

  const verifyDemo = await fetch(REDIS_DEMO_URL).then((r) => r.json());
  const verifyDefault = await fetch(REDIS_DEFAULT_URL).then((r) => r.json());
  const afterDemo = counts(verifyDemo.payload || {});
  const afterDefault = counts(verifyDefault.payload || {});

  console.log("\nDepois demo:", afterDemo);
  console.log("Depois oficial:", afterDefault);
  console.log("Supabase demo:", supaDemoOk ? "sim" : "não");
  console.log("Supabase default:", supaDefaultOk ? "sim" : "não");
  console.log("\nNo PC: Ctrl+F5 → Carregar da nuvem (demo e oficial separados).");

  if (
    afterDefault.clientes > 0 ||
    afterDefault.veiculos > 0 ||
    afterDefault.locacoes > 0
  ) {
    console.error("\nFALHA: oficial ainda tem cadastros.");
    process.exit(1);
  }
  if (afterDemo.locacoes === 0 && before.locacoes > 0) {
    console.error("\nFALHA: demo não recebeu cópia das locações.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
