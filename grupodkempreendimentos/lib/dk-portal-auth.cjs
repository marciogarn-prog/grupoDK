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

async function enforceRateLimit(req, res, bucket, maxPerMin, opts) {
  const identRaw = opts && opts.identity != null && String(opts.identity).trim()
    ? String(opts.identity)
    : clientIp(req);
  const ident = String(identRaw).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 80) || "unknown";
  const window = Math.floor(Date.now() / 60000);
  const key = `dk:rl:${bucket}:${ident}:${window}`;
  try {
    if (!isRedisKvConfigured()) return false;
    const redis = createRedisClient();
    const n = Number(await redis.incr(key));
    if (n === 1) await redis.expire(key, 120);
    if (n > maxPerMin) {
      const retryAfter = Math.max(1, 60 - (Math.floor(Date.now() / 1000) % 60));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ ok: false, reason: "rate_limited", retryAfter, bucket });
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

const {
  normalizeOperacaoAccess,
  ownerWriteAccess,
} = require("./dk-portal-module-access.cjs");

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

function isBcryptHash(s) {
  return /^\$2[aby]\$/.test(String(s || ""));
}

function hashPassword(plain) {
  const bcrypt = require("bcryptjs");
  return bcrypt.hashSync(String(plain || ""), 10);
}

function verifySecretAgainstRecord(plain, record) {
  const hash = String(record?.senhaHash || "").trim();
  const legacy = String(record?.senha || "").trim();
  const given = String(plain || "");
  if (hash && isBcryptHash(hash)) {
    const bcrypt = require("bcryptjs");
    return bcrypt.compareSync(given, hash);
  }
  if (legacy && !isBcryptHash(legacy)) return legacy === given;
  return false;
}

function needsPasswordUpgrade(record) {
  const hash = String(record?.senhaHash || "").trim();
  const legacy = String(record?.senha || "").trim();
  return Boolean(legacy) && !isBcryptHash(legacy) && !isBcryptHash(hash);
}

function applyPasswordUpgradeToRecord(record, plain) {
  if (!record || typeof record !== "object") return record;
  if (isBcryptHash(record.senhaHash)) return record;
  const hash = hashPassword(plain);
  const senha = String(record.senha || "").trim();
  return { ...record, senhaHash: hash, senha };
}

function clienteAuthRecord(c) {
  if (!c || typeof c !== "object") return null;
  if (String(c.senhaHash || "").trim()) return c;
  const senha = String(c.senha || "123456").trim() || "123456";
  return { ...c, senha };
}

async function persistPasswordUpgrade(kind, cpf, plain) {
  if (!isRedisKvConfigured()) return false;
  const redis = createRedisClient();
  const key = "dk:portal:cloud_snapshot:v1";
  const raw = await redis.get(key);
  const row = parseSnapshotRow(raw);
  if (!row?.payload || typeof row.payload !== "object") return false;
  const arrKey = kind === "cliente" ? "dk_clientes_cadastro" : "dk_funcionarios_access";
  const arr = Array.isArray(row.payload[arrKey]) ? row.payload[arrKey] : [];
  let changed = false;
  row.payload[arrKey] = arr.map((item) => {
    if (!item || typeof item !== "object") return item;
    if (onlyDigits(item.cpf).slice(0, 11) !== cpf) return item;
    const next = applyPasswordUpgradeToRecord(item, plain);
    if (next !== item) changed = true;
    return next;
  });
  if (!changed) return false;
  await redis.set(key, JSON.stringify(row));
  return true;
}

/**
 * IDENTIDADE + ROLE + ACESSOS + OPERAÇÃO (escrita de módulo).
 * Owner e service (escopo explícito) passam. Operação só com acessos[modulo].
 */
async function requireModuleAccess(req, modulo) {
  const gate = requirePortalAuth(req, { allowCliente: false, allowEquipa: true, allowService: true });
  if (!gate.ok) return gate;
  if (gate.service) {
    return { ok: true, ...gate, acessos: ownerWriteAccess(), scopes: ["snapshot", "backup", "cadastro", "whatsapp", "cron", "geo"] };
  }
  if (String(gate.role || "").trim() === "owner") {
    return { ok: true, ...gate, acessos: ownerWriteAccess() };
  }
  let payload = null;
  try {
    payload = await loadOfficialSnapshotPayload();
  } catch {
    return { ok: false, status: 503, reason: "snapshot_unavailable" };
  }
  const f = findFuncionario(payload, onlyDigits(gate.cpf).slice(0, 11));
  if (!f || f.blocked) return { ok: false, status: 403, reason: "forbidden" };
  if (String(f.role || "").trim() === "owner") {
    return { ok: true, ...gate, acessos: ownerWriteAccess(), funcionario: f };
  }
  const acessos = normalizeOperacaoAccess(f.acessos, f.role);
  if (!acessos[modulo]) {
    return { ok: false, status: 403, reason: "module_forbidden", modulo };
  }
  return { ok: true, ...gate, acessos, funcionario: f };
}

module.exports = {
  applyApiCors,
  clientIp,
  signingSecret,
  isServiceCredential,
  mintToken,
  verifySignedToken,
  requirePortalAuth,
  requireModuleAccess,
  enforceRateLimit,
  loadOfficialSnapshotPayload,
  findFuncionario,
  findCliente,
  clienteTemProtocolo,
  publicFuncionario,
  onlyDigits,
  normalizeProto,
  hashPassword,
  verifySecretAgainstRecord,
  needsPasswordUpgrade,
  applyPasswordUpgradeToRecord,
  clienteAuthRecord,
  persistPasswordUpgrade,
  TOKEN_TTL_MS,
};
