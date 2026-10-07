/**
 * Conta o que passa pela Vercel, pelo Supabase e pelo Redis e aplica a tabela pública.
 * O GitHub não transporta cadastro: entra só com o plano mensal.
 * A gravação deste contador não entra na própria conta.
 */
const { AsyncLocalStorage } = require("async_hooks");

const KEY_USO = "dk:portal:custos_sistema:v1";
const KEY_PLANOS = "dk:portal:custos_sistema_planos:v1";
const GB = 1024 ** 3;
const MB = 1024 ** 2;

const TABELA = {
  vercelPlanoUsd: 20,
  vercelInvocacoesInclusas: 1000000,
  vercelUsdPorMilhao: 0.6,
  vercelBytesInclusos: 1024 * GB,
  vercelUsdPorGb: 0.15,
  supabasePlanoUsd: 25,
  supabaseBytesInclusos: 250 * GB,
  supabaseUsdPorGb: 0.09,
  redisUsdPor100k: 0.2,
  redisBytesGratis: GB,
  redisUsdPorGb: 0.25,
  redisBandaGratis: 200 * GB,
  redisUsdPorGbBanda: 0.03,
  redisComandosGratis: 500000,
  redisArmazenamentoGratisPlano: 256 * MB,
  redisBandaGratisPlano: 10 * GB,
  githubPlanoUsd: 0,
  cambioBrl: 5.4,
};

const als = new AsyncLocalStorage();

function byteSize(value) {
  if (value == null) return 0;
  if (typeof value === "string") return Buffer.byteLength(value);
  if (Buffer.isBuffer(value)) return value.length;
  if (typeof value === "number" || typeof value === "boolean") return String(value).length;
  try {
    return Buffer.byteLength(JSON.stringify(value));
  } catch {
    return 0;
  }
}

function mesSaoPaulo(data) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(data || new Date());
}

function numero(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function arredondar(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function marcar() {
  return als.getStore() || null;
}

function anotarRedis(args, result) {
  const s = marcar();
  if (!s || s.silencio) return;
  const chave = args && typeof args[0] === "string" ? args[0] : "";
  if (chave === KEY_USO || chave === KEY_PLANOS) return;
  s.redisComandos += 1;
  const ida = byteSize(args);
  const volta = byteSize(result);
  s.redisBytes += ida + volta;
  if (chave === "dk:portal:cloud_snapshot:v1" || chave.startsWith("dk:portal:cloud_snapshot:v1")) {
    const corpo = typeof args[1] !== "undefined" ? byteSize(args[1]) : volta;
    if (corpo > s.redisArmazenamento) s.redisArmazenamento = corpo;
  }
}

function anotarSupabase(corpo) {
  const s = marcar();
  if (!s || s.silencio) return;
  s.supabasePedidos += 1;
  s.supabaseBytes += byteSize(corpo);
}

function planosDe(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  return {
    cambioBrl: Math.min(20, Math.max(1, numero(p.cambioBrl ?? p.cambio_brl, TABELA.cambioBrl))),
    planoVercelUsd: Math.min(5000, Math.max(0, numero(p.planoVercelUsd ?? p.plano_vercel_usd, TABELA.vercelPlanoUsd))),
    planoSupabaseUsd: Math.min(5000, Math.max(0, numero(p.planoSupabaseUsd ?? p.plano_supabase_usd, TABELA.supabasePlanoUsd))),
    planoGithubUsd: Math.min(5000, Math.max(0, numero(p.planoGithubUsd ?? p.plano_github_usd, TABELA.githubPlanoUsd))),
  };
}

function usoDe(raw) {
  const u = raw && typeof raw === "object" ? raw : {};
  return {
    mes: String(u.mes || mesSaoPaulo()),
    atualizadoEm: String(u.atualizadoEm || u.atualizado_em || ""),
    vercelInvocacoes: Math.max(0, numero(u.vercel_invocacoes ?? u.vercelInvocacoes, 0)),
    vercelBytes: Math.max(0, numero(u.vercel_bytes ?? u.vercelBytes, 0)),
    supabasePedidos: Math.max(0, numero(u.supabase_pedidos ?? u.supabasePedidos, 0)),
    supabaseBytes: Math.max(0, numero(u.supabase_bytes ?? u.supabaseBytes, 0)),
    redisComandos: Math.max(0, numero(u.redis_comandos ?? u.redisComandos, 0)),
    redisBytes: Math.max(0, numero(u.redis_bytes ?? u.redisBytes, 0)),
    redisArmazenamento: Math.max(0, numero(u.redis_armazenamento ?? u.redisArmazenamento, 0)),
  };
}

function custoVercel(uso, planos) {
  const invExtra = Math.max(0, uso.vercelInvocacoes - TABELA.vercelInvocacoesInclusas);
  const bytesExtra = Math.max(0, uso.vercelBytes - TABELA.vercelBytesInclusos);
  const usoUsd = (invExtra / 1000000) * TABELA.vercelUsdPorMilhao + (bytesExtra / GB) * TABELA.vercelUsdPorGb;
  return { planoUsd: planos.planoVercelUsd, usoUsd, usd: planos.planoVercelUsd + usoUsd };
}

function custoSupabase(uso, planos) {
  const bytesExtra = Math.max(0, uso.supabaseBytes - TABELA.supabaseBytesInclusos);
  const usoUsd = (bytesExtra / GB) * TABELA.supabaseUsdPorGb;
  return { planoUsd: planos.planoSupabaseUsd, usoUsd, usd: planos.planoSupabaseUsd + usoUsd };
}

function custoRedis(uso) {
  const dentroGratis =
    uso.redisComandos <= TABELA.redisComandosGratis &&
    uso.redisArmazenamento <= TABELA.redisArmazenamentoGratisPlano &&
    uso.redisBytes <= TABELA.redisBandaGratisPlano;
  if (dentroGratis) return { planoUsd: 0, usoUsd: 0, usd: 0, modo: "gratis" };
  const comandosUsd = (uso.redisComandos / 100000) * TABELA.redisUsdPor100k;
  const armUsd = (Math.max(0, uso.redisArmazenamento - TABELA.redisBytesGratis) / GB) * TABELA.redisUsdPorGb;
  const bandaUsd = (Math.max(0, uso.redisBytes - TABELA.redisBandaGratis) / GB) * TABELA.redisUsdPorGbBanda;
  const usoUsd = comandosUsd + armUsd + bandaUsd;
  return { planoUsd: 0, usoUsd, usd: usoUsd, modo: "payg" };
}

function calcularCustos(usoRaw, planosRaw) {
  const uso = usoDe(usoRaw);
  const planos = planosDe(planosRaw);
  const cambio = planos.cambioBrl;
  const vercel = custoVercel(uso, planos);
  const supabase = custoSupabase(uso, planos);
  const redis = custoRedis(uso);
  const github = { planoUsd: planos.planoGithubUsd, usoUsd: 0, usd: planos.planoGithubUsd };
  const itens = [
    { id: "vercel", nome: "Vercel", ...vercel, transita: true },
    { id: "supabase", nome: "Supabase", ...supabase, transita: true },
    { id: "redis", nome: "Redis", ...redis, transita: true },
    { id: "github", nome: "GitHub", ...github, transita: false },
  ].map((item) => ({
    ...item,
    usd: arredondar(item.usd),
    planoUsd: arredondar(item.planoUsd),
    usoUsd: arredondar(item.usoUsd),
    brl: arredondar(item.usd * cambio),
  }));
  const totalUsd = arredondar(itens.reduce((s, item) => s + item.usd, 0));
  return {
    mes: uso.mes,
    atualizadoEm: uso.atualizadoEm,
    cambioBrl: cambio,
    totalUsd,
    totalBrl: arredondar(totalUsd * cambio),
    uso,
    planos,
    itens,
    tabela: {
      vercel: "Plano Pro + o que passar de 1 milhão de pedidos (US$ 0,60 por milhão) e de 1 TB (US$ 0,15 por GB).",
      supabase: "Plano Pro + o que passar de 250 GB de saída (US$ 0,09 por GB).",
      redis: "Até 500 mil comandos, 256 MB e 10 GB no mês fica US$ 0. Acima disso: US$ 0,20 por 100 mil comandos, US$ 0,25 por GB guardado depois do 1º GB e US$ 0,03 por GB depois de 200 GB.",
      github: "Os cadastros não passam pelo GitHub. O GitHub guarda o código. O valor é o plano mensal.",
    },
  };
}

async function comMedicaoCusto(req, res, fn) {
  if (!req || req.method === "OPTIONS") return fn();
  const marca = {
    silencio: false,
    vercelInvocacoes: 1,
    vercelBytes: byteSize(req.body),
    supabasePedidos: 0,
    supabaseBytes: 0,
    redisComandos: 0,
    redisBytes: 0,
    redisArmazenamento: 0,
  };
  if (typeof res.json === "function") {
    const orig = res.json.bind(res);
    res.json = (body) => {
      try {
        marca.vercelBytes += byteSize(body);
      } catch {
        /* ignore */
      }
      return orig(body);
    };
  }
  try {
    return await als.run(marca, fn);
  } finally {
    marca.silencio = true;
    try {
      await gravarMarca(marca);
    } catch {
      /* o contador não pode derrubar a gravação do cadastro */
    }
  }
}

async function gravarMarca(marca) {
  if (!marca) return;
  const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
  if (!isRedisKvConfigured()) return;
  const redis = createRedisClient();
  const mes = mesSaoPaulo();
  const guardado = await redis.hget(KEY_USO, "mes");
  if (guardado && String(guardado) !== mes) await redis.del(KEY_USO);
  const campos = { mes, atualizado_em: new Date().toISOString() };
  if (marca.redisArmazenamento > 0) campos.redis_armazenamento = String(Math.round(marca.redisArmazenamento));
  await redis.hset(KEY_USO, campos);
  const somas = [
    ["vercel_invocacoes", marca.vercelInvocacoes],
    ["vercel_bytes", marca.vercelBytes],
    ["supabase_pedidos", marca.supabasePedidos],
    ["supabase_bytes", marca.supabaseBytes],
    ["redis_comandos", marca.redisComandos],
    ["redis_bytes", marca.redisBytes],
  ];
  for (const [campo, valor] of somas) {
    const n = Math.round(Number(valor) || 0);
    if (n > 0) await redis.hincrby(KEY_USO, campo, n);
  }
}

async function lerCustos(redis) {
  const mes = mesSaoPaulo();
  let uso = {};
  let planos = {};
  try {
    const guardado = await redis.hget(KEY_USO, "mes");
    if (!guardado || String(guardado) === mes) uso = (await redis.hgetall(KEY_USO)) || {};
  } catch {
    uso = {};
  }
  try {
    planos = (await redis.hgetall(KEY_PLANOS)) || {};
  } catch {
    planos = {};
  }
  return calcularCustos(uso, planos);
}

async function gravarPlanos(redis, body) {
  const planos = planosDe(body || {});
  await redis.hset(KEY_PLANOS, {
    cambio_brl: String(planos.cambioBrl),
    plano_vercel_usd: String(planos.planoVercelUsd),
    plano_supabase_usd: String(planos.planoSupabaseUsd),
    plano_github_usd: String(planos.planoGithubUsd),
  });
  return lerCustos(redis);
}

module.exports = {
  KEY_USO,
  KEY_PLANOS,
  TABELA,
  byteSize,
  mesSaoPaulo,
  anotarRedis,
  anotarSupabase,
  calcularCustos,
  comMedicaoCusto,
  lerCustos,
  gravarPlanos,
  planosDe,
};
