/**
 * Canal demo vs oficial nas APIs Vercel (Redis / gate app cliente).
 */
const REDIS_SNAPSHOT_KEYS = {
  default: "dk:portal:cloud_snapshot:v1",
  demo: "dk:portal:cloud_snapshot:demo:v1",
};

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

function resolveDeployChannel(req) {
  const q = String(req.query?.channel || "").trim().toLowerCase();
  if (q === "demo") return "demo";
  const hdr = String(req.headers["x-dk-deploy-channel"] || "").trim().toLowerCase();
  if (hdr === "demo") return "demo";
  const origin = String(req.headers.origin || req.headers.referer || "");
  if (/demo\.grupodkempreendimentos\.com\.br/i.test(origin)) return "demo";
  if (/^https?:\/\/demo\./i.test(origin)) return "demo";
  const env = String(process.env.DK_DEPLOY_CHANNEL || "").trim().toLowerCase();
  if (env === "demo") return "demo";
  return "default";
}

async function fetchPortalCadastrosFromRedis(redis, channel) {
  const snapKey = channel === "demo" ? REDIS_SNAPSHOT_KEYS.demo : REDIS_SNAPSHOT_KEYS.default;
  const rawSnap = await redis.get(snapKey);
  const payload = parseSnapshotPayload(rawSnap);
  if (payload) {
    const clientes = Array.isArray(payload.dk_clientes_cadastro) ? payload.dk_clientes_cadastro : [];
    const locs = Array.isArray(payload.dk_locacoes_cadastro) ? payload.dk_locacoes_cadastro : [];
    if (clientes.length || locs.length) {
      return { clientes, locs, source: "snapshot", channel };
    }
  }
  const [rawClientes, rawLocs] = await Promise.all([
    redis.get(LEGACY_CLIENTES_KEY),
    redis.get(LEGACY_LOCACOES_KEY),
  ]);
  return {
    clientes: parseRedisArray(rawClientes),
    locs: parseRedisArray(rawLocs),
    source: "legacy",
    channel,
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
};
