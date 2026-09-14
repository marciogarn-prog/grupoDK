/**
 * Canal oficial nas APIs Vercel (Redis / gate app cliente).
 */
const { mergeClientesCadastro, mergeLocacoesCadastro } = require("./dk-append-only-merge.cjs");

const REDIS_SNAPSHOT_KEY = "dk:portal:cloud_snapshot:v1";

const LEGACY_CLIENTES_KEY = "dk:portal:clientes_cadastro:v1";
const LEGACY_LOCACOES_KEY = "dk:portal:locacoes_cadastro:v1";

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normProto(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function parseRedisArray(raw) {
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

function parseSnapshotPayload(raw) {
  if (raw == null) return null;
  let row = raw;
  if (typeof raw === "string") {
    try {
      row = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (row?.payload && typeof row.payload === "object") return row.payload;
  if (row && typeof row === "object" && !Array.isArray(row)) {
    if (Array.isArray(row.dk_clientes_cadastro) || Array.isArray(row.dk_locacoes_cadastro)) return row;
  }
  return null;
}

function resolveDeployChannel() {
  return "default";
}

const OFICIAL_CLIENTES_CPF_EXCLUIDOS = new Set([
  "00000000001",
  "00000000003",
  "00000000004",
  "06523244440",
  "04292253420",
  "07534147409",
  "00445040556",
  "01303628514",
  "01503608514",
  "01503628514",
]);
const OFICIAL_LOCACOES_NC_EXCLUIDOS = new Set(["2026052002"]);

function dropClientesCpfExcluidos(list) {
  return (Array.isArray(list) ? list : []).filter((c) => {
    const d = onlyDigits(c?.cpf).slice(0, 11);
    return d.length === 11 && !OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(d);
  });
}

function dropLocacoesCpfExcluidos(list) {
  return (Array.isArray(list) ? list : []).filter((l) => {
    const d = onlyDigits(l?.cpf).slice(0, 11);
    if (d && OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(d)) return false;
    const nc = String(l?.numeroContrato || l?.protocolo || "").replace(/\D/g, "");
    if (nc && OFICIAL_LOCACOES_NC_EXCLUIDOS.has(nc)) return false;
    return true;
  });
}

async function fetchPortalCadastrosFromRedis(redis) {
  const [rawSnap, rawClientes, rawLocs] = await Promise.all([
    redis.get(REDIS_SNAPSHOT_KEY),
    redis.get(LEGACY_CLIENTES_KEY),
    redis.get(LEGACY_LOCACOES_KEY),
  ]);
  const payload = parseSnapshotPayload(rawSnap);
  const snapCli = Array.isArray(payload?.dk_clientes_cadastro) ? payload.dk_clientes_cadastro : [];
  const snapPortal = Array.isArray(payload?.dk_portal_clientes_cadastro)
    ? payload.dk_portal_clientes_cadastro
    : [];
  const legacyCli = parseRedisArray(rawClientes);
  const clientes = dropClientesCpfExcluidos(
    mergeClientesCadastro(mergeClientesCadastro(snapCli, snapPortal), legacyCli)
  );
  const snapLocs = Array.isArray(payload?.dk_locacoes_cadastro) ? payload.dk_locacoes_cadastro : [];
  const locs = dropLocacoesCpfExcluidos(
    snapLocs.length ? mergeLocacoesCadastro(snapLocs, parseRedisArray(rawLocs)) : parseRedisArray(rawLocs)
  );
  return {
    clientes,
    locs,
    source: payload ? "snapshot+legacy" : "legacy",
    channel: "default",
  };
}

function matchClienteProtocoloGate(cpf, protoIn, clientes, locs) {
  const cliente = (clientes || []).find((c) => onlyDigits(c.cpf) === cpf) || null;
  const hit = (locs || []).find(
    (l) => onlyDigits(l.cpf) === cpf && normProto(l.numeroContrato) === protoIn
  );
  if (!hit) {
    return {
      ok: false,
      msg: "Protocolo não encontrado para este CPF. Verifique os dados ou contacte a locadora.",
    };
  }
  const nome = String(cliente?.nome || hit.nome || hit.cliente || "").trim();
  if (!nome) {
    return { ok: false, msg: "Cliente não cadastrado. Contacte a DK Locadora." };
  }
  return { ok: true, cpf, proto: protoIn, nome, cliente: cliente || { cpf, nome }, loc: hit };
}

module.exports = {
  onlyDigits,
  normProto,
  parseRedisArray,
  resolveDeployChannel,
  fetchPortalCadastrosFromRedis,
  matchClienteProtocoloGate,
  dropClientesCpfExcluidos,
  dropLocacoesCpfExcluidos,
  OFICIAL_CLIENTES_CPF_EXCLUIDOS,
};
