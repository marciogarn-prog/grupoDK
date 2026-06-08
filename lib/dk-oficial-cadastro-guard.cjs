/**
 * Oficial: bloqueia cadastros com data de registo anterior a hoje (fuso America/Sao_Paulo).
 * Usado na API Redis e espelhado em dk-oficial-cadastro-guard.js no browser.
 */
const CADASTRO_GUARD_KEYS = [
  "dk_clientes_cadastro",
  "dk_portal_clientes_cadastro",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_veiculos_frota_planilha",
  "dk_locacoes_cadastro",
  "dk_lancamentos_aluguel",
  "dk_lancamentos_aluguel_cadastro",
];

function todayCutoffYmd() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function parseAnyDateToYmd(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
    }
    return null;
  }
  const s = String(value).trim();
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ms = Date.parse(s);
  if (Number.isFinite(ms)) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));
  }
  return null;
}

function cadastroKeyFamily(key) {
  if (String(key).includes("cliente")) return "cliente";
  if (String(key).includes("veiculo") || String(key).includes("frota")) return "veiculo";
  if (String(key).includes("locacoes")) return "locacao";
  if (String(key).includes("lancamento")) return "lancamento";
  return "generic";
}

const DATE_FIELDS = {
  cliente: ["dataCadastro", "createdAt", "updatedAt"],
  veiculo: ["dataCadastro", "createdAt", "updatedAt"],
  locacao: ["dataCadastro", "createdAt", "updatedAt", "inicio", "dataInicio"],
  lancamento: ["dataCadastro", "data", "dataPagamento", "dataLancamento", "createdAt"],
  generic: ["dataCadastro", "createdAt"],
};

function extractRecordYmd(record, key) {
  if (!record || typeof record !== "object") return null;
  const family = cadastroKeyFamily(key);
  const fields = DATE_FIELDS[family] || DATE_FIELDS.generic;
  for (const f of fields) {
    const ymd = parseAnyDateToYmd(record[f]);
    if (ymd) return ymd;
  }
  return null;
}

function isRecordAllowedOnOficial(record, key, cutoffYmd = todayCutoffYmd()) {
  const ymd = extractRecordYmd(record, key);
  if (!ymd) return false;
  return ymd >= cutoffYmd;
}

function filterCadastroArrayForOficial(key, arr, cutoffYmd = todayCutoffYmd()) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((r) => isRecordAllowedOnOficial(r, key, cutoffYmd));
}

function sanitizePayloadForOficial(payload, cutoffYmd = todayCutoffYmd()) {
  if (!payload || typeof payload !== "object") return payload;
  const out = { ...payload };
  for (const k of CADASTRO_GUARD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(out, k)) continue;
    out[k] = filterCadastroArrayForOficial(k, out[k], cutoffYmd);
  }
  out.dk_oficial_cadastro_guard_v1 = cutoffYmd;
  return out;
}

function wipeCadastroKeys(payload) {
  const out = payload && typeof payload === "object" ? { ...payload } : {};
  for (const k of CADASTRO_GUARD_KEYS) out[k] = [];
  out.dk_cadastro_manual_portal_v1 = true;
  out.dk_cadastro_lock_v1 = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  out.dk_oficial_cadastro_guard_v1 = todayCutoffYmd();
  return out;
}

module.exports = {
  CADASTRO_GUARD_KEYS,
  todayCutoffYmd,
  isRecordAllowedOnOficial,
  filterCadastroArrayForOficial,
  sanitizePayloadForOficial,
  wipeCadastroKeys,
};
