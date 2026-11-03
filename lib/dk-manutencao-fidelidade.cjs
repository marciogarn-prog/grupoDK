/**
 * Contrato de fidelidade da manutenção (histórica e rápida).
 * Não grava banco. Não descarta chave desconhecida.
 * Fonte atual: snapshot/backup dk_manutencoes_cadastro + dk_manutencoes_rapidas_v1.
 * Não funde os dois formatos.
 */
const crypto = require("crypto");

const FONTES = {
  historico: {
    nome: "dk_manutencoes_cadastro",
    localizacao: "snapshot oficial / backup / localStorage cadastro",
    formato: "array de objetos JSON",
    autoridade_atual: true,
    legado: false,
    espelho: false,
  },
  rapida: {
    nome: "dk_manutencoes_rapidas_v1",
    localizacao: "snapshot oficial / backup / localStorage portal-manutencao-rapida.js",
    formato: "array de objetos JSON",
    autoridade_atual: true,
    legado: false,
    espelho: false,
  },
  tabela_pg_rapida: {
    nome: "public.dk_manutencao_rapida",
    localizacao: "PostgreSQL (script existe; produção sem linhas/tabela ativa nesta fase)",
    formato: "relacional payload jsonb",
    autoridade_atual: false,
    legado: false,
    espelho: false,
    nota: "LEGACY_FALLBACK / PREPARADO — não migrar nesta fase",
  },
};

const LEGACY_FALLBACKS = [
  {
    caminho: "portal-manutencao-rapida.js",
    quando: "STORAGE_KEY dk_manutencoes_rapidas_v1 no localStorage",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "api/cadastro-manutencoes-rapidas.js",
    quando: "merge e escrita no campo do snapshot default",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "api/dk-cloud-snapshot.js",
    quando: "mergeManutencoesCadastro no snapshot monolítico",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "lib/dk-manutencao-rapida-pg.cjs",
    quando: "flag DK_MANUTENCOES_RAPIDAS_PG=1 ainda desligada; tabela preparada sem cutover",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "app.js CAD_MANUTENCOES_KEY",
    quando: "histórico lido/gravado via loadCadastro/saveCadastro local",
    classe: "LEGACY_FALLBACK",
  },
];

const CAMPOS_RESUMO = new Set(["id", "placa", "data", "status", "os", "tipo"]);

const PROPOSTA_RELACIONAL = {
  aplicada: false,
  representa_390: true,
  tabelas: [
    {
      nome: "public.dk_manutencao",
      papel: "uma linha por manutenção histórica ou rápida",
      colunas: [
        "id uuid/text PK",
        "formato text check (historico|rapida)",
        "placa text",
        "veiculo_id text null",
        "payload jsonb not null",
        "version integer not null default 1",
        "operation_id uuid null unique",
        "created_at timestamptz",
        "updated_at timestamptz",
        "deleted_at timestamptz null",
      ],
    },
    {
      nome: "public.dk_manutencao_documento",
      papel: "referências/manifesto de anexos sem bytes no Log",
      colunas: ["id", "manutencao_id", "document_type", "mime", "bytes", "sha256", "reference"],
    },
  ],
  notas: [
    "Não fundir formatos na migration: formato discrimina semântica.",
    "payload preserva 100% das chaves atuais inclusive nested checklists.",
    "Histórico concluído: update exige version + operation_id; evento na mesma TX.",
    "FK lógica a dk_veiculos por placa/id sem sobrescrever placa/modelo históricos no payload.",
  ],
};

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

function dkManutencaoCanonicalizar(registro) {
  return canonicalizar(registro);
}

function dkManutencaoParaPersistencia(registro, formato) {
  const payload = clonar(registro && typeof registro === "object" && !Array.isArray(registro) ? registro : {});
  return {
    formato: formato === "rapida" ? "rapida" : "historico",
    id: payload.id == null ? "" : String(payload.id),
    placa: payload.placa == null ? "" : String(payload.placa),
    payload,
  };
}

function dkManutencaoParaTerminal(linha) {
  if (!linha || typeof linha !== "object") return {};
  if (linha.payload && typeof linha.payload === "object" && !Array.isArray(linha.payload)) return clonar(linha.payload);
  return clonar(linha);
}

function dkManutencaoCompararRoundTrip(original, reconstruido) {
  const a = clonar(original && typeof original === "object" ? original : {});
  const b = clonar(reconstruido && typeof reconstruido === "object" ? reconstruido : {});
  const diff = classificarDiferencas(a, b);
  return {
    ok: diff.ok,
    missing: diff.missing.length,
    extra: diff.extra.length,
    typeChanges: diff.typeChanges.length,
    valueChanges: diff.valueChanges.length,
    caminhos: diff,
  };
}

function dkManutencaoAplicarPatch(oficial, patch) {
  const base = clonar(oficial && typeof oficial === "object" && !Array.isArray(oficial) ? oficial : {});
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  for (const chave of Object.keys(patch)) base[chave] = clonar(patch[chave]);
  return base;
}

function dkManutencaoEhResumo(registro) {
  if (!registro || typeof registro !== "object" || Array.isArray(registro)) return false;
  const chaves = Object.keys(registro);
  return chaves.length > 0 && chaves.length <= 6 && chaves.every((chave) => CAMPOS_RESUMO.has(chave));
}

function dkManutencaoSubstituir(oficial, novo) {
  const anterior = oficial && typeof oficial === "object" ? oficial : {};
  const recebido = novo && typeof novo === "object" ? novo : {};
  const faltam = Object.keys(anterior).filter((chave) => !Object.prototype.hasOwnProperty.call(recebido, chave));
  if (faltam.length || (dkManutencaoEhResumo(recebido) && Object.keys(anterior).length > Object.keys(recebido).length)) {
    return { ok: false, reason: "resumo_nao_substitui_manutencao", missing: faltam };
  }
  return { ok: true, registro: clonar(recebido) };
}

function dkManutencaoConflitoVersao(versaoLida, versaoOficial) {
  if (versaoOficial == null || versaoOficial === "") {
    return { ok: false, status: 501, reason: "NOT_IMPLEMENTED" };
  }
  const lida = Number(versaoLida);
  const oficial = Number(versaoOficial);
  if (!Number.isFinite(lida) || !Number.isFinite(oficial) || lida !== oficial) {
    return { ok: false, status: 409, reason: "version" };
  }
  return { ok: true, status: 200, proxima: oficial + 1 };
}

function dkManutencaoAusenciaNaoEZero(valor) {
  if (valor === undefined || valor === null || valor === "") return { zero: false, preservado: valor };
  if (valor === 0 || valor === "0" || valor === "0.00" || valor === "R$ 0,00") return { zero: true, preservado: valor };
  return { zero: false, preservado: valor };
}

function placaNorm(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function vinculoVeiculo(manutencao, placas) {
  const placa = placaNorm(manutencao && manutencao.placa);
  if (!placa) return { ok: false, reason: "placa_ausente" };
  const set = placas instanceof Set ? placas : new Set((Array.isArray(placas) ? placas : []).map(placaNorm));
  if (!set.has(placa)) return { ok: false, reason: "orfao" };
  return { ok: true, placa };
}

function exigirOperationId(pedido) {
  const body = pedido && typeof pedido === "object" ? pedido : {};
  const op = String(body.operacao || body.acao || "").trim();
  const mapa = { criar: "create", create: "create", atualizar: "update", update: "update", finalizar: "finalize", close: "finalize", remover: "remove", remove: "remove" };
  if (!mapa[op]) return { ok: false, reason: "operacao_invalida" };
  const operationId = String(body.operation_id || body.operationId || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
    return { ok: false, reason: "operation_id_obrigatorio" };
  }
  return { ok: true, operacao: mapa[op], operation_id: operationId };
}

function idempotenciaPorOperationId(existentes, operationId) {
  const lista = Array.isArray(existentes) ? existentes : [];
  const achados = lista.filter((item) => String(item && item.operation_id) === String(operationId));
  if (achados.length > 1) return { ok: false, reason: "duplicado", count: achados.length };
  if (achados.length === 1) return { ok: true, idempotent: true, registro: achados[0] };
  return { ok: true, idempotent: false };
}

function fixtureAtomica(createManut, createEvento, falharEvento) {
  const manutencao = typeof createManut === "function" ? createManut() : null;
  if (!manutencao) return { ok: false, reason: "manutencao_falhou", manutencao: null, evento: null };
  if (falharEvento) return { ok: false, reason: "evento_falhou", manutencao: null, evento: null };
  const evento = typeof createEvento === "function" ? createEvento(manutencao) : null;
  if (!evento) return { ok: false, reason: "evento_falhou", manutencao: null, evento: null };
  return { ok: true, manutencao, evento };
}

function refTecnica(formato, id) {
  return crypto.createHash("sha256").update(String(formato || "manut") + "\n" + String(id ?? ""), "utf8").digest("hex").slice(0, 12);
}

function aggregateHash(lista, formato) {
  const linhas = (Array.isArray(lista) ? lista : [])
    .map((item) => refTecnica(formato, item && item.id) + " " + textoEstavel(canonicalizar(item)))
    .sort();
  return crypto.createHash("sha256").update(linhas.join("\n"), "utf8").digest("hex");
}

function inventariarChaves(lista) {
  const acc = new Map();
  function walk(valor, prefixo) {
    if (Array.isArray(valor)) {
      valor.forEach((item) => walk(item, prefixo + "[]"));
      return;
    }
    if (!valor || typeof valor !== "object") return;
    for (const chave of Object.keys(valor)) {
      const caminho = prefixo ? prefixo + "." + chave : chave;
      acc.set(caminho, (acc.get(caminho) || 0) + 1);
      walk(valor[chave], caminho);
    }
  }
  for (const item of Array.isArray(lista) ? lista : []) walk(item, "");
  return [...acc.entries()].map(([path, n]) => ({ path, n })).sort((a, b) => a.path.localeCompare(b.path));
}

function compararFormatos(historico, rapidas) {
  const a = new Set(inventariarChaves(historico).map((item) => item.path.split(".")[0]));
  const b = new Set(inventariarChaves(rapidas).map((item) => item.path.split(".")[0]));
  const comuns = [...a].filter((k) => b.has(k)).sort();
  const soHist = [...a].filter((k) => !b.has(k)).sort();
  const soRap = [...b].filter((k) => !a.has(k)).sort();
  return { comuns, so_historico: soHist, so_rapida: soRap };
}

module.exports = {
  FONTES,
  LEGACY_FALLBACKS,
  CAMPOS_RESUMO,
  PROPOSTA_RELACIONAL,
  dkManutencaoCanonicalizar,
  dkManutencaoParaPersistencia,
  dkManutencaoParaTerminal,
  dkManutencaoCompararRoundTrip,
  dkManutencaoAplicarPatch,
  dkManutencaoEhResumo,
  dkManutencaoSubstituir,
  dkManutencaoConflitoVersao,
  dkManutencaoAusenciaNaoEZero,
  vinculoVeiculo,
  exigirOperationId,
  idempotenciaPorOperationId,
  fixtureAtomica,
  classificarDiferencas,
  textoEstavel,
  refTecnica,
  aggregateHash,
  inventariarChaves,
  compararFormatos,
  placaNorm,
};
