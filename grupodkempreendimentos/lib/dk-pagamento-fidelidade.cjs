/**
 * Contrato de fidelidade do pagamento.
 * Não grava banco. Não descarta chave desconhecida.
 * Fonte operacional: public.dk_pagamento_locacao.
 */
const crypto = require("crypto");
const { normalizarOperacao } = require("./dk-pagamento-operacao.cjs");

const COLUNAS_TECNICAS = [
  "id",
  "migration_key",
  "protocolo_lancamento",
  "numero_contrato",
  "tipo",
  "data_pagamento",
  "valor",
  "payload",
  "version",
  "removido",
  "deleted_at",
  "created_at",
  "updated_at",
  "source_state",
  "source_position",
  "source_payload_hash",
  "operation_id",
];

const LEGACY_FALLBACKS = [
  {
    caminho: "portal-pagamento-store.js",
    quando: "modo legacy ainda grava pelo caminho monolítico da tela",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "lib/dk-pagamento-locacao-store.cjs",
    quando: "gravarUma permanece write_not_active e a tela pode cair no legado",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "lib/dk-locacao-pg.cjs",
    quando: "arrays portalLancamentosAluguel embutidos na locação ainda existem como visão",
    classe: "LEGACY_FALLBACK",
  },
];

function clonar(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || typeof valor !== "object") return valor;
  return JSON.parse(JSON.stringify(valor));
}

function canonicalizar(valor) {
  if (valor === null || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) return valor.map((item) => canonicalizar(item));
  const saida = {};
  for (const chave of Object.keys(valor).sort()) saida[chave] = canonicalizar(valor[chave]);
  return saida;
}

function textoEstavel(valor) {
  if (valor === undefined) return '"\\u0000undefined"';
  if (valor === null) return "null";
  if (typeof valor === "string" || typeof valor === "boolean") return JSON.stringify(valor);
  if (typeof valor === "number") {
    if (Object.is(valor, -0)) return "-0";
    if (!Number.isFinite(valor)) return JSON.stringify(String(valor));
    return JSON.stringify(valor);
  }
  if (Array.isArray(valor)) return "[" + valor.map((item) => textoEstavel(item)).join(",") + "]";
  const chaves = Object.keys(valor).sort();
  return "{" + chaves.map((chave) => JSON.stringify(chave) + ":" + textoEstavel(valor[chave])).join(",") + "}";
}

function tipoDe(valor) {
  if (valor === null) return "null";
  if (Array.isArray(valor)) return "array";
  return typeof valor;
}

function classificarDiferencas(original, reconstruido) {
  const missing = [];
  const extra = [];
  const typeChanges = [];
  const valueChanges = [];
  function walk(a, b, caminho) {
    const aObj = a !== null && typeof a === "object";
    const bObj = b !== null && typeof b === "object";
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) {
        typeChanges.push(caminho || "$");
        return;
      }
      if (a.length !== b.length) valueChanges.push((caminho || "$") + ".length");
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i += 1) {
        const filho = (caminho || "$") + "[" + i + "]";
        if (i >= a.length) extra.push(filho);
        else if (i >= b.length) missing.push(filho);
        else walk(a[i], b[i], filho);
      }
      return;
    }
    if (aObj || bObj) {
      if (!aObj || !bObj) {
        typeChanges.push(caminho || "$");
        return;
      }
      const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const chave of chaves) {
        const filho = caminho ? caminho + "." + chave : chave;
        const temA = Object.prototype.hasOwnProperty.call(a, chave);
        const temB = Object.prototype.hasOwnProperty.call(b, chave);
        if (temA && !temB) missing.push(filho);
        else if (!temA && temB) extra.push(filho);
        else if (tipoDe(a[chave]) !== tipoDe(b[chave])) typeChanges.push(filho);
        else walk(a[chave], b[chave], filho);
      }
      return;
    }
    if (textoEstavel(a) !== textoEstavel(b)) valueChanges.push(caminho || "$");
  }
  walk(original, reconstruido, "");
  return {
    missing,
    extra,
    typeChanges,
    valueChanges,
    ok: !missing.length && !extra.length && !typeChanges.length && !valueChanges.length,
  };
}

function dkPagamentoCanonicalizar(pagamento) {
  return canonicalizar(pagamento);
}

function dkPagamentoParaPersistencia(pagamento) {
  const src = clonar(pagamento && typeof pagamento === "object" && !Array.isArray(pagamento) ? pagamento : {});
  const payload =
    src.payload && typeof src.payload === "object" && !Array.isArray(src.payload) ? clonar(src.payload) : clonar(src);
  const linha = {
    id: src.id == null ? payload.id || "" : String(src.id),
    migration_key: src.migration_key == null ? "" : String(src.migration_key),
    protocolo_lancamento: src.protocolo_lancamento == null ? payload.protocoloLancamento || null : src.protocolo_lancamento,
    numero_contrato: src.numero_contrato == null ? String(payload.numeroContrato || "") : String(src.numero_contrato),
    tipo: src.tipo == null ? payload.tipo || null : src.tipo,
    data_pagamento: src.data_pagamento == null ? payload.data || payload.dataPagamento || null : src.data_pagamento,
    valor: src.valor == null ? (payload.valor == null ? null : payload.valor) : src.valor,
    payload,
    version: src.version == null ? 1 : Number(src.version) || 1,
    removido: src.removido === true || payload.removido === true,
    deleted_at: src.deleted_at == null ? null : src.deleted_at,
    source_state: src.source_state == null ? "online" : String(src.source_state),
    source_position: src.source_position == null ? 0 : Number(src.source_position) || 0,
    source_payload_hash: src.source_payload_hash == null ? "" : String(src.source_payload_hash),
  };
  if (src.operation_id != null) linha.operation_id = src.operation_id;
  return linha;
}

function dkPagamentoParaTerminal(linha) {
  if (!linha || typeof linha !== "object") return {};
  const out = clonar(linha);
  if (out.payload && typeof out.payload === "object" && !Array.isArray(out.payload)) {
    return out;
  }
  return { ...out, payload: clonar(out) };
}

function dkPagamentoCompararRoundTrip(original, reconstruido) {
  const a = dkPagamentoParaPersistencia(original);
  const b = dkPagamentoParaPersistencia(reconstruido);
  const diff = classificarDiferencas(a, b);
  return {
    ok: diff.ok,
    missing: diff.missing.length,
    extra: diff.extra.length,
    typeChanges: diff.typeChanges.length,
    valueChanges: diff.valueChanges.length,
  };
}

function dkPagamentoAplicarPatch(oficial, patch) {
  const base = dkPagamentoParaPersistencia(oficial);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  const protegidos = new Set([
    "numero_contrato",
    "valor",
    "data_pagamento",
    "tipo",
    "source_position",
    "removido",
    "deleted_at",
    "migration_key",
    "id",
  ]);
  for (const chave of Object.keys(patch)) {
    if (protegidos.has(chave) && patch[chave] === undefined) continue;
    if (chave === "payload" && patch.payload && typeof patch.payload === "object") {
      base.payload = { ...base.payload, ...clonar(patch.payload) };
      continue;
    }
    base[chave] = clonar(patch[chave]);
  }
  return base;
}

function dkPagamentoConflitoVersao(versaoLida, versaoOficial) {
  const lida = Number(versaoLida);
  const oficial = Number(versaoOficial);
  if (!Number.isFinite(lida) || !Number.isFinite(oficial) || lida !== oficial) {
    return { ok: false, status: 409, reason: "version" };
  }
  return { ok: true, status: 200, proxima: oficial + 1 };
}

function sourcePositionConfere(posicao, indice) {
  return Number(posicao) === Number(indice) + 1;
}

function vinculoContrato(pagamento, locacao) {
  const pag = pagamento && typeof pagamento === "object" ? pagamento : {};
  const loc = locacao && typeof locacao === "object" ? locacao : {};
  const contratoPag = String(pag.numero_contrato || pag.numeroContrato || "").replace(/\D/g, "");
  const contratoLoc = String(loc.numero_contrato || loc.numeroContrato || loc.protocolo || "").replace(/\D/g, "");
  if (!contratoPag || !contratoLoc) return { ok: false, reason: "contrato_ausente" };
  if (contratoPag !== contratoLoc) return { ok: false, reason: "contrato_errado" };
  return { ok: true };
}

function exigirOperationId(pedido) {
  const body = pedido && typeof pedido === "object" ? pedido : {};
  const op = normalizarOperacao(body.operacao || body.acao || body.verb);
  if (!op) return { ok: false, reason: "operacao_invalida" };
  const operationId = String(body.operation_id || body.operationId || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
    return { ok: false, reason: "operation_id_obrigatorio" };
  }
  return { ok: true, operacao: op, operation_id: operationId };
}

function idempotenciaPorOperationId(existentes, operationId) {
  const lista = Array.isArray(existentes) ? existentes : [];
  const achados = lista.filter((item) => String(item && item.operation_id) === String(operationId));
  if (achados.length > 1) return { ok: false, reason: "duplicado", count: achados.length };
  if (achados.length === 1) return { ok: true, idempotent: true, registro: achados[0] };
  return { ok: true, idempotent: false };
}

/**
 * Fixture de atomicidade: pagamento + evento na mesma unidade lógica.
 * Não grava banco. Rollback = descartar o resultado.
 */
function fixtureAtomica(createPagamento, createEvento, falharEvento) {
  const pagamento = typeof createPagamento === "function" ? createPagamento() : null;
  if (!pagamento) return { ok: false, reason: "pagamento_falhou", pagamento: null, evento: null };
  if (falharEvento) return { ok: false, reason: "evento_falhou", pagamento: null, evento: null };
  const evento = typeof createEvento === "function" ? createEvento(pagamento) : null;
  if (!evento) return { ok: false, reason: "evento_falhou", pagamento: null, evento: null };
  return { ok: true, pagamento, evento };
}

function refTecnica(id) {
  return crypto.createHash("sha256").update("pagamento\n" + String(id ?? ""), "utf8").digest("hex").slice(0, 12);
}

function aggregateHash(lista) {
  const linhas = (Array.isArray(lista) ? lista : [])
    .map((item) => refTecnica(item && item.id) + " " + textoEstavel(canonicalizar(dkPagamentoParaPersistencia(item))))
    .sort();
  return crypto.createHash("sha256").update(linhas.join("\n"), "utf8").digest("hex");
}

module.exports = {
  LEGACY_FALLBACKS,
  COLUNAS_TECNICAS,
  dkPagamentoCanonicalizar,
  dkPagamentoParaPersistencia,
  dkPagamentoParaTerminal,
  dkPagamentoCompararRoundTrip,
  dkPagamentoAplicarPatch,
  dkPagamentoConflitoVersao,
  sourcePositionConfere,
  vinculoContrato,
  exigirOperationId,
  idempotenciaPorOperationId,
  fixtureAtomica,
  classificarDiferencas,
  textoEstavel,
  refTecnica,
  aggregateHash,
  normalizarOperacao,
};
