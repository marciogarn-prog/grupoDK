/**
 * Demo: clientes + veículos (planilha) + locações (cópia demo Redis).
 * Oficial: zera cadastros + activa guard de data.
 *
 *   node grupodkempreendimentos/scripts/populate-demo-full-and-zero-oficial.cjs --confirm
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const {
  wipeCadastroKeys,
  todayCutoffYmd,
} = require("../lib/dk-oficial-cadastro-guard.cjs");

const ROOT = path.join(__dirname, "..");
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const REDIS_DEFAULT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const REDIS_DEMO_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot?channel=demo";

function counts(p) {
  return {
    clientes: (p.dk_clientes_cadastro || []).length,
    veiculos: (p.dk_veiculos_cadastro || []).length,
    locacoes: (p.dk_locacoes_cadastro || []).length,
    lancamentos: (p.dk_lancamentos_aluguel || []).length,
  };
}

async function supabaseFetch(pathSuffix, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathSuffix}`, {
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

async function upsertSupabaseLabel(label, payload) {
  const updatedAt = new Date().toISOString();
  const rows = await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(label)}&select=label`);
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

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Resposta inválida (${url}): ${text.slice(0, 80)}`);
  }
  if (!res.ok) throw new Error(data?.error || data?.reason || `HTTP ${res.status} (${url})`);
  return data;
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

function loadBancoCadastro() {
  spawnSync(process.execPath, [path.join(__dirname, "build-dk-banco-cadastro.cjs")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  const jsonPath = path.join(ROOT, "data", "dk-banco-cadastro.json");
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.log(`
ATENÇÃO:
  • Demo recebe ${"`"}307 clientes + 165 veículos (planilha) + locações actuais na demo${"`"}
  • Oficial fica zerado (cadastro manual, guard data >= hoje)

Execute:
  node grupodkempreendimentos/scripts/populate-demo-full-and-zero-oficial.cjs --confirm
`);
    process.exit(1);
  }

  const banco = loadBancoCadastro();
  console.log("Banco planilha:", banco.clientes.length, "clientes,", banco.veiculos.length, "veículos");

  const demoRes = await fetchJson(REDIS_DEMO_URL);
  const demoBase = demoRes?.payload && typeof demoRes.payload === "object" ? demoRes.payload : {};
  const locacoes = Array.isArray(demoBase.dk_locacoes_cadastro) ? demoBase.dk_locacoes_cadastro : [];
  console.log("Locações demo actuais:", locacoes.length);

  const demoPayload = {
    ...demoBase,
    dk_clientes_cadastro: banco.clientes,
    dk_veiculos_cadastro: banco.veiculos,
    dk_portal_clientes_cadastro: demoBase.dk_portal_clientes_cadastro || [],
    dk_portal_veiculos_cadastro: demoBase.dk_portal_veiculos_cadastro || [],
    dk_veiculos_frota_planilha: banco.veiculos,
    dk_locacoes_cadastro: locacoes,
    dk_lancamentos_aluguel: demoBase.dk_lancamentos_aluguel || [],
    dk_lancamentos_aluguel_cadastro: demoBase.dk_lancamentos_aluguel_cadastro || [],
  };
  delete demoPayload.dk_cadastro_manual_portal_v1;
  delete demoPayload.dk_cadastro_lock_v1;
  demoPayload.dk_demo_full_cadastro_v1 = new Date().toISOString();

  const oficialPayload = wipeCadastroKeys(demoBase);
  oficialPayload.dk_oficial_cadastro_guard_v1 = todayCutoffYmd();

  const updatedAt = new Date().toISOString();
  let supaDemo = false;
  let supaDefault = false;
  try {
    await upsertSupabaseLabel("demo", demoPayload);
    supaDemo = true;
  } catch (e) {
    console.warn("Supabase demo:", e.message || e);
  }
  try {
    await upsertSupabaseLabel("default", oficialPayload);
    supaDefault = true;
  } catch (e) {
    console.warn("Supabase default:", e.message || e);
  }

  await postRedis(REDIS_DEMO_URL, {
    payload: demoPayload,
    wipe_keys: [
      "dk_clientes_cadastro",
      "dk_portal_clientes_cadastro",
      "dk_veiculos_cadastro",
      "dk_portal_veiculos_cadastro",
      "dk_veiculos_frota_planilha",
      "dk_locacoes_cadastro",
      "dk_lancamentos_aluguel",
      "dk_lancamentos_aluguel_cadastro",
    ],
    updated_at: updatedAt,
  });
  await postRedis(REDIS_DEFAULT_URL, {
    payload: oficialPayload,
    wipe_keys: [
      "dk_clientes_cadastro",
      "dk_portal_clientes_cadastro",
      "dk_veiculos_cadastro",
      "dk_portal_veiculos_cadastro",
      "dk_veiculos_frota_planilha",
      "dk_locacoes_cadastro",
      "dk_lancamentos_aluguel",
      "dk_lancamentos_aluguel_cadastro",
    ],
    updated_at: updatedAt,
  });

  const verifyDemo = await fetchJson(REDIS_DEMO_URL);
  const verifyDefault = await fetchJson(REDIS_DEFAULT_URL);
  const afterDemo = counts(verifyDemo.payload || {});
  const afterDefault = counts(verifyDefault.payload || {});

  console.log("\nDemo:", afterDemo);
  console.log("Oficial:", afterDefault);
  console.log("Supabase demo:", supaDemo ? "sim" : "não");
  console.log("Supabase default:", supaDefault ? "sim" : "não");
  console.log("Guard oficial (data mínima):", todayCutoffYmd());

  if (afterDefault.locacoes > 0 || afterDefault.clientes > 0 || afterDefault.veiculos > 0) {
    console.error("\nFALHA: oficial ainda tem cadastros.");
    process.exit(1);
  }
  if (afterDemo.clientes < 300 || afterDemo.veiculos < 150 || afterDemo.locacoes < 300) {
    console.error("\nFALHA: demo incompleta.");
    process.exit(1);
  }
  console.log("\nOK. Oficial vazio; demo com cadastros completos.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
