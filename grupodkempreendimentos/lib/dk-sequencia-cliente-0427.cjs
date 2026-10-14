/**
 * Em 14/10/2026 o titular mandou apagar os cadastros que apareciam depois do 0427.
 * Não foram feitos por funcionário da DK. O próximo código real é 0428.
 * Um cadastro novo (0428, 0429…) gravado depois do corte permanece.
 */
const SEQUENCIA_CLIENTE_TETO = 427;
const SEQUENCIA_CLIENTE_CORTE_MS = Date.parse("2026-10-14T19:55:00.000Z");
const SEQUENCIA_CLIENTE_CORTE_YMD = "2026-10-14";

function onlyDigitsCodigo(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

function numeroCodigoCadastro(raw) {
  const digits = onlyDigitsCodigo(raw);
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseDataCadastroYmd(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function instanteCriacaoMs(record) {
  const c = Number(record?.createdAt || 0);
  if (c > 1e12) return c;
  const id = Number(record?.id || 0);
  if (id > 1e12) return id;
  return 0;
}

function cpfSoDigitoRepetido(cpf) {
  const d = onlyDigitsCodigo(cpf).slice(0, 11);
  return d.length === 11 && /^(\d)\1{10}$/.test(d);
}

/**
 * true = este registo não entra no oficial (código furado acima de 0427, anterior à limpeza).
 * campo: "codigo" no cliente, "clienteCodigo" na locação.
 */
function isCodigoAcimaDoUltimoClienteOficial(record, campo) {
  if (!record || typeof record !== "object") return false;
  const n = numeroCodigoCadastro(record[campo || "codigo"]);
  if (n <= SEQUENCIA_CLIENTE_TETO) return false;
  const ymd = parseDataCadastroYmd(record.dataCadastro || record.dataInicio || record.inicio);
  if (ymd && ymd < SEQUENCIA_CLIENTE_CORTE_YMD) return true;
  const created = instanteCriacaoMs(record);
  if (created && created >= SEQUENCIA_CLIENTE_CORTE_MS) return false;
  return true;
}

module.exports = {
  SEQUENCIA_CLIENTE_TETO,
  SEQUENCIA_CLIENTE_CORTE_MS,
  SEQUENCIA_CLIENTE_CORTE_YMD,
  numeroCodigoCadastro,
  cpfSoDigitoRepetido,
  isCodigoAcimaDoUltimoClienteOficial,
};
