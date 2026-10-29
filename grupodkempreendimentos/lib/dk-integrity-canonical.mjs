import { createHash } from "crypto";

/** Ordena chaves de objeto só para hash. Array mantém a ordem. Ausente não vira null. */
export function canonicalize(value) {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

export function stableStringify(value) {
  if (value === undefined) return '"\\u0000undefined"';
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (Object.is(value, -0)) return "-0";
    if (!Number.isFinite(value)) return JSON.stringify(String(value));
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map((item) => stableStringify(item)).join(",") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }
  return JSON.stringify(String(value));
}

export function sha256Text(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashValue(value) {
  return sha256Text(stableStringify(canonicalize(value)));
}

export function emptyValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

export function valueKind(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Inventário recursivo. Não grava valores.
 * absent não entra: a chave só conta onde existe.
 */
export function inventoryKeys(records) {
  const acc = new Map();
  function bump(path, value) {
    let row = acc.get(path);
    if (!row) {
      row = { path, types: {}, present: 0, nulls: 0, empty: 0, filled: 0 };
      acc.set(path, row);
    }
    const kind = valueKind(value);
    row.types[kind] = (row.types[kind] || 0) + 1;
    row.present += 1;
    if (value === null) row.nulls += 1;
    else if (emptyValue(value)) row.empty += 1;
    else row.filled += 1;
  }
  function walk(value, prefix) {
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, prefix + "[]"));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      const path = prefix ? prefix + "." + key : key;
      bump(path, value[key]);
      const child = value[key];
      if (child && typeof child === "object") walk(child, path);
    }
  }
  for (const record of records) walk(record, "");
  return [...acc.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function diffTrees(backup, current) {
  const missing = [];
  const extra = [];
  const mismatches = [];
  function walk(a, b, path) {
    const aArr = Array.isArray(a);
    const bArr = Array.isArray(b);
    if (aArr || bArr) {
      if (!aArr || !bArr) {
        mismatches.push(path || "$");
        return;
      }
      if (a.length !== b.length) mismatches.push((path || "$") + ".length");
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i += 1) {
        const child = (path || "$") + "[" + i + "]";
        if (i >= a.length) extra.push(child);
        else if (i >= b.length) missing.push(child);
        else walk(a[i], b[i], child);
      }
      return;
    }
    const aObj = a !== null && typeof a === "object";
    const bObj = b !== null && typeof b === "object";
    if (aObj || bObj) {
      if (!aObj || !bObj) {
        mismatches.push(path || "$");
        return;
      }
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys) {
        const child = path ? path + "." + key : key;
        const ha = Object.prototype.hasOwnProperty.call(a, key);
        const hb = Object.prototype.hasOwnProperty.call(b, key);
        if (ha && !hb) missing.push(child);
        else if (!ha && hb) extra.push(child);
        else walk(a[key], b[key], child);
      }
      return;
    }
    if (stableStringify(a) !== stableStringify(b)) mismatches.push(path || "$");
  }
  walk(backup, current, "");
  return { missing, extra, mismatches };
}

/** Marcadores técnicos do adaptador. Não entram no objeto de negócio. */
export const MARCADORES_TECNICOS = new Set(["pgId", "pgVersion", "pgUpdatedAt"]);

export function semMarcadoresTecnicos(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out = {};
  for (const key of Object.keys(value)) {
    if (!MARCADORES_TECNICOS.has(key)) out[key] = value[key];
  }
  return out;
}

/**
 * Reconstrói a locação a partir do que está persistido.
 * Pagamentos extraídos voltam na ordem de source_position, sem reordenar por valor.
 * Não descarta chave desconhecida e não normaliza texto numérico.
 */
export function reconstruirLocacao(campos, ativos, removidos) {
  const base = semMarcadoresTecnicos(campos && typeof campos === "object" && !Array.isArray(campos) ? { ...campos } : {});
  if (!Object.prototype.hasOwnProperty.call(base, "portalLancamentosAluguel")) {
    base.portalLancamentosAluguel = (ativos || []).map((row) => row);
  }
  if (!Object.prototype.hasOwnProperty.call(base, "portalLancamentosAluguelRemovidos") && removidos && removidos.length) {
    base.portalLancamentosAluguelRemovidos = removidos.map((row) => row);
  }
  return base;
}

export function perdaDeChave(backup, reconstruido) {
  return diffTrees(backup, reconstruido).missing;
}

export function redigirCaminho(path) {
  return String(path || "")
    .split(".")
    .map((part) => (/^\d{11}(\[\d+\])?$/.test(part) || /^\d{14}(\[\d+\])?$/.test(part) ? "ref_" + sha256Text(part).slice(0, 12) : part))
    .join(".");
}

export function dinheiroExato(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value !== "string") return null;
  const limpo = value.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$/.test(limpo) && !/^\d+,\d{2}$/.test(limpo) && !/^\d+\.\d{2}$/.test(limpo)) {
    return null;
  }
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function schemaHash(definicao) {
  return hashValue(definicao);
}

function base64Provavel(value) {
  return typeof value === "string" && value.length >= 120 && /^[A-Za-z0-9+/=\r\n]+$/.test(value.slice(0, 180));
}

function mimeDeDataUrl(value) {
  const m = /^data:([^;,]+)/.exec(value);
  return m ? m[1] : "";
}

/**
 * Classifica um objeto que parece arquivo.
 * Data de pagamento e texto curto não viram documento.
 */
export function classificarBlocoDocumento(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  let blob = null;
  let presente = false;
  for (const key of ["imagem", "imagemRecortada", "arquivo", "pdf", "conteudo"]) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    blob = obj[key];
    presente = true;
    break;
  }
  if (!presente && Object.prototype.hasOwnProperty.call(obj, "data")) {
    const data = obj.data;
    const arquivo =
      data == null ||
      data === "" ||
      (typeof data === "string" && (data.startsWith("data:") || base64Provavel(data))) ||
      typeof obj.mime === "string";
    if (arquivo && (typeof obj.mime === "string" || typeof obj.nome === "string" || (typeof data === "string" && data.startsWith("data:")))) {
      blob = data;
      presente = true;
    }
  }
  if (!presente && obj.imagemIndisponivel === true) {
    return { status: "absent_in_source", bytes: 0, mime: "", sha256: "" };
  }
  if (!presente) return null;
  if (typeof blob === "string" && blob.length > 0 && (blob.startsWith("data:") || base64Provavel(blob))) {
    const mime = typeof obj.mime === "string" && obj.mime ? obj.mime : mimeDeDataUrl(blob);
    return { status: "verified", bytes: Buffer.byteLength(blob, "utf8"), mime, sha256: sha256Text(blob) };
  }
  if (blob == null || blob === "" || obj.imagemIndisponivel === true) {
    return { status: "absent_in_source", bytes: 0, mime: typeof obj.mime === "string" ? obj.mime : "", sha256: "" };
  }
  return { status: "document_missing", bytes: 0, mime: typeof obj.mime === "string" ? obj.mime : "", sha256: "" };
}

/** Identificador do manifesto. CPF (11 dígitos) e CNPJ (14) não aparecem. */
/** Posição gravada no PostgreSQL: índice do array original, começando em 1. */
export function sourcePositionConfere(posicao, indice) {
  return Number(posicao) === Number(indice) + 1;
}

export function entityRef(module, id) {
  const s = String(id ?? "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return module + ":" + s.toLowerCase();
  }
  if (/^\d{1,10}$/.test(s)) return module + ":" + s;
  return module + ":h:" + sha256Text(module + "\n" + s).slice(0, 24);
}
