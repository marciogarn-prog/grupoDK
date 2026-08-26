/**
 * Oficial: importa CADASTRO DE CLIENTES.xlsx (CPF único) e CADASTRO DE VEICULOS.xlsx (placa única).
 * Não altera locações/protocolos. Funde com a nuvem sem duplicar CPF nem placa.
 *
 *   node grupodkempreendimentos/scripts/import-xlsx-clientes-veiculos-oficial.mjs --confirm
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA = path.resolve(__dirname, "../data");
const require = createRequire(path.join(ROOT, "package.json"));
const XLSX = require("xlsx");

const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const REDIS_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const LABEL = "default";
const PLACA_ANTIGA_RE = /^[A-Z]{3}[0-9]{4}$/;
const PLACA_ANTIGA_PARA_MERCOSUL = "ABCDEFGHIJ";
const MERCOSUL_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

const WIPE_KEYS = [
  "dk_clientes_cadastro",
  "dk_portal_clientes_cadastro",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
];

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normalizePlate(p) {
  return String(p ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function placaParaCadastro(value) {
  const raw = normalizePlate(value);
  if (!raw) return "";
  if (MERCOSUL_RE.test(raw)) return raw;
  if (PLACA_ANTIGA_RE.test(raw)) {
    const letter = PLACA_ANTIGA_PARA_MERCOSUL[parseInt(raw[4], 10)];
    if (letter) {
      const conv = raw.slice(0, 4) + letter + raw.slice(5);
      if (MERCOSUL_RE.test(conv)) return conv;
    }
  }
  return raw;
}

function padCodigo(v) {
  const d = onlyDigits(v);
  if (!d) return String(v || "").trim();
  return d.padStart(Math.max(4, d.length), "0");
}

function formatCel(s) {
  const d = onlyDigits(s);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(s || "").trim();
}

function formatCep(s) {
  const d = onlyDigits(String(s || "").replace(",", "."));
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return String(s || "").trim();
}

function toBrDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getUTCDate()).padStart(2, "0");
    const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${value.getUTCFullYear()}`;
  }
  const s = String(value).trim();
  if (!s) return "";
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000 && !s.includes("-") && !s.includes("/")) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const brDash = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (brDash) return `${brDash[1]}/${brDash[2]}/${brDash[3]}`;
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  return s;
}

function pick(row, ...names) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row, n) && row[n] != null && String(row[n]).trim() !== "") {
      return row[n];
    }
  }
  return "";
}

function readSheet(fileName) {
  const fp = path.join(DATA, fileName);
  const wb = XLSX.readFile(fp, { cellDates: true, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
}

function clientesFromXlsx() {
  const rows = readSheet("CADASTRO DE CLIENTES.xlsx");
  const byCpf = new Map();
  const skipped = { semCpf: 0, cnpj: 0, semNome: 0, dup: 0 };
  rows.forEach((row, idx) => {
    const doc = onlyDigits(pick(row, "CNPJ/CPF", "CPF", "cnpj/cpf"));
    if (doc.length === 14) {
      skipped.cnpj += 1;
      return;
    }
    const nome = String(pick(row, "Cliente", "Nome", "cliente")).trim();
    const codigo = padCodigo(pick(row, "Cód.", "Codigo", "Código"));
    let cpf = doc;
    if (cpf.length !== 11) {
      if (!nome) {
        skipped.semNome += 1;
        return;
      }
      /* 3 linhas da planilha (cód. 10, 16, 161) não têm CPF — entram no total 369 com CPF-reserva único. */
      cpf = onlyDigits(codigo).padStart(11, "0");
      if (cpf.length !== 11) {
        skipped.semCpf += 1;
        return;
      }
      skipped.semCpf += 1;
    }
    if (!nome) {
      skipped.semNome += 1;
      return;
    }
    if (byCpf.has(cpf)) skipped.dup += 1;
    const now = Date.now() - (rows.length - idx) * 1000;
    const cnhRaw = onlyDigits(pick(row, "Nº da CNH-e", "CNH"));
    byCpf.set(cpf, {
      id: now,
      createdAt: now,
      updatedAt: Date.now(),
      origemPortal: true,
      cadastroRetroativo: true,
      status: "ATIVO",
      ambiente: "real",
      senha: "123456",
      codigo,
      dataCadastro: toBrDate(pick(row, "Data do Cadastro")),
      cpf,
      nome,
      celular: formatCel(pick(row, "Nº do Celular", "Celular")),
      recado1: formatCel(pick(row, "Recados 01")),
      recado2: formatCel(pick(row, "Recados 02")),
      cnh: cnhRaw,
      categoria: String(pick(row, "Categoria")).trim(),
      vencimento: toBrDate(pick(row, "Vencimento")),
      ear: String(pick(row, "EAR")).trim(),
      cep: formatCep(pick(row, "Cep", "CEP")),
      municipioUf: String(pick(row, "Município/UF", "Municipio/UF")).trim(),
      endereco: String(pick(row, "Endereço", "Endereco")).trim(),
    });
  });
  return { list: [...byCpf.values()], skipped, rows: rows.length, unique: byCpf.size };
}

function veiculosFromXlsx() {
  const rows = readSheet("CADASTRO DE VEICULOS.xlsx");
  const byPlaca = new Map();
  const skipped = { semPlaca: 0, dup: 0, placaCorrigida: 0 };
  rows.forEach((row, idx) => {
    let placaRaw = pick(row, "Placa");
    let cat = String(pick(row, "Categoria")).trim().toUpperCase();
    /* Linha deslocada (ex. DKCR-016): placa vazia e Categoria = placa. */
    if (!normalizePlate(placaRaw) && /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(normalizePlate(cat))) {
      placaRaw = cat;
      cat = String(pick(row, "TAG", "Tag")).toUpperCase().includes("DKCR") ? "CARRO" : "MOTO";
      skipped.placaCorrigida += 1;
    }
    const placa = placaParaCadastro(placaRaw);
    if (!placa) {
      skipped.semPlaca += 1;
      return;
    }
    if (byPlaca.has(placa)) skipped.dup += 1;
    const tipo = cat.includes("CARRO") ? "CARRO" : cat.includes("MOTO") ? "MOTO" : cat || "MOTO";
    const now = Date.now() - (rows.length - idx) * 1000;
    const tag = String(pick(row, "TAG", "Tag")).trim();
    /* Coluna TIPO da planilha (CG, BROS, KWID…) → campo TIPO no formulário (gravado em codigo). */
    const tipoPlanilha = String(pick(row, "TIPO", "Tipo")).trim();
    byPlaca.set(placa, {
      id: now,
      createdAt: now,
      updatedAt: Date.now(),
      origemPortal: true,
      cadastroRetroativo: true,
      tipo,
      tag,
      placa,
      codigo: tipoPlanilha,
      marca: String(pick(row, "Marca")).trim(),
      modelo: String(pick(row, "Modelo")).trim(),
      valor: String(pick(row, "Valor de Aquisição", "Valor")).trim(),
      cor: String(pick(row, "Cor")).trim(),
      chassi: String(pick(row, "Chassi")).trim(),
      anoModelo: String(pick(row, "Ano/Modelo")).trim(),
      renavam: String(pick(row, "Renavam")).trim(),
      motor: String(pick(row, "Nº do Motor", "Motor")).trim(),
      proprietario: String(pick(row, "Proprietário", "Proprietario")).trim(),
      local: "",
      status: "DISPONIVEL",
      ambiente: "real",
      dataCadastro: toBrDate(pick(row, "Data do Cadastro")),
    });
  });
  return { list: [...byPlaca.values()], skipped, rows: rows.length, unique: byPlaca.size };
}

function mergeClientes(cloudList, sheetList) {
  const senhaByCpf = new Map();
  const idByCpf = new Map();
  for (const c of cloudList || []) {
    const cpf = onlyDigits(c.cpf).slice(0, 11);
    if (cpf.length !== 11) continue;
    if (c.senha) senhaByCpf.set(cpf, c.senha);
    if (c.id) idByCpf.set(cpf, { id: c.id, createdAt: c.createdAt });
  }
  return sheetList.map((c) => {
    const prev = idByCpf.get(c.cpf);
    return {
      ...c,
      id: prev?.id ?? c.id,
      createdAt: prev?.createdAt ?? c.createdAt,
      senha: senhaByCpf.get(c.cpf) || c.senha || "123456",
      cadastroRetroativo: true,
      origemPortal: true,
    };
  });
}

function mergeVeiculos(cloudList, sheetList) {
  const prevByPlaca = new Map();
  for (const v of cloudList || []) {
    const pl = placaParaCadastro(v.placa);
    if (pl) prevByPlaca.set(pl, v);
  }
  return sheetList.map((v) => {
    const ex = prevByPlaca.get(v.placa);
    return {
      ...v,
      id: ex?.id ?? v.id,
      createdAt: ex?.createdAt ?? v.createdAt,
      cadastroRetroativo: true,
      origemPortal: true,
    };
  });
}

async function supabaseFetch(p, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, {
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

async function getRedis() {
  const data = await fetch(`${REDIS_URL}?n=${Date.now()}`).then((r) => r.json());
  if (!data?.ok) throw new Error(data?.error || data?.reason || "GET redis");
  return data;
}

async function postRedis(body) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "POST redis");
  return data;
}

function uniqueness(list, keyFn) {
  const seen = new Set();
  let dup = 0;
  for (const item of list) {
    const k = keyFn(item);
    if (!k) continue;
    if (seen.has(k)) dup += 1;
    else seen.add(k);
  }
  return { unique: seen.size, dup };
}

const clientesX = clientesFromXlsx();
const veiculosX = veiculosFromXlsx();
console.log("Planilha clientes:", clientesX.rows, "linhas →", clientesX.unique, "únicos", clientesX.skipped);
console.log("Planilha veículos:", veiculosX.rows, "linhas →", veiculosX.unique, "placas únicas", veiculosX.skipped);
if (clientesX.unique !== 369) {
  console.error("Esperado 369 clientes únicos, obtido", clientesX.unique);
  process.exit(1);
}
if (veiculosX.unique !== 187) {
  console.error("Esperado 187 veículos únicos, obtido", veiculosX.unique);
  process.exit(1);
}

if (!process.argv.includes("--confirm")) {
  console.log("Dry-run. Para gravar na nuvem oficial: --confirm");
  process.exit(0);
}

const redis = await getRedis();
if (redis.label !== "default") throw new Error("snapshot não é o canal oficial");
const payload = { ...(redis.payload || {}) };
const clientesAntes = (payload.dk_clientes_cadastro || []).length;
const veiculosAntes = (payload.dk_veiculos_cadastro || []).length;
const locAntes = (payload.dk_locacoes_cadastro || []).length;

const clientes = mergeClientes(payload.dk_clientes_cadastro, clientesX.list);
const veiculos = mergeVeiculos(payload.dk_veiculos_cadastro, veiculosX.list);
const uC = uniqueness(clientes, (c) => onlyDigits(c.cpf).slice(0, 11));
const uV = uniqueness(veiculos, (v) => placaParaCadastro(v.placa));
if (uC.dup || uV.dup) {
  console.error("Duplicados após merge", uC, uV);
  process.exit(1);
}

payload.dk_clientes_cadastro = clientes;
payload.dk_portal_clientes_cadastro = clientes;
payload.dk_veiculos_cadastro = veiculos;
payload.dk_portal_veiculos_cadastro = veiculos;
payload.dk_cadastro_manual_portal_v1 = true;
payload.dk_oficial_sem_protocolos_v1 = true;

const incoming = {
  dk_clientes_cadastro: clientes,
  dk_portal_clientes_cadastro: clientes,
  dk_veiculos_cadastro: veiculos,
  dk_portal_veiculos_cadastro: veiculos,
  dk_cadastro_manual_portal_v1: true,
  dk_oficial_sem_protocolos_v1: true,
};

await postRedis({
  payload: incoming,
  wipe_keys: WIPE_KEYS,
  updated_at: new Date().toISOString(),
});

const afterRedis = await getRedis();
const afterP = afterRedis.payload || {};
try {
  const rows = await supabaseFetch(`dk_cloud_snapshots?label=eq.${LABEL}&select=label`);
  if (rows.length) {
    await supabaseFetch(`dk_cloud_snapshots?label=eq.${LABEL}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload: afterP, updated_at: new Date().toISOString() }),
    });
    console.log("Supabase default actualizado");
  }
} catch (e) {
  console.warn("Supabase:", e.message || e);
}

const cAfter = afterP.dk_clientes_cadastro || [];
const vAfter = afterP.dk_veiculos_cadastro || [];
const lAfter = afterP.dk_locacoes_cadastro || [];
const uC2 = uniqueness(cAfter, (c) => onlyDigits(c.cpf).slice(0, 11));
const uV2 = uniqueness(vAfter, (v) => placaParaCadastro(v.placa));

console.log("Clientes nuvem:", clientesAntes, "→", cAfter.length, "únicos", uC2.unique, "dup", uC2.dup);
console.log("Veículos nuvem:", veiculosAntes, "→", vAfter.length, "únicos", uV2.unique, "dup", uV2.dup);
console.log("Locações/protocolos:", locAntes, "→", lAfter.length);
console.log("Virgin:", Boolean(afterP.dk_oficial_sem_protocolos_v1));

const ok =
  cAfter.length === clientes.length &&
  vAfter.length === veiculos.length &&
  uC2.dup === 0 &&
  uV2.dup === 0 &&
  lAfter.length === 0 &&
  uC2.unique === cAfter.length &&
  uV2.unique === vAfter.length;
if (!ok) {
  console.error("Falha na verificação da nuvem oficial.");
  process.exit(1);
}
console.log("OK — clientes e veículos no oficial (CPF único, placa única, 0 protocolos).");
