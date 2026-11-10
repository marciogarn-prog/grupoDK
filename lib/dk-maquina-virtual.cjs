/**
 * Máquinas virtuais DK — um clone na nuvem por colaborador (CPF).
 * PC físico ↔ VM do CPF; VMs sincronizam entre si via hub oficial.
 * Redis: índice + clone operacional por CPF (não substitui PostgreSQL/Supabase).
 */
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
const { mergeVeiculosCadastro, neverLoseCadastroPayload } = require("./dk-append-only-merge.cjs");

const INDICE_KEY = "dk:portal:vms:indice:v1";
const CLONE_PREFIX = "dk:portal:vm:clone:v1:";
const HUB_KEY = "dk:portal:cloud_snapshot:v1";

/** Chaves que o clone espelha entre PCs (estado operacional que divergia). */
const CLONE_KEYS = [
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_manutencoes_cadastro",
  "dk_manutencoes_rapidas_v1",
  "dk_portal_setor_movimentacoes_v1",
  "dk_portal_checklist_movimentacoes_v1",
  "dk_portal_checklist_historico_v1",
];

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
  const out = {};
  if (!payload || typeof payload !== "object") return out;
  for (const k of CLONE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, k)) out[k] = payload[k];
  }
  return out;
}

function fundirClones(existente, incoming) {
  const base = existente && typeof existente === "object" ? existente : {};
  const parte = incoming && typeof incoming === "object" ? incoming : {};
  try {
    return neverLoseCadastroPayload(base, parte, { pularLocacao: true }) || { ...base, ...parte };
  } catch {
    const out = { ...base };
    for (const k of CLONE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(parte, k)) continue;
      if (k.includes("veiculos") && typeof mergeVeiculosCadastro === "function") {
        out[k] = mergeVeiculosCadastro(base[k], parte[k]);
      } else if (Array.isArray(base[k]) && Array.isArray(parte[k])) {
        out[k] = parte[k].length >= base[k].length ? parte[k] : base[k];
      } else {
        out[k] = parte[k];
      }
    }
    return out;
  }
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
    return lerJson(await client.get(cloneKey(dig)), null);
  } catch {
    return null;
  }
}

async function gravarClone(cpf, estado, r) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const client = r || redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };
  await client.set(cloneKey(dig), JSON.stringify(estado && typeof estado === "object" ? estado : {}));
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
 * Espelha o hub oficial em todas as VMs (ou numa). Mantém overlays locais com merge append-only.
 */
async function espelharHubNasVms(opts) {
  const client = redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };
  const hub = await lerHub(client);
  if (!hub.ok) return { ok: false, reason: hub.reason || "hub_indisponivel" };
  const pedaco = extrairCloneDoHub(hub.payload);
  let metas = await listarMetas(client);
  const soCpf = opts && opts.cpf ? cpfOk(opts.cpf) : "";
  if (soCpf) metas = metas.filter((m) => m.cpf === soCpf);
  let atualizadas = 0;
  for (const m of metas) {
    const atual = (await lerClone(m.cpf, client)) || {};
    const fundido = fundirClones(atual, pedaco);
    await gravarClone(m.cpf, fundido, client);
    m.hubRevision = hub.revision;
    m.updatedAt = agoraIso();
    await gravarMeta(m, client);
    atualizadas += 1;
  }
  return { ok: true, atualizadas, revision: hub.revision };
}

/**
 * Login: garante VM, espelha hub nela, devolve clone para a máquina física.
 */
async function loginEspelhar(cpf, extra) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const g = await garantirVm(dig, extra);
  if (!g.ok) return g;
  await espelharHubNasVms({ cpf: dig });
  const client = redis();
  const meta = await lerMeta(dig, client);
  if (meta) {
    meta.lastLoginAt = agoraIso();
    meta.lastDeviceId = String((extra && extra.deviceId) || "").trim();
    await gravarMeta(meta, client);
  }
  const estado = (await lerClone(dig, client)) || {};
  return {
    ok: true,
    meta: (await lerMeta(dig, client)) || g.meta,
    estado,
    criada: g.criada,
  };
}

/**
 * PC envia estado operacional → funde na VM → propaga para as outras VMs via hub-espelho.
 * Não grava o hub completo aqui (o sync oficial continua a fazê-lo); só alinha clones.
 */
async function sincronizarPcParaVm(cpf, estadoPc, extra) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const client = redis();
  if (!client) return { ok: false, reason: "kv_not_configured" };
  await garantirVm(dig, extra);
  const atual = (await lerClone(dig, client)) || {};
  const pedacoPc = extrairCloneDoHub(estadoPc || {});
  const fundido = fundirClones(atual, pedacoPc);
  await gravarClone(dig, fundido, client);
  const meta = (await lerMeta(dig, client)) || metaVazia(dig, extra);
  meta.updatedAt = agoraIso();
  if (extra && extra.deviceId) meta.lastDeviceId = String(extra.deviceId).trim();
  await gravarMeta(meta, client);

  /* Propaga o que este PC trouxe para as restantes VMs (mesmo offline recebem no clone). */
  const metas = await listarMetas(client);
  let propagadas = 0;
  for (const m of metas) {
    if (m.cpf === dig) continue;
    const outro = (await lerClone(m.cpf, client)) || {};
    const uniao = fundirClones(outro, pedacoPc);
    await gravarClone(m.cpf, uniao, client);
    m.updatedAt = agoraIso();
    await gravarMeta(m, client);
    propagadas += 1;
  }
  return { ok: true, meta, propagadas };
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
  await espelharHubNasVms({});
  return { ok: true, total: resultados.length, resultados, revision: hub.revision };
}

module.exports = {
  INDICE_KEY,
  CLONE_PREFIX,
  CLONE_KEYS,
  cpfOk,
  garantirVm,
  garantirTodasDoHub,
  loginEspelhar,
  sincronizarPcParaVm,
  espelharHubNasVms,
  listarMetas,
  lerMeta,
  lerClone,
  extrairCloneDoHub,
};
