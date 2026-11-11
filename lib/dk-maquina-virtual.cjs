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
/** Sequência global do cluster de VMs (sobe a cada Salvar redistribuído). */
const SEQ_KEY = "dk:portal:vms:seq:v1";
/** Pendências de download PC: hash cpf → { seq, fromCpf, at }. */
const PENDENTE_KEY = "dk:portal:vms:pendente:v1";

/**
 * Banco completo do clone: tudo o que existe no hub oficial.
 * As VMs devem ficar iguais entre si; só muda quem se conecta (CPF).
 */
const CLONE_KEYS = [
  "dk_clientes_cadastro",
  "dk_portal_clientes_cadastro",
  "dk_clientes_validacao_pendente",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_veiculos_frota_planilha",
  "dk_locacoes_cadastro",
  "dk_locacoes_quadro_geral",
  "dk_funcionarios_access",
  "dk_manutencoes_cadastro",
  "dk_manutencoes_rapidas_v1",
  "dk_lancamentos_aluguel",
  "dk_portal_setor_movimentacoes_v1",
  "dk_portal_checklist_movimentacoes_v1",
  "dk_portal_checklist_historico_v1",
  "dk_comprovantes_banco",
  "dk_comprovantes_cliente_pendentes",
  "dk_financeiro_extratos_v1",
  "dk_financeiro_despesas_v1",
  "dk_financeiro_ceo_despesas_v1",
  "dk_audit_log",
  "dk_pagamentos_auditoria_v1",
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
    /* Inclui locações/pagamentos embutidos — VMs devem ser clones do mesmo banco. */
    return neverLoseCadastroPayload(base, parte, { pularLocacao: false }) || { ...base, ...parte };
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

/** Contagens para verificar se as VMs estão iguais. */
function resumirClone(estado) {
  const e = estado && typeof estado === "object" ? estado : {};
  const locs = Array.isArray(e.dk_locacoes_cadastro) ? e.dk_locacoes_cadastro : [];
  let pagamentos = 0;
  let ativos = 0;
  let finalizados = 0;
  for (const loc of locs) {
    const pays = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
    pagamentos += pays.length;
    const st = String(loc.statusLocacao || loc.status || "")
      .trim()
      .toUpperCase();
    const fim = String(loc.fim || loc.dataFim || "").trim();
    const inativo =
      st.includes("FINAL") ||
      st.includes("INATIV") ||
      st.includes("CANCEL") ||
      (fim && fim !== "...");
    if (inativo) finalizados += 1;
    else ativos += 1;
  }
  const clientes = Array.isArray(e.dk_clientes_cadastro) ? e.dk_clientes_cadastro.length : 0;
  const veiculos = Array.isArray(e.dk_veiculos_cadastro) ? e.dk_veiculos_cadastro.length : 0;
  const manut = Array.isArray(e.dk_manutencoes_cadastro) ? e.dk_manutencoes_cadastro.length : 0;
  const manutRapidas = Array.isArray(e.dk_manutencoes_rapidas_v1) ? e.dk_manutencoes_rapidas_v1.length : 0;
  return {
    clientes,
    veiculos,
    protocolos: locs.length,
    protocolosAtivos: ativos,
    protocolosFinalizados: finalizados,
    pagamentos,
    manutencoes: manut,
    manutencoesRapidas: manutRapidas,
  };
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
 * Regra: VMs na nuvem devem ficar idênticas.
 * Une hub + todos os clones (append-only) e grava o mesmo banco em todas.
 */
async function alinearClusterVms() {
  const client = redis();
  if (!client) return { ok: false, alinhadas: false, reason: "kv_not_configured" };
  const hub = await lerHub(client);
  let fundido = {};
  if (hub.ok) fundido = extrairCloneDoHub(hub.payload) || {};
  const metas = await listarMetas(client);
  for (const m of metas) {
    const clone = (await lerClone(m.cpf, client)) || {};
    fundido = fundirClones(fundido, clone);
  }
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
  };
}

/**
 * Login: garante VM, compara o cluster e, se houver diferença, sincroniza todas as VMs.
 * Devolve o clone alinhado para a máquina física.
 */
async function loginEspelhar(cpf, extra) {
  const dig = cpfOk(cpf);
  if (!dig) return { ok: false, reason: "cpf" };
  const g = await garantirVm(dig, extra);
  if (!g.ok) return g;

  let sincronizouCluster = false;
  let conf = await conferirAlinhamento();
  if (!conf.ok || !conf.alinhadas) {
    const alin = await alinearClusterVms();
    sincronizouCluster = Boolean(alin.sincronizou);
    conf = await conferirAlinhamento();
    if (conf.ok && !conf.alinhadas) {
      const alin2 = await alinearClusterVms();
      sincronizouCluster = Boolean(alin2.sincronizou) || sincronizouCluster;
      conf = await conferirAlinhamento();
    }
  } else {
    /* Já alinhadas: funde hub em todas sem apagar o que as VMs já têm. */
    await espelharHubNasVms({ merge: true });
    conf = await conferirAlinhamento();
    if (conf.ok && !conf.alinhadas) {
      const alin = await alinearClusterVms();
      sincronizouCluster = Boolean(alin.sincronizou);
      conf = await conferirAlinhamento();
    }
  }

  const client = redis();
  const meta = await lerMeta(dig, client);
  if (meta) {
    meta.lastLoginAt = agoraIso();
    meta.lastDeviceId = String((extra && extra.deviceId) || "").trim();
    meta.clusterSeq = await lerSeqGlobal(client);
    meta.resumo = conf.resumo || meta.resumo;
    await gravarMeta(meta, client);
  }
  await limparPendente(dig, client);
  const estado = (await lerClone(dig, client)) || {};
  return {
    ok: true,
    meta: (await lerMeta(dig, client)) || g.meta,
    estado,
    seq: await lerSeqGlobal(client),
    resumo: resumirClone(estado),
    criada: g.criada,
    alinhadas: Boolean(conf.alinhadas),
    sincronizouCluster,
    divergencias: conf.divergencias || [],
  };
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
  if (!haNovidade) {
    return { ok: true, haNovidade: false, seq, resumo: null, estado: null };
  }
  const estado = (await lerClone(dig, client)) || {};
  const resumo = resumirClone(estado);
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
 * PC envia estado (Salvar) → funde na VM → redistribui clone idêntico a todas as VMs.
 * Marca pendência de download nas outras (login ou troca de tela / poll entrega no PC).
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
  const resumo = resumirClone(fundido);
  const seq = await bumpSeqGlobal(client);

  /* Redistribuição na nuvem: todas as VMs ficam com o mesmo banco. */
  const metas = await listarMetas(client);
  let propagadas = 0;
  for (const m of metas) {
    await gravarClone(m.cpf, fundido, client);
    const metaRow = (await lerMeta(m.cpf, client)) || metaVazia(m.cpf, m);
    metaRow.updatedAt = agoraIso();
    metaRow.resumo = resumo;
    metaRow.clusterSeq = seq;
    if (m.cpf === dig) {
      if (extra && extra.deviceId) metaRow.lastDeviceId = String(extra.deviceId).trim();
      if (extra && extra.nome) metaRow.nome = String(extra.nome).trim() || metaRow.nome;
    }
    await gravarMeta(metaRow, client);
    if (m.cpf !== dig) propagadas += 1;
  }

  const pendentes = await marcarPendentesDownload(dig, seq, client);
  /* Quem salvou já tem os dados no PC — limpa pendência própria. */
  await limparPendente(dig, client);

  return {
    ok: true,
    seq,
    resumo,
    propagadas,
    pendentes,
    meta: await lerMeta(dig, client),
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
  cpfOk,
  garantirVm,
  garantirTodasDoHub,
  loginEspelhar,
  sincronizarPcParaVm,
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
