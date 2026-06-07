/**
 * Zera clientes, veículos e protocolos na nuvem (Redis + Supabase).
 * Ativa modo «cadastro manual portal» — não repõe planilha RECEITA 2026 ao atualizar.
 *
 *   node grupodkempreendimentos/scripts/zerar-cadastros-protocolos-nuvem.cjs
 *   node grupodkempreendimentos/scripts/zerar-cadastros-protocolos-nuvem.cjs --confirm
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

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

async function readPayload() {
  try {
    const rows = await supabaseFetch(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=payload`
    );
    if (rows[0]?.payload) return { payload: rows[0].payload, source: "supabase" };
  } catch (e) {
    console.warn("Supabase leitura:", e.message || e);
  }
  const res = await fetch(REDIS_SNAPSHOT_URL);
  const data = await res.json().catch(() => ({}));
  if (!data?.payload) throw new Error("Snapshot indisponível");
  return { payload: data.payload, source: "redis" };
}

async function pushWipe(payload) {
  for (const k of WIPE_KEYS) payload[k] = [];
  payload.dk_cadastro_manual_portal_v1 = true;
  payload.dk_cadastro_lock_v1 = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const res = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload,
      wipe_keys: WIPE_KEYS,
      updated_at: new Date().toISOString(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "Redis POST falhou");
  return data;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.log("ATENÇÃO: apaga TODOS clientes, veículos e protocolos na nuvem.");
    console.log("Execute com: node grupodkempreendimentos/scripts/zerar-cadastros-protocolos-nuvem.cjs --confirm");
    process.exit(1);
  }

  const { payload, source } = await readPayload();
  const before = {
    clientes: (payload.dk_clientes_cadastro || []).length,
    veiculos: (payload.dk_veiculos_cadastro || []).length,
    locacoes: (payload.dk_locacoes_cadastro || []).length,
  };

  const updatedAt = new Date().toISOString();
  let supaOk = false;
  try {
    for (const k of WIPE_KEYS) payload[k] = [];
    payload.dk_cadastro_manual_portal_v1 = true;
    await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload, updated_at: updatedAt }),
    });
    supaOk = true;
  } catch (e) {
    console.warn("Supabase PATCH:", e.message || e);
  }

  await pushWipe({ ...payload });

  const verify = await fetch(REDIS_SNAPSHOT_URL).then((r) => r.json());
  const after = verify.payload || {};
  const counts = {
    clientes: (after.dk_clientes_cadastro || []).length,
    veiculos: (after.dk_veiculos_cadastro || []).length,
    locacoes: (after.dk_locacoes_cadastro || []).length,
    manual: after.dk_cadastro_manual_portal_v1 === true,
  };

  console.log("Fonte leitura:", source);
  console.log("Antes:", before);
  console.log("Depois:", counts);
  console.log("Gravado Supabase:", supaOk ? "sim" : "não");
  console.log("Gravado Redis: sim");
  console.log("\nNo PC: Ctrl+F5 → Carregar da nuvem.");
  console.log("Cadastre clientes, veículos e protocolos um a um (Operação).");
  console.log("A planilha RECEITA 2026 não será reposta automaticamente.");

  if (counts.clientes > 0 || counts.veiculos > 0 || counts.locacoes > 0) {
    console.error("\nFALHA: cadastros ainda não estão vazios na nuvem.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
