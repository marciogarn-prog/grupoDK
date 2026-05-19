/**
 * Repõe na nuvem (dk_cloud_snapshots) o cadastro do portal separado da planilha.
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
    const err = new Error(typeof data === "object" && data?.message ? data.message : text || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

function mergeCliente(ex, inc) {
  const fields = ["nome", "celular", "categoria", "dataCadastro", "codigo", "status"];
  const out = { ...ex, ...inc, cpf: onlyDigits(inc.cpf || ex.cpf) };
  fields.forEach((f) => {
    const a = String(ex?.[f] ?? "").trim();
    const b = String(inc?.[f] ?? "").trim();
    if (a && !b) out[f] = ex[f];
    else if (b) out[f] = inc[f];
  });
  out.origemPortal = true;
  return out;
}

function mergeVeiculo(ex, inc) {
  const fields = ["tipo", "tag", "marca", "modelo", "cor", "status"];
  const out = { ...ex, ...inc, placa: normalizePlate(inc.placa || ex.placa) };
  fields.forEach((f) => {
    const a = String(ex?.[f] ?? "").trim();
    const b = String(inc?.[f] ?? "").trim();
    if (a && !b) out[f] = ex[f];
    else if (b) out[f] = inc[f];
  });
  out.origemPortal = true;
  return out;
}

async function main() {
  const rows = await supabaseFetch(
    `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=id,payload,updated_at`
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.payload) {
    console.error("Snapshot não encontrado.");
    process.exit(1);
  }

  const payload = row.payload;
  const now = Date.now();

  const clientesByCpf = new Map();
  (Array.isArray(payload.dk_portal_clientes_cadastro) ? payload.dk_portal_clientes_cadastro : []).forEach((c) => {
    const cpf = onlyDigits(c.cpf);
    if (cpf.length === 11) clientesByCpf.set(cpf, c);
  });
  PORTAL_CLIENTES.forEach((c, i) => {
    const cpf = onlyDigits(c.cpf);
    const ex = clientesByCpf.get(cpf);
    clientesByCpf.set(
      cpf,
      mergeCliente(ex, { ...c, id: ex?.id ?? now + i, createdAt: ex?.createdAt ?? now, updatedAt: now })
    );
  });
  payload.dk_portal_clientes_cadastro = Array.from(clientesByCpf.values());

  const veiculosByPlaca = new Map();
  (Array.isArray(payload.dk_portal_veiculos_cadastro) ? payload.dk_portal_veiculos_cadastro : []).forEach((v) => {
    const pl = normalizePlate(v.placa);
    if (pl) veiculosByPlaca.set(pl, v);
  });
  PORTAL_VEICULOS.forEach((v, i) => {
    const pl = normalizePlate(v.placa);
    const ex = veiculosByPlaca.get(pl);
    veiculosByPlaca.set(
      pl,
      mergeVeiculo(ex, { ...v, id: ex?.id ?? now + 1000 + i, createdAt: ex?.createdAt ?? now, updatedAt: now })
    );
  });
  payload.dk_portal_veiculos_cadastro = Array.from(veiculosByPlaca.values());

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

  if (!Array.isArray(payload.dk_veiculos_frota_planilha) && Array.isArray(payload.dk_veiculos_cadastro)) {
    payload.dk_veiculos_frota_planilha = payload.dk_veiculos_cadastro.filter((v) => !v?.origemPortal);
  }

  const updated_at = new Date().toISOString();
  await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ payload, updated_at }),
  });

  console.log("OK: nuvem atualizada com portal clientes/veículos e locações corrigidas.");
  console.log("  portal clientes:", payload.dk_portal_clientes_cadastro.length);
  console.log("  portal veículos:", payload.dk_portal_veiculos_cadastro.length);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
