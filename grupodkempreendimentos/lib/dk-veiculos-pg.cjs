/**
 * Leitura e gravação de um veículo em public.dk_veiculos.
 * Não grava snapshot, Redis nem o espelho legado.
 */
const { revisaoConflita } = require("./dk-persistencia-central.cjs");

const FONTE = "dk_veiculos";
const FLAG_REDIS = "dk:portal:veiculos_fonte:v1";
const TABELA = "dk_veiculos";
const URL_PADRAO = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function urlBase() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || URL_PADRAO)
    .trim()
    .replace(/\/$/, "");
}

function chaveServico() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
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

function placaDuplicada(res) {
  const data = res && res.data;
  const msg = String((data && (data.message || data.details || data.hint)) || "");
  return Boolean(res && (data && data.code === "23505" || /dk_veiculos_placa_ativa_idx|duplicate key/i.test(msg)));
}

async function rest(caminho, opts = {}) {
  const key = chaveServico();
  if (!key) return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (opts.prefer) headers.Prefer = opts.prefer;
  let res;
  try {
    res = await fetch(urlBase() + "/rest/v1/" + caminho, {
      method: opts.method || "GET",
      headers,
      body: opts.body == null ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(opts.ms || 20000),
    });
  } catch {
    return { ok: false, status: 522, data: { reason: "leitura_lenta" } };
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

function idDe(item) {
  return item && item.id != null ? String(item.id).trim() : "";
}

function placaDe(item) {
  if (!item || item.placa == null) return "";
  return String(item.placa);
}

function pedidoUm(body) {
  const operacao = String(body && (body.operacao || body.operação) ? body.operacao || body.operação : "")
    .trim()
    .toLowerCase();
  const veiculo = body && body.veiculo;
  if (operacao === "upsert" && veiculo && typeof veiculo === "object" && !Array.isArray(veiculo)) return veiculo;
  return null;
}

async function tabelaExiste(ioRest) {
  const pedido = ioRest || rest;
  const res = await pedido(TABELA + "?select=id&limit=1");
  if (res.ok) return { ok: true, existe: true };
  if (schemaAusente(res)) return { ok: true, existe: false };
  return { ok: false, existe: false, status: res.status, data: res.data };
}

async function listar(ioRest) {
  const pedido = ioRest || rest;
  const res = await pedido(TABELA + "?deleted_at=is.null&select=id,placa,payload&order=id.asc&limit=2000");
  if (!res.ok) return { ok: false, status: res.status, data: res.data, veiculos: [] };
  const linhas = Array.isArray(res.data) ? res.data : [];
  return {
    ok: true,
    veiculos: linhas.map((row) => (row && row.payload && typeof row.payload === "object" ? row.payload : {})),
  };
}

async function lerPorId(id, ioRest) {
  const pedido = ioRest || rest;
  const res = await pedido(
    TABELA + "?id=eq." + encodeURIComponent(id) + "&select=id,placa,payload,updated_at,deleted_at&limit=1"
  );
  if (!res.ok) return { ok: false, status: res.status, data: res.data, row: null };
  const linhas = Array.isArray(res.data) ? res.data : [];
  return { ok: true, row: linhas[0] || null };
}

async function lerPorPlaca(placa, ioRest) {
  const pedido = ioRest || rest;
  const res = await pedido(
    TABELA +
      "?placa=eq." +
      encodeURIComponent(placa) +
      "&deleted_at=is.null&select=id,placa&limit=2"
  );
  if (!res.ok) return { ok: false, status: res.status, data: res.data, linhas: [] };
  return { ok: true, linhas: Array.isArray(res.data) ? res.data : [] };
}

async function upsertUm(veiculo, baseRevision, ioRest) {
  const pedido = ioRest || rest;
  const t0 = Date.now();
  const recebido = JSON.parse(JSON.stringify(veiculo || {}));
  const id = idDe(recebido);
  const placa = placaDe(recebido);
  if (!id || !placa.trim()) {
    return { ok: false, status: 400, body: { ok: false, success: false, reason: "veiculo" } };
  }
  const atual = await lerPorId(id, pedido);
  if (!atual.ok) {
    return {
      ok: false,
      status: schemaAusente(atual) ? 503 : 502,
      body: { ok: false, success: false, reason: schemaAusente(atual) ? "tabela_ausente" : "leitura", source: FONTE },
    };
  }
  const placaOcupada = await lerPorPlaca(placa, pedido);
  if (!placaOcupada.ok) {
    return { ok: false, status: 502, body: { ok: false, success: false, reason: "leitura", source: FONTE } };
  }
  if (placaOcupada.linhas.some((row) => String(row && row.id) !== id)) {
    return { ok: false, status: 409, body: { ok: false, success: false, reason: "placa_duplicada", source: FONTE } };
  }
  if (atual.row && revisaoConflita(baseRevision, atual.row.updated_at)) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        success: false,
        reason: "revisao_conflito",
        revision: atual.row.updated_at,
        updated_at: atual.row.updated_at,
        source: FONTE,
        message: "A nuvem tem uma versão mais nova. Recarregue antes de gravar.",
      },
    };
  }
  const payload = { ...recebido, id, placa };
  const agora = new Date().toISOString();
  const gravado = await pedido(TABELA + "?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { id, placa, payload, updated_at: agora, deleted_at: null },
  });
  if (!gravado.ok || placaDuplicada(gravado)) {
    return {
      ok: false,
      status: placaDuplicada(gravado) ? 409 : gravado.status || 502,
      body: {
        ok: false,
        success: false,
        reason: placaDuplicada(gravado) ? "placa_duplicada" : "gravacao",
        source: FONTE,
      },
    };
  }
  const linha = Array.isArray(gravado.data) ? gravado.data[0] : null;
  const eco = linha && linha.payload && typeof linha.payload === "object" ? linha.payload : payload;
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
      count: 1,
      linhas_afetadas: 1,
      duracao_ms: Date.now() - t0,
      veiculo: eco,
    },
  };
}

async function modoOperacional(redis, ioRest) {
  let flag = "";
  try {
    flag = String((await redis.get(FLAG_REDIS)) || "");
  } catch {
    flag = "";
  }
  if (flag !== FONTE) return { modo: "snapshot", flag };
  const existe = await tabelaExiste(ioRest);
  if (!existe.ok || !existe.existe) return { modo: "erro", flag, reason: existe.existe === false ? "tabela_ausente" : "leitura" };
  return { modo: "pg", flag };
}

module.exports = {
  FONTE,
  FLAG_REDIS,
  TABELA,
  pedidoUm,
  tabelaExiste,
  listar,
  upsertUm,
  modoOperacional,
  schemaAusente,
};
