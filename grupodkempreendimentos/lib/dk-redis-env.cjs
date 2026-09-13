/** Aceita variáveis Upstash manual ou integração Vercel Marketplace (KV_REST_API_*). */
const {
  isQuotaError,
  isCloudBudgetTripped,
  tripCloudBudget,
  cloudBudgetError,
} = require("./dk-cloud-budget.cjs");

function isRedisKvConfigured() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

function wrapRedisFn(fn, target) {
  return async function wrappedRedisFn(...args) {
    if (isCloudBudgetTripped()) throw cloudBudgetError();
    try {
      return await fn.apply(target, args);
    } catch (e) {
      if (isQuotaError(e)) tripCloudBudget();
      throw e;
    }
  };
}

function createRedisClient() {
  if (isCloudBudgetTripped()) throw cloudBudgetError();
  const { Redis } = require("@upstash/redis");
  const raw = Redis.fromEnv();
  return new Proxy(raw, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v !== "function") return v;
      return wrapRedisFn(v, target);
    },
  });
}

module.exports = { isRedisKvConfigured, createRedisClient };
