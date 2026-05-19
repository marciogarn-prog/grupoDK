/**
 * Gera o banco único DK (JSON) a partir dos bundles JS + cadastros de teste do portal.
 * Uso: node scripts/build-dk-banco-cadastro.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT_JSON = path.join(ROOT, "data", "dk-banco-cadastro.json");
const OUT_JS = path.join(ROOT, "data", "dk-banco-cadastro.js");

const PORTAL_VEICULOS = [
  { placa: "AAA0A00", tipo: "CARRO", marca: "FERRARI", modelo: "FERRARI", cor: "VERMELHA", tag: "DKCR013", status: "DISPONIVEL", origemPortal: true },
  { placa: "BBB0B00", tipo: "CARRO", marca: "BUGATTI", modelo: "BUGATTI", cor: "AZUL", tag: "DKCR014", status: "DISPONIVEL", origemPortal: true },
  { placa: "CCC0C00", tipo: "CARRO", marca: "PORSCHE", modelo: "PORSCHE", cor: "AMARELO", tag: "DKCR015", status: "DISPONIVEL", origemPortal: true },
];

const PORTAL_CLIENTES = [
  { cpf: "00000000001", nome: "TESTE-001", celular: "111", categoria: "AB", dataCadastro: "01/01/2025", codigo: "CLIENTE 01", status: "ATIVO", origemPortal: true },
  { cpf: "00000000003", nome: "TESTE-003", celular: "3333", categoria: "AB", dataCadastro: "01/01/2025", codigo: "CLIENTE 03", status: "ATIVO", origemPortal: true },
  { cpf: "00000000004", nome: "TESTE-004", celular: "444", categoria: "AB", dataCadastro: "01/01/2025", codigo: "CLIENTE 04", status: "ATIVO", origemPortal: true },
];

function loadJsArray(file, varName) {
  const code = fs.readFileSync(path.join(ROOT, file), "utf8");
  const re = new RegExp(`const\\s+${varName}\\s*=\\s*(\\[)`);
  const m = code.match(re);
  if (!m || m.index == null) throw new Error(`${varName} não encontrado em ${file}`);
  const start = m.index + code.slice(m.index).indexOf("[");
  let depth = 0;
  let end = start;
  for (let i = start; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return JSON.parse(code.slice(start, end));
}

function normPlate(p) {
  return String(p || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normCpf(c) {
  return String(c || "").replace(/\D/g, "");
}

function mergeVeiculo(ex, inc) {
  const fields = ["tipo", "tag", "placa", "codigo", "marca", "modelo", "valor", "cor", "chassi", "anoModelo", "renavam", "motor", "proprietario", "local", "status"];
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

function mergeCliente(ex, inc) {
  const fields = ["codigo", "dataCadastro", "nome", "celular", "recado1", "recado2", "cnh", "categoria", "vencimento", "ear", "cep", "municipioUf", "endereco", "status"];
  const out = { ...ex, ...inc, cpf: normCpf(inc.cpf || ex.cpf) };
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

function main() {
  const planilhaVeiculos = loadJsArray("veiculos-dk-financeiro-2026.js", "VEICULOS_DK_FINANCEIRO_2026").map((v) => ({
    ...v,
    tag: String(v.tag || "").replace(/\s*-\s*/g, ""),
    placa: normPlate(v.placa),
    origemPlanilha: true,
  }));

  let planilhaClientes = [];
  try {
    planilhaClientes = loadJsArray("clientes-dk-financeiro-2026.js", "CLIENTES_DK_FINANCEIRO_2026").map((c) => ({
      ...c,
      cpf: normCpf(c.cpf),
      origemPlanilha: true,
    }));
  } catch {
    console.warn("clientes-dk-financeiro-2026.js ausente — só veículos.");
  }

  const veiculosByPlaca = new Map();
  planilhaVeiculos.forEach((v, i) => {
    const pl = normPlate(v.placa);
    if (!pl) return;
    veiculosByPlaca.set(pl, { ...v, id: v.id != null ? Number(v.id) : 1780000000 + i });
  });
  PORTAL_VEICULOS.forEach((v, i) => {
    const pl = normPlate(v.placa);
    const ex = veiculosByPlaca.get(pl);
    veiculosByPlaca.set(pl, mergeVeiculo(ex, { ...v, id: ex?.id ?? 1790000000 + i }));
  });

  const clientesByCpf = new Map();
  planilhaClientes.forEach((c, i) => {
    const cpf = normCpf(c.cpf);
    if (cpf.length !== 11) return;
    clientesByCpf.set(cpf, { ...c, id: c.id != null ? Number(c.id) : 1765000000 + i });
  });
  PORTAL_CLIENTES.forEach((c, i) => {
    const cpf = normCpf(c.cpf);
    const ex = clientesByCpf.get(cpf);
    clientesByCpf.set(cpf, mergeCliente(ex, { ...c, id: ex?.id ?? 1791000000 + i }));
  });

  const banco = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: "planilha-embutida+portal-teste",
    clientes: Array.from(clientesByCpf.values()),
    veiculos: Array.from(veiculosByPlaca.values()),
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(banco));
  fs.writeFileSync(
    OUT_JS,
    `/** Banco único DK — gerado por scripts/build-dk-banco-cadastro.cjs. Não editar à mão. */\nwindow.DK_BANCO_CADASTRO = ${JSON.stringify(banco)};\n`
  );

  console.log(`OK: ${banco.veiculos.length} veículos, ${banco.clientes.length} clientes`);
  console.log(`  → ${OUT_JSON}`);
  console.log(`  → ${OUT_JS}`);
}

main();
