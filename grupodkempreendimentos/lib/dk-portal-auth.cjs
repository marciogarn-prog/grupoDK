/**
 * Fase 1A — autenticação de API + rate limit.
 * Não altera merge nem apaga dados Redis de negócio.
 */
const crypto = require("crypto");
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const AUTH_HEADERS =
  "Content-Type, Authorization, X-DK-Portal-Token, X-DK-Deploy-Channel, X-DK-Client-Protocol, X-DK-User-Active, x-dk-backup-secret, x-dk-whatsapp-secret";

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

const SESSION_EPOCH_KEY = "dk:portal:session_epoch:v1";
const SESSION_EPOCH_META_KEY = "dk:portal:session_epoch_meta:v1";

function parseEpochN(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function tokenSessionGen(gate) {
  const n = Number(gate && gate.sg);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function readSessionEpoch() {
  const empty = { n: 0, at: null };
  if (!isRedisKvConfigured()) return empty;
  try {
    const redis = createRedisClient();
    const n = parseEpochN(await redis.get(SESSION_EPOCH_KEY));
    let at = null;
    const metaRaw = await redis.get(SESSION_EPOCH_META_KEY);
    if (metaRaw) {
      const meta = typeof metaRaw === "string" ? JSON.parse(metaRaw) : metaRaw;
      if (meta && meta.at) at = String(meta.at);
    }
    return { n, at };
  } catch {
    return empty;
  }
}

async function countRecentSnapshotOrigins() {
  if (!isRedisKvConfigured()) return null;
  try {
    const redis = createRedisClient();
    const idents = new Set();
    let cursor = 0;
    for (let i = 0; i < 20; i += 1) {
      const res = await redis.scan(cursor, { match: "dk:rl:cloud-snapshot*", count: 200 });
      const next = Array.isArray(res) ? res[0] : res && res.cursor;
      const keys = Array.isArray(res) ? res[1] : (res && res.keys) || [];
      cursor = Number(next || 0);
      for (const key of keys) {
        const parts = String(key).split(":");
        if (parts.length >= 5) idents.add(parts.slice(3, -1).join(":"));
      }
      if (cursor === 0) break;
    }
    return idents.size;
  } catch {
    return null;
  }
}

async function bumpSessionEpoch() {
  if (!isRedisKvConfigured()) {
    return { ok: false, status: 503, reason: "kv_not_configured" };
  }
  const redis = createRedisClient();
  const n = parseEpochN(await redis.incr(SESSION_EPOCH_KEY));
  const at = new Date().toISOString();
  await redis.set(SESSION_EPOCH_META_KEY, JSON.stringify({ n, at }));
  return { ok: true, n, at };
}

const DK_CLIENT_PROTOCOL_MIN = 20260913;
const SESSAO_ATIVA_TTL_SEC = 30 * 60;
const SESSAO_ATIVA_KEY_PREFIX = "dk:portal:sessao_ativa:v1:";

function readClientProtocol(req) {
  const raw =
    (req && req.headers && (req.headers["x-dk-client-protocol"] || req.headers["X-DK-Client-Protocol"])) ||
    "";
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function requestMarksUserActive(req) {
  const raw =
    (req && req.headers && (req.headers["x-dk-user-active"] || req.headers["X-DK-User-Active"])) ||
    "";
  return String(raw).trim() === "1";
}

function assertEquipaClientProtocol(gate, req) {
  if (!gate || !gate.ok || gate.service) return gate;
  if (String(gate.typ || "") !== "equipa") return gate;
  if (readClientProtocol(req) < DK_CLIENT_PROTOCOL_MIN) {
    return { ok: false, status: 403, reason: "client_stale" };
  }
  return gate;
}

function chaveSessaoAtiva(cpf) {
  return SESSAO_ATIVA_KEY_PREFIX + onlyDigits(cpf).slice(0, 11);
}

function formatCpfBr(cpf) {
  const d = onlyDigits(cpf).slice(0, 11);
  if (d.length !== 11) return String(cpf || "").trim() || "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function publicClientIp(req) {
  let s = clientIp(req);
  if (s.toLowerCase().startsWith("::ffff:")) s = s.slice(7);
  s = String(s || "").trim();
  return s || "desconhecido";
}

function newSessaoSid() {
  return crypto.randomBytes(16).toString("hex");
}

function parseSessaoAtivaRaw(raw) {
  const empty = { at: 0, sid: "", ip: "", deviceId: "" };
  if (raw == null) return empty;
  if (typeof raw === "number") {
    return { ...empty, at: Number.isFinite(raw) ? raw : 0 };
  }
  if (typeof raw === "object") {
    return {
      at: Number(raw.at || 0) || 0,
      sid: String(raw.sid || "").trim(),
      ip: String(raw.ip || "").trim(),
      deviceId: String(raw.deviceId || "").trim(),
    };
  }
  const t = String(raw).trim();
  if (!t) return empty;
  if (t.startsWith("{")) {
    try {
      return parseSessaoAtivaRaw(JSON.parse(t));
    } catch {
      /* legado */
    }
  }
  const n = Number(t);
  return { ...empty, at: Number.isFinite(n) ? n : 0 };
}

function sessaoEstaOcupada(rec, deviceId) {
  if (!rec || (!rec.at && !rec.sid)) return false;
  const dev = String(deviceId || "").trim();
  if (dev && rec.deviceId && rec.deviceId === dev) return false;
  return true;
}

function mensagemDesconectarSessao(cpf, ip) {
  const ipLab = String(ip || "").trim() || "desconhecido";
  return `O usuário CPF ${formatCpfBr(cpf)} será desconectado no IP ${ipLab} caso o login seja confirmado.`;
}

async function readSessaoAtiva(cpf) {
  const empty = { at: 0, sid: "", ip: "", deviceId: "" };
  const dig = onlyDigits(cpf).slice(0, 11);
  if (dig.length !== 11 || !isRedisKvConfigured()) return empty;
  try {
    const redis = createRedisClient();
    return parseSessaoAtivaRaw(await redis.get(chaveSessaoAtiva(dig)));
  } catch {
    return empty;
  }
}

async function touchSessaoAtiva(cpf, patch) {
  const dig = onlyDigits(cpf).slice(0, 11);
  if (dig.length !== 11 || !isRedisKvConfigured()) return false;
  try {
    const extra = patch && typeof patch === "object" ? patch : {};
    const existing = extra.replace ? { at: 0, sid: "", ip: "", deviceId: "" } : await readSessaoAtiva(dig);
    const rec = {
      at: Date.now(),
      sid: String(extra.sid || existing.sid || "").trim(),
      ip: String(extra.ip || existing.ip || "").trim(),
      deviceId: String(extra.deviceId || existing.deviceId || "").trim(),
    };
    const redis = createRedisClient();
    await redis.set(chaveSessaoAtiva(dig), JSON.stringify(rec), { ex: SESSAO_ATIVA_TTL_SEC });
    return true;
  } catch {
    return false;
  }
}

async function clearSessaoAtivaSeDona(cpf, sid) {
  const dig = onlyDigits(cpf).slice(0, 11);
  if (dig.length !== 11 || !isRedisKvConfigured()) return false;
  try {
    const rec = await readSessaoAtiva(dig);
    const mine = String(sid || "").trim();
    if (rec.sid && mine && rec.sid !== mine) return false;
    const redis = createRedisClient();
    await redis.del(chaveSessaoAtiva(dig));
    return true;
  } catch {
    return false;
  }
}

async function sessaoAtivaExiste(cpf) {
  const dig = onlyDigits(cpf).slice(0, 11);
  if (dig.length !== 11 || !isRedisKvConfigured()) return true;
  try {
    const redis = createRedisClient();
    const v = await redis.get(chaveSessaoAtiva(dig));
    return v != null && String(v).trim() !== "";
  } catch {
    return true;
  }
}

async function attachLiveSession(gate, req) {
  if (!gate || !gate.ok) return gate;
  if (gate.service) return gate;
  const proto = assertEquipaClientProtocol(gate, req);
  if (!proto.ok) return proto;
  if (String(gate.typ || "") === "equipa") {
    const cpf = onlyDigits(gate.cpf).slice(0, 11);
    if (cpf.length === 11) {
      const viva = await sessaoAtivaExiste(cpf);
      if (!viva) {
        return { ok: false, status: 401, reason: "session_idle" };
      }
      const rec = await readSessaoAtiva(cpf);
      const tokenSid = String(gate.sid || "").trim();
      const isCeoTitular = cpf === TITULAR_CEO_CPF || String(gate.role || "").trim() === "owner";
      if (!isCeoTitular && rec.sid && tokenSid && rec.sid !== tokenSid) {
        return { ok: false, status: 401, reason: "session_replaced", ip: rec.ip || "" };
      }
      if (!isCeoTitular && rec.sid && !tokenSid) {
        return { ok: false, status: 401, reason: "session_replaced", ip: rec.ip || "" };
      }
      if (requestMarksUserActive(req)) {
        await touchSessaoAtiva(cpf, { ip: publicClientIp(req) });
      }
    }
  }
  if (String(gate.role || "").trim() === "owner") return gate;
  try {
    const epoch = await readSessionEpoch();
    if (tokenSessionGen(gate) < epoch.n) {
      return { ok: false, status: 401, reason: "session_revoked" };
    }
  } catch {
    /* fail-open: Redis indisponível não trava o portal */
  }
  return gate;
}

async function requireLiveSession(req, opts) {
  return attachLiveSession(requirePortalAuth(req, opts), req);
}

async function mintTokenWithSession(claims) {
  const epoch = await readSessionEpoch();
  const sid = String(claims && claims.sid ? claims.sid : "").trim() || newSessaoSid();
  return mintToken({ ...claims, sid, sg: epoch.n });
}

async function requireCeoEmergencyLock(req) {
  const gate = requirePortalAuth(req, {
    allowCliente: false,
    allowEquipa: true,
    allowService: false,
  });
  if (!gate.ok) return gate;
  const live = await attachLiveSession(gate, req);
  if (!live.ok) return live;
  if (String(live.typ || "") !== "equipa" || String(live.role || "") !== "owner") {
    return { ok: false, status: 403, reason: "forbidden" };
  }
  return live;
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
  const { isQuotaError, isCloudBudgetTripped, tripCloudBudget, budgetReject, allowRedisAttempt } = require("./dk-cloud-budget.cjs");
  allowRedisAttempt();
  if (isCloudBudgetTripped()) return budgetReject(res);
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
  } catch (e) {
    if (isQuotaError(e)) {
      tripCloudBudget();
      return budgetReject(res);
    }
    /* fail-open só se não for cota: não bloquear o portal se o contador falhar */
  }
  return false;
}

/** 3 senhas erradas → bloqueio de 1 hora (por CPF). */
const LOGIN_FAIL_MAX = 3;
const LOGIN_LOCK_MS = 60 * 60 * 1000;
const LOGIN_FAIL_TTL_SEC = 60 * 60 + 120;

function chaveLoginFail(cpf) {
  return `dk:portal:login_fail:v1:${onlyDigits(cpf).slice(0, 11)}`;
}

function mensagemSenhaNaoConfere(attemptsLeft) {
  const n = Math.max(0, Number(attemptsLeft) || 0);
  if (n <= 0) {
    return "Senha não confere. Você esgotou as 3 tentativas. Tente novamente após 1 hora.";
  }
  return `Senha não confere. Você tem mais ${n} tentativa${n === 1 ? "" : "s"}.`;
}

function mensagemLoginBloqueado(lockedUntilMs) {
  const restante = Math.max(0, Number(lockedUntilMs || 0) - Date.now());
  const mins = Math.max(1, Math.ceil(restante / 60000));
  return `Acesso bloqueado por excesso de tentativas com senha. Tente novamente após ${mins} min.`;
}

function parseLoginFailRaw(raw) {
  if (raw == null) return { fails: 0, lockedUntil: 0 };
  let row = raw;
  if (typeof raw === "string") {
    try {
      row = JSON.parse(raw);
    } catch {
      return { fails: 0, lockedUntil: 0 };
    }
  }
  if (!row || typeof row !== "object") return { fails: 0, lockedUntil: 0 };
  return {
    fails: Math.max(0, Number(row.fails) || 0),
    lockedUntil: Math.max(0, Number(row.lockedUntil) || 0),
  };
}

async function readLoginFailState(cpf) {
  const dig = onlyDigits(cpf).slice(0, 11);
  if (dig.length !== 11 || !isRedisKvConfigured()) return { fails: 0, lockedUntil: 0 };
  try {
    const redis = createRedisClient();
    return parseLoginFailRaw(await redis.get(chaveLoginFail(dig)));
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
}

/**
 * Se o CPF estiver bloqueado, responde 429 e devolve true.
 * Caso contrário devolve false (pode tentar login).
 */
async function rejectIfLoginPasswordLocked(res, cpf) {
  const dig = onlyDigits(cpf).slice(0, 11);
  if (dig.length !== 11) return false;
  const st = await readLoginFailState(dig);
  if (st.lockedUntil && st.lockedUntil > Date.now()) {
    const retryAfter = Math.max(1, Math.ceil((st.lockedUntil - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      ok: false,
      reason: "password_locked",
      message: mensagemLoginBloqueado(st.lockedUntil),
      attemptsLeft: 0,
      lockedUntil: st.lockedUntil,
      retryAfter,
    });
    return true;
  }
  return false;
}

async function registerLoginPasswordFailure(cpf) {
  const dig = onlyDigits(cpf).slice(0, 11);
  const empty = {
    attemptsLeft: LOGIN_FAIL_MAX - 1,
    locked: false,
    lockedUntil: 0,
    message: mensagemSenhaNaoConfere(LOGIN_FAIL_MAX - 1),
  };
  if (dig.length !== 11) return empty;
  if (!isRedisKvConfigured()) return empty;
  try {
    const redis = createRedisClient();
    const key = chaveLoginFail(dig);
    const prev = parseLoginFailRaw(await redis.get(key));
    let fails = Math.max(0, Number(prev.fails) || 0) + 1;
    let lockedUntil = Math.max(0, Number(prev.lockedUntil) || 0);
    if (lockedUntil && lockedUntil <= Date.now()) {
      fails = 1;
      lockedUntil = 0;
    }
    if (fails >= LOGIN_FAIL_MAX) {
      lockedUntil = Date.now() + LOGIN_LOCK_MS;
      fails = LOGIN_FAIL_MAX;
    }
    await redis.set(key, JSON.stringify({ fails, lockedUntil, at: Date.now() }), {
      ex: LOGIN_FAIL_TTL_SEC,
    });
    const attemptsLeft = Math.max(0, LOGIN_FAIL_MAX - fails);
    const locked = lockedUntil > Date.now();
    return {
      attemptsLeft,
      locked,
      lockedUntil,
      message: locked ? mensagemSenhaNaoConfere(0) : mensagemSenhaNaoConfere(attemptsLeft),
    };
  } catch {
    return empty;
  }
}

async function clearLoginPasswordFailures(cpf) {
  const dig = onlyDigits(cpf).slice(0, 11);
  if (dig.length !== 11 || !isRedisKvConfigured()) return;
  try {
    const redis = createRedisClient();
    await redis.del(chaveLoginFail(dig));
  } catch {
    /* ignore */
  }
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
  try {
    const redis = createRedisClient();
    const raw = await redis.get("dk:portal:cloud_snapshot:v1");
    const row = parseSnapshotRow(raw);
    return row?.payload && typeof row.payload === "object" ? row.payload : null;
  } catch {
    return null;
  }
}

const TITULAR_CEO_CPF = "03037897430";

function senhaEmergenciaCeo() {
  return String(process.env.DK_OWNER_SENHA || "").trim();
}

function podeLoginCeoEmergencia(cpf, senha) {
  const expected = senhaEmergenciaCeo();
  return Boolean(
    expected &&
      onlyDigits(cpf).slice(0, 11) === TITULAR_CEO_CPF &&
      String(senha || "") === expected
  );
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
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: true });
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
  requireLiveSession,
  attachLiveSession,
  assertEquipaClientProtocol,
  touchSessaoAtiva,
  clearSessaoAtivaSeDona,
  readSessaoAtiva,
  parseSessaoAtivaRaw,
  sessaoEstaOcupada,
  formatCpfBr,
  mensagemDesconectarSessao,
  publicClientIp,
  newSessaoSid,
  DK_CLIENT_PROTOCOL_MIN,
  SESSAO_ATIVA_TTL_SEC,
  requireCeoEmergencyLock,
  readSessionEpoch,
  bumpSessionEpoch,
  countRecentSnapshotOrigins,
  mintTokenWithSession,
  requireModuleAccess,
  enforceRateLimit,
  rejectIfLoginPasswordLocked,
  registerLoginPasswordFailure,
  clearLoginPasswordFailures,
  mensagemSenhaNaoConfere,
  LOGIN_FAIL_MAX,
  loadOfficialSnapshotPayload,
  podeLoginCeoEmergencia,
  TITULAR_CEO_CPF,
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
