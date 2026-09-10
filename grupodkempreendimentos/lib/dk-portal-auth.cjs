/**
 * Fase 1A — autenticação de API + rate limit.
 * Não altera merge nem apaga dados Redis de negócio.
 */
const crypto = require("crypto");
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const AUTH_HEADERS =
  "Content-Type, Authorization, X-DK-Portal-Token, X-DK-Deploy-Channel, x-dk-backup-secret, x-dk-whatsapp-secret";

function signingSecret() {
  return String(
    process.env.DK_PORTAL_API_SECRET ||
      process.env.DK_BACKUP_SEND_SECRET ||
      process.env.CRON_SECRET ||
      ""
  ).trim();
}

function serviceSecrets() {
  return [
    process.env.DK_PORTAL_API_SECRET,
    process.env.DK_BACKUP_SEND_SECRET,
    process.env.CRON_SECRET,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
}

function applyApiCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", AUTH_HEADERS);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return fwd || String(req.socket?.remoteAddress || "unknown");
}

function readBearer(req) {
  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-dk-portal-token"] || "").trim();
}

function isServiceCredential(req) {
  const secrets = serviceSecrets();
  if (!secrets.length) return false;
  const candidates = [
    readBearer(req),
    String(req.headers["x-dk-backup-secret"] || "").trim(),
    String(req.headers["x-dk-whatsapp-secret"] || "").trim(),
  ].filter(Boolean);
  return candidates.some((c) => secrets.includes(c));
}

function signToken(payload) {
  const secret = signingSecret();
  if (!secret) throw new Error("auth_secret_missing");
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySignedToken(token) {
  const secret = signingSecret();
  if (!secret || !token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function mintToken(claims) {
  const now = Date.now();
  return signToken({
    ...claims,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  });
}

/**
 * @param {{ allowCliente?: boolean, allowEquipa?: boolean, allowService?: boolean }} opts
 */
function requirePortalAuth(req, opts = {}) {
  const allowCliente = opts.allowCliente !== false;
  const allowEquipa = opts.allowEquipa !== false;
  const allowService = opts.allowService !== false;
  if (!signingSecret() && !serviceSecrets().length) {
    return { ok: false, status: 503, reason: "auth_not_configured" };
  }
  if (allowService && isServiceCredential(req)) {
    return { ok: true, typ: "service", role: "owner", cpf: "", service: true };
  }
  const payload = verifySignedToken(readBearer(req));
  if (!payload) {
    return { ok: false, status: 401, reason: "unauthorized" };
  }
  if (payload.typ === "equipa" && allowEquipa) return { ok: true, ...payload };
  if (payload.typ === "cliente" && allowCliente) return { ok: true, ...payload };
  return { ok: false, status: 403, reason: "forbidden" };
}

async function enforceRateLimit(req, res, bucket, maxPerMin) {
  const ip = clientIp(req);
  const window = Math.floor(Date.now() / 60000);
  const key = `dk:rl:${bucket}:${ip}:${window}`;
  try {
    if (!isRedisKvConfigured()) return false;
    const redis = createRedisClient();
    const n = Number(await redis.incr(key));
    if (n === 1) await redis.expire(key, 120);
    if (n > maxPerMin) {
      res.status(429).json({ ok: false, reason: "rate_limited" });
      return true;
    }
  } catch {
    /* fail-open: não bloquear o portal se o contador falhar */
  }
  return false;
}

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normalizeProto(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function parseSnapshotRow(raw) {
  if (raw == null) return null;
  let row = raw;
  if (typeof raw === "string") {
    try {
      row = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return row && typeof row === "object" ? row : null;
}

async function loadOfficialSnapshotPayload() {
  if (!isRedisKvConfigured()) return null;
  const redis = createRedisClient();
  const raw = await redis.get("dk:portal:cloud_snapshot:v1");
  const row = parseSnapshotRow(raw);
  return row?.payload && typeof row.payload === "object" ? row.payload : null;
}

function findFuncionario(payload, cpf) {
  const arr = Array.isArray(payload?.dk_funcionarios_access) ? payload.dk_funcionarios_access : [];
  return arr.find((f) => onlyDigits(f?.cpf).slice(0, 11) === cpf) || null;
}

function findCliente(payload, cpf) {
  const arr = Array.isArray(payload?.dk_clientes_cadastro) ? payload.dk_clientes_cadastro : [];
  return arr.find((c) => onlyDigits(c?.cpf).slice(0, 11) === cpf) || null;
}

function clienteTemProtocolo(payload, cpf, proto) {
  const locs = Array.isArray(payload?.dk_locacoes_cadastro) ? payload.dk_locacoes_cadastro : [];
  return locs.some((l) => {
    const lc = onlyDigits(l?.cpf).slice(0, 11);
    const np = normalizeProto(l?.numeroContrato || l?.protocolo);
    return lc === cpf && np && np === proto;
  });
}

function publicFuncionario(f) {
  if (!f || typeof f !== "object") return null;
  return {
    cpf: onlyDigits(f.cpf).slice(0, 11),
    nome: String(f.nome || "").trim(),
    role: String(f.role || "").trim(),
    blocked: Boolean(f.blocked),
    mustChangePassword: Boolean(f.mustChangePassword),
    acessos: f.acessos && typeof f.acessos === "object" ? f.acessos : undefined,
    horarioAcesso: f.horarioAcesso || undefined,
    adminNivel: f.adminNivel || undefined,
  };
}

module.exports = {
  applyApiCors,
  clientIp,
  signingSecret,
  isServiceCredential,
  mintToken,
  verifySignedToken,
  requirePortalAuth,
  enforceRateLimit,
  loadOfficialSnapshotPayload,
  findFuncionario,
  findCliente,
  clienteTemProtocolo,
  publicFuncionario,
  onlyDigits,
  normalizeProto,
  TOKEN_TTL_MS,
};
