/** Simula dedupe: 2026082801 fantasma + 2026011601 canónico (mesmo CPF/placa/início). */
function parseBrDate(s) {
  const m = String(s || "")
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}
function normalizeNumeroContratoKey(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}
function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function normalizePlate(x) {
  return String(x || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function protocoloLocacaoDatePrefix(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
function parseProtocoloNumeroContrato(ncRaw) {
  const nc = String(normalizeNumeroContratoKey(ncRaw || "")).replace(/\s+/g, "");
  const m = nc.match(/^(\d{8})(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], seq: Number(m[2]), full: nc };
}
function protocoloPrefixFromLocacaoInicio(loc) {
  const d = parseBrDate(String(loc?.inicio || "").trim());
  if (!d || Number.isNaN(d.getTime())) return "";
  return protocoloLocacaoDatePrefix(d);
}
function isProtocoloAlignedWithLocacaoInicio(ncRaw, loc) {
  const expected = protocoloPrefixFromLocacaoInicio(loc);
  if (!expected) return true;
  const parts = parseProtocoloNumeroContrato(ncRaw);
  if (!parts) return false;
  return parts.prefix === expected;
}
function locacaoContratoNaturalKey(loc) {
  const cpf = onlyDigits(String(loc?.cpf || ""));
  const placa = normalizePlate(String(loc?.placa || ""));
  const inicio = String(loc?.inicio || "").trim();
  if (cpf.length !== 11 || !placa) return "";
  return `${cpf}|${placa}|${inicio}`;
}
function scoreLocacaoCanonica(loc) {
  const nc = String(normalizeNumeroContratoKey(loc?.numeroContrato || "")).replace(/\s+/g, "");
  let score = 0;
  if (isProtocoloAlignedWithLocacaoInicio(nc, loc)) score += 100000;
  if (Array.isArray(loc.portalLancamentosAluguel)) score += loc.portalLancamentosAluguel.length * 1000;
  score += Math.min(Number(loc.createdAt || loc.id || 0), 1e15) / 1e10;
  return score;
}
function mergePortalLancamentosNoKeeper(keeper, dup, keeperNc) {
  const base = Array.isArray(keeper.portalLancamentosAluguel) ? keeper.portalLancamentosAluguel : [];
  const extra = Array.isArray(dup.portalLancamentosAluguel) ? dup.portalLancamentosAluguel : [];
  if (!extra.length) return keeper;
  return {
    ...keeper,
    portalLancamentosAluguel: [
      ...base,
      ...extra.map((p) => ({ ...p, numeroContrato: keeperNc })),
    ],
  };
}
function deduplicateLocacoesCadastro(locs) {
  const remap = new Map();
  let list = locs.map((l) => ({ ...l }));
  const byNatural = new Map();
  list.forEach((loc) => {
    const key = locacaoContratoNaturalKey(loc);
    if (!key) return;
    if (!byNatural.has(key)) byNatural.set(key, []);
    byNatural.get(key).push(loc);
  });
  const dropIds = new Set();
  byNatural.forEach((group) => {
    if (group.length <= 1) return;
    group.sort((a, b) => scoreLocacaoCanonica(b) - scoreLocacaoCanonica(a));
    let keeper = { ...group[0] };
    const keeperNc = String(normalizeNumeroContratoKey(keeper.numeroContrato || "")).replace(/\s+/g, "");
    for (let i = 1; i < group.length; i++) {
      const dup = group[i];
      dropIds.add(Number(dup.id));
      const dupNc = String(normalizeNumeroContratoKey(dup.numeroContrato || "")).replace(/\s+/g, "");
      if (dupNc && keeperNc && dupNc !== keeperNc) remap.set(dupNc, keeperNc);
      keeper = mergePortalLancamentosNoKeeper(keeper, dup, keeperNc);
    }
    const ki = list.findIndex((x) => Number(x.id) === Number(keeper.id));
    if (ki >= 0) list[ki] = keeper;
  });
  list = list.filter((l) => !dropIds.has(Number(l.id)));
  return { locs: list, remap };
}

const locs = [
  {
    id: 1,
    numeroContrato: "2026011601",
    cpf: "00175015554",
    placa: "SOU5C59",
    inicio: "16/01/2026",
    fim: "27/03/2026",
  },
  {
    id: 2,
    numeroContrato: "2026082801",
    cpf: "00175015554",
    placa: "SOU5C59",
    inicio: "16/01/2026",
    fim: "27/03/2026",
  },
  {
    id: 3,
    numeroContrato: "2025082801",
    cpf: "00175015554",
    placa: "SOU5C59",
    inicio: "28/08/2025",
    fim: "16/01/2026",
  },
];
const r = deduplicateLocacoesCadastro(locs);
console.log(
  "after",
  r.locs.map((l) => l.numeroContrato),
  "remap",
  [...r.remap.entries()]
);
