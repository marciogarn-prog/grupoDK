/**
 * Contrato de fidelidade do veículo.
 * Não grava banco. Não descarta chave desconhecida.
 * Espelho do portal não é autoridade e não substitui o oficial.
 */
const crypto = require("crypto");

const CAMPOS_RESUMO = new Set(["id", "placa", "modelo", "marca", "status"]);
const COLUNAS_TECNICAS = ["id", "placa", "created_at", "updated_at", "deleted_at"];

const LEGACY_FALLBACKS = [
  {
    caminho: "api/cadastro-veiculos.js",
    quando: "a flag não aponta para dk_veiculos e a gravação usa snapshot e Redis",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "lib/dk-veiculos-fonte.cjs",
    quando: "a flag Redis pode voltar o modo para snapshot",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "lib/dk-veiculos-copiar.cjs",
    quando: "a cópia histórica ainda lê o snapshot default",
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

function dkVeiculoCanonicalizar(veiculo) {
  return canonicalizar(veiculo);
}

function dkVeiculoParaPersistencia(veiculo) {
  const payload = clonar(veiculo && typeof veiculo === "object" && !Array.isArray(veiculo) ? veiculo : {});
  return {
    id: payload.id == null ? "" : String(payload.id),
    placa: payload.placa == null ? "" : String(payload.placa),
    payload,
  };
}

function dkVeiculoParaTerminal(linha) {
  if (!linha || typeof linha !== "object") return {};
  if (linha.payload && typeof linha.payload === "object" && !Array.isArray(linha.payload)) return clonar(linha.payload);
  return clonar(linha);
}

function dkVeiculoCompararRoundTrip(original, reconstruido) {
  const diff = classificarDiferencas(original, reconstruido);
  return {
    ok: diff.ok,
    missing: diff.missing.length,
    extra: diff.extra.length,
    typeChanges: diff.typeChanges.length,
    valueChanges: diff.valueChanges.length,
  };
}

function dkVeiculoAplicarPatch(oficial, patch) {
  const base = clonar(oficial && typeof oficial === "object" && !Array.isArray(oficial) ? oficial : {});
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  for (const chave of Object.keys(patch)) base[chave] = clonar(patch[chave]);
  return base;
}

function dkVeiculoEhResumo(veiculo) {
  if (!veiculo || typeof veiculo !== "object" || Array.isArray(veiculo)) return false;
  const chaves = Object.keys(veiculo);
  return chaves.length > 0 && chaves.length <= CAMPOS_RESUMO.size && chaves.every((chave) => CAMPOS_RESUMO.has(chave));
}

function dkVeiculoSubstituir(oficial, novo) {
  const anterior = oficial && typeof oficial === "object" && !Array.isArray(oficial) ? oficial : {};
  const recebido = novo && typeof novo === "object" && !Array.isArray(novo) ? novo : {};
  const faltam = Object.keys(anterior).filter((chave) => !Object.prototype.hasOwnProperty.call(recebido, chave));
  if (faltam.length || (dkVeiculoEhResumo(recebido) && Object.keys(anterior).length > Object.keys(recebido).length)) {
    return { ok: false, reason: "resumo_nao_substitui_cadastro" };
  }
  return { ok: true, veiculo: clonar(recebido) };
}

function dkVeiculoConflitoVersao(versaoLida, versaoOficial) {
  const lida = Number(versaoLida);
  const oficial = Number(versaoOficial);
  if (!Number.isFinite(lida) || !Number.isFinite(oficial) || lida !== oficial) {
    return { ok: false, status: 409, reason: "revisao_conflito" };
  }
  return { ok: true, status: 200, proxima: oficial + 1 };
}

function dkVeiculoResumo(veiculo) {
  const item = veiculo && typeof veiculo === "object" ? veiculo : {};
  return {
    id: item.id == null ? "" : String(item.id),
    placa: item.placa == null ? "" : String(item.placa),
    modelo: item.modelo == null ? "" : String(item.modelo),
    status: item.status == null ? "" : String(item.status),
  };
}

function refTecnica(id) {
  return crypto.createHash("sha256").update("veiculo\n" + String(id ?? ""), "utf8").digest("hex").slice(0, 12);
}

/**
 * O espelho não vira autoridade. A divergência já conhecida fica classificada
 * e qualquer campo novo fora dela reprova a comparação.
 */
function dkVeiculoClassificarEspelho(oficial, espelho) {
  const a = new Map((Array.isArray(oficial) ? oficial : []).map((item) => [String(item && item.id), item]));
  const b = new Map((Array.isArray(espelho) ? espelho : []).map((item) => [String(item && item.id), item]));
  const campos = new Map();
  const refs = [];
  let semPar = Math.abs(a.size - b.size);
  for (const [id, item] of a) {
    const outro = b.get(id);
    if (!outro) {
      semPar += 1;
      continue;
    }
    const diff = classificarDiferencas(item, outro);
    const caminhos = [...diff.missing, ...diff.extra, ...diff.typeChanges, ...diff.valueChanges];
    if (caminhos.includes("proprietario") || caminhos.includes("proprietarioCpfCnpj")) refs.push(refTecnica(id));
    for (const caminho of caminhos) campos.set(caminho, (campos.get(caminho) || 0) + 1);
  }
  const conhecidos = new Set(["updatedAt", "proprietario", "proprietarioCpfCnpj"]);
  const outras = [...campos.keys()].filter((caminho) => !conhecidos.has(caminho));
  const conhecida =
    semPar === 0 &&
    a.size === 199 &&
    campos.get("updatedAt") === 199 &&
    campos.get("proprietario") === 1 &&
    campos.get("proprietarioCpfCnpj") === 1 &&
    outras.length === 0;
  return {
    classe: conhecida ? "KNOWN_LEGACY_MIRROR_DIFFERENCE" : "DIVERGENCIA_NOVA",
    pares: a.size,
    sem_par: semPar,
    updatedAt: campos.get("updatedAt") || 0,
    proprietario: campos.get("proprietario") || 0,
    proprietarioDocumento: campos.get("proprietarioCpfCnpj") || 0,
    outras,
    refs: conhecida ? refs.filter((ref, indice) => refs.indexOf(ref) === indice).slice(0, 2) : [],
  };
}

module.exports = {
  LEGACY_FALLBACKS,
  COLUNAS_TECNICAS,
  CAMPOS_RESUMO,
  dkVeiculoCanonicalizar,
  dkVeiculoParaPersistencia,
  dkVeiculoParaTerminal,
  dkVeiculoCompararRoundTrip,
  dkVeiculoAplicarPatch,
  dkVeiculoEhResumo,
  dkVeiculoSubstituir,
  dkVeiculoConflitoVersao,
  dkVeiculoResumo,
  dkVeiculoClassificarEspelho,
  classificarDiferencas,
  textoEstavel,
  refTecnica,
};
