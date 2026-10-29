/**
 * Cadastro de clientes: uma linha em public.dk_clientes.
 * O navegador não fala com o banco. O snapshot default não entra neste módulo.
 */
const crypto = require("crypto");
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");
const { revisaoConflita } = require("./dk-persistencia-central.cjs");
const { dkClienteAplicarPatch, dkClienteParaPersistencia, dkClienteParaTerminal } = require("./dk-cliente-fidelidade.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const TABELA = "dk_clientes";
const FONTE = "dk_clientes";
const FLAG_REDIS = "dk:portal:clientes_fonte:v1";
const SQL_TABELA = `
create extension if not exists pgcrypto;
create table if not exists public.dk_clientes (
  id text primary key,
  cpf text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists dk_clientes_cpf_ativo_idx
  on public.dk_clientes (cpf)
  where deleted_at is null;
create index if not exists dk_clientes_updated_at_idx
  on public.dk_clientes (updated_at);
alter table public.dk_clientes enable row level security;
revoke all on table public.dk_clientes from public, anon, authenticated;
grant select, insert, update on table public.dk_clientes to service_role;
notify pgrst, 'reload schema';
`;

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
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

async function rest(path, opts = {}) {
  if (typeof opts.rest === "function") return opts.rest(path, opts);
  if (!isSupabaseDoormanConfigured()) {
    return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  }
  const headers = {
    apikey: serviceRoleKey(),
    Authorization: "Bearer " + serviceRoleKey(),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (opts.prefer) headers.Prefer = opts.prefer;
  if (opts.range) headers.Range = opts.range;
  const res = await fetch(supabaseUrl() + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

function limparCliente(item) {
  const copia = JSON.parse(JSON.stringify(item || {}));
  return copia && typeof copia === "object" ? copia : {};
}

function ecoDe(cliente) {
  return {
    id: String(cliente && cliente.id != null ? cliente.id : ""),
    cpf: onlyDigits(cliente && cliente.cpf).slice(0, 11),
    nome: String((cliente && cliente.nome) || ""),
    recado2: String((cliente && cliente.recado2) || ""),
  };
}

async function tabelaExiste(io) {
  const pedido = io || rest;
  const res = await pedido(TABELA + "?select=id&limit=1");
  if (res.ok) return { ok: true, existe: true };
  if (schemaAusente(res)) return { ok: true, existe: false };
  return { ok: false, existe: false, status: res.status, data: res.data };
}

async function executarSql(sql, io) {
  if (io && typeof io.sql === "function") return io.sql(sql);
  const key = serviceRoleKey();
  if (!key) return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const destinos = [supabaseUrl() + "/pg/query", supabaseUrl() + "/pg-meta/default/query"];
  let ultimo = { ok: false, status: 404, data: { reason: "sql_indisponivel" } };
  for (const url of destinos) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query: sql }) });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 240) };
    }
    ultimo = { ok: res.ok, status: res.status, data };
    if (res.ok) return ultimo;
  }
  return ultimo;
}

async function garantirTabela(io) {
  const pedido = io && typeof io.rest === "function" ? io.rest : rest;
  const probe = await pedido(TABELA + "?select=id&limit=1");
  if (probe.ok) return { ok: true, criada: false };
  if (!schemaAusente(probe)) return { ok: false, reason: "leitura_tabela", status: probe.status };
  const sql = await executarSql(SQL_TABELA, io);
  if (!sql.ok) return { ok: false, reason: "sql", status: sql.status, detalhe: sql.data };
  const deNovo = await pedido(TABELA + "?select=id&limit=1");
  if (!deNovo.ok) return { ok: false, reason: schemaAusente(deNovo) ? "tabela_ausente_depois_do_sql" : "leitura_tabela", status: deNovo.status };
  return { ok: true, criada: true };
}

async function listarLinhas(ioRest) {
  const pedido = ioRest || rest;
  const res = await pedido(
    TABELA + "?deleted_at=is.null&select=id,cpf,payload,created_at,updated_at,deleted_at&order=id.asc&limit=2000"
  );
  if (!res.ok) return { ok: false, status: res.status, data: res.data, linhas: [] };
  const linhas = Array.isArray(res.data) ? res.data : [];
  return { ok: true, linhas };
}

async function listarClientes(ioRest) {
  const lido = await listarLinhas(ioRest);
  if (!lido.ok) return lido;
  return {
    ok: true,
    clientes: lido.linhas.map((row) => dkClienteParaTerminal(row)),
  };
}

async function lerClienteCompleto(id, ioRest) {
  const pedido = ioRest || rest;
  const chave = encodeURIComponent(String(id || ""));
  const res = await pedido(
    TABELA + "?id=eq." + chave + "&deleted_at=is.null&select=id,cpf,payload,created_at,updated_at,deleted_at&limit=1"
  );
  if (!res.ok) return { ok: false, status: res.status, data: res.data, cliente: null };
  const linha = Array.isArray(res.data) ? res.data[0] : null;
  return { ok: true, cliente: linha ? dkClienteParaTerminal(linha) : null };
}

async function lerPorCpf(cpf, ioRest) {
  const pedido = ioRest || rest;
  const dig = onlyDigits(cpf).slice(0, 11);
  const res = await pedido(
    TABELA + "?cpf=eq." + encodeURIComponent(dig) + "&deleted_at=is.null&select=id,cpf,payload,updated_at&limit=2"
  );
  if (!res.ok) return { ok: false, status: res.status, data: res.data, duplicado: false, row: null };
  const linhas = Array.isArray(res.data) ? res.data : [];
  return { ok: true, duplicado: linhas.length > 1, row: linhas[0] || null };
}

async function gravarLinha(linha, ioRest) {
  const pedido = ioRest || rest;
  return pedido(TABELA + "?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: linha,
  });
}

async function upsertUm(cliente, baseRevision, ioRest, opts) {
  const t0 = Date.now();
  const recebido = limparCliente(cliente);
  const cpf = onlyDigits(recebido.cpf).slice(0, 11);
  if (cpf.length !== 11) {
    return { ok: false, status: 400, body: { ok: false, success: false, reason: "cpf" } };
  }
  const atual = await lerPorCpf(cpf, ioRest);
  if (!atual.ok) {
    return {
      ok: false,
      status: schemaAusente(atual) ? 503 : 502,
      body: { ok: false, success: false, reason: schemaAusente(atual) ? "tabela_ausente" : "leitura" },
    };
  }
  if (atual.duplicado) {
    return { ok: false, status: 409, body: { ok: false, success: false, reason: "cpf_duplicado" } };
  }
  const prev = atual.row && atual.row.payload && typeof atual.row.payload === "object" ? atual.row.payload : null;
  if (!(opts && opts.ignorarRevisao) && atual.row && revisaoConflita(baseRevision, atual.row.updated_at)) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        success: false,
        reason: "revisao_conflito",
        revision: atual.row.updated_at,
        updated_at: atual.row.updated_at,
        message: "A nuvem tem uma versão mais nova. Recarregue antes de gravar.",
      },
    };
  }
  const merged = dkClienteAplicarPatch(prev || {}, recebido);
  if (prev && prev.id != null) merged.id = prev.id;
  else if (merged.id == null || merged.id === "") merged.id = recebido.id || Date.now();
  const persistido = dkClienteParaPersistencia(merged);
  const agora = new Date().toISOString();
  const gravado = await gravarLinha(
    {
      id: String(persistido.id),
      cpf: persistido.cpf || cpf,
      payload: persistido.payload,
      updated_at: agora,
      ...(atual.row ? {} : { created_at: agora }),
    },
    ioRest
  );
  if (!gravado.ok) {
    return {
      ok: false,
      status: 502,
      body: { ok: false, success: false, reason: "gravacao", detalhe: gravado.data || null },
      duracao_ms: Date.now() - t0,
    };
  }
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      success: true,
      persistencia: "supabase",
      source: FONTE,
      revision: agora,
      updated_at: agora,
      snapshot_gravacoes: 0,
      duracao_ms: Date.now() - t0,
      cliente: ecoDe(merged),
    },
  };
}

function resumirLista(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  const ids = new Set();
  const cpfs = new Set();
  const hashes = [];
  for (const item of arr) {
    ids.add(String(item && item.id != null ? item.id : ""));
    cpfs.add(onlyDigits(item && item.cpf).slice(0, 11));
    hashes.push(sha256(canon(limparCliente(item))));
  }
  hashes.sort();
  return {
    quantidade: arr.length,
    ids: ids.size,
    cpfs: cpfs.size,
    hash: sha256(hashes.join("\n")),
  };
}

async function copiarLista(lista, ioRest) {
  const pedido = ioRest || rest;
  const agora = new Date().toISOString();
  const linhas = (Array.isArray(lista) ? lista : []).map((item) => {
    const payload = limparCliente(item);
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    const id = String(payload.id != null ? payload.id : "");
    return { id, cpf, payload, updated_at: agora, created_at: agora, deleted_at: null };
  });
  for (let i = 0; i < linhas.length; i += 80) {
    const lote = linhas.slice(i, i + 80);
    const res = await pedido(TABELA + "?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: lote,
    });
    if (!res.ok) return { ok: false, status: res.status, data: res.data, gravados: i };
  }
  return { ok: true, gravados: linhas.length };
}

function compararListas(origem, destino) {
  const a = Array.isArray(origem) ? origem : [];
  const b = Array.isArray(destino) ? destino : [];
  const porId = new Map(b.map((item) => [String(item && item.id != null ? item.id : ""), limparCliente(item)]));
  const porCpf = new Map(b.map((item) => [onlyDigits(item && item.cpf).slice(0, 11), true]));
  let idsIguais = 0;
  let cpfsIguais = 0;
  let conteudoIgual = 0;
  const semCorrespondencia = [];
  for (const item of a) {
    const id = String(item && item.id != null ? item.id : "");
    const cpf = onlyDigits(item && item.cpf).slice(0, 11);
    const outro = porId.get(id);
    if (!outro) {
      semCorrespondencia.push(id || cpf);
      continue;
    }
    idsIguais += 1;
    if (onlyDigits(outro.cpf).slice(0, 11) === cpf) cpfsIguais += 1;
    if (canon(limparCliente(item)) === canon(outro)) conteudoIgual += 1;
    porCpf.delete(cpf);
  }
  const idsDestino = new Set(b.map((item) => String(item && item.id != null ? item.id : "")));
  const idsOrigem = new Set(a.map((item) => String(item && item.id != null ? item.id : "")));
  let extras = 0;
  idsDestino.forEach((id) => {
    if (!idsOrigem.has(id)) extras += 1;
  });
  const cpfsDestino = b.map((item) => onlyDigits(item && item.cpf).slice(0, 11));
  const cpfDuplicado = cpfsDestino.length !== new Set(cpfsDestino).size;
  return {
    quantidadeOrigem: a.length,
    quantidadeDestino: b.length,
    idsIguais,
    cpfsIguais,
    conteudoIgual,
    semCorrespondencia: semCorrespondencia.length,
    extras,
    cpfDuplicado,
    ok:
      a.length === b.length &&
      idsIguais === a.length &&
      cpfsIguais === a.length &&
      conteudoIgual === a.length &&
      semCorrespondencia.length === 0 &&
      extras === 0 &&
      !cpfDuplicado,
  };
}

module.exports = {
  FONTE,
  FLAG_REDIS,
  SQL_TABELA,
  onlyDigits,
  canon,
  sha256,
  schemaAusente,
  rest,
  ecoDe,
  tabelaExiste,
  garantirTabela,
  listarClientes,
  listarLinhas,
  lerPorCpf,
  lerClienteCompleto,
  upsertUm,
  resumirLista,
  copiarLista,
  compararListas,
  limparCliente,
};
