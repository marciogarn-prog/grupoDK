/**
 * Remove o colaborador de teste (CPF 123.456.789-01) da nuvem oficial.
 *   node grupodkempreendimentos/scripts/purge-colaborador-teste-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const CPF_TESTE = "12345678901";

function dig(s) {
  return String(s ?? "").replace(/\D/g, "").slice(0, 11);
}

async function supabaseFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
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

async function readPayload() {
  const redis = await fetch(`${REDIS_SNAPSHOT_URL}?nocache=${Date.now()}`).then((r) => r.json());
  if (redis?.payload) return { payload: redis.payload, source: "redis" };
  const rows = await supabaseFetch(
    `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=payload`
  );
  if (rows[0]?.payload) return { payload: rows[0].payload, source: "supabase" };
  throw new Error("Snapshot indisponível");
}

async function pushBoth(payload) {
  const body = {
    payload,
    updated_at: new Date().toISOString(),
    wipe_keys: ["dk_funcionarios_access"],
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

function resumoLista(list) {
  const operacao = list.filter((f) => String(f.role || "").trim() === "operacao");
  const owners = list.filter((f) => String(f.role || "").trim() === "owner");
  return {
    total: list.length,
    operacao: operacao.length,
    owners: owners.length,
    nomesOperacao: operacao.map((f) => `${String(f.nome || "").trim()} (${dig(f.cpf)})`),
  };
}

async function main() {
  const { payload, source } = await readPayload();
  const before = Array.isArray(payload.dk_funcionarios_access) ? payload.dk_funcionarios_access : [];
  const removed = before.filter((f) => dig(f.cpf) === CPF_TESTE);
  const after = before.filter((f) => dig(f.cpf) !== CPF_TESTE);
  console.log("Fonte:", source);
  console.log("Antes:", resumoLista(before));
  console.log(
    "Removidos:",
    removed.map((f) => `${f.nome} ${dig(f.cpf)}`).join(", ") || "(nenhum)"
  );
  if (!removed.length) {
    console.log("CPF teste já não está na nuvem. Depois:", resumoLista(after));
    return;
  }
  payload.dk_funcionarios_access = after;
  await pushBoth(payload);
  console.log("Depois:", resumoLista(after));
  console.log("OK — colaborador teste excluído da nuvem oficial.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
