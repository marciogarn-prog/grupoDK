/**
 * Remove da nuvem (Supabase + Redis) todos os dados operacionais de clientes teste.
 * Mantém cadastro de cliente/veículo; remove locações, comprovantes, notificações, lançamentos, assinaturas.
 *
 * Uso:
 *   node grupodkempreendimentos/scripts/purge-clientes-teste-nuvem.cjs
 *   node grupodkempreendimentos/scripts/purge-clientes-teste-nuvem.cjs --cpf=19174403400,06523244440
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

const DEFAULT_CPFS = ["19174403400", "06523244440"];

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normProto(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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

function countByCpf(arr, cpfKey = "cpf") {
  const map = new Map();
  for (const r of arr || []) {
    const c = onlyDigits(r?.[cpfKey]).slice(0, 11);
    if (!c) continue;
    map.set(c, (map.get(c) || 0) + 1);
  }
  return map;
}

function purgePayload(payload, cpfSet) {
  const stats = {
    comprovantesAntes: 0,
    comprovantesDepois: 0,
    notificacoesRemovidas: 0,
    locacoesRemovidas: 0,
    lancamentosRemovidos: 0,
    assinaturasRemovidas: 0,
    validacaoRemovida: 0,
    protocolosRemovidos: new Set(),
  };

  const matchCpf = (r, key = "cpf") => cpfSet.has(onlyDigits(r?.[key]).slice(0, 11));

  if (Array.isArray(payload.dk_comprovantes_cliente_pendentes)) {
    stats.comprovantesAntes = payload.dk_comprovantes_cliente_pendentes.length;
    for (const r of payload.dk_comprovantes_cliente_pendentes) {
      if (matchCpf(r)) stats.protocolosRemovidos.add(normProto(r.protocolo));
    }
    payload.dk_comprovantes_cliente_pendentes = payload.dk_comprovantes_cliente_pendentes.filter(
      (r) => !matchCpf(r)
    );
    stats.comprovantesDepois = payload.dk_comprovantes_cliente_pendentes.length;
  }

  if (Array.isArray(payload.dk_cliente_notificacoes)) {
    const antes = payload.dk_cliente_notificacoes.length;
    payload.dk_cliente_notificacoes = payload.dk_cliente_notificacoes.filter((n) => !matchCpf(n));
    stats.notificacoesRemovidas = antes - payload.dk_cliente_notificacoes.length;
  }

  const bancoKeys = [
    "dk_comprovantes_banco_assinaturas",
    "dk_comprovantes_banco",
    "dk_cliente_comprovantes_enviados",
  ];
  for (const bk of bancoKeys) {
    if (!Array.isArray(payload[bk])) continue;
    const antes = payload[bk].length;
    payload[bk] = payload[bk].filter((sig) => {
      const proto = normProto(sig?.protocolo);
      if (stats.protocolosRemovidos.has(proto)) return false;
      return true;
    });
    stats.assinaturasRemovidas += antes - payload[bk].length;
  }

  if (Array.isArray(payload.dk_locacoes_cadastro)) {
    const antes = payload.dk_locacoes_cadastro.length;
    for (const loc of payload.dk_locacoes_cadastro) {
      if (matchCpf(loc)) stats.protocolosRemovidos.add(normProto(loc.numeroContrato));
    }
    payload.dk_locacoes_cadastro = payload.dk_locacoes_cadastro.filter((loc) => {
      if (!matchCpf(loc)) return true;
      stats.locacoesRemovidas += 1;
      return false;
    });
    void antes;
  }

  const lancKeys = ["dk_lancamentos_aluguel", "dk_lancamentos_aluguel_cadastro"];
  for (const lk of lancKeys) {
    if (!Array.isArray(payload[lk])) continue;
    const antes = payload[lk].length;
    payload[lk] = payload[lk].filter((row) => {
      if (matchCpf(row)) return false;
      const proto = normProto(row?.numeroContrato || row?.protocolo);
      if (proto && stats.protocolosRemovidos.has(proto)) return false;
      return true;
    });
    stats.lancamentosRemovidos += antes - payload[lk].length;
  }

  if (Array.isArray(payload.dk_clientes_validacao_pendente)) {
    const antes = payload.dk_clientes_validacao_pendente.length;
    payload.dk_clientes_validacao_pendente = payload.dk_clientes_validacao_pendente.filter(
      (r) => !matchCpf(r)
    );
    stats.validacaoRemovida = antes - payload.dk_clientes_validacao_pendente.length;
  }

  return stats;
}

async function pushRedis(payload) {
  const res = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, updated_at: new Date().toISOString() }),
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
  console.log("CPFs alvo:", [...cpfSet].map((c) => `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`).join(", "));

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

  const stats = purgePayload(payload, cpfSet);
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

  console.log("\n--- Limpeza concluída ---");
  console.log("Fonte lida:", source);
  console.log("Comprovantes:", stats.comprovantesAntes, "→", stats.comprovantesDepois);
  console.log("Notificações removidas:", stats.notificacoesRemovidas);
  console.log("Locações removidas:", stats.locacoesRemovidas);
  console.log("Lançamentos removidos:", stats.lancamentosRemovidos);
  console.log("Assinaturas removidas:", stats.assinaturasRemovidas);
  console.log("Validação pendente removida:", stats.validacaoRemovida);
  console.log("Protocolos:", [...stats.protocolosRemovidos].join(", ") || "—");
  console.log("Gravado Supabase:", supaOk ? "sim" : "não");
  console.log("Gravado Redis:", redisOk ? "sim" : "não");

  if (!supaOk && !redisOk) {
    process.exit(1);
  }

  console.log("\nNo PC/telemóvel: abra o portal e o app cliente, Ctrl+F5, depois «Carregar da nuvem».");
  console.log("Ou no consola do browser (portal):");
  console.log(
    `  (${[...cpfSet].map((c) => `'${c}'`).join(",")}).forEach(c=>{['dk_comprovantes_cliente_pendentes','dk_cliente_notificacoes','dk_comprovantes_banco_assinaturas'].forEach(k=>{const a=JSON.parse(localStorage.getItem(k)||'[]');localStorage.setItem(k,JSON.stringify(a.filter(x=>String(x.cpf||'').replace(/\\D/g,'').slice(0,11)!==c)))});});location.reload();`
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
