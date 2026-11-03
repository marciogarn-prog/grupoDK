/**
 * Contrato de fidelidade da locação.
 * Não grava banco. Não descarta chave desconhecida.
 * Lista resumida não substitui o objeto completo.
 */
const crypto = require("crypto");

const CAMPOS_RESUMO = new Set([
  "numeroContrato",
  "protocolo",
  "cpf",
  "placa",
  "status",
  "statusLocacao",
  "nome",
  "cliente",
]);

const COLUNAS_TECNICAS = [
  "id",
  "numero_contrato",
  "cpf",
  "placa",
  "status_locacao",
  "campos",
  "version",
  "created_at",
  "updated_at",
  "deleted_at",
];

const ALIASES = {
  modelo: ["marcaModelo", "marca_modelo"],
  marcaModelo: ["modelo", "marca_modelo"],
  dataInicio: ["inicio", "data_inicio"],
  inicio: ["dataInicio", "data_inicio"],
  dataFim: ["fim", "data_fim"],
  fim: ["dataFim", "data_fim"],
  valorAluguel: ["valorLocacao", "valor_locacao"],
  valorLocacao: ["valorAluguel", "valor_locacao"],
  valorSemanal: ["valorParcela", "valorPlano", "valor_semanal"],
  valorParcela: ["valorSemanal", "valorPlano"],
  valorPlano: ["valorSemanal", "valorParcela"],
  plano: ["tipoPlano", "tipo_plano"],
  tipoPlano: ["plano", "tipo_plano"],
};

const LEGACY_FALLBACKS = [
  {
    caminho: "lib/dk-locacao-pg.cjs",
    quando: "a flag do módulo não aponta para dk_locacao e a fonte volta a snapshot",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "lib/dk-locacoes-copiar.cjs",
    quando: "a cópia histórica ainda lê o snapshot default",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "api/dk-locacao-lista-leve.js",
    quando: "a lista leve não carrega o objeto completo e não pode gravar no lugar do detail",
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

function dkLocacaoCanonicalizar(locacao) {
  return canonicalizar(locacao);
}

function dkLocacaoParaPersistencia(locacao) {
  const payload = clonar(locacao && typeof locacao === "object" && !Array.isArray(locacao) ? locacao : {});
  delete payload.pgId;
  delete payload.pgVersion;
  delete payload.pgUpdatedAt;
  const numero = String(payload.numeroContrato || payload.protocolo || "").replace(/\D/g, "");
  return {
    numero_contrato: numero,
    campos: payload,
  };
}

function dkLocacaoParaTerminal(linha) {
  if (!linha || typeof linha !== "object") return {};
  if (linha.campos && typeof linha.campos === "object" && !Array.isArray(linha.campos)) {
    return clonar(linha.campos);
  }
  if (linha.payload && typeof linha.payload === "object" && !Array.isArray(linha.payload)) {
    return clonar(linha.payload);
  }
  return clonar(linha);
}

function dkLocacaoCompararRoundTrip(original, reconstruido) {
  const a = clonar(original && typeof original === "object" ? original : {});
  const b = clonar(reconstruido && typeof reconstruido === "object" ? reconstruido : {});
  delete a.pgId;
  delete a.pgVersion;
  delete a.pgUpdatedAt;
  delete b.pgId;
  delete b.pgVersion;
  delete b.pgUpdatedAt;
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

function dkLocacaoAplicarPatch(oficial, patch) {
  const base = clonar(oficial && typeof oficial === "object" && !Array.isArray(oficial) ? oficial : {});
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  for (const chave of Object.keys(patch)) base[chave] = clonar(patch[chave]);
  return base;
}

function dkLocacaoEhResumo(locacao) {
  if (!locacao || typeof locacao !== "object" || Array.isArray(locacao)) return false;
  const chaves = Object.keys(locacao);
  if (!chaves.length) return false;
  if (chaves.length > 12) return false;
  return chaves.every((chave) => CAMPOS_RESUMO.has(chave));
}

function dkLocacaoSubstituir(oficial, novo) {
  const anterior = oficial && typeof oficial === "object" && !Array.isArray(oficial) ? oficial : {};
  const recebido = novo && typeof novo === "object" && !Array.isArray(novo) ? novo : {};
  const faltam = Object.keys(anterior).filter((chave) => !Object.prototype.hasOwnProperty.call(recebido, chave));
  if (faltam.length || (dkLocacaoEhResumo(recebido) && Object.keys(anterior).length > Object.keys(recebido).length)) {
    return { ok: false, reason: "resumo_nao_substitui_locacao", missing: faltam };
  }
  return { ok: true, locacao: clonar(recebido) };
}

function dkLocacaoConflitoVersao(versaoLida, versaoOficial) {
  const lida = Number(versaoLida);
  const oficial = Number(versaoOficial);
  if (!Number.isFinite(lida) || !Number.isFinite(oficial) || lida !== oficial) {
    return { ok: false, status: 409, reason: "version" };
  }
  return { ok: true, status: 200, proxima: oficial + 1 };
}

function dkLocacaoResumo(locacao) {
  const item = locacao && typeof locacao === "object" ? locacao : {};
  return {
    numeroContrato: item.numeroContrato == null ? "" : String(item.numeroContrato),
    placa: item.placa == null ? "" : String(item.placa),
    status: item.statusLocacao || item.status || "",
    nome: item.nome == null ? "" : String(item.nome),
  };
}

function dkLocacaoAusenciaNaoEZero(valor) {
  if (valor === undefined || valor === null || valor === "") return { zero: false, preservado: valor };
  if (valor === 0 || valor === 0.0 || valor === "0" || valor === "0.00" || valor === "R$ 0,00") {
    return { zero: true, preservado: valor };
  }
  return { zero: false, preservado: valor };
}

function dkLocacaoAliasPresente(locacao, chave) {
  const item = locacao && typeof locacao === "object" ? locacao : {};
  if (Object.prototype.hasOwnProperty.call(item, chave)) return true;
  const lista = ALIASES[chave] || [];
  return lista.some((alias) => Object.prototype.hasOwnProperty.call(item, alias));
}

function refTecnica(id) {
  return crypto.createHash("sha256").update("locacao\n" + String(id ?? ""), "utf8").digest("hex").slice(0, 12);
}

function aggregateHash(lista) {
  const linhas = (Array.isArray(lista) ? lista : [])
    .map((item) => {
      const id = item && (item.numeroContrato || item.numero_contrato || item.id);
      return refTecnica(id) + " " + textoEstavel(canonicalizar(item && item.campos ? item.campos : item));
    })
    .sort();
  return crypto.createHash("sha256").update(linhas.join("\n"), "utf8").digest("hex");
}

module.exports = {
  LEGACY_FALLBACKS,
  COLUNAS_TECNICAS,
  CAMPOS_RESUMO,
  ALIASES,
  dkLocacaoCanonicalizar,
  dkLocacaoParaPersistencia,
  dkLocacaoParaTerminal,
  dkLocacaoCompararRoundTrip,
  dkLocacaoAplicarPatch,
  dkLocacaoEhResumo,
  dkLocacaoSubstituir,
  dkLocacaoConflitoVersao,
  dkLocacaoResumo,
  dkLocacaoAusenciaNaoEZero,
  dkLocacaoAliasPresente,
  classificarDiferencas,
  textoEstavel,
  refTecnica,
  aggregateHash,
};
