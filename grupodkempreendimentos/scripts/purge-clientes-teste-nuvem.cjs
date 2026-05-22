/**
 * Remove só comprovantes e registos de pagamento dos CPFs teste na nuvem.
 * Mantém cadastro (cliente/veículo), locação/protocolo; zera listas de pagamento na locação.
 *
 * Uso:
 *   node grupodkempreendimentos/scripts/purge-clientes-teste-nuvem.cjs
 *   node grupodkempreendimentos/scripts/purge-clientes-teste-nuvem.cjs --cpf=19174403400,06523244440
 */
const { purgePagamentosComprovantesPayload } = require("../lib/dk-purge-pagamentos-only.cjs");

const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

const DEFAULT_CPFS = ["19174403400", "06523244440"];

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function parseArgs() {
  const out = { cpfs: [...DEFAULT_CPFS] };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--cpf=(.+)$/);
    if (m) {
      out.cpfs = m[1]
        .split(/[,;]/)
        .map((x) => onlyDigits(x).slice(0, 11))
        .filter((x) => x.length === 11);
    }
  }
  return out;
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
  if (!res.ok) {
    throw new Error(typeof data === "object" && data?.message ? data.message : text);
  }
  return data;
}

async function pushRedis(payload) {
  const res = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, updated_at: new Date().toISOString(), replace: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || data?.reason || res.statusText || "Redis POST falhou");
  }
  return data;
}

async function main() {
  const { cpfs } = parseArgs();
  const cpfSet = new Set(cpfs);
  console.log(
    "CPFs alvo (só pagamentos/comprovantes):",
    [...cpfSet].map((c) => `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`).join(", ")
  );

  let payload;
  let source = "supabase";
  try {
    const rows = await supabaseFetch(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=payload,updated_at`
    );
    payload = rows[0]?.payload;
    if (!payload || typeof payload !== "object") {
      throw new Error("Snapshot Supabase vazio");
    }
  } catch (e) {
    console.warn("Supabase:", e.message || e);
    const res = await fetch(REDIS_SNAPSHOT_URL);
    const data = await res.json().catch(() => ({}));
    if (!data?.payload) {
      console.error("Não foi possível ler snapshot (Supabase nem Redis).");
      process.exit(1);
    }
    payload = data.payload;
    source = "redis";
  }

  const stats = purgePagamentosComprovantesPayload(payload, cpfSet);
  const updatedAt = new Date().toISOString();

  let supaOk = false;
  try {
    await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload, updated_at: updatedAt }),
    });
    supaOk = true;
  } catch (e) {
    console.warn("Supabase PATCH:", e.message || e);
  }

  let redisOk = false;
  try {
    await pushRedis(payload);
    redisOk = true;
  } catch (e) {
    console.warn("Redis POST:", e.message || e);
  }

  console.log("\n--- Limpeza (só pagamentos/comprovantes) ---");
  console.log("Fonte lida:", source);
  console.log("Comprovantes:", stats.comprovantesAntes, "→", stats.comprovantesDepois);
  console.log("Notificações removidas:", stats.notificacoesRemovidas);
  console.log("Locações com pagamentos zerados:", stats.pagamentosZeradosEmLocacoes);
  console.log("Lançamentos globais removidos:", stats.lancamentosGlobaisRemovidos);
  console.log("Assinaturas removidas:", stats.assinaturasRemovidas);
  console.log("Validação pendente removida:", stats.validacaoRemovida);
  console.log("Protocolos (comprovantes):", [...stats.protocolosAfetados].join(", ") || "—");
  console.log("Gravado Supabase:", supaOk ? "sim" : "não");
  console.log("Gravado Redis:", redisOk ? "sim" : "não");

  if (!supaOk && !redisOk) {
    process.exit(1);
  }

  console.log("\nCadastro, veículo e protocolo de locação são mantidos.");
  console.log("No PC/telemóvel: Ctrl+F5 no portal e no app → Carregar da nuvem.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
