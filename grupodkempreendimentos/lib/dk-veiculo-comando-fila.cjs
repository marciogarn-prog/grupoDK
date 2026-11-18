/**
 * Fila de comandos EC33 para o agente USB / bridge.
 * Redis quando disponível; senão memória do processo (dev).
 */
const crypto = require("crypto");
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
const { montarComandoEc33, rotuloComando, normImei, normPlaca } = require("./dk-ec33-comandos.cjs");

const REDIS_FILA = "dk:portal:veiculo_cmd_fila_v1";
const REDIS_CERCA = "dk:portal:veiculo_cerca_v1";
const TTL_FILA_SEC = 7 * 24 * 3600;

/** @type {Array<Record<string, unknown>>} */
let memoriaFila = [];
/** @type {Record<string, Record<string, unknown>>} */
let memoriaCerca = {};

function novoId() {
  return `cmd_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

async function lerFila() {
  if (!isRedisKvConfigured()) return memoriaFila.slice();
  try {
    const raw = await createRedisClient().get(REDIS_FILA);
    if (!raw) return [];
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(data) ? data : [];
  } catch {
    return memoriaFila.slice();
  }
}

async function gravarFila(lista) {
  memoriaFila = Array.isArray(lista) ? lista : [];
  if (!isRedisKvConfigured()) return { ok: true, persistencia: "memoria" };
  try {
    const redis = createRedisClient();
    await redis.set(REDIS_FILA, JSON.stringify(memoriaFila), { ex: TTL_FILA_SEC });
    return { ok: true, persistencia: "redis" };
  } catch (err) {
    return { ok: false, reason: String(err && err.message ? err.message : err) };
  }
}

async function enfileirarComando({ imei, placa, tipo, params, origem }) {
  const cmd = montarComandoEc33(tipo, params);
  if (!cmd) return { ok: false, status: 400, body: { ok: false, msg: "Tipo de comando inválido." } };
  const item = {
    id: novoId(),
    imei: normImei(imei),
    placa: normPlaca(placa),
    tipo: String(tipo || "").toLowerCase(),
    rotulo: rotuloComando(tipo),
    cmd,
    params: params || {},
    origem: String(origem || "portal"),
    status: "pendente",
    criadoEm: Date.now(),
    enviadoEm: null,
    resposta: "",
  };
  const fila = await lerFila();
  fila.unshift(item);
  await gravarFila(fila.slice(0, 500));
  return { ok: true, status: 200, body: { ok: true, success: true, comando: item } };
}

async function listarPendentes(imeiFiltro) {
  const imei = normImei(imeiFiltro);
  const fila = await lerFila();
  return fila.filter((c) => c.status === "pendente" && (!imei || c.imei === imei || !c.imei));
}

/**
 * Reserva pendentes (status → enviando) para o bridge GT06 / agente.
 * Evita envio duplicado USB+GPRS no mesmo ciclo.
 * @param {string} [imeiFiltro]
 * @param {number} [limite=20]
 */
async function claimPendentes(imeiFiltro, limite = 20) {
  const imei = normImei(imeiFiltro);
  const fila = await lerFila();
  const agora = Date.now();
  const STALE_MS = 120000;
  const claimed = [];
  for (let i = 0; i < fila.length; i++) {
    const c = fila[i];
    if (!c) continue;
    // Recupera "enviando" travado (bridge caiu)
    if (c.status === "enviando" && agora - Number(c.enviadoEm || 0) > STALE_MS) {
      fila[i] = { ...c, status: "pendente", enviadoEm: null };
    }
  }
  for (let i = 0; i < fila.length; i++) {
    if (claimed.length >= Math.max(1, Number(limite) || 20)) break;
    const c = fila[i];
    if (!c || c.status !== "pendente") continue;
    if (imei && c.imei && c.imei !== imei) continue;
    const row = { ...c, status: "enviando", enviadoEm: agora };
    fila[i] = row;
    claimed.push(row);
  }
  if (claimed.length) await gravarFila(fila);
  return claimed;
}

async function marcarResultado({ id, ok, resposta, via }) {
  const fila = await lerFila();
  const idx = fila.findIndex((c) => String(c.id) === String(id));
  if (idx < 0) return { ok: false, status: 404, body: { ok: false, msg: "Comando não encontrado." } };
  fila[idx] = {
    ...fila[idx],
    status: ok ? "enviado" : "erro",
    enviadoEm: Date.now(),
    resposta: String(resposta || "").slice(0, 2000),
    via: String(via || "usb"),
  };
  await gravarFila(fila);
  return { ok: true, status: 200, body: { ok: true, comando: fila[idx] } };
}

async function lerCercas() {
  if (!isRedisKvConfigured()) return { ...memoriaCerca };
  try {
    const raw = await createRedisClient().get(REDIS_CERCA);
    if (!raw) return {};
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return data && typeof data === "object" ? data : {};
  } catch {
    return { ...memoriaCerca };
  }
}

async function gravarCerca(imei, cerca) {
  const key = normImei(imei);
  if (key.length < 14) return { ok: false, msg: "IMEI inválido" };
  const todas = await lerCercas();
  if (!cerca || cerca.ativa === false) {
    delete todas[key];
  } else {
    todas[key] = {
      imei: key,
      placa: normPlaca(cerca.placa),
      lat: Number(cerca.lat),
      lng: Number(cerca.lng),
      raioM: Number(cerca.raioM) || 500,
      ativa: true,
      updatedAt: Date.now(),
    };
  }
  memoriaCerca = todas;
  if (isRedisKvConfigured()) {
    try {
      await createRedisClient().set(REDIS_CERCA, JSON.stringify(todas), { ex: TTL_FILA_SEC });
    } catch {
      /* ignore */
    }
  }
  return { ok: true, cerca: todas[key] || null };
}

module.exports = {
  enfileirarComando,
  listarPendentes,
  claimPendentes,
  marcarResultado,
  lerFila,
  lerCercas,
  gravarCerca,
  montarComandoEc33,
};
