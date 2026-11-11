/**
 * Máquinas virtuais DK — I/O Redis + orquestração.
 * Regras de união/espelho: lib/dk-vm-sync-core.cjs (testadas sem rede).
 */
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
const syncCore = require("./dk-vm-sync-core.cjs");

const INDICE_KEY = "dk:portal:vms:indice:v1";
const CLONE_PREFIX = "dk:portal:vm:clone:v1:";
const CLONE_PARTS_PREFIX = "dk:portal:vm:cloneparts:v1:";
const HUB_KEY = "dk:portal:cloud_snapshot:v1";
const SEQ_KEY = "dk:portal:vms:seq:v1";
const PENDENTE_KEY = "dk:portal:vms:pendente:v1";

const CLONE_KEYS = syncCore.CLONE_KEYS;
const CLONE_KEYS_EXCLUIDAS_REDIS = syncCore.CLONE_KEYS_EXCLUIDAS;

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function cpfOk(cpf) {
  const d = onlyDigits(cpf);
  return d.length === 11 ? d : "";
}

function agoraIso() {
  return new Date().toISOString();
}

function redis() {
  if (!isRedisKvConfigured()) return null;
  return createRedisClient();
}

function cloneKey(cpf) {
  return CLONE_PREFIX + cpf;
}

function clonePartsKey(cpf) {
  return CLONE_PARTS_PREFIX + cpf;
}

function slimEstadoParaRedis(estado) {
  return syncCore.slimEstado(estado);
}

function metaVazia(cpf, extra) {
  const now = agoraIso();
  return {
    cpf,
    nome: String((extra && extra.nome) || "").trim(),
    role: String((extra && extra.role) || "operacao").trim() || "operacao",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: "",
    lastDeviceId: "",
    hubRevision: "",
    status: "ativa",
  };
}

function lerJson(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw === "object") return raw;
  try {
    const j = JSON.parse(String(raw));
    return j && typeof j === "object" ? j : fallback;
  } catch {
    return fallback;
  }
}

function extrairCloneDoHub(payload) {
  return syncCore.slimEstado(payload);
}

function fundirClones(existente, incoming) {
  return syncCore.unirDoisEstados(existente, incoming);
}

function resumirClone(estado) {
  return syncCore.resumirEstado(estado);
}

async function lerHub(r) {
  const client = r || redis();
  if (!client) return { ok: false, reason: "kv_not_configured", payload: null, revision: "" };
  try {
    const raw = await client.get(HUB_KEY);
    const row = lerJson(raw, null);
    const payload = row && row.payload && typeof row.payload === "object" ? row.payload : null;
    const revision = String((row && (row.updated_at || row.revision)) || "");
    if (!payload) return { ok: false, reason: "hub_vazio", payload: null, revision: "" };
    return { ok: true, payload, revision };
  } catch (e) {
    return { ok: false, reason: String(e && e.message ? e.message : e), payload: null, revision: "" };
  }
}

async function lerMeta(cpf, r) {
  const dig = cpfOk(cpf);
  if (!dig) return null;
  const client = r || redis();
  if (!client) return null;
  try {
    const raw = await client.hget(INDICE_KEY, dig);
    return lerJson(raw, null);
  } catch {
    return null;
  }
}

async function gravarMeta(meta, r) {
  const dig = cpfOk(meta && meta.cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const client = r || redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };
  const row = { ...meta, cpf: dig, updatedAt: agoraIso() };
  await client.hset(INDICE_KEY, { [dig]: JSON.stringify(row) });
  return { ok: true, meta: row };
}

async function lerClone(cpf, r) {
  const dig = cpfOk(cpf);
  if (!dig) return null;
  const client = r || redis();
  if (!client) return null;
  try {
    /* Preferir fatiado (novo). */
    const parts = await client.hgetall(clonePartsKey(dig));
    if (parts && typeof parts === "object" && Object.keys(parts).length) {
      const out = {};
      for (const [k, raw] of Object.entries(parts)) {
        if (CLONE_KEYS_EXCLUIDAS_REDIS.has(k)) continue;
        out[k] = lerJson(raw, null);
      }
      return out;
    }
    /* Legado monolítico — lê e ignora chaves gordas. */
    const legado = lerJson(await client.get(cloneKey(dig)), null);
    return legado ? slimEstadoParaRedis(legado) : null;
  } catch {
    return null;
  }
}

async function gravarClone(cpf, estado, r) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const client = r || redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };
  const slim = slimEstadoParaRedis(estado);
  const fields = {};
  for (const [k, v] of Object.entries(slim)) {
    fields[k] = JSON.stringify(v == null ? null : v);
  }
  /* Hash por chave: cada campo fica sob o limite de 10 MB do Upstash. */
  if (Object.keys(fields).length) {
    await client.hset(clonePartsKey(dig), fields);
  } else {
    try {
      await client.del(clonePartsKey(dig));
    } catch {
      /* ignore */
    }
  }
  /* Apaga monolítico antigo para não reaparecer gordo no próximo ler. */
  try {
    await client.del(cloneKey(dig));
  } catch {
    /* ignore */
  }
  return { ok: true };
}

async function listarMetas(r) {
  const client = r || redis();
  if (!client) return [];
  try {
    const all = await client.hgetall(INDICE_KEY);
    const out = [];
    const map = all && typeof all === "object" ? all : {};
    for (const raw of Object.values(map)) {
      const m = lerJson(raw, null);
      if (m && m.cpf) out.push(m);
    }
    out.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    return out;
  } catch {
    return [];
  }
}

/**
 * Garante VM do colaborador. Se não existir, cria a partir do hub oficial.
 */
async function garantirVm(cpf, extra) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const client = redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };

  let meta = await lerMeta(dig, client);
  const criada = !meta;
  if (!meta) meta = metaVazia(dig, extra || {});
  else {
    if (extra && extra.nome) meta.nome = String(extra.nome).trim() || meta.nome;
    if (extra && extra.role) meta.role = String(extra.role).trim() || meta.role;
  }

  let clone = await lerClone(dig, client);
  if (!clone || typeof clone !== "object") {
    const hub = await lerHub(client);
    clone = hub.ok ? extrairCloneDoHub(hub.payload) : {};
    if (hub.ok) meta.hubRevision = hub.revision;
  }

  await gravarClone(dig, clone, client);
  const saved = await gravarMeta(meta, client);
  return {
    ok: true,
    criada: Boolean(criada),
    meta: saved.meta || meta,
    temClone: Object.keys(clone).length > 0,
  };
}

/**
 * Espelha o hub oficial em todas as VMs (ou numa).
 * Por defeito substitui o clone pelo hub (todas iguais). merge=true une append-only.
 */
async function espelharHubNasVms(opts) {
  const client = redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };
  const hub = await lerHub(client);
  if (!hub.ok) return { ok: false, reason: hub.reason || "hub_indisponivel" };
  const pedaco = extrairCloneDoHub(hub.payload);
  const resumoHub = resumirClone(pedaco);
  let metas = await listarMetas(client);
  const soCpf = opts && opts.cpf ? cpfOk(opts.cpf) : "";
  if (soCpf) metas = metas.filter((m) => m.cpf === soCpf);
  const usarMerge = Boolean(opts && opts.merge);
  let atualizadas = 0;
  for (const m of metas) {
    const atual = (await lerClone(m.cpf, client)) || {};
    const fundido = usarMerge ? fundirClones(atual, pedaco) : pedaco;
    await gravarClone(m.cpf, fundido, client);
    m.hubRevision = hub.revision;
    m.updatedAt = agoraIso();
    m.resumo = resumirClone(fundido);
    await gravarMeta(m, client);
    atualizadas += 1;
  }
  return { ok: true, atualizadas, revision: hub.revision, resumoHub };
}

/**
 * VMs idênticas: união hub + todos os clones → grava o mesmo slim em todas.
 */
async function alinearClusterVms() {
  const client = redis();
  if (!client) return { ok: false, alinhadas: false, reason: "kv_not_configured" };
  const hub = await lerHub(client);
  const metas = await listarMetas(client);
  const pedacos = [];
  if (hub.ok) pedacos.push(extrairCloneDoHub(hub.payload) || {});
  for (const m of metas) {
    pedacos.push((await lerClone(m.cpf, client)) || {});
  }
  const fundido = syncCore.unirCluster(pedacos);
  const resumo = resumirClone(fundido);
  const seq = await bumpSeqGlobal(client);
  const agora = agoraIso();
  for (const m of metas) {
    await gravarClone(m.cpf, fundido, client);
    const meta = (await lerMeta(m.cpf, client)) || metaVazia(m.cpf, m);
    meta.updatedAt = agora;
    meta.resumo = resumo;
    meta.clusterSeq = seq;
    if (hub.ok) meta.hubRevision = hub.revision;
    await gravarMeta(meta, client);
  }
  const conf = await conferirAlinhamento();
  return {
    ok: true,
    sincronizou: true,
    alinhadas: Boolean(conf.alinhadas),
    total: metas.length,
    seq,
    resumo,
    divergencias: conf.divergencias || [],
    oficinaPropriaAtivas: Number(resumo.oficinaPropriaAtivas) || 0,
  };
}

/**
 * PC contribui → alinha cluster → devolve espelho.
 * Usado por login-espelhar e sincronizar-pc.
 */
async function contribuirPcEAlinhar(cpf, estadoPc, extra) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const g = await garantirVm(dig, extra || {});
  if (!g.ok) return g;
  const client = redis();
  if (estadoPc && typeof estadoPc === "object") {
    const atual = (await lerClone(dig, client)) || {};
    await gravarClone(dig, fundirClones(atual, extrairCloneDoHub(estadoPc)), client);
  }
  if (extra && (extra.deviceId || extra.nome || extra.role)) {
    const metaRow = (await lerMeta(dig, client)) || metaVazia(dig, extra);
    if (extra.deviceId) metaRow.lastDeviceId = String(extra.deviceId).trim();
    if (extra.nome) metaRow.nome = String(extra.nome).trim() || metaRow.nome;
    if (extra.role) metaRow.role = String(extra.role).trim() || metaRow.role;
    metaRow.updatedAt = agoraIso();
    await gravarMeta(metaRow, client);
  }
  let alin;
  try {
    alin = await alinearClusterVms();
  } catch (e) {
    return { ok: false, reason: "alinear_falhou", error: String(e && e.message ? e.message : e) };
  }
  if (!alin || !alin.ok) {
    return { ok: false, reason: (alin && alin.reason) || "alinear_falhou", alin };
  }
  await limparPendente(dig, client);
  const estado = (await lerClone(dig, client)) || {};
  const conf = await conferirAlinhamento();
  return {
    ok: true,
    meta: (await lerMeta(dig, client)) || g.meta,
    estado,
    seq: alin.seq,
    resumo: resumirClone(estado),
    criada: g.criada,
    alinhadas: Boolean(conf.alinhadas),
    sincronizouCluster: true,
    divergencias: conf.divergencias || [],
    oficinaPropriaAtivas: Number((alin.resumo && alin.resumo.oficinaPropriaAtivas) || 0),
  };
}

async function loginEspelhar(cpf, extra) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const out = await contribuirPcEAlinhar(dig, extra && extra.estado, {
    nome: extra && extra.nome,
    role: extra && extra.role,
    deviceId: extra && extra.deviceId,
  });
  if (!out.ok) return out;
  const client = redis();
  const meta = await lerMeta(dig, client);
  if (meta) {
    meta.lastLoginAt = agoraIso();
    meta.clusterSeq = out.seq;
    meta.resumo = out.resumo;
    await gravarMeta(meta, client);
  }
  return { ...out, meta: (await lerMeta(dig, client)) || out.meta };
}

async function lerSeqGlobal(r) {
  const client = r || redis();
  if (!client) return 0;
  try {
    const n = Number(await client.get(SEQ_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function bumpSeqGlobal(r) {
  const client = r || redis();
  if (!client) return 0;
  try {
    const next = await client.incr(SEQ_KEY);
    return Number(next) || 0;
  } catch {
    return 0;
  }
}

async function marcarPendentesDownload(fromCpf, seq, r) {
  const client = r || redis();
  if (!client || !seq) return 0;
  const metas = await listarMetas(client);
  const digFrom = cpfOk(fromCpf);
  let n = 0;
  const agora = agoraIso();
  for (const m of metas) {
    if (!m.cpf || m.cpf === digFrom) continue;
    await client.hset(PENDENTE_KEY, {
      [m.cpf]: JSON.stringify({ seq, fromCpf: digFrom, at: agora }),
    });
    n += 1;
  }
  return n;
}

async function limparPendente(cpf, r) {
  const dig = cpfOk(cpf);
  if (!dig) return;
  const client = r || redis();
  if (!client) return;
  try {
    await client.hdel(PENDENTE_KEY, dig);
  } catch {
    /* ignore */
  }
}

async function lerPendente(cpf, r) {
  const dig = cpfOk(cpf);
  if (!dig) return null;
  const client = r || redis();
  if (!client) return null;
  try {
    return lerJson(await client.hget(PENDENTE_KEY, dig), null);
  } catch {
    return null;
  }
}

/**
 * Confere se todas as VMs têm o mesmo resumo (banco clone alinhado).
 */
async function conferirAlinhamento() {
  const client = redis();
  if (!client) return { ok: false, alinhadas: false, reason: "kv_not_configured" };
  const metas = await listarMetas(client);
  if (!metas.length) return { ok: true, alinhadas: true, total: 0, seq: await lerSeqGlobal(client) };
  const linhas = [];
  for (const m of metas) {
    const estado = (await lerClone(m.cpf, client)) || {};
    const resumo = resumirClone(estado);
    linhas.push({
      cpf: m.cpf,
      nome: m.nome,
      hubRevision: m.hubRevision || "",
      resumo,
      fingerprint: JSON.stringify(resumo),
    });
  }
  const ref = linhas[0].fingerprint;
  const alinhadas = linhas.every((l) => l.fingerprint === ref);
  const divergencias = alinhadas
    ? []
    : linhas.filter((l) => l.fingerprint !== ref).map((l) => ({ cpf: l.cpf, nome: l.nome, resumo: l.resumo }));
  return {
    ok: true,
    alinhadas,
    total: linhas.length,
    seq: await lerSeqGlobal(client),
    resumo: linhas[0].resumo,
    divergencias,
  };
}

/**
 * PC consulta a VM: há novidade desde lastSeq? Se sim, devolve o clone (download do delta lógico).
 */
async function consultarDelta(cpf, lastSeq) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const client = redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };
  await garantirVm(dig, {});
  const seq = await lerSeqGlobal(client);
  const visto = Number(lastSeq) || 0;
  const pendente = await lerPendente(dig, client);
  const haNovidade = seq > visto || (pendente && Number(pendente.seq) > visto);
  const estado = (await lerClone(dig, client)) || {};
  const resumo = resumirClone(estado);
  if (!haNovidade) {
    /* Sempre devolve resumo para o PC detectar divergência local × clone gémeo. */
    return { ok: true, haNovidade: false, seq, resumo, estado: null, pendente: pendente || null };
  }
  return {
    ok: true,
    haNovidade: true,
    seq,
    resumo,
    estado,
    pendente: pendente || null,
  };
}

/**
 * Salvar no PC: contribui + alinha cluster + devolve espelho + marca pendência nas outras.
 */
async function sincronizarPcParaVm(cpf, estadoPc, extra) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const out = await contribuirPcEAlinhar(dig, estadoPc || {}, extra || {});
  if (!out.ok) return out;
  const client = redis();
  const metas = await listarMetas(client);
  const pendentes = await marcarPendentesDownload(dig, out.seq, client);
  return {
    ...out,
    propagadas: Math.max(0, metas.length - 1),
    pendentes,
  };
}

/**
 * Cria VMs em falta a partir da lista de funcionários do hub.
 */
async function garantirTodasDoHub() {
  const client = redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };
  const hub = await lerHub(client);
  if (!hub.ok) return { ok: false, reason: hub.reason || "hub_indisponivel" };
  const funcs = Array.isArray(hub.payload.dk_funcionarios_access) ? hub.payload.dk_funcionarios_access : [];
  const resultados = [];
  for (const f of funcs) {
    const dig = cpfOk(f && f.cpf);
    if (!dig) continue;
    const r = await garantirVm(dig, { nome: f.nome, role: f.role });
    resultados.push({ cpf: dig, nome: f.nome, ok: r.ok, criada: r.criada });
  }
  /* Nunca substituir o cluster pelo hub cru — une e redistribui. */
  const alin = await alinearClusterVms();
  return {
    ok: true,
    total: resultados.length,
    resultados,
    revision: hub.revision,
    alinhadas: Boolean(alin.alinhadas),
    sincronizouCluster: Boolean(alin.sincronizou),
  };
}

module.exports = {
  INDICE_KEY,
  CLONE_PREFIX,
  CLONE_KEYS,
  SEQ_KEY,
  PENDENTE_KEY,
  syncCore,
  cpfOk,
  garantirVm,
  garantirTodasDoHub,
  loginEspelhar,
  sincronizarPcParaVm,
  contribuirPcEAlinhar,
  espelharHubNasVms,
  alinearClusterVms,
  listarMetas,
  lerMeta,
  lerClone,
  extrairCloneDoHub,
  resumirClone,
  lerSeqGlobal,
  consultarDelta,
  conferirAlinhamento,
  limparPendente,
};
