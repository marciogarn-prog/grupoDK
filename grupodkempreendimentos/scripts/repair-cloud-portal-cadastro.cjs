/**
 * Repõe cadastros de teste na nuvem e grava no banco único (dk_*_cadastro).
 * Uso: node scripts/repair-cloud-portal-cadastro.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";

const PORTAL_CLIENTES = [
  { cpf: "00000000001", nome: "TESTE-001", celular: "111", categoria: "AB", dataCadastro: "01/01/2025", codigo: "CLIENTE 01", status: "ATIVO", origemPortal: true },
  { cpf: "00000000003", nome: "TESTE-003", celular: "3333", categoria: "AB", dataCadastro: "01/01/2025", codigo: "CLIENTE 03", status: "ATIVO", origemPortal: true },
  { cpf: "00000000004", nome: "TESTE-004", celular: "444", categoria: "AB", dataCadastro: "01/01/2025", codigo: "CLIENTE 04", status: "ATIVO", origemPortal: true },
];

const PORTAL_VEICULOS = [
  { placa: "AAA0A00", tipo: "CARRO", marca: "FERRARI", modelo: "FERRARI", cor: "VERMELHA", tag: "DKCR013", status: "DISPONIVEL", origemPortal: true },
  { placa: "BBB0B00", tipo: "CARRO", marca: "BUGATTI", modelo: "BUGATTI", cor: "AZUL", tag: "DKCR014", status: "DISPONIVEL", origemPortal: true },
  { placa: "CCC0C00", tipo: "CARRO", marca: "PORSCHE", modelo: "PORSCHE", cor: "AMARELO", tag: "DKCR015", status: "DISPONIVEL", origemPortal: true },
];

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function normalizePlate(p) {
  return String(p || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function normalizeNumeroContratoKey(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "");
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
  const out = { ...ex, ...inc, placa: normalizePlate(inc.placa || ex.placa) };
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

async function main() {
  const rows = await supabaseFetch(
    `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=payload`
  );
  const payload = rows[0]?.payload;
  if (!payload) {
    console.error("Snapshot não encontrado.");
    process.exit(1);
  }

  const now = Date.now();
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
  PORTAL_CLIENTES.forEach((c, i) => {
    const cpf = onlyDigits(c.cpf);
    const ex = clientesByCpf.get(cpf);
    clientesByCpf.set(cpf, mergeCliente(ex, { ...c, id: ex?.id ?? now + i, updatedAt: now }));
  });

  const veiculosByPlaca = new Map();
  const addV = (list) => {
    (list || []).forEach((v) => {
      const pl = normalizePlate(v.placa);
      if (!pl) return;
      const ex = veiculosByPlaca.get(pl);
      veiculosByPlaca.set(pl, mergeVeiculo(ex, v));
    });
  };
  addV(payload.dk_veiculos_cadastro);
  addV(payload.dk_veiculos_frota_planilha);
  addV(payload.dk_portal_veiculos_cadastro);
  PORTAL_VEICULOS.forEach((v, i) => {
    const pl = normalizePlate(v.placa);
    const ex = veiculosByPlaca.get(pl);
    veiculosByPlaca.set(pl, mergeVeiculo(ex, { ...v, id: ex?.id ?? now + 1000 + i, updatedAt: now }));
  });

  payload.dk_clientes_cadastro = Array.from(clientesByCpf.values());
  payload.dk_veiculos_cadastro = Array.from(veiculosByPlaca.values());
  delete payload.dk_portal_clientes_cadastro;
  delete payload.dk_portal_veiculos_cadastro;
  delete payload.dk_veiculos_frota_planilha;

  const locHints = {
    "2025010101": { nome: "TESTE-001", marcaModelo: "FERRARI" },
    "2025010102": { nome: "TESTE-003", marcaModelo: "BUGATTI" },
    "2025010103": { nome: "TESTE-004", marcaModelo: "PORSCHE" },
  };
  if (Array.isArray(payload.dk_locacoes_cadastro)) {
    payload.dk_locacoes_cadastro = payload.dk_locacoes_cadastro.map((loc) => {
      const nc = normalizeNumeroContratoKey(loc.numeroContrato);
      const hint = locHints[nc];
      if (!hint) return loc;
      return {
        ...loc,
        nome: String(loc.nome || "").trim() || hint.nome,
        marcaModelo:
          String(loc.marcaModelo || "").trim().length <= 2 ? hint.marcaModelo : loc.marcaModelo,
        modalidade: loc.modalidade || "CARRO",
      };
    });
  }

  await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ payload, updated_at: new Date().toISOString() }),
  });

  console.log("OK: banco único na nuvem.");
  console.log("  clientes:", payload.dk_clientes_cadastro.length);
  console.log("  veículos:", payload.dk_veiculos_cadastro.length);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
