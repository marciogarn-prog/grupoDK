/**
 * Presença da equipa em public.dk_equipa_presenca. Uma linha por CPF.
 * Não grava o snapshot. O handler só chama isto com DK_EQUIPA_PRESENCA_PG=1.
 * Se a tabela ainda não existir, ou a cópia for ambígua, devolve fallback.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const TABELA = "dk_equipa_presenca";
const LEDGER = "dk_equipa_presenca_migracao";
const CAMPO = "dk_equipa_presenca_v1";
const MAX_AGE_MS = 8 * 60 * 1000;
const MAX_OPS = 40;
const ESTADOS = new Set(["copiada", "origem_vazia", "nao_migrar", "ja_tinha_dados"]);

function presencaRelacionalAtiva() {
  return String(process.env.DK_EQUIPA_PRESENCA_PG || "") === "1";
}

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function texto(v) {
  return String(v ?? "").trim();
}

function agoraIso(deps) {
  if (deps && typeof deps.agora === "function") return deps.agora();
  return new Date().toISOString();
}

function agoraMs(deps) {
  const t = Date.parse(agoraIso(deps));
  return Number.isFinite(t) ? t : Date.now();
}

function msDe(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const t = Date.parse(String(valor || ""));
  return Number.isFinite(t) ? t : 0;
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
  const res = await rest(`${TABELA}?select=cpf&limit=1`, { rest: deps && deps.rest });
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
  return { ok: true, estado, copiados: Number(row.copiados) || 0 };
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

function linhasDaOrigem(payload) {
  const bruto = payload && payload[CAMPO];
  if (bruto == null) return { ok: true, linhas: [] };
  if (typeof bruto !== "object" || Array.isArray(bruto)) return { ambiguo: true, motivo: "formato" };
  const byCpf = bruto.byCpf;
  if (byCpf == null) return { ok: true, linhas: [] };
  if (typeof byCpf !== "object" || Array.isArray(byCpf)) return { ambiguo: true, motivo: "formato" };
  const linhas = [];
  for (const [cpfBruto, row] of Object.entries(byCpf)) {
    const cpf = onlyDigits(cpfBruto).slice(0, 11);
    const at = Number(row && row.at);
    if (row && row.nome != null && typeof row.nome !== "string" && typeof row.nome !== "number") {
      return { ambiguo: true, motivo: "formato" };
    }
    if (cpf.length !== 11 || !Number.isFinite(at) || at <= 0) continue;
    linhas.push({
      cpf,
      nome: texto(row && row.nome),
      pulso_em: new Date(at).toISOString(),
      updated_at: new Date(at).toISOString(),
    });
  }
  return { ok: true, linhas };
}

async function migrarSeVazio(deps) {
  if (!deps || typeof deps.lerOrigem !== "function") {
    return { fallback: true, motivo: "sem_leitura_de_origem" };
  }
  let atual;
  try {
    atual = await deps.lerOrigem();
  } catch {
    return { fallback: true, motivo: "origem_indisponivel" };
  }
  if (!atual || atual.indisponivel) return { fallback: true, motivo: "origem_indisponivel" };
  const lido = linhasDaOrigem(atual.payload);
  if (lido.ambiguo) {
    const marcado = await gravarLedger("nao_migrar", 0, deps);
    if (marcado.fallback || marcado.ok !== true) return { fallback: true, motivo: "migracao_ambigua" };
    return { fallback: true, motivo: "migracao_ambigua" };
  }
  if (!lido.linhas.length) {
    const marcado = await gravarLedger("origem_vazia", 0, deps);
    if (marcado.ok !== true) return marcado.fallback ? { fallback: true, motivo: marcado.motivo } : marcado;
    return { ok: true, copiados: 0 };
  }
  const res = await rest(`${TABELA}?on_conflict=cpf`, {
    rest: deps.rest,
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: lido.linhas,
  });
  const falha = classificar(res);
  if (falha) return falha.fallback ? { fallback: true, motivo: falha.motivo } : falha;
  const marcado = await gravarLedger("copiada", lido.linhas.length, deps);
  if (marcado.ok !== true) return marcado.fallback ? { fallback: true, motivo: marcado.motivo } : marcado;
  return { ok: true, copiados: lido.linhas.length };
}

function storeDeLinhas(linhas) {
  const byCpf = {};
  const ordered = (Array.isArray(linhas) ? linhas : [])
    .map((row) => ({
      cpf: onlyDigits(row && row.cpf).slice(0, 11),
      at: msDe(row && row.pulso_em),
      nome: texto(row && row.nome),
      updated_at: row && row.updated_at ? String(row.updated_at) : "",
    }))
    .filter((row) => row.cpf.length === 11 && row.at > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_OPS);
  let revision = null;
  let revisionMs = 0;
  for (const row of ordered) {
    byCpf[row.cpf] = { at: row.at, nome: row.nome };
    const t = Date.parse(row.updated_at || "") || row.at;
    if (t >= revisionMs) {
      revisionMs = t;
      revision = row.updated_at || new Date(row.at).toISOString();
    }
  }
  return { store: { byCpf }, revision };
}

async function listarOnline(deps) {
  const corte = new Date(agoraMs(deps) - MAX_AGE_MS).toISOString();
  const res = await rest(
    `${TABELA}?select=cpf,nome,pulso_em,updated_at&pulso_em=gte.${encodeURIComponent(corte)}&order=pulso_em.desc&limit=${MAX_OPS}`,
    { rest: deps && deps.rest }
  );
  const falha = classificar(res);
  if (falha) return falha;
  return { ok: true, ...storeDeLinhas(res.data) };
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

async function aplicarPulso(entrada, deps) {
  const cpf = onlyDigits(entrada && entrada.cpf).slice(0, 11);
  const at = Number(entrada && entrada.at);
  if (cpf.length !== 11 || !Number.isFinite(at) || at <= 0) {
    return { fallback: false, status: 400, body: { ok: false, success: false, reason: "cpf" } };
  }
  if (!entrada.vivo) {
    const res = await rest(`${TABELA}?cpf=eq.${encodeURIComponent(cpf)}`, {
      rest: deps && deps.rest,
      method: "DELETE",
      prefer: "return=minimal",
    });
    const falha = classificar(res);
    if (falha) return falha.fallback ? { fallback: true, motivo: falha.motivo } : falha;
    return { ok: true, gravou: true, cpf, removeu: true };
  }
  const atual = await rest(`${TABELA}?cpf=eq.${encodeURIComponent(cpf)}&select=cpf,nome,pulso_em,updated_at`, {
    rest: deps && deps.rest,
  });
  const falhaAtual = classificar(atual);
  if (falhaAtual) return falhaAtual.fallback ? { fallback: true, motivo: falhaAtual.motivo } : falhaAtual;
  const row = Array.isArray(atual.data) ? atual.data[0] : null;
  if (row && msDe(row.pulso_em) >= at) return { ok: true, gravou: false };
  const updatedAt = agoraIso(deps);
  const res = await rest(`${TABELA}?on_conflict=cpf`, {
    rest: deps && deps.rest,
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      cpf,
      nome: texto(entrada.nome) || texto(row && row.nome),
      pulso_em: new Date(at).toISOString(),
      updated_at: updatedAt,
    },
  });
  const falha = classificar(res);
  if (falha) return falha.fallback ? { fallback: true, motivo: falha.motivo } : falha;
  return { ok: true, gravou: true, updatedAt };
}

function concluir(lista) {
  return {
    fallback: false,
    status: 200,
    store: lista.store,
    revision: lista.revision || null,
  };
}

async function atenderPresencaRelacional(pedido, deps) {
  const base = deps || {};
  const pronto = await garantirTabela(base);
  if (pronto.fallback || pronto.ok !== true) return pronto;
  const lista = await listarOnline(base);
  if (lista.fallback || lista.ok !== true) return lista;
  const method = String((pedido && pedido.method) || "GET").toUpperCase();
  if (method === "GET") return concluir(lista);
  if (method !== "POST") return { fallback: false, status: 405, body: { ok: false, reason: "method" } };
  const aplicado = await aplicarPulso(pedido.entrada || {}, base);
  if (aplicado.fallback || aplicado.ok !== true) return aplicado;
  if (!aplicado.gravou) return concluir(lista);
  const deNovo = await listarOnline(base);
  if (deNovo.ok !== true) return deNovo.fallback ? corpoErro(502, "supabase_falhou") : deNovo;
  if (aplicado.updatedAt) deNovo.revision = aplicado.updatedAt;
  return concluir(deNovo);
}

function avaliarRollbackPresenca() {
  return {
    podeDesligar: true,
    apagaSnapshot: false,
    apagaTabela: false,
    como: "Retirar DK_EQUIPA_PRESENCA_PG. O campo dk_equipa_presenca_v1 permanece no snapshot. A tabela permanece. Pulsos feitos só na tabela deixam de aparecer no banner; a janela é de 8 minutos.",
  };
}

module.exports = {
  TABELA,
  LEDGER,
  CAMPO,
  MAX_AGE_MS,
  MAX_OPS,
  presencaRelacionalAtiva,
  linhasDaOrigem,
  storeDeLinhas,
  atenderPresencaRelacional,
  avaliarRollbackPresenca,
};
