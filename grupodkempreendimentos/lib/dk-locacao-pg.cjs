/**
 * Locações e pagamentos no PostgreSQL.
 * O navegador não fala com o banco. Redis não entra aqui.
 * Cada gravação é uma locação, com a versão que o terminal leu.
 * Movimento financeiro só é inserido; a chave de idempotência impede repetir o mesmo fato.
 */
const { isSupabaseDoormanConfigured, fetchSnapshotByLabel } = require("./dk-supabase-doorman.cjs");

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
      prefer: "count=exact",
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

async function listar(cpf) {
  const rows = await lerLocacoesAbertas(cpf);
  if (schemaSumiu(rows)) return { ok: false, schema: false, reason: "schema_ausente" };
  if (!rows.ok) return { ok: false, schema: true, reason: "leitura", status: rows.status };
  if (!(rows.data || []).length) {
    if (digitos(cpf)) {
      return { ok: true, schema: true, locacoes: [], migracao: "aguardar" };
    }
    const semeada = await migrarSnapshotOficial("sistema");
    if (semeada && semeada.schema === false) return { ok: false, schema: false, reason: "schema_ausente" };
    if (semeada && semeada.reason === "supabase_indisponivel") {
      return { ok: true, schema: true, locacoes: [], migracao: "supabase_indisponivel" };
    }
    const deNovo = await lerLocacoesAbertas(cpf);
    if (!deNovo.ok) return { ok: false, schema: true, reason: "leitura" };
    const movs = await lerMovimentos((deNovo.data || []).map((r) => r.id));
    if (!movs.ok) return { ok: false, schema: true, reason: "leitura" };
    const locacoes = montarTerminais(deNovo.data, movs.data, cpf);
    return {
      ok: true,
      schema: true,
      locacoes,
      migracao: locacoes.length ? "semeada" : semeada && semeada.lidas > 0 ? "falhou" : "vazio",
    };
  }
  const movs = await lerMovimentos((rows.data || []).map((r) => r.id));
  if (schemaSumiu(movs)) return { ok: false, schema: false, reason: "schema_ausente" };
  if (!movs.ok) return { ok: false, schema: true, reason: "leitura" };
  return { ok: true, schema: true, locacoes: montarTerminais(rows.data, movs.data, cpf), migracao: "pronta" };
}

async function relogio() {
  const topo = await rest(
    "dk_locacao?deleted_at=is.null&select=updated_at&order=updated_at.desc&limit=1"
  );
  if (schemaSumiu(topo)) return { ok: false, schema: false };
  if (!topo.ok) return { ok: false, schema: true };
  const conta = await rest("dk_locacao_movimento?select=id&limit=1", {
    headers: { Range: "0-0", Prefer: "count=exact" },
  });
  const total = String(conta.contentRange || "").split("/")[1] || "0";
  const updated = Array.isArray(topo.data) && topo.data[0] ? topo.data[0].updated_at : "";
  return { ok: true, schema: true, selo: `${updated}|${total}` };
}

async function gravarUma({ numero, version, locacao, by, criar }) {
  const campos = stripCampos(locacao);
  const nc = digitos(numero || campos.numeroContrato);
  if (!nc) return { ok: false, status: 400, reason: "protocolo_obrigatorio" };
  const atual = await rest(
    `dk_locacao?numero_contrato=eq.${encodeURIComponent(nc)}&select=id,version,deleted_at,campos`
  );
  if (schemaSumiu(atual)) return { ok: false, schema: false, reason: "schema_ausente" };
  const row = Array.isArray(atual.data) ? atual.data[0] : null;
  if (row?.deleted_at) return { ok: false, status: 409, conflict: true, reason: "excluida" };
  let movimentos = [];
  if (row?.id) {
    const movs = await lerMovimentos([row.id]);
    if (!movs.ok) return { ok: false, status: 502, reason: "leitura" };
    movimentos = movs.data || [];
  }
  const novos = movimentosNovos(movimentos, locacao);
  const rpc = await rest("rpc/dk_locacao_gravar", {
    method: "POST",
    prefer: "return=representation",
    body: {
      p_numero: nc,
      p_version: row ? Number(version) || 0 : null,
      p_campos: campos,
      p_novos: novos,
      p_by: String(by || "").slice(0, 80),
      p_criar: !row || Boolean(criar),
    },
  });
  if (schemaSumiu(rpc)) return { ok: false, schema: false, reason: "schema_ausente" };
  const body = rpc.data && typeof rpc.data === "object" && !Array.isArray(rpc.data) ? rpc.data : null;
  if (!rpc.ok || !body || body.ok !== true) {
    if (body && body.conflict) {
      return { ok: false, status: 409, conflict: true, reason: body.reason || "version", version: body.version || null };
    }
    return { ok: false, status: rpc.status || 502, reason: "gravacao", detalhe: body || rpc.data };
  }
  const fresca = await rest(
    `dk_locacao?numero_contrato=eq.${encodeURIComponent(nc)}&deleted_at=is.null&select=id,numero_contrato,cpf,placa,status_locacao,campos,version,created_at,updated_at,deleted_at,created_by,updated_by`
  );
  const gravada = Array.isArray(fresca.data) ? fresca.data[0] : null;
  if (!gravada) return { ok: true, schema: true, version: body.version };
  const movs = await lerMovimentos([gravada.id]);
  return {
    ok: true,
    schema: true,
    version: Number(gravada.version) || body.version,
    locacao: locacaoParaTerminal(gravada, movs.data || []),
  };
}

async function excluirUma({ numero, version, by }) {
  const nc = digitos(numero);
  if (!nc) return { ok: false, status: 400, reason: "protocolo_obrigatorio" };
  const rpc = await rest("rpc/dk_locacao_excluir", {
    method: "POST",
    prefer: "return=representation",
    body: { p_numero: nc, p_version: Number(version) || 0, p_by: String(by || "").slice(0, 80) },
  });
  if (schemaSumiu(rpc)) return { ok: false, schema: false, reason: "schema_ausente" };
  const body = rpc.data && typeof rpc.data === "object" ? rpc.data : null;
  if (!rpc.ok || !body || body.ok !== true) {
    return { ok: false, status: 409, conflict: true, reason: (body && body.reason) || "version" };
  }
  return { ok: true, schema: true, version: body.version, deleted_at: body.deleted_at };
}

async function migrarSnapshotOficial(by) {
  if (!isSupabaseDoormanConfigured()) return { ok: false, reason: "doorman_key_missing" };
  const oficial = await fetchSnapshotByLabel("default");
  if (!oficial || oficial.ok === false || !oficial.payload) {
    return { ok: false, schema: true, reason: "supabase_indisponivel" };
  }
  const locs = Array.isArray(oficial.payload.dk_locacoes_cadastro) ? oficial.payload.dk_locacoes_cadastro : [];
  let criadas = 0;
  let movimentos = 0;
  for (const loc of locs) {
    if (!loc || typeof loc !== "object") continue;
    const nc = digitos(loc.numeroContrato || loc.protocolo);
    if (!nc) continue;
    const campos = stripCampos(loc);
    const ins = await rest("dk_locacao", {
      method: "POST",
      prefer: "return=representation,resolution=ignore-duplicates",
      body: {
        numero_contrato: nc,
        cpf: digitos(campos.cpf).slice(0, 11),
        placa: String(campos.placa || "").toUpperCase().slice(0, 12),
        status_locacao: String(campos.statusLocacao || campos.status || "ATIVO").slice(0, 40),
        campos,
        created_by: String(by || "sistema").slice(0, 80),
        updated_by: String(by || "sistema").slice(0, 80),
      },
    });
    if (schemaSumiu(ins)) return { ok: false, schema: false, reason: "schema_ausente" };
    const row = Array.isArray(ins.data) ? ins.data[0] : null;
    let id = row && row.id;
    if (!id) {
      const ja = await rest(`dk_locacao?numero_contrato=eq.${encodeURIComponent(nc)}&select=id,deleted_at`);
      const existente = Array.isArray(ja.data) ? ja.data[0] : null;
      if (!existente || existente.deleted_at) continue;
      id = existente.id;
    } else {
      criadas += 1;
    }
    const movs = await lerMovimentos([id]);
    const novos = movimentosNovos(movs.ok ? movs.data : [], loc);
    for (const m of novos) {
      const gravou = await rest("dk_locacao_movimento", {
        method: "POST",
        prefer: "return=minimal,resolution=ignore-duplicates",
        body: { ...m, locacao_id: id, created_by: String(by || "sistema").slice(0, 80) },
      });
      if (gravou.ok) movimentos += 1;
    }
  }
  return { ok: true, schema: true, criadas, movimentos, lidas: locs.length };
}

module.exports = {
  TIPOS,
  stripCampos,
  protocoloDe,
  movimentosNovos,
  derivarVisao,
  assinaturaLocacao,
  locacaoParaTerminal,
  listar,
  relogio,
  gravarUma,
  excluirUma,
  migrarSnapshotOficial,
};
