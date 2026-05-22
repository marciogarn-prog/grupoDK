/** Aceita variáveis Upstash manual ou integração Vercel Marketplace (KV_REST_API_*). */
function isRedisKvConfigured() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

function createRedisClient() {
  const { Redis } = require("@upstash/redis");
  return Redis.fromEnv();
}

module.exports = { isRedisKvConfigured, createRedisClient };
