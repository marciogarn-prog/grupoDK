/**
 * Extrai comprovantes do localStorage Chrome (leveldb UTF-16).
 * node scripts/read-chrome-comprovantes.cjs
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const CHROME_LS = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "Google",
  "Chrome",
  "User Data",
  "Default",
  "Local Storage",
  "leveldb"
);
const KEY = "dk_comprovantes_cliente_pendentes";

function parseJsonArrayFromText(text, startIdx) {
  const j = text.indexOf("[{", startIdx);
  if (j < 0 || j > startIdx + 8000) return null;
  let depth = 0;
  for (let k = j; k < Math.min(text.length, j + 2_500_000); k++) {
    const c = text[k];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        const slice = text.slice(j, k + 1);
        try {
          const arr = JSON.parse(slice);
          if (Array.isArray(arr) && arr.length && (arr[0].id || arr[0].status)) return arr;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractFromBuffer(buf) {
  const key16 = Buffer.from(KEY, "utf16le");
  let idx = 0;
  let best = null;
  while ((idx = buf.indexOf(key16, idx)) >= 0) {
    const pos = idx + key16.length;
    const chunk = buf.slice(pos, pos + 4_000_000).toString("utf16le");
    const arr = parseJsonArrayFromText(chunk, 0);
    if (arr && (!best || arr.length > best.length)) best = arr;
    idx += key16.length;
  }
  const key8 = Buffer.from(KEY);
  idx = 0;
  while ((idx = buf.indexOf(key8, idx)) >= 0) {
    const chunk = buf.slice(idx, idx + 4_000_000).toString("utf8");
    const arr = parseJsonArrayFromText(chunk, idx > 0 ? KEY.length : 0);
    if (arr && (!best || arr.length > best.length)) best = arr;
    idx += key8.length;
  }
  return best;
}

function normProto(x) {
  return String(x || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function normId(raw) {
  const s0 = String(raw ?? "").trim();
  if (!s0) return "";
  const e2e = s0.match(/\b(E[0-9A-Z]{31,35})\b/i);
  if (e2e) return e2e[1].toUpperCase();
  const c = s0.replace(/\s+/g, "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (c.length >= 10 && c.length <= 64) return c;
  return "";
}
function fmtBRL(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function rowFromRec(r) {
  const ia = r.iaValidacao;
  if (!ia) {
    return {
      status: r.status,
      protocolo: r.protocolo,
      cliente: String(r.nomeCliente || "").trim(),
      cpf: r.cpf,
      enviado: (r.enviadoEm || "").slice(0, 19),
      assinatura: "(sem leitura IA)",
    };
  }
  const id = normId(ia.idTransacao || r.idTransacao);
  const proto = normProto(r.protocolo);
  const valor = Math.round((Number(ia.valor) || 0) * 100) / 100;
  const chave =
    r.assinaturaDupChave ||
    (ia.dataPagamento && ia.horaPagamento && id && valor > 0
      ? `${proto}|${ia.dataPagamento}|${ia.horaPagamento}|${valor.toFixed(2)}|${id}`
      : "");
  return {
    status: r.status,
    protocolo: r.protocolo,
    cliente: String(r.nomeCliente || "").trim(),
    cpf: r.cpf,
    enviado: (r.enviadoEm || "").slice(0, 19),
    dataIA: ia.dataPagamento || "—",
    horaIA: ia.horaPagamento || "—",
    valorIA: valor > 0 ? fmtBRL(valor) : "—",
    idIA: id || "—",
    assinatura: chave || "(incompleta)",
  };
}

function main() {
  if (!fs.existsSync(CHROME_LS)) {
    console.error("Chrome leveldb não encontrado.");
    process.exit(1);
  }
  let list = null;
  let fromFile = "";
  for (const f of fs.readdirSync(CHROME_LS)) {
    if (!f.endsWith(".ldb")) continue;
    const buf = fs.readFileSync(path.join(CHROME_LS, f));
    const arr = extractFromBuffer(buf);
    if (arr && (!list || arr.length > list.length)) {
      list = arr;
      fromFile = f;
    }
  }
  if (!list || !list.length) {
    console.error("Nenhum comprovante em dk_comprovantes_cliente_pendentes no Chrome.");
    process.exit(1);
  }
  const rows = list.map(rowFromRec).sort((a, b) => String(b.enviado).localeCompare(String(a.enviado)));
  const out = {
    origem: `chrome:${fromFile}`,
    total: list.length,
    com_ia: list.filter((r) => r.iaValidacao).length,
    geradoEm: new Date().toISOString(),
    rows,
  };
  const outPath = path.join(__dirname, "comprovantes-export.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main();
