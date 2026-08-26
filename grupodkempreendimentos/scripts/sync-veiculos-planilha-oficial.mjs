/**
 * Oficial: dk_veiculos_* = exactamente CADASTRO DE VEICULOS.xlsx (nada mais).
 * Não altera clientes nem locações.
 * Coluna TIPO da planilha → campo codigo (rótulo TIPO no formulário).
 *
 *   node grupodkempreendimentos/scripts/sync-veiculos-planilha-oficial.mjs --confirm
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
function toBrDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getUTCDate()).padStart(2, "0");
    const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${value.getUTCFullYear()}`;
  }
  const s = String(value).trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
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

function veiculosFromXlsx() {
  const fp = path.join(DATA, "CADASTRO DE VEICULOS.xlsx");
  const wb = XLSX.readFile(fp, { cellDates: true, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const byPlaca = new Map();
  const notes = [];
  rows.forEach((row, idx) => {
    let placaRaw = pick(row, "Placa");
    let cat = String(pick(row, "Categoria")).trim().toUpperCase();
    if (!normalizePlate(placaRaw) && /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(normalizePlate(cat))) {
      notes.push(`corrigido ${pick(row, "TAG")}: placa=${cat}`);
      placaRaw = cat;
      cat = String(pick(row, "TAG", "Tag")).toUpperCase().includes("DKCR") ? "CARRO" : "MOTO";
    }
    const placa = placaParaCadastro(placaRaw);
    if (!placa) {
      notes.push(`sem placa: ${pick(row, "TAG")}`);
      return;
    }
    const tipo = cat.includes("CARRO") ? "CARRO" : cat.includes("MOTO") ? "MOTO" : cat || "MOTO";
    const now = Date.now() - (rows.length - idx) * 1000;
    const tag = String(pick(row, "TAG", "Tag")).trim();
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
      renavam: onlyDigits(pick(row, "Renavam")),
      motor: String(pick(row, "Nº do Motor", "Motor")).trim(),
      proprietario: String(pick(row, "Proprietário", "Proprietario")).trim(),
      local: "",
      status: "DISPONIVEL",
      ambiente: "real",
      dataCadastro: toBrDate(pick(row, "Data do Cadastro")),
      cadastradoPorCpf: "03037897430",
      cadastradoPorNome: "Márcio Santos",
      cadastradoPorLabel: "Márcio Santos-030",
    });
  });
  return { list: [...byPlaca.values()], rows: rows.length, unique: byPlaca.size, notes };
}

async function main() {
  const sheet = veiculosFromXlsx();
  const motos = sheet.list.filter((v) => v.tipo === "MOTO").length;
  const carros = sheet.list.filter((v) => v.tipo === "CARRO").length;
  console.log({
    linhas: sheet.rows,
    unicos: sheet.unique,
    motos,
    carros,
    notes: sheet.notes,
    sampleTipo: sheet.list.slice(0, 3).map((v) => ({ tag: v.tag, placa: v.placa, tipo: v.codigo })),
  });

  if (!process.argv.includes("--confirm")) {
    console.log("Dry-run. Grave com --confirm");
    return;
  }

  const redis = await fetch(`${REDIS_URL}?n=${Date.now()}`).then((r) => r.json());
  if (!redis?.ok || redis.label !== "default") throw new Error("snapshot oficial indisponível");
  const payload = { ...(redis.payload || {}) };
  const locAntes = (payload.dk_locacoes_cadastro || []).length;
  const cliAntes = (payload.dk_clientes_cadastro || []).length;

  /* Preserva id/createdAt se a placa já existia. */
  const prevByPlaca = new Map();
  for (const v of payload.dk_veiculos_cadastro || []) {
    const pl = placaParaCadastro(v.placa);
    if (pl) prevByPlaca.set(pl, v);
  }
  const veiculos = sheet.list.map((v) => {
    const ex = prevByPlaca.get(v.placa);
    return {
      ...v,
      id: ex?.id ?? v.id,
      createdAt: ex?.createdAt ?? v.createdAt,
    };
  });

  const incoming = {
    ...payload,
    dk_veiculos_cadastro: veiculos,
    dk_portal_veiculos_cadastro: veiculos,
    dk_veiculos_frota_planilha: [],
  };
  const updated_at = new Date().toISOString();
  const post = await fetch(REDIS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload: incoming,
      updated_at,
      wipe_keys: ["dk_veiculos_cadastro", "dk_portal_veiculos_cadastro", "dk_veiculos_frota_planilha"],
    }),
  }).then((r) => r.json());
  if (!post?.ok) throw new Error(post?.error || post?.reason || "POST falhou");

  await fetch(`${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.${LABEL}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ payload: { ...payload, ...incoming }, updated_at }),
  });

  const after = await fetch(`${REDIS_URL}?n=${Date.now()}`).then((r) => r.json());
  const v = after.payload?.dk_veiculos_cadastro || [];
  const demo = v.filter((x) => /^(AAA|BBB|CCC)0/i.test(normalizePlate(x.placa)));
  console.log({
    ok: true,
    veiculos: v.length,
    motos: v.filter((x) => x.tipo === "MOTO").length,
    carros: v.filter((x) => x.tipo === "CARRO").length,
    demoSeeds: demo.length,
    clientesIntactos: (after.payload?.dk_clientes_cadastro || []).length === cliAntes,
    locacoesIntactas: (after.payload?.dk_locacoes_cadastro || []).length === locAntes,
    clientes: (after.payload?.dk_clientes_cadastro || []).length,
    locacoes: (after.payload?.dk_locacoes_cadastro || []).length,
  });
  if (v.length !== veiculos.length || demo.length) {
    process.exit(1);
  }
  console.log("OK — frota oficial = planilha CADASTRO DE VEICULOS.xlsx");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
