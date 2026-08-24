/**
 * Oficial: importa CADASTRO DE LOCAÇÕES(PROTOCOLOS).xlsx (protocolo único).
 * Coluna «Locação» da planilha = valor do aluguel no sistema (`valorLocacao`).
 * Não altera clientes/veículos nem o canal demo. Depois da importação, locações novas
 * entram pelo cadastro do portal.
 *
 *   node grupodkempreendimentos/scripts/import-xlsx-locacoes-oficial.mjs
 *   node grupodkempreendimentos/scripts/import-xlsx-locacoes-oficial.mjs --patch-aluguel --confirm
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
const FILE = "CADASTRO DE LOCAÇOES(PROTOCOLOS).xlsx";
const EXPECTED = 526;
const PLACA_ANTIGA_RE = /^[A-Z]{3}[0-9]{4}$/;
const PLACA_ANTIGA_PARA_MERCOSUL = "ABCDEFGHIJ";
const MERCOSUL_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const WIPE_KEYS = ["dk_locacoes_cadastro"];

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

function normName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toBrDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getUTCDate()).padStart(2, "0");
    const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${value.getUTCFullYear()}`;
  }
  const s = String(value).trim();
  if (!s || s === "..." || /^ativo$/i.test(s)) return "";
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000 && !s.includes("-") && !s.includes("/")) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return "";
}

function parseMoney(value) {
  let s = String(value ?? "").replace(/[R$\s\u00A0]/gi, "").trim();
  if (!s || s === "-" || s === "–") return 0;
  if (s.includes(",") && s.includes(".")) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function moneyBr(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseKm(value) {
  const d = onlyDigits(value);
  return d ? String(Number(d)) : "";
}

function pick(row, ...names) {
  const keys = Object.keys(row);
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const mapped = keys.map((k) => ({ k, n: norm(k) }));
  for (const n of names) {
    const want = norm(n);
    const hit = mapped.find((x) => x.n === want);
    if (hit && row[hit.k] != null && String(row[hit.k]).trim() !== "") return row[hit.k];
  }
  return "";
}

function statusLocacao(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (s.includes("CANCEL")) return "CT CANCELADO";
  if (s.includes("FINAL")) return "FINALIZADO";
  if (s.includes("ATIVO")) return "ATIVO";
  return s || "ATIVO";
}

async function supabaseFetch(pathRel, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathRel}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status} ${t.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) return res.json();
  return null;
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

function indexClientes(list) {
  const byCodigo = new Map();
  const byNome = new Map();
  for (const c of list || []) {
    const cpf = onlyDigits(c.cpf).slice(0, 11);
    if (cpf.length !== 11) continue;
    const cod = padCodigo(c.codigo);
    if (cod) byCodigo.set(cod, c);
    const nome = normName(c.nome);
    if (nome && !byNome.has(nome)) byNome.set(nome, c);
  }
  return { byCodigo, byNome };
}

function locacoesFromXlsx(clientes) {
  const fp = path.join(DATA, FILE);
  const wb = XLSX.readFile(fp, { cellDates: true, raw: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
  const { byCodigo, byNome } = indexClientes(clientes);
  const byProto = new Map();
  const skipped = { semProtocolo: 0, semPlaca: 0, semCliente: 0, dup: 0 };
  rows.forEach((row, idx) => {
    const protocolo = onlyDigits(pick(row, "Protocolo"));
    if (protocolo.length < 8) {
      skipped.semProtocolo += 1;
      return;
    }
    const placa = placaParaCadastro(pick(row, "Placa"));
    if (!placa) {
      skipped.semPlaca += 1;
      return;
    }
    const codigo = padCodigo(pick(row, "Cód. do Cliente", "Cod. do Cliente", "Código do Cliente"));
    const nomePlanilha = String(pick(row, "Cliente")).trim();
    const cli = (codigo && byCodigo.get(codigo)) || byNome.get(normName(nomePlanilha)) || null;
    if (!cli) {
      skipped.semCliente += 1;
      return;
    }
    if (byProto.has(protocolo)) skipped.dup += 1;
    const status = statusLocacao(pick(row, "Status"));
    const inicio = toBrDate(pick(row, "Data Inicio", "Data Início"));
    let fim = toBrDate(pick(row, "Data Fim"));
    if (status === "ATIVO") fim = "";
    const locacao = parseMoney(pick(row, "Locação", "Locacao", "Valor do Aluguel", "Valor Aluguel"));
    const investimento = parseMoney(pick(row, "Investimento"));
    const parcela = parseMoney(pick(row, "Valor da Parcela")) || locacao + investimento;
    const opcao = String(pick(row, "Opção de Contrato", "Opcao de Contrato")).trim();
    const now = Date.now() - (rows.length - idx) * 1000;
    byProto.set(protocolo, {
      id: now,
      createdAt: now,
      updatedAt: Date.now(),
      origemPortal: true,
      cadastroRetroativo: true,
      cpf: onlyDigits(cli.cpf).slice(0, 11),
      nome: String(cli.nome || nomePlanilha).trim(),
      clienteCodigo: codigo || padCodigo(cli.codigo),
      placa,
      inicio,
      fim,
      plano: opcao,
      opcaoContrato: opcao,
      marcaModelo: String(pick(row, "Marca Modelo", "Marca\nModelo")).trim(),
      periodoContrato: String(pick(row, "Período de Contrato", "Periodo de Contrato")).trim(),
      periodoLocacao: String(pick(row, "Período (Locação)", "Periodo (Locacao)")).trim(),
      diaPagto: String(pick(row, "Dia de Pagto", "Dia de Pagamento")).trim(),
      kmInicial: parseKm(pick(row, "Km de Retirada")),
      valorLocacao: moneyBr(locacao),
      valorInvestimento: moneyBr(investimento),
      valorParcela: moneyBr(parcela),
      valorSemanal: moneyBr(parcela),
      numeroContrato: protocolo,
      statusLocacao: status,
      ambiente: "real",
    });
  });
  return { list: [...byProto.values()], skipped, rows: rows.length, unique: byProto.size };
}

const redis = await getRedis();
if (redis.label !== "default") throw new Error("snapshot não é o canal oficial");
const payload = { ...(redis.payload || {}) };
const clientes = payload.dk_clientes_cadastro || [];
if (clientes.length !== 369) {
  console.error("Esperado 369 clientes na nuvem oficial, obtido", clientes.length);
  process.exit(1);
}

const parsed = locacoesFromXlsx(clientes);
console.log("Planilha locações:", parsed.rows, "linhas →", parsed.unique, "protocolos únicos", parsed.skipped);
if (parsed.unique !== EXPECTED) {
  console.error("Esperado", EXPECTED, "protocolos únicos, obtido", parsed.unique);
  process.exit(1);
}
if (parsed.skipped.semCliente) {
  console.error("Locações sem cliente correspondente no cadastro:", parsed.skipped.semCliente);
  process.exit(1);
}

const u = new Set(parsed.list.map((l) => l.numeroContrato));
if (u.size !== parsed.list.length) {
  console.error("Protocolos duplicados após parse");
  process.exit(1);
}

const probe = parsed.list.find((l) => onlyDigits(l.numeroContrato) === "2026070201");
if (!probe || parseMoney(probe.valorLocacao) < 300) {
  console.error("Falha: coluna Locação da planilha não mapeou para valor do aluguel", probe);
  process.exit(1);
}

const existing = payload.dk_locacoes_cadastro || [];
const byXlsx = new Map(parsed.list.map((l) => [onlyDigits(l.numeroContrato), l]));
let wouldPatchAluguel = 0;
for (const loc of existing) {
  const x = byXlsx.get(onlyDigits(loc.numeroContrato));
  if (!x) continue;
  if (parseMoney(loc.valorLocacao) <= 0 && parseMoney(x.valorLocacao) > 0) wouldPatchAluguel += 1;
}
console.log(
  "Nuvem oficial:",
  existing.length,
  "protocolos com valor do aluguel vazio a preencher da coluna Locação:",
  wouldPatchAluguel
);

if (process.argv.includes("--patch-aluguel")) {
  if (!process.argv.includes("--confirm")) {
    console.log("Dry-run. Para gravar o valor do aluguel (coluna Locação): --patch-aluguel --confirm");
    process.exit(0);
  }
  const now = Date.now();
  const patched = existing.map((loc) => {
    const x = byXlsx.get(onlyDigits(loc.numeroContrato));
    if (!x) return loc;
    const curLoc = parseMoney(loc.valorLocacao);
    const nextLoc = parseMoney(x.valorLocacao);
    const curInv = parseMoney(loc.valorInvestimento);
    const nextInv = parseMoney(x.valorInvestimento);
    if ((curLoc > 0 || nextLoc <= 0) && (curInv > 0 || nextInv <= 0)) return loc;
    return {
      ...loc,
      valorLocacao: curLoc > 0 ? loc.valorLocacao : x.valorLocacao,
      valorInvestimento: curInv > 0 ? loc.valorInvestimento : x.valorInvestimento,
      updatedAt: now,
    };
  });
  if (patched.length !== existing.length) {
    console.error("Recusa: o patch não pode alterar a quantidade de locações.");
    process.exit(1);
  }
  await postRedis({
    payload: { dk_locacoes_cadastro: patched },
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
  const lAfter = afterP.dk_locacoes_cadastro || [];
  const filled = lAfter.filter((l) => parseMoney(l.valorLocacao) > 0).length;
  const stillZero = lAfter.filter((l) => {
    const x = byXlsx.get(onlyDigits(l.numeroContrato));
    return x && parseMoney(x.valorLocacao) > 0 && parseMoney(l.valorLocacao) <= 0;
  }).length;
  const cAfter = (afterP.dk_clientes_cadastro || []).length;
  const vAfter = (afterP.dk_veiculos_cadastro || []).length;
  console.log("Locações:", lAfter.length, "com valor do aluguel preenchido:", filled, "ainda vazio:", stillZero);
  console.log("Clientes/veículos intactos:", cAfter, vAfter);
  const probeAfter = lAfter.find((l) => onlyDigits(l.numeroContrato) === "2026070201");
  const ok =
    lAfter.length === existing.length &&
    stillZero === 0 &&
    parseMoney(probeAfter?.valorLocacao) >= 300 &&
    cAfter === 369 &&
    vAfter === 186;
  if (!ok) {
    console.error("Falha na verificação do patch de valor do aluguel.");
    process.exit(1);
  }
  console.log("OK — valor do aluguel = coluna Locação da planilha, sem apagar protocolos.");
  process.exit(0);
}

if (!process.argv.includes("--confirm")) {
  const ativos = parsed.list.filter((l) => l.statusLocacao === "ATIVO").length;
  console.log("Dry-run. ATIVO:", ativos, "FINALIZADO:", parsed.list.filter((l) => l.statusLocacao === "FINALIZADO").length);
  console.log("Para preencher valor do aluguel na nuvem: --patch-aluguel --confirm");
  console.log("Para reimportar a lista inteira (não use se já houver protocolos no portal): --confirm");
  process.exit(0);
}

const locAntes = (payload.dk_locacoes_cadastro || []).length;
await postRedis({
  payload: {
    dk_locacoes_cadastro: parsed.list,
    dk_oficial_sem_protocolos_v1: false,
    dk_oficial_locacoes_importadas_v1: true,
    dk_cadastro_manual_portal_v1: true,
  },
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

const lAfter = afterP.dk_locacoes_cadastro || [];
const uniq = new Set(lAfter.map((l) => onlyDigits(l.numeroContrato)));
const cAfter = (afterP.dk_clientes_cadastro || []).length;
const vAfter = (afterP.dk_veiculos_cadastro || []).length;
console.log("Locações nuvem:", locAntes, "→", lAfter.length, "únicos", uniq.size);
console.log("Clientes/veículos intactos:", cAfter, vAfter);
console.log("Virgin protocolos:", afterP.dk_oficial_sem_protocolos_v1);

const ok =
  lAfter.length === EXPECTED &&
  uniq.size === EXPECTED &&
  cAfter === 369 &&
  vAfter === 186 &&
  afterP.dk_oficial_sem_protocolos_v1 === false;
if (!ok) {
  console.error("Falha na verificação da nuvem oficial.");
  process.exit(1);
}
console.log("OK — 526 locações/protocolos no oficial (protocolo único). Clientes 369 · veículos 186.");
