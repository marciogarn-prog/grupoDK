/**
 * Lançamento novo do FINANCEIRO CEO: uma linha pequena em public.dk_cloud_snapshots.
 * Não lê nem regrava o snapshot label=default.
 */
const { randomUUID } = require("crypto");

const PREFIXO = "entity:financeiro_ceo:";
const PREFIXO_DESPESA = `${PREFIXO}despesa:`;
const LIMITE_BYTES = 65536;
const PAGINA = 200;
const MAX_PAGINAS = 20;

const TIPOS = [
  {
    chave: "dk_financeiro_ceo_despesas_v1",
    tipo: "despesa",
    prefixo: PREFIXO_DESPESA,
    idDe(row) {
      return String(row && row.id != null ? row.id : "").trim();
    },
  },
  {
    chave: "dk_financeiro_ceo_situacao_pag_v1",
    tipo: "situacao",
    prefixo: `${PREFIXO}situacao:`,
    idDe(row) {
      return String(row && (row.chave || row.id) != null ? row.chave || row.id : "").trim();
    },
  },
  {
    chave: "dk_financeiro_ceo_fontes_v1",
    tipo: "fonte",
    prefixo: `${PREFIXO}fonte:`,
    idDe(row) {
      return String(row && row.id != null ? row.id : "").trim();
    },
  },
  {
    chave: "dk_financeiro_ceo_cartoes_v1",
    tipo: "cartao",
    prefixo: `${PREFIXO}cartao:`,
    idDe(row) {
      return String(row && row.id != null ? row.id : "").trim();
    },
  },
  {
    chave: "dk_financeiro_despesas_v1",
    tipo: "despesa_unidade",
    prefixo: `${PREFIXO}despesa_unidade:`,
    idDe(row) {
      return String(row && row.id != null ? row.id : "").trim();
    },
  },
];

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co")
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function segmentoId(id) {
  const safe = String(id || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  return safe;
}

function labelDoTipo(tipo, id) {
  const safe = segmentoId(id);
  if (!safe) {
    const err = new Error("id_ausente");
    err.reason = "id_ausente";
    throw err;
  }
  const label = `${tipo.prefixo}${safe}`;
  if (label === "default" || !label.startsWith(PREFIXO)) {
    const err = new Error("label_proibida");
    err.reason = "label_proibida";
    throw err;
  }
  return label;
}

function montarUrlListaLinhas(offset) {
  const filtro = `label=like.${encodeURIComponent(`${PREFIXO}*`)}&select=label,payload,updated_at&order=label.asc&limit=${PAGINA}&offset=${Number(offset) || 0}`;
  if (filtro.includes("eq.default") || filtro.includes("label=default")) {
    throw new Error("filtro_proibido");
  }
  return `${supabaseUrl()}/rest/v1/dk_cloud_snapshots?${filtro}`;
}

function montarUrlLinha(label) {
  if (!String(label || "").startsWith(PREFIXO)) throw new Error("label_proibida");
  const filtro = `label=eq.${encodeURIComponent(label)}&select=label,payload,updated_at`;
  if (filtro.includes("eq.default")) throw new Error("filtro_proibido");
  return `${supabaseUrl()}/rest/v1/dk_cloud_snapshots?${filtro}`;
}

function montarUrlGravacao() {
  return `${supabaseUrl()}/rest/v1/dk_cloud_snapshots?on_conflict=label`;
}

function idEstavel(tipo, row) {
  const atual = tipo.idDe(row);
  if (atual) return atual.slice(0, 80);
  return randomUUID();
}

function montarPayload(recebido, meta) {
  const base = recebido && typeof recebido === "object" ? { ...recebido } : {};
  const deleted = meta.deleted === true;
  const payload = {
    ...base,
    id: meta.id,
    revision: meta.revision,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
    deleted,
    deleted_at: deleted ? meta.deleted_at || meta.updated_at : null,
    operation_id: meta.operation_id || "",
  };
  if (recebido && recebido.chave != null && payload.chave == null) payload.chave = recebido.chave;
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  if (bytes > LIMITE_BYTES) {
    const err = new Error("payload_grande");
    err.reason = "payload_grande";
    throw err;
  }
  return payload;
}

function decidirLinha(existente, recebido, operationId, agora, id) {
  const agoraIso = agora();
  if (!existente) {
    const deleted = recebido && recebido.deleted === true;
    return {
      payload: montarPayload(recebido, {
        id,
        revision: 1,
        created_at: agoraIso,
        updated_at: agoraIso,
        deleted,
        deleted_at: deleted ? agoraIso : null,
        operation_id: operationId || "",
      }),
    };
  }
  if (operationId && existente.operation_id && existente.operation_id === operationId) {
    return { idempotente: true, payload: existente };
  }
  const revSrv = Number(existente.revision);
  const bruto = recebido ? recebido.revision : null;
  const revCli = bruto == null || bruto === "" ? null : Number(bruto);
  if (!Number.isFinite(revSrv) || revCli == null || revCli !== revSrv) {
    return { conflito: true, revision: Number.isFinite(revSrv) ? revSrv : null };
  }
  const deleted = recebido && recebido.deleted === true;
  return {
    payload: montarPayload(recebido, {
      id: existente.id || id,
      revision: revSrv + 1,
      created_at: existente.created_at || agoraIso,
      updated_at: agoraIso,
      deleted,
      deleted_at: deleted ? existente.deleted_at || agoraIso : null,
      operation_id: operationId || "",
    }),
  };
}

function registroPublico(tipo, payload) {
  return {
    tipo: tipo.tipo,
    id: payload.id,
    chave: payload.chave || "",
    revision: payload.revision,
    created_at: payload.created_at || null,
    updated_at: payload.updated_at || null,
    deleted: payload.deleted === true,
    deleted_at: payload.deleted_at || null,
  };
}

function unirPorIdentidade(historico, linhas, idDe) {
  const map = new Map();
  for (const row of Array.isArray(historico) ? historico : []) {
    const id = idDe(row);
    if (!id || map.has(id)) continue;
    map.set(id, row);
  }
  for (const row of Array.isArray(linhas) ? linhas : []) {
    const id = idDe(row);
    if (!id) continue;
    map.set(id, row);
  }
  return Array.from(map.values());
}

function unirHistoricoComLinhas(historico, linhas) {
  const out = {};
  for (const tipo of TIPOS) {
    out[tipo.chave] = unirPorIdentidade(historico && historico[tipo.chave], linhas && linhas[tipo.chave], (row) => tipo.idDe(row));
  }
  return out;
}

function bundleVazio() {
  const out = {};
  for (const tipo of TIPOS) out[tipo.chave] = [];
  return out;
}

async function gravarLancamentosFinanceiroCeo({ bundle, io, agora, operationId }) {
  const registros = [];
  const salvos = bundleVazio();
  const fonte = bundle && typeof bundle === "object" ? bundle : {};
  let algum = false;
  for (const tipo of TIPOS) {
    const itens = Array.isArray(fonte[tipo.chave]) ? fonte[tipo.chave] : [];
    for (const item of itens) {
      if (!item || typeof item !== "object") continue;
      algum = true;
      const id = idEstavel(tipo, item);
      const label = labelDoTipo(tipo, id);
      const lido = await io.ler(label);
      if (!lido || lido.ok === false) {
        return { ok: false, status: 503, reason: (lido && lido.reason) || "supabase_indisponivel" };
      }
      const decisao = decidirLinha(lido.payload || null, { ...item, id: item.id || id }, operationId, agora, item.id || id);
      if (decisao.conflito) {
        return { ok: false, status: 409, reason: "revisao_conflito", revision: decisao.revision };
      }
      if (!decisao.idempotente) {
        const gravou = await io.gravar(label, decisao.payload);
        if (!gravou || gravou.ok === false) {
          return { ok: false, status: 503, reason: (gravou && gravou.reason) || "supabase_indisponivel" };
        }
      }
      salvos[tipo.chave].push(decisao.payload);
      registros.push(registroPublico(tipo, decisao.payload));
    }
  }
  if (!algum) return { ok: false, status: 400, reason: "bloco_vazio" };
  if (typeof io.cache === "function") {
    try {
      await io.cache(salvos);
    } catch {
      /* Redis é cache. A linha já está no Supabase. */
    }
  }
  return { ok: true, status: 200, registros, salvos };
}

function classificarLabel(label) {
  return TIPOS.find((tipo) => String(label || "").startsWith(tipo.prefixo)) || null;
}

function tipoDespesa() {
  return TIPOS.find((tipo) => tipo.tipo === "despesa");
}

async function lerConfirmacaoDespesaCeo(io, id) {
  const tipo = tipoDespesa();
  let label = "";
  try {
    label = labelDoTipo(tipo, id);
  } catch (err) {
    return { ok: false, status: 400, reason: (err && err.reason) || "id_ausente" };
  }
  if (!String(label).startsWith(PREFIXO_DESPESA) || String(label) === "default") {
    return { ok: false, status: 400, reason: "label_proibida" };
  }
  const lido = await io.ler(label);
  if (!lido || lido.ok === false) {
    return { ok: false, status: 503, reason: (lido && lido.reason) || "supabase_indisponivel" };
  }
  const payload = lido.payload;
  if (!payload) {
    return { ok: true, found: false, id: String(id), revision: null, updated_at: null, operation_id: "" };
  }
  return {
    ok: true,
    found: true,
    id: payload.id,
    revision: payload.revision,
    updated_at: payload.updated_at || null,
    operation_id: payload.operation_id || "",
  };
}

async function orquestrarGravacaoCeo({ operationId, post, confirmar }) {
  let ativo = 0;
  let posts = 0;
  async function umPost() {
    if (ativo) {
      const err = new Error("post_sobreposto");
      err.reason = "post_sobreposto";
      throw err;
    }
    ativo += 1;
    posts += 1;
    try {
      return await post();
    } finally {
      ativo -= 1;
    }
  }
  const primeira = await umPost();
  if (primeira && primeira.ok) return { ok: true, posts, via: "post", r: primeira.r || null };
  if (!primeira || primeira.reason !== "timeout") {
    return { ok: false, posts, via: "erro", reason: (primeira && primeira.reason) || "erro" };
  }
  const conf = await confirmar();
  if (conf && conf.found === true && String(conf.operation_id || "") === String(operationId || "")) {
    return { ok: true, posts, via: "confirmacao", revision: conf.revision, r: conf.r || null };
  }
  if (conf && conf.found === false) {
    const segunda = await umPost();
    if (segunda && segunda.ok) return { ok: true, posts, via: "retry", r: segunda.r || null };
    if (segunda && segunda.reason === "timeout") {
      const conf2 = await confirmar();
      if (conf2 && conf2.found === true && String(conf2.operation_id || "") === String(operationId || "")) {
        return { ok: true, posts, via: "confirmacao", revision: conf2.revision, r: conf2.r || null };
      }
    }
    return { ok: false, posts, via: "erro", reason: (segunda && segunda.reason) || "nao_gravado" };
  }
  return { ok: false, posts, via: "erro", reason: (conf && conf.reason) || "nao_gravado" };
}

async function lerLinhasFinanceiroCeo(io) {
  const lido = await io.listar();
  if (!lido || lido.ok === false) {
    return { ok: false, status: 503, reason: (lido && lido.reason) || "supabase_indisponivel" };
  }
  const linhas = bundleVazio();
  for (const row of Array.isArray(lido.rows) ? lido.rows : []) {
    const tipo = classificarLabel(row && row.label);
    const payload = row && row.payload && typeof row.payload === "object" ? row.payload : null;
    if (!tipo || !payload) continue;
    if (String(row.label || "") === "default" || !String(row.label || "").startsWith(PREFIXO)) continue;
    linhas[tipo.chave].push(payload);
  }
  return { ok: true, linhas };
}

function headersSupabase(extra) {
  const key = serviceRoleKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}

function criarIoSupabaseLinhas(fetchImpl) {
  const fetchFn = fetchImpl || fetch;
  return {
    async ler(label) {
      if (!serviceRoleKey()) return { ok: false, reason: "doorman_key_missing", payload: null };
      const res = await fetchFn(montarUrlLinha(label), { headers: headersSupabase() });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, reason: `supabase_http_${res.status}`, detail: String(text || "").slice(0, 180), payload: null };
      }
      const rows = await res.json().catch(() => null);
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      const payload = row && row.payload && typeof row.payload === "object" ? row.payload : null;
      return { ok: true, payload };
    },
    async gravar(label, payload) {
      if (!serviceRoleKey()) return { ok: false, reason: "doorman_key_missing" };
      if (!String(label).startsWith(PREFIXO)) return { ok: false, reason: "label_proibida" };
      const res = await fetchFn(montarUrlGravacao(), {
        method: "POST",
        headers: headersSupabase({
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify({
          label,
          payload,
          updated_at: String(payload.updated_at || new Date().toISOString()),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, reason: `supabase_http_${res.status}`, detail: String(text || "").slice(0, 180) };
      }
      return { ok: true };
    },
    async listar() {
      if (!serviceRoleKey()) return { ok: false, reason: "doorman_key_missing", rows: [] };
      const rows = [];
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
        const res = await fetchFn(montarUrlListaLinhas(pagina * PAGINA), { headers: headersSupabase() });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return { ok: false, reason: `supabase_http_${res.status}`, detail: String(text || "").slice(0, 180), rows: [] };
        }
        const lote = await res.json().catch(() => null);
        const lista = Array.isArray(lote) ? lote : [];
        rows.push(...lista);
        if (lista.length < PAGINA) break;
      }
      return { ok: true, rows };
    },
  };
}

module.exports = {
  PREFIXO,
  PREFIXO_DESPESA,
  TIPOS,
  LIMITE_BYTES,
  labelDoTipo,
  montarUrlListaLinhas,
  montarUrlLinha,
  montarUrlGravacao,
  decidirLinha,
  gravarLancamentosFinanceiroCeo,
  lerConfirmacaoDespesaCeo,
  orquestrarGravacaoCeo,
  lerLinhasFinanceiroCeo,
  unirHistoricoComLinhas,
  criarIoSupabaseLinhas,
  bundleVazio,
};
