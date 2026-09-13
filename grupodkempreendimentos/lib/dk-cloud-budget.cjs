/**
 * Proteção financeira: se a nuvem falhar ou entrar em loop,
 * para Redis / Supabase / Vercel para não gerar cobrança.
 */
const TRIP_MS = 3 * 60 * 1000;
const SNAP_GET_HOUR_MAX = 600;
const SNAP_POST_HOUR_MAX = 240;
const DOORMAN_MIN_GAP_MS = 45000;
const BUDGET_KEY_PREFIX = "dk:portal:cloud_budget:v1:";

let trippedUntil = 0;
let lastDoormanAt = 0;

function isQuotaError(err) {
  const s = String(err && err.message ? err.message : err || "");
  return /max requests|payment required|quota|limit exceeded|ERR max|cloud_budget/i.test(s);
}

function isCloudBudgetTripped() {
  return Date.now() < trippedUntil;
}

function tripCloudBudget(ms) {
  const until = Date.now() + (Number(ms) > 0 ? Number(ms) : TRIP_MS);
  if (until > trippedUntil) trippedUntil = until;
}

function clearCloudBudget() {
  trippedUntil = 0;
}

/** Depois de um upgrade da cota, tenta Redis outra vez em vez de ficar 6 h travado. */
function allowRedisAttempt() {
  if (isCloudBudgetTripped()) clearCloudBudget();
  return true;
}

function cloudBudgetError() {
  const e = new Error("cloud_budget");
  e.reason = "cloud_budget";
  return e;
}

function budgetReject(res) {
  if (!res || typeof res.status !== "function") return true;
  res.setHeader("Retry-After", "3600");
  res.status(503).json({
    ok: false,
    reason: "cloud_budget",
    message: "Nuvem em proteção financeira. Sem chamadas a Redis/Supabase/Vercel até o corte expirar.",
  });
  return true;
}

function hourStamp() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}${m}${day}${h}`;
}

async function assertHourlyBudget(kind) {
  if (isCloudBudgetTripped()) throw cloudBudgetError();
  const max = kind === "post" ? SNAP_POST_HOUR_MAX : SNAP_GET_HOUR_MAX;
  const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
  if (!isRedisKvConfigured()) return true;
  const redis = createRedisClient();
  const key = `${BUDGET_KEY_PREFIX}${kind}:${hourStamp()}`;
  const n = Number(await redis.incr(key));
  if (n === 1) await redis.expire(key, 7200);
  if (n > max) {
    tripCloudBudget(60 * 60 * 1000);
    throw cloudBudgetError();
  }
  return true;
}

async function rejectIfRedisBurst(redis) {
  if (isCloudBudgetTripped()) return true;
  const key = "dk:portal:burst:v1";
  const n = Number(await redis.incr(key));
  if (n === 1) await redis.expire(key, 3);
  if (n > 15) {
    tripCloudBudget(3 * 60 * 1000);
    return true;
  }
  return false;
}

function allowSupabaseDoorman() {
  if (isCloudBudgetTripped()) return false;
  const now = Date.now();
  if (now - lastDoormanAt < DOORMAN_MIN_GAP_MS) return false;
  lastDoormanAt = now;
  return true;
}

module.exports = {
  isQuotaError,
  isCloudBudgetTripped,
  tripCloudBudget,
  clearCloudBudget,
  allowRedisAttempt,
  cloudBudgetError,
  budgetReject,
  assertHourlyBudget,
  rejectIfRedisBurst,
  allowSupabaseDoorman,
  SNAP_GET_HOUR_MAX,
  SNAP_POST_HOUR_MAX,
  DOORMAN_MIN_GAP_MS,
  BUDGET_KEY_PREFIX,
};
