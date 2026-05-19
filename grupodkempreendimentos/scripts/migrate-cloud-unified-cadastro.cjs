/**
 * Unifica snapshot na nuvem: dk_clientes_cadastro + dk_veiculos_cadastro (único banco).
 * node scripts/migrate-cloud-unified-cadastro.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function normPlate(p) {
  return String(p || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function mergeCliente(ex, inc) {
  const fields = ["nome", "celular", "categoria", "dataCadastro", "codigo", "status"];
  const out = { ...ex, ...inc, cpf: onlyDigits(inc.cpf || ex.cpf) };
  fields.forEach((f) => {
    const a = String(ex?.[f] ?? "").trim();
    const b = String(inc?.[f] ?? "").trim();
    if (inc?.origemPortal && b) out[f] = inc[f];
    else if (a && !b) out[f] = ex[f];
    else if (b) out[f] = inc[f];
  });
  if (inc?.origemPortal || ex?.origemPortal) out.origemPortal = true;
  if (inc?.origemPlanilha || ex?.origemPlanilha) out.origemPlanilha = true;
  return out;
}
function mergeVeiculo(ex, inc) {
  const fields = ["tipo", "tag", "marca", "modelo", "cor", "status"];
  const out = { ...ex, ...inc, placa: normPlate(inc.placa || ex.placa) };
  fields.forEach((f) => {
    const a = String(ex?.[f] ?? "").trim();
    const b = String(inc?.[f] ?? "").trim();
    if (inc?.origemPortal && b) out[f] = inc[f];
    else if (a && !b) out[f] = ex[f];
    else if (b) out[f] = inc[f];
  });
  if (inc?.origemPortal || ex?.origemPortal) out.origemPortal = true;
  if (inc?.origemPlanilha || ex?.origemPlanilha) out.origemPlanilha = true;
  return out;
}

async function main() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=payload`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const payload = (await res.json())[0]?.payload;
  if (!payload) {
    console.error("Sem snapshot");
    process.exit(1);
  }

  const clientesByCpf = new Map();
  const addC = (list) => {
    (list || []).forEach((c) => {
      const cpf = onlyDigits(c.cpf);
      if (cpf.length !== 11) return;
      const ex = clientesByCpf.get(cpf);
      clientesByCpf.set(cpf, mergeCliente(ex, c));
    });
  };
  addC(payload.dk_clientes_cadastro);
  addC(payload.dk_portal_clientes_cadastro);

  const veiculosByPlaca = new Map();
  const addV = (list) => {
    (list || []).forEach((v) => {
      const pl = normPlate(v.placa);
      if (!pl) return;
      const ex = veiculosByPlaca.get(pl);
      veiculosByPlaca.set(pl, mergeVeiculo(ex, v));
    });
  };
  addV(payload.dk_veiculos_cadastro);
  addV(payload.dk_veiculos_frota_planilha);
  addV(payload.dk_portal_veiculos_cadastro);

  payload.dk_clientes_cadastro = Array.from(clientesByCpf.values());
  payload.dk_veiculos_cadastro = Array.from(veiculosByPlaca.values());
  delete payload.dk_portal_clientes_cadastro;
  delete payload.dk_portal_veiculos_cadastro;
  delete payload.dk_veiculos_frota_planilha;

  const updated_at = new Date().toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ payload, updated_at }),
  });

  console.log(
    `OK nuvem unificada: ${payload.dk_clientes_cadastro.length} clientes, ${payload.dk_veiculos_cadastro.length} veículos`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
