/**
 * Contrato de fidelidade do cliente.
 * Não grava banco. Não descarta chave desconhecida.
 * Campo ausente no patch não vira null. String vazia permanece string vazia.
 */
const CAMPOS_RESUMO = new Set(["id", "nome", "cpf", "status", "codigo"]);

const LEGACY_FALLBACKS = [
  {
    caminho: "api/cadastro-clientes.js",
    quando: "a fonte dk_clientes não está pronta e a leitura ou a gravação usa Redis ou snapshot",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "lib/dk-clientes-fonte.cjs",
    quando: "a flag Redis não aponta para dk_clientes e o modo volta ao snapshot",
    classe: "LEGACY_FALLBACK",
  },
  {
    caminho: "lib/dk-clientes-copiar.cjs",
    quando: "a cópia ainda lê o snapshot default como origem histórica",
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

function dkClienteCanonicalizar(cliente) {
  return canonicalizar(cliente);
}

function dkClienteParaPersistencia(cliente) {
  const payload = clonar(cliente && typeof cliente === "object" && !Array.isArray(cliente) ? cliente : {});
  const cpf = String(payload.cpf == null ? "" : payload.cpf).replace(/\D/g, "").slice(0, 11);
  return {
    id: payload.id == null ? "" : String(payload.id),
    cpf,
    payload,
  };
}

function dkClienteParaTerminal(linha) {
  if (!linha || typeof linha !== "object") return {};
  if (linha.payload && typeof linha.payload === "object" && !Array.isArray(linha.payload)) return clonar(linha.payload);
  return clonar(linha);
}

function classificarDiferencas(original, reconstruido) {
  const missing = [];
  const extra = [];
  const typeChanges = [];
  const valueChanges = [];
  function tipo(valor) {
    if (valor === null) return "null";
    if (Array.isArray(valor)) return "array";
    return typeof valor;
  }
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
        else if (tipo(a[chave]) !== tipo(b[chave])) typeChanges.push(filho);
        else walk(a[chave], b[chave], filho);
      }
      return;
    }
    if (textoEstavel(a) !== textoEstavel(b)) valueChanges.push(caminho || "$");
  }
  walk(original, reconstruido, "");
  return { missing, extra, typeChanges, valueChanges, ok: !missing.length && !extra.length && !typeChanges.length && !valueChanges.length };
}

function dkClienteCompararRoundTrip(original, reconstruido) {
  const diff = classificarDiferencas(original, reconstruido);
  return {
    ok: diff.ok,
    missing: diff.missing.length,
    extra: diff.extra.length,
    typeChanges: diff.typeChanges.length,
    valueChanges: diff.valueChanges.length,
  };
}

function dkClienteAplicarPatch(oficial, patch) {
  const base = clonar(oficial && typeof oficial === "object" && !Array.isArray(oficial) ? oficial : {});
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  for (const chave of Object.keys(patch)) {
    if (chave === "senha" && patch.senha === "" && base.senha) continue;
    base[chave] = clonar(patch[chave]);
  }
  return base;
}

function dkClienteEhResumo(cliente) {
  if (!cliente || typeof cliente !== "object" || Array.isArray(cliente)) return false;
  const chaves = Object.keys(cliente);
  return chaves.length > 0 && chaves.every((chave) => CAMPOS_RESUMO.has(chave));
}

function dkClienteSubstituir(oficial, novo) {
  const anterior = oficial && typeof oficial === "object" && !Array.isArray(oficial) ? oficial : {};
  const recebido = novo && typeof novo === "object" && !Array.isArray(novo) ? novo : {};
  const faltam = Object.keys(anterior).filter((chave) => !Object.prototype.hasOwnProperty.call(recebido, chave));
  if (faltam.length || (dkClienteEhResumo(recebido) && Object.keys(anterior).length > Object.keys(recebido).length)) {
    return { ok: false, reason: "resumo_nao_substitui_cadastro" };
  }
  return { ok: true, cliente: clonar(recebido) };
}

function dkClienteConflitoVersao(versaoLida, versaoOficial) {
  const lida = Number(versaoLida);
  const oficial = Number(versaoOficial);
  if (!Number.isFinite(lida) || !Number.isFinite(oficial) || lida !== oficial) {
    return { ok: false, status: 409, reason: "revisao_conflito" };
  }
  return { ok: true, status: 200, proxima: oficial + 1 };
}

function dkClienteResumo(cliente) {
  const item = cliente && typeof cliente === "object" ? cliente : {};
  const cpf = String(item.cpf == null ? "" : item.cpf).replace(/\D/g, "");
  const mascarado = cpf.length === 11 ? cpf.slice(0, 3) + ".***.***-" + cpf.slice(9) : "";
  return {
    id: item.id == null ? "" : String(item.id),
    nome: item.nome == null ? "" : String(item.nome),
    cpf: mascarado,
    status: item.status == null ? "" : String(item.status),
  };
}

module.exports = {
  LEGACY_FALLBACKS,
  CAMPOS_RESUMO,
  dkClienteCanonicalizar,
  dkClienteParaPersistencia,
  dkClienteParaTerminal,
  dkClienteCompararRoundTrip,
  classificarDiferencas,
  dkClienteAplicarPatch,
  dkClienteEhResumo,
  dkClienteSubstituir,
  dkClienteConflitoVersao,
  dkClienteResumo,
  textoEstavel,
};
