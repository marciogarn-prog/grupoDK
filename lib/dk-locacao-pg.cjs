/**
 * Locações e pagamentos no PostgreSQL.
 * A flag Redis decide se o módulo está ativo. Sem ela, a tabela não vira fonte.
 * Cada gravação é uma locação, com a versão que o terminal leu.
 * Movimento financeiro só é inserido; a chave de idempotência impede repetir o mesmo fato.
 */
const { isSupabaseDoormanConfigured, fetchSnapshotByLabel } = require("./dk-supabase-doorman.cjs");
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
const {
  acquireLocacoesWriteLock,
  releaseLocacoesWriteLock,
  findActivePlateConflicts,
  activePlateConflictMessage,
  findNewDuplicatePayments,
} = require("./dk-locacoes-integrity.cjs");
const { normalizeOperacaoAccess } = require("./dk-portal-module-access.cjs");

const FLAG_LOCACAO = "dk:portal:locacoes_fonte:v1";
const FONTE_LOCACAO = "dk_locacao";

function moduloPedido(flag) {
  return String(flag || "") === FONTE_LOCACAO;
}

async function lerFlagLocacao(redis) {
  try {
    if (redis && typeof redis.get === "function") return String((await redis.get(FLAG_LOCACAO)) || "");
    if (!isRedisKvConfigured()) return "";
    return String((await createRedisClient().get(FLAG_LOCACAO)) || "");
  } catch {
    return "";
  }
}

function respostaInativa() {
  return { ok: true, schema: true, ativado: false, migracao: "inativo", locacoes: [] };
}

async function flagDoPedido(opts) {
  if (opts && Object.prototype.hasOwnProperty.call(opts, "flag")) return opts.flag;
  return lerFlagLocacao(opts && opts.redis);
}

async function obterFonteLocacoes(opts) {
  return moduloPedido(await flagDoPedido(opts)) ? FONTE_LOCACAO : "snapshot";
}

function decidirAcessoLocacao(gate, funcionarios) {
  if (!gate || gate.ok === false) {
    return {
      ok: false,
      status: Number(gate && gate.status) || 401,
      reason: (gate && gate.reason) || "unauthorized",
    };
  }
  if (gate.typ === "cliente") {
    return { ok: false, status: 403, reason: "module_forbidden", modulo: "locacao" };
  }
  if (gate.service || String(gate.role || "").trim() === "owner") return { ok: true };
  let role = String(gate.role || "operacao").trim();
  let acessos = gate.acessos;
  if (Array.isArray(funcionarios)) {
    const cpf = digitos(gate.cpf).slice(0, 11);
    const funcionario = funcionarios.find((item) => digitos(item && item.cpf).slice(0, 11) === cpf) || null;
    role = String((funcionario && funcionario.role) || gate.role || "operacao").trim();
    if (role === "owner") return { ok: true };
    acessos = normalizeOperacaoAccess(funcionario && funcionario.acessos, role);
  } else if (!acessos) {
    acessos = normalizeOperacaoAccess(null, role);
  } else {
    acessos = normalizeOperacaoAccess(acessos, role);
  }
  if (!acessos.locacao) {
    return { ok: false, status: 403, reason: "module_forbidden", modulo: "locacao" };
  }
  return { ok: true };
}

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

const TIPOS = new Set([
  "pagamento",
  "estorno",
  "cancelamento",
  "ajuste",
  "devolucao",
  "credito_manutencao",
  "caucao",
]);

const CHAVES_FORA_DO_REGISTRO = new Set([
  "portalLancamentosAluguel",
  "portalLancamentosAluguelRemovidos",
  "portalPagamentosAuditoria",
  "portalLancamentosCaucao",
  "pgId",
  "pgVersion",
  "pgUpdatedAt",
]);

function digitos(v) {
  return String(v || "").replace(/\D/g, "");
}

function tipoDeLancamento(row) {
  const t = String(row?.tipoMovimento || "").trim().toUpperCase();
  if (t.includes("DEVOL")) return "devolucao";
  if (t.includes("CREDITO")) return "credito_manutencao";
  if (t.includes("CAU")) return "caucao";
  return "pagamento";
}

function tipoParaTela(tipo) {
  if (tipo === "devolucao") return "DEVOLUCAO_INVESTIMENTO";
  if (tipo === "credito_manutencao") return "CREDITO_MANUTENCAO";
  if (tipo === "caucao") return "CAUCAO";
  return "PAGAMENTO";
}

function protocoloDe(row) {
  const p = String(row?.protocoloLancamento || row?.protocolo || "").trim();
  if (p) return p;
  const data = String(row?.data || row?.dataPagamento || "").trim();
  const valor = Number(row?.valor || 0).toFixed(2);
  const ca = Number(row?.createdAt || row?.id || 0);
  return `legado|${data}|${valor}|${ca}`;
}

function stripCampos(loc) {
  const src = loc && typeof loc === "object" ? loc : {};
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (CHAVES_FORA_DO_REGISTRO.has(k)) continue;
    if (/base64|imagem|pdfbin/i.test(k)) continue;
    out[k] = v;
  }
  const numero = digitos(out.numeroContrato || out.protocolo);
  if (numero) out.numeroContrato = numero;
  return out;
}

function chavePagamento(proto) {
  return `pag|${proto}`;
}

function chaveEstorno(proto) {
  return `estorno|${proto}`;
}

function movimentosNovos(existentes, loc) {
  const lista = Array.isArray(existentes) ? existentes : [];
  const keys = new Set(lista.map((m) => String(m?.idempotency_key || "")));
  const porChave = new Map(lista.map((m) => [String(m?.idempotency_key || ""), m]));
  const visao = derivarVisao({}, lista);
  const valorNaTela = new Map(
    (visao.portalLancamentosAluguel || []).map((p) => [protocoloDe(p), Number(p.valor) || 0])
  );
  const cancelado = new Set(
    (visao.portalLancamentosAluguelRemovidos || []).map((p) => protocoloDe(p))
  );
  const novos = [];
  const pagamentos = Array.isArray(loc?.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
  for (const row of pagamentos) {
    if (!row || typeof row !== "object") continue;
    const proto = protocoloDe(row);
    const key = chavePagamento(proto);
    const ja = porChave.get(key);
    if (!ja) {
      const tipo = tipoDeLancamento(row);
      novos.push({
        tipo,
        valor: Number(row.valor) || 0,
        data_movimento: String(row.data || row.dataPagamento || "").trim(),
        descricao: String(row.comentarioPagamento || row.comentario || "").trim().slice(0, 500),
        idempotency_key: key,
        protocolo_lancamento: proto,
        campos: {
          tipoMovimento: tipoParaTela(tipo),
          registradoPorCpf: digitos(row.registradoPorCpf).slice(0, 11),
          registradoPorNome: String(row.registradoPorNome || "").trim(),
          createdAt: Number(row.createdAt || 0) || Date.now(),
          valorEspecie: row.valorEspecie,
          valorPix: row.valorPix,
          valorCartao: row.valorCartao,
          comentarioPagamento: String(row.comentarioPagamento || row.comentario || "").trim().slice(0, 500),
        },
      });
      keys.add(key);
      continue;
    }
    if (cancelado.has(proto)) continue;
    const atual = valorNaTela.has(proto) ? valorNaTela.get(proto) : Number(ja.valor) || 0;
    const pedido = Number(row.valor) || 0;
    if (pedido === atual) continue;
    const ajKey = `ajuste|${proto}|${pedido.toFixed(2)}|${Number(row.updatedAt || 0)}`;
    if (keys.has(ajKey)) continue;
    novos.push({
      tipo: "ajuste",
      valor: Number((pedido - atual).toFixed(2)),
      data_movimento: String(row.data || row.dataPagamento || "").trim(),
      descricao: "Ajuste de valor",
      idempotency_key: ajKey,
      protocolo_lancamento: proto,
      campos: { protocoloAlvo: proto, valorPedido: pedido },
    });
    keys.add(ajKey);
  }
  const removidos = Array.isArray(loc?.portalLancamentosAluguelRemovidos)
    ? loc.portalLancamentosAluguelRemovidos
    : [];
  for (const row of removidos) {
    if (!row || typeof row !== "object") continue;
    const proto = protocoloDe(row);
    const key = chaveEstorno(proto);
    if (keys.has(key)) continue;
    novos.push({
      tipo: "estorno",
      valor: Math.abs(Number(row.valor) || 0),
      data_movimento: String(row.data || row.dataPagamento || "").trim(),
      descricao: "Estorno",
      idempotency_key: key,
      protocolo_lancamento: proto,
      campos: {
        protocoloAlvo: proto,
        removedAt: Number(row.removedAt || 0) || Date.now(),
      },
    });
    keys.add(key);
  }
  return novos.filter((m) => TIPOS.has(m.tipo) && m.idempotency_key);
}

function derivarVisao(campos, movimentos) {
  const base = campos && typeof campos === "object" ? { ...campos } : {};
  const ordem = [];
  const porProto = new Map();
  const lista = (Array.isArray(movimentos) ? movimentos : []).slice().sort((a, b) => {
    const ta = Date.parse(a?.created_at || "") || 0;
    const tb = Date.parse(b?.created_at || "") || 0;
    if (ta !== tb) return ta - tb;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
  for (const m of lista) {
    const tipo = String(m?.tipo || "");
    const proto = String(m?.protocolo_lancamento || m?.campos?.protocoloAlvo || "").trim();
    if (!proto) continue;
    if (tipo === "estorno" || tipo === "cancelamento") {
      const alvo = String(m?.campos?.protocoloAlvo || proto).trim();
      const row = porProto.get(alvo);
      if (row) row.cancelado = true;
      else porProto.set(alvo, { protocoloLancamento: alvo, cancelado: true, valor: 0, data: m.data_movimento || "" });
      if (!ordem.includes(alvo)) ordem.push(alvo);
      continue;
    }
    if (tipo === "ajuste") {
      const alvo = String(m?.campos?.protocoloAlvo || proto).trim();
      const row = porProto.get(alvo);
      if (row) row.valor = Number((Number(row.valor) + Number(m.valor || 0)).toFixed(2));
      continue;
    }
    const extra = m?.campos && typeof m.campos === "object" ? m.campos : {};
    const row = {
      ...extra,
      data: String(m.data_movimento || extra.data || "").trim(),
      valor: Number(m.valor) || 0,
      protocoloLancamento: proto,
      tipoMovimento: tipoParaTela(tipo),
      createdAt: Number(extra.createdAt || 0) || Date.parse(m.created_at || "") || 0,
      cancelado: false,
    };
    porProto.set(proto, row);
    if (!ordem.includes(proto)) ordem.push(proto);
  }
  const visiveis = [];
  const removidos = [];
  for (const proto of ordem) {
    const row = porProto.get(proto);
    if (!row) continue;
    if (row.cancelado) removidos.push(row);
    else visiveis.push(row);
  }
  base.portalLancamentosAluguel = visiveis;
  if (removidos.length) base.portalLancamentosAluguelRemovidos = removidos;
  else delete base.portalLancamentosAluguelRemovidos;
  return base;
}

function locacaoParaTerminal(row, movimentos) {
  const campos = row?.campos && typeof row.campos === "object" ? row.campos : {};
  const vista = derivarVisao(campos, movimentos);
  vista.numeroContrato = String(row.numero_contrato || vista.numeroContrato || "");
  vista.pgId = row.id;
  vista.pgVersion = Number(row.version) || 1;
  vista.pgUpdatedAt = row.updated_at || null;
  if (row.deleted_at) vista.deleted_at = row.deleted_at;
  return vista;
}

function assinaturaLocacao(loc) {
  const campos = stripCampos(loc);
  const pays = (Array.isArray(loc?.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [])
    .map((p) => `${protocoloDe(p)}|${Number(p?.valor) || 0}|${String(p?.data || "")}`)
    .sort()
    .join(";");
  const rems = (Array.isArray(loc?.portalLancamentosAluguelRemovidos) ? loc.portalLancamentosAluguelRemovidos : [])
    .map((p) => protocoloDe(p))
    .sort()
    .join(";");
  return `${JSON.stringify(campos)}#${pays}#${rems}`;
}

const LEITURA_MS = 15000;

async function rest(path, opts = {}) {
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
  const prazo = Number.isFinite(Number(opts.timeoutMs)) ? Number(opts.timeoutMs) : LEITURA_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), prazo);
  let res;
  try {
    res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
      method: opts.method || "GET",
      headers,
      body: opts.body == null ? undefined : JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (ctrl.signal.aborted || (err && err.name === "AbortError")) {
      return { ok: false, status: 504, data: { reason: "supabase_timeout" } };
    }
    return { ok: false, status: 503, data: { reason: "supabase_indisponivel" } };
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  const schemaAusente =
    res.status === 404 ||
    (data && (data.code === "PGRST205" || data.code === "42P01" || /dk_locacao/i.test(String(data.message || "")) && /schema cache|does not exist|Could not find/i.test(String(data.message || ""))));
  return { ok: res.ok, status: res.status, data, schemaAusente, contentRange: res.headers.get("content-range") };
}

async function restAll(path) {
  const page = 1000;
  const all = [];
  for (let from = 0; from < 100000; from += page) {
    const res = await rest(path, {
      headers: { Range: `${from}-${from + page - 1}`, "Range-Unit": "items" },
    });
    if (res.schemaAusente) return res;
    if (!res.ok) return res;
    const chunk = Array.isArray(res.data) ? res.data : [];
    all.push(...chunk);
    if (chunk.length < page) return { ok: true, data: all };
  }
  return { ok: true, data: all };
}

function schemaSumiu(res) {
  return Boolean(res && res.schemaAusente);
}

async function lerLocacoesAbertas(cpf) {
  let path = "dk_locacao?deleted_at=is.null&select=id,numero_contrato,cpf,placa,status_locacao,campos,version,created_at,updated_at,deleted_at,created_by,updated_by&order=numero_contrato.asc";
  const c = digitos(cpf).slice(0, 11);
  if (c.length === 11) path += `&cpf=eq.${encodeURIComponent(c)}`;
  return restAll(path);
}

async function lerMovimentos(ids) {
  if (!ids.length) return { ok: true, data: [] };
  const all = [];
  const lote = 80;
  for (let i = 0; i < ids.length; i += lote) {
    const parte = ids.slice(i, i + lote).map((id) => encodeURIComponent(id)).join(",");
    const res = await restAll(
      `dk_locacao_movimento?locacao_id=in.(${parte})&select=id,locacao_id,tipo,valor,data_movimento,descricao,referencia_movimento_id,idempotency_key,created_at,created_by,protocolo_lancamento,campos&order=created_at.asc`
    );
    if (!res.ok || res.schemaAusente) return res;
    all.push(...(res.data || []));
  }
  return { ok: true, data: all };
}

function montarTerminais(rows, movimentos, cpf) {
  const porLoc = new Map();
  for (const m of movimentos || []) {
    const id = String(m.locacao_id || "");
    if (!porLoc.has(id)) porLoc.set(id, []);
    porLoc.get(id).push(m);
  }
  const c = digitos(cpf).slice(0, 11);
  return (rows || [])
    .filter((row) => !row.deleted_at)
    .filter((row) => (c.length === 11 ? digitos(row.cpf).slice(0, 11) === c : true))
    .map((row) => locacaoParaTerminal(row, porLoc.get(String(row.id)) || []));
}

function locacaoCanonica(row) {
  const campos = row && row.campos && typeof row.campos === "object" && !Array.isArray(row.campos) ? row.campos : null;
  return campos || {};
}

function semMarcadores(loc) {
  if (!loc || typeof loc !== "object" || Array.isArray(loc)) return {};
  const out = { ...loc };
  delete out.pgId;
  delete out.pgVersion;
  delete out.pgUpdatedAt;
  return out;
}

function locacaoParaTela(row) {
  const base = semMarcadores(locacaoCanonica(row));
  if (!row || !row.id) return base;
  return { ...base, pgId: row.id, pgVersion: Number(row.version) || 1 };
}

function idLegadoDe(loc) {
  if (!loc || loc.id == null) return null;
  const id = String(loc.id).trim();
  return id || null;
}

function projetarColunas(loc, nc) {
  const cpf = digitos(loc && loc.cpf);
  const placa = loc && loc.placa != null ? String(loc.placa) : "";
  const status = String((loc && (loc.statusLocacao || loc.status)) || "").trim();
  return {
    numero_contrato: nc,
    id_legado: idLegadoDe(loc),
    cpf: cpf || null,
    placa: placa || null,
    status_locacao: status || null,
    campos: semMarcadores(loc),
  };
}

async function listar(cpf, opts) {
  if (!moduloPedido(await flagDoPedido(opts))) return respostaInativa();
  const io = (opts && opts.rest) || restAll;
  let path =
    "dk_locacao?deleted_at=is.null&select=id,numero_contrato,id_legado,cpf,placa,status_locacao,campos,version,updated_at&order=numero_contrato.asc";
  const c = digitos(cpf).slice(0, 11);
  if (c.length === 11) path += `&cpf=eq.${encodeURIComponent(c)}`;
  const rows = await io(path);
  if (schemaSumiu(rows)) return { ok: false, schema: false, reason: "schema_ausente", ativado: true, locacoes: [] };
  if (!rows || !rows.ok) {
    return { ok: false, schema: true, ativado: true, reason: "leitura", status: rows && rows.status, locacoes: [] };
  }
  const locacoes = (rows.data || []).filter((row) => row && !row.deleted_at).map(locacaoParaTela);
  return { ok: true, schema: true, ativado: true, migracao: "pronta", locacoes };
}

async function relogio(opts) {
  if (!moduloPedido(await flagDoPedido(opts))) return { ok: true, schema: true, ativado: false, selo: "inativo" };
  const io = (opts && opts.rest) || rest;
  const topo = await io("dk_locacao?deleted_at=is.null&select=updated_at&order=updated_at.desc&limit=1");
  if (schemaSumiu(topo)) return { ok: false, schema: false, reason: "schema_ausente", ativado: true };
  if (!topo || !topo.ok) return { ok: false, schema: true, ativado: true, reason: "leitura", status: topo && topo.status };
  const conta = await io("dk_locacao?deleted_at=is.null&select=id&limit=1", {
    headers: { Range: "0-0", Prefer: "count=exact" },
  });
  if (schemaSumiu(conta) || !conta || !conta.ok) return { ok: false, schema: true, ativado: true, reason: "leitura" };
  const total = String(conta.contentRange || "").split("/")[1] || "0";
  const updated = Array.isArray(topo.data) && topo.data[0] ? topo.data[0].updated_at : "";
  return { ok: true, schema: true, ativado: true, selo: `${updated}|${total}` };
}

function conflitoVersao(row, version) {
  const lida = Number(version);
  return !Number.isInteger(lida) || lida < 1 || lida !== Number(row && row.version);
}

function linhaUnica(res) {
  return res && Array.isArray(res.data) ? res.data[0] : null;
}

function locacaoConfirmada(loc) {
  const inicio = String((loc && (loc.inicio || loc.dataInicio)) || "").trim();
  const cpf = digitos(loc && loc.cpf);
  const nome = String((loc && (loc.nome || loc.cliente)) || "").trim();
  const placa = String((loc && loc.placa) || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return Boolean(inicio && cpf.length === 11 && nome && placa.length >= 7);
}

function locacaoParaConflito(row) {
  const campos = row && row.campos && typeof row.campos === "object" && !Array.isArray(row.campos) ? row.campos : {};
  return {
    ...campos,
    numeroContrato: campos.numeroContrato || campos.protocolo || (row && row.numero_contrato) || "",
    placa: campos.placa || (row && row.placa) || "",
    statusLocacao: campos.statusLocacao || campos.status || (row && row.status_locacao) || "",
  };
}

function listaComLocacao(rows, locacao, nc) {
  const lista = [];
  let achou = false;
  for (const row of rows || []) {
    if (!row || row.deleted_at) continue;
    const protocolo = digitos((row && row.numero_contrato) || "");
    if (protocolo === nc) {
      achou = true;
      lista.push({ ...locacao, numeroContrato: nc });
    } else {
      lista.push(locacaoParaConflito(row));
    }
  }
  if (!achou) lista.push({ ...locacao, numeroContrato: nc });
  return lista;
}

function respostaDuplicado(duplicados) {
  const duplicate = duplicados[0];
  return {
    ok: false,
    status: 409,
    conflict: true,
    reason: "duplicate_payment_same_day_value",
    protocolo: duplicate.protocoloContrato,
    data: duplicate.data,
    valor: duplicate.valor,
    duplicates: duplicados,
    message:
      `JÁ EXISTE UM PAGAMENTO DE R$ ${Number(duplicate.valor).toFixed(2).replace(".", ",")} ` +
      `EM ${duplicate.data} PARA O PROTOCOLO ${duplicate.protocoloContrato}.`,
    ativado: true,
  };
}
function respostaPlaca(conflict) {
  return {
    ok: false,
    success: false,
    status: 409,
    conflict: true,
    reason: "active_plate_conflict",
    placa: conflict.placa,
    protocolos: conflict.contratos.map((item) => item.protocolo),
    message: activePlateConflictMessage(conflict),
    ativado: true,
  };
}

async function comTrava(pedido, trabalho) {
  const redis = pedido && Object.prototype.hasOwnProperty.call(pedido, "redis")
    ? pedido.redis
    : isRedisKvConfigured()
      ? (() => {
          try {
            return createRedisClient();
          } catch {
            return null;
          }
        })()
      : null;
  let token = "sem-redis";
  if (redis) {
    try {
      token = await acquireLocacoesWriteLock(redis, { attempts: 5, waitMs: 100, ttlSec: 30 });
    } catch {
      token = "sem-redis";
    }
  }
  if (!token) {
    return {
      ok: false,
      success: false,
      status: 409,
      reason: "locacoes_write_busy",
      message: "Outra gravação de locação está em andamento. Aguarde e tente novamente.",
      ativado: true,
    };
  }
  try {
    return await trabalho();
  } finally {
    if (redis && token !== "sem-redis") await releaseLocacoesWriteLock(redis, token);
  }
}

async function gravarUma(pedido) {
  if (!moduloPedido(await flagDoPedido(pedido))) {
    return { ok: false, status: 409, conflict: true, reason: "modulo_inativo", ativado: false };
  }
  const acesso = decidirAcessoLocacao(pedido && pedido.acesso, pedido && pedido.funcionarios);
  if (!acesso.ok) return { ...acesso, ativado: true };
  const io = (pedido && pedido.rest) || rest;
  const locacao = pedido && pedido.locacao;
  if (!locacao || typeof locacao !== "object" || Array.isArray(locacao)) {
    return { ok: false, status: 400, reason: "locacao_obrigatoria", ativado: true };
  }
  const nc = digitos((pedido && pedido.numero) || locacao.numeroContrato || locacao.protocolo);
  if (!nc) return { ok: false, status: 400, reason: "protocolo_obrigatorio", ativado: true };
  return comTrava(pedido, async () => {
  const atual = await io(`dk_locacao?numero_contrato=eq.${encodeURIComponent(nc)}&select=id,version,deleted_at,campos`);
  if (schemaSumiu(atual)) return { ok: false, schema: false, reason: "schema_ausente", ativado: true };
  if (!atual || !atual.ok) return { ok: false, status: 502, reason: "leitura", ativado: true };
  const row = linhaUnica(atual);
  if (row && row.deleted_at) return { ok: false, status: 409, conflict: true, reason: "excluida", ativado: true };
  const placas = await io(
    "dk_locacao?deleted_at=is.null&select=numero_contrato,placa,status_locacao,campos"
  );
  if (schemaSumiu(placas)) return { ok: false, schema: false, reason: "schema_ausente", ativado: true };
  if (!placas || !placas.ok) return { ok: false, status: 502, reason: "leitura", ativado: true };
  const conflitos = findActivePlateConflicts(listaComLocacao(placas.data, locacao, nc));
  if (conflitos.length) return respostaPlaca(conflitos[0]);
  if (!locacaoConfirmada(locacao)) {
    return {
      ok: false,
      success: false,
      status: 409,
      reason: "locacao_nao_confirmada",
      message: "A nuvem não guardou data, cliente e placa deste protocolo. Confira o cadastro e tente de novo.",
      ativado: true,
    };
  }
  const anteriores = row && row.campos ? [{ ...row.campos, numeroContrato: nc }] : [];
  const duplicados = findNewDuplicatePayments(anteriores, [{ ...locacao, numeroContrato: nc }]);
  if (duplicados.length) return respostaDuplicado(duplicados);
  const autor = String((pedido && pedido.by) || "").slice(0, 80);
  const corpo = projetarColunas(locacao, nc);
  if (!row) {
    const ins = await io("dk_locacao", {
      method: "POST",
      prefer: "return=representation",
      body: { ...corpo, created_by: autor, updated_by: autor },
    });
    if (schemaSumiu(ins)) return { ok: false, schema: false, reason: "schema_ausente", ativado: true };
    const duplicada = ins && ins.data && (ins.data.code === "23505" || /duplicate key/i.test(String(ins.data.message || "")));
    if (!ins || !ins.ok || duplicada) {
      return { ok: false, status: duplicada ? 409 : ins && ins.status || 502, conflict: Boolean(duplicada), reason: duplicada ? "protocolo" : "gravacao", ativado: true };
    }
    const gravada = linhaUnica(ins);
    return {
      ok: true,
      schema: true,
      ativado: true,
      linhas_afetadas: 1,
      id: gravada && gravada.id,
      version: Number(gravada && gravada.version) || 1,
      locacao: locacaoParaTela({
        id: gravada && gravada.id,
        version: (gravada && gravada.version) || 1,
        campos: gravada && gravada.campos && Object.keys(gravada.campos).length ? gravada.campos : semMarcadores(locacao),
      }),
    };
  }
  if (conflitoVersao(row, pedido && pedido.version)) {
    return { ok: false, status: 409, conflict: true, reason: "version", version: Number(row.version) || null, ativado: true };
  }
  const patch = await io(`dk_locacao?id=eq.${encodeURIComponent(row.id)}&version=eq.${Number(row.version)}&deleted_at=is.null`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { ...corpo, version: Number(row.version) + 1, updated_at: new Date().toISOString(), updated_by: autor },
  });
  if (schemaSumiu(patch)) return { ok: false, schema: false, reason: "schema_ausente", ativado: true };
  if (!patch || !patch.ok) return { ok: false, status: 502, reason: "gravacao", ativado: true };
  const gravada = linhaUnica(patch);
  if (!gravada) return { ok: false, status: 409, conflict: true, reason: "version", version: Number(row.version) || null, ativado: true };
  return {
    ok: true,
    schema: true,
    ativado: true,
    linhas_afetadas: 1,
    id: gravada.id,
    version: Number(gravada.version) || Number(row.version) + 1,
    locacao: locacaoParaTela({
      id: gravada.id,
      version: gravada.version || Number(row.version) + 1,
      campos: gravada.campos && Object.keys(gravada.campos).length ? gravada.campos : semMarcadores(locacao),
    }),
  };
  });
}

async function excluirUma(pedido) {
  if (!moduloPedido(await flagDoPedido(pedido))) {
    return { ok: false, status: 409, conflict: true, reason: "modulo_inativo", ativado: false };
  }
  const acesso = decidirAcessoLocacao(pedido && pedido.acesso, pedido && pedido.funcionarios);
  if (!acesso.ok) return { ...acesso, ativado: true };
  const io = (pedido && pedido.rest) || rest;
  const nc = digitos(pedido && pedido.numero);
  if (!nc) return { ok: false, status: 400, reason: "protocolo_obrigatorio", ativado: true };
  return comTrava(pedido, async () => {
  const atual = await io(`dk_locacao?numero_contrato=eq.${encodeURIComponent(nc)}&select=id,version,deleted_at`);
  if (schemaSumiu(atual)) return { ok: false, schema: false, reason: "schema_ausente", ativado: true };
  if (!atual || !atual.ok) return { ok: false, status: 502, reason: "leitura", ativado: true };
  const row = linhaUnica(atual);
  if (!row) return { ok: false, status: 404, reason: "ausente", ativado: true };
  if (row.deleted_at) return { ok: false, status: 409, conflict: true, reason: "excluida", ativado: true };
  if (conflitoVersao(row, pedido && pedido.version)) {
    return { ok: false, status: 409, conflict: true, reason: "version", version: Number(row.version) || null, ativado: true };
  }
  const patch = await io(`dk_locacao?id=eq.${encodeURIComponent(row.id)}&version=eq.${Number(row.version)}&deleted_at=is.null`, {
    method: "PATCH",
    prefer: "return=representation",
    body: {
      deleted_at: new Date().toISOString(),
      version: Number(row.version) + 1,
      updated_at: new Date().toISOString(),
      updated_by: String((pedido && pedido.by) || "").slice(0, 80),
    },
  });
  if (schemaSumiu(patch)) return { ok: false, schema: false, reason: "schema_ausente", ativado: true };
  const gravada = linhaUnica(patch);
  if (!patch || !patch.ok || !gravada) return { ok: false, status: 409, conflict: true, reason: "version", ativado: true };
  return { ok: true, schema: true, ativado: true, version: Number(gravada.version), deleted_at: gravada.deleted_at, linhas_afetadas: 1 };
  });
}

async function migrarSnapshotOficial() {
  return { ok: false, schema: true, reason: "caminho_desligado", ativado: false };
}

module.exports = {
  FLAG_LOCACAO,
  FONTE_LOCACAO,
  moduloPedido,
  obterFonteLocacoes,
  decidirAcessoLocacao,
  TIPOS,
  stripCampos,
  protocoloDe,
  movimentosNovos,
  derivarVisao,
  assinaturaLocacao,
  locacaoParaTerminal,
  locacaoCanonica,
  LEITURA_MS,
  rest,
  listar,
  relogio,
  gravarUma,
  excluirUma,
  migrarSnapshotOficial,
};
