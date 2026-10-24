/**
 * Manutenção rápida em public.dk_manutencao_rapida. Uma linha por id.
 * Não grava o snapshot. O handler só chama isto com DK_MANUTENCOES_RAPIDAS_PG=1.
 * Cópia automática só com a tabela vazia e as duas origens sem conflito.
 * Lançamento mais novo não é substituído por cópia mais antiga.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");
const { mergeManutencoesRapidas } = require("./dk-append-only-merge.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const TABELA = "dk_manutencao_rapida";
const LEDGER = "dk_manutencao_rapida_migracao";
const CAMPO = "dk_manutencoes_rapidas_v1";
const PAGE = 1000;
const ESTADOS = new Set(["copiada", "origem_vazia", "nao_migrar", "ja_tinha_dados"]);

function manutencaoRelacionalAtiva() {
  return String(process.env.DK_MANUTENCOES_RAPIDAS_PG || "") === "1";
}

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function agoraIso(deps) {
  if (deps && typeof deps.agora === "function") return deps.agora();
  return new Date().toISOString();
}

function chaveManutencao(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return "";
  const id = String(r.id || "").trim();
  return id || [r.placa, r.criadoEm || r.createdAt, r.valorPago].filter(Boolean).join("|");
}

function scoreManutencao(r) {
  return Date.parse((r && (r.criadoEm || r.createdAt)) || 0) || 0;
}

function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === "object") {
    const out = {};
    for (const chave of Object.keys(valor).sort()) {
      const item = canonico(valor[chave]);
      if (item !== undefined) out[chave] = item;
    }
    return out;
  }
  return valor;
}

function digestManutencao(valor) {
  return JSON.stringify(canonico(valor));
}

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function schemaAusente(res) {
  const data = res && res.data;
  const msg = String((data && (data.message || data.raw || data.hint)) || "");
  return Boolean(
    res &&
      (res.status === 404 ||
        (data && (data.code === "PGRST205" || data.code === "42P01")) ||
        /does not exist|schema cache|Could not find the table/i.test(msg))
  );
}

function semChave(res) {
  return Boolean(res && res.data && res.data.reason === "doorman_key_missing");
}

function corpoErro(status, reason) {
  return {
    fallback: false,
    status,
    body: {
      ok: false,
      success: false,
      reason,
      supabase: { ok: false, reason },
    },
  };
}

async function rest(path, opts = {}) {
  if (typeof opts.rest === "function") return opts.rest(path, opts);
  if (!isSupabaseDoormanConfigured()) {
    return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  }
  const headers = {
    apikey: serviceRoleKey(),
    Authorization: `Bearer ${serviceRoleKey()}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (opts.prefer) headers.Prefer = opts.prefer;
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function classificar(res) {
  if (semChave(res)) return { fallback: true, motivo: "sem_chave" };
  if (schemaAusente(res)) return { fallback: true, motivo: "tabela_ausente" };
  if (!res || !res.ok) return corpoErro(res && res.status === 503 ? 503 : 502, "supabase_falhou");
  return null;
}

async function sondarTabela(deps) {
  const res = await rest(`${TABELA}?select=id&limit=1`, { rest: deps && deps.rest });
  const falha = classificar(res);
  if (falha) return falha;
  const linhas = Array.isArray(res.data) ? res.data : [];
  return { ok: true, vazia: linhas.length === 0 };
}

async function lerLedger(deps) {
  const res = await rest(`${LEDGER}?id=eq.1&select=id,estado,copiados,updated_at`, { rest: deps && deps.rest });
  const falha = classificar(res);
  if (falha) return falha.fallback ? { fallback: true, motivo: "ledger_ausente" } : falha;
  const row = Array.isArray(res.data) ? res.data[0] : null;
  if (!row) return { ok: true, estado: "" };
  const estado = String(row.estado || "");
  if (!ESTADOS.has(estado)) return { ok: true, estado: "desconhecido" };
  return { ok: true, estado };
}

async function gravarLedger(estado, copiados, deps) {
  const res = await rest(`${LEDGER}?on_conflict=id`, {
    rest: deps && deps.rest,
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      id: 1,
      estado,
      copiados: Math.max(0, Number(copiados) || 0),
      updated_at: agoraIso(deps),
    },
  });
  const falha = classificar(res);
  if (falha) return falha;
  return { ok: true };
}

function analisarOrigem(snapshot, redisLista) {
  if (snapshot == null) snapshot = [];
  if (!Array.isArray(snapshot) || !Array.isArray(redisLista)) return { ambiguo: true, motivo: "formato" };
  const porId = new Map();
  const ordem = [];
  const ver = (r) => {
    if (!r || typeof r !== "object" || Array.isArray(r)) return { ambiguo: true, motivo: "formato" };
    let registro;
    try {
      registro = clonar(r);
    } catch {
      return { ambiguo: true, motivo: "formato" };
    }
    const id = chaveManutencao(registro);
    if (!id) return { ambiguo: true, motivo: "sem_id" };
    const dig = digestManutencao(registro);
    const ex = porId.get(id);
    if (!ex) {
      porId.set(id, { registro, dig });
      ordem.push(id);
      return { ok: true };
    }
    if (ex.dig !== dig) return { ambiguo: true, motivo: "conflito" };
    return { ok: true };
  };
  for (const r of snapshot) {
    const a = ver(r);
    if (a.ambiguo) return a;
  }
  for (const r of redisLista) {
    const a = ver(r);
    if (a.ambiguo) return a;
  }
  return {
    ok: true,
    linhas: ordem.map((id, i) => ({
      id,
      registro: porId.get(id).registro,
      ordem: i + 1,
    })),
  };
}

async function migrarSeVazio(deps) {
  if (!deps || typeof deps.lerOrigem !== "function" || typeof deps.lerRedis !== "function") {
    return { fallback: true, motivo: "sem_leitura_de_origem" };
  }
  let atual;
  try {
    atual = await deps.lerOrigem();
  } catch {
    return { fallback: true, motivo: "origem_indisponivel" };
  }
  if (!atual || atual.indisponivel) return { fallback: true, motivo: "origem_indisponivel" };
  let redisLista;
  try {
    redisLista = await deps.lerRedis();
  } catch {
    return { fallback: true, motivo: "redis_indisponivel" };
  }
  const campo = atual.payload && Object.prototype.hasOwnProperty.call(atual.payload, CAMPO) ? atual.payload[CAMPO] : [];
  const lido = analisarOrigem(campo, redisLista);
  if (lido.ambiguo) {
    await gravarLedger("nao_migrar", 0, deps);
    return { fallback: true, motivo: "migracao_ambigua" };
  }
  if (!lido.linhas.length) {
    const marcado = await gravarLedger("origem_vazia", 0, deps);
    if (marcado.ok !== true) return marcado.fallback ? { fallback: true, motivo: marcado.motivo } : marcado;
    return { ok: true, copiados: 0 };
  }
  const updatedAt = agoraIso(deps);
  const res = await rest(`${TABELA}?on_conflict=id`, {
    rest: deps.rest,
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: lido.linhas.map((row) => ({ ...row, updated_at: updatedAt })),
  });
  const falha = classificar(res);
  if (falha) return falha.fallback ? { fallback: true, motivo: falha.motivo } : falha;
  const marcado = await gravarLedger("copiada", lido.linhas.length, deps);
  if (marcado.ok !== true) return marcado.fallback ? { fallback: true, motivo: marcado.motivo } : marcado;
  return { ok: true, copiados: lido.linhas.length };
}

async function garantirTabela(deps) {
  const sonda = await sondarTabela(deps);
  if (sonda.fallback || sonda.ok !== true) return sonda;
  const ledger = await lerLedger(deps);
  if (ledger.fallback || ledger.ok !== true) return ledger;
  if (ledger.estado === "nao_migrar") return { fallback: true, motivo: "migracao_recusada" };
  if (ledger.estado === "desconhecido") return { fallback: true, motivo: "ledger_desconhecido" };
  if (ledger.estado) return { ok: true };
  if (!sonda.vazia) {
    const marcado = await gravarLedger("ja_tinha_dados", 0, deps);
    if (marcado.ok !== true) return marcado.fallback ? { fallback: true, motivo: marcado.motivo } : marcado;
    return { ok: true };
  }
  return migrarSeVazio(deps);
}

async function listarTodos(deps) {
  const pageSize = Number(deps && deps.pageSize) > 0 ? Number(deps.pageSize) : PAGE;
  const todos = [];
  let primeira = "";
  for (let from = 0; from < pageSize * 200; from += pageSize) {
    const to = from + pageSize - 1;
    const res = await rest(`${TABELA}?select=id,registro,ordem,updated_at&order=ordem.asc`, {
      rest: deps && deps.rest,
      headers: { Range: `${from}-${to}`, "Range-Unit": "items" },
    });
    const falha = classificar(res);
    if (falha) return falha.fallback ? corpoErro(503, "tabela_ausente") : falha;
    const linhas = Array.isArray(res.data) ? res.data : [];
    const marca = linhas[0] && String(linhas[0].id || "");
    if (from > 0 && marca && marca === primeira) break;
    if (!primeira && marca) primeira = marca;
    todos.push(...linhas);
    if (linhas.length < pageSize) break;
  }
  let revision = null;
  let revisionMs = 0;
  for (const row of todos) {
    const t = Date.parse(row.updated_at || "") || 0;
    if (t >= revisionMs) {
      revisionMs = t;
      revision = row.updated_at || null;
    }
  }
  return { ok: true, linhas: todos, revision };
}

function aplicarLista(linhas, incoming, updatedAt) {
  const stored = Array.isArray(linhas) ? linhas : [];
  const porId = new Map();
  let ordemMax = 0;
  const finais = [];
  for (const row of stored) {
    const id = String(row.id || chaveManutencao(row.registro) || "");
    if (!id || porId.has(id)) continue;
    const registro = row.registro && typeof row.registro === "object" ? clonar(row.registro) : null;
    if (!registro) continue;
    porId.set(id, { registro, ordem: Number(row.ordem) || 0 });
    ordemMax = Math.max(ordemMax, Number(row.ordem) || 0);
    finais.push(registro);
  }
  const recebidos = mergeManutencoesRapidas([], Array.isArray(incoming) ? incoming : []);
  const writes = [];
  for (const reg of recebidos) {
    const id = chaveManutencao(reg);
    if (!id) continue;
    const ex = porId.get(id);
    if (!ex) {
      ordemMax += 1;
      const registro = clonar(reg);
      writes.push({ id, registro, ordem: ordemMax, updated_at: updatedAt });
      finais.push(registro);
      porId.set(id, { registro, ordem: ordemMax });
      continue;
    }
    if (scoreManutencao(ex.registro) > scoreManutencao(reg)) continue;
    const candidato = mergeManutencoesRapidas([ex.registro], [reg])[0];
    if (!candidato || digestManutencao(candidato) === digestManutencao(ex.registro)) continue;
    const registro = clonar(candidato);
    writes.push({ id, registro, updated_at: updatedAt });
    const idx = finais.findIndex((item) => chaveManutencao(item) === id);
    if (idx >= 0) finais[idx] = registro;
    ex.registro = registro;
  }
  return { finais, writes };
}

async function gravarNecessarios(writes, deps) {
  if (!writes.length) return { ok: true };
  const inserts = writes.filter((row) => row.ordem != null);
  const updates = writes.filter((row) => row.ordem == null);
  if (inserts.length) {
    const res = await rest(`${TABELA}?on_conflict=id`, {
      rest: deps && deps.rest,
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: inserts,
    });
    const falha = classificar(res);
    if (falha) return falha.fallback ? corpoErro(502, "supabase_falhou") : falha;
  }
  for (const row of updates) {
    const res = await rest(`${TABELA}?id=eq.${encodeURIComponent(row.id)}`, {
      rest: deps && deps.rest,
      method: "PATCH",
      prefer: "return=minimal",
      body: { registro: row.registro, updated_at: row.updated_at },
    });
    const falha = classificar(res);
    if (falha) return falha.fallback ? corpoErro(502, "supabase_falhou") : falha;
  }
  return { ok: true };
}

async function atenderManutencaoRelacional(pedido, deps) {
  const base = deps || {};
  const pronto = await garantirTabela(base);
  if (pronto.fallback || pronto.ok !== true) return pronto;
  const lista = await listarTodos(base);
  if (lista.fallback || lista.ok !== true) return lista;
  const method = String((pedido && pedido.method) || "GET").toUpperCase();
  if (method === "GET") {
    return {
      fallback: false,
      status: 200,
      data: lista.linhas.map((row) => row.registro),
      revision: lista.revision,
      gravou: false,
    };
  }
  if (method !== "POST") return { fallback: false, status: 405, body: { ok: false, reason: "method" } };
  const updatedAt = agoraIso(base);
  const aplicado = aplicarLista(lista.linhas, pedido.incoming, updatedAt);
  if (!aplicado.writes.length) {
    return {
      fallback: false,
      status: 200,
      data: aplicado.finais,
      revision: lista.revision,
      gravou: false,
    };
  }
  const gravado = await gravarNecessarios(aplicado.writes, base);
  if (gravado.fallback || gravado.ok !== true) return gravado;
  return {
    fallback: false,
    status: 200,
    data: aplicado.finais,
    revision: updatedAt,
    gravou: true,
  };
}

async function avaliarRollbackManutencao(deps) {
  const base = {
    apagaSnapshot: false,
    apagaTabela: false,
    como: "Retirar DK_MANUTENCOES_RAPIDAS_PG. O campo dk_manutencoes_rapidas_v1 permanece no snapshot. A tabela permanece. Não desligar se a tabela tiver lançamento que o snapshot não tem igual.",
  };
  if (!deps || typeof deps.lerOrigem !== "function" || typeof deps.rest !== "function") {
    return { ...base, podeDesligar: false, motivo: "sem_comparacao" };
  }
  const lista = await listarTodos(deps);
  if (lista.ok !== true) return { ...base, podeDesligar: false, motivo: "tabela_indisponivel" };
  let atual;
  try {
    atual = await deps.lerOrigem();
  } catch {
    return { ...base, podeDesligar: false, motivo: "origem_indisponivel" };
  }
  const campo = atual && atual.payload ? atual.payload[CAMPO] : [];
  const snap = new Map();
  if (Array.isArray(campo)) {
    for (const row of campo) {
      const id = chaveManutencao(row);
      if (id && !snap.has(id)) snap.set(id, digestManutencao(row));
    }
  }
  const soNaTabela = [];
  for (const row of lista.linhas) {
    const id = String(row.id || "");
    const dig = digestManutencao(row.registro);
    if (snap.get(id) !== dig) soNaTabela.push(id);
  }
  if (soNaTabela.length) {
    return { ...base, podeDesligar: false, motivo: "registros_so_na_tabela", ids: soNaTabela };
  }
  return { ...base, podeDesligar: true, motivo: "snapshot_cobre_a_tabela" };
}

module.exports = {
  TABELA,
  LEDGER,
  CAMPO,
  manutencaoRelacionalAtiva,
  chaveManutencao,
  digestManutencao,
  analisarOrigem,
  aplicarLista,
  atenderManutencaoRelacional,
  avaliarRollbackManutencao,
};
