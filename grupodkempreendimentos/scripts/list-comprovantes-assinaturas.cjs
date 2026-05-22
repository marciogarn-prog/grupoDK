/**
 * Lista assinaturas / comprovantes: Chrome localStorage + Supabase.
 * node scripts/list-comprovantes-assinaturas.cjs
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const CHROME_LDB = path.join(
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

function parseJsonArray(text, maxScan = 3_000_000) {
  const j = text.indexOf("[{");
  if (j < 0) return null;
  let depth = 0;
  const limit = Math.min(text.length, j + maxScan);
  for (let k = j; k < limit; k++) {
    if (text[k] === "[") depth++;
    else if (text[k] === "]") {
      depth--;
      if (depth === 0) {
        try {
          const arr = JSON.parse(text.slice(j, k + 1));
          return Array.isArray(arr) ? arr : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function tryExtractKey(buf, key) {
  const hits = [];
  const key16 = Buffer.from(key, "utf16le");
  let idx = 0;
  while ((idx = buf.indexOf(key16, idx)) >= 0) {
    const chunk = buf.slice(idx + key16.length, idx + key16.length + 6_000_000).toString("utf16le");
    const arr = parseJsonArray(chunk);
    if (arr) hits.push(arr);
    idx += key16.length;
  }
  const key8 = Buffer.from(key);
  idx = 0;
  while ((idx = buf.indexOf(key8, idx)) >= 0) {
    const slice = buf.slice(idx, idx + 6_000_000);
    const arr = parseJsonArray(slice.toString("utf16le")) || parseJsonArray(slice.toString("utf8"), 500000);
    if (arr) hits.push(arr);
    idx += key8.length;
  }
  return hits.sort((a, b) => b.length - a.length)[0] || null;
}

function loadFromChrome() {
  if (!fs.existsSync(CHROME_LDB)) return { comprovantes: null, locacoes: null, banco: null, file: "" };
  let comprovantes = null;
  let locacoes = null;
  let banco = null;
  let file = "";
  for (const f of fs.readdirSync(CHROME_LDB)) {
    if (!f.endsWith(".ldb")) continue;
    const buf = fs.readFileSync(path.join(CHROME_LDB, f));
    const c = tryExtractKey(buf, "dk_comprovantes_cliente_pendentes");
    const l = tryExtractKey(buf, "dk_locacoes_cadastro");
    const b = tryExtractKey(buf, "dk_comprovantes_banco_assinaturas");
    if (c && (!comprovantes || c.length > comprovantes.length)) {
      comprovantes = c;
      file = f;
    }
    if (l && (!locacoes || l.length > locacoes.length)) locacoes = l;
    if (b && (!banco || b.length > banco.length)) banco = b;
  }
  return { comprovantes, locacoes, banco, file };
}

async function loadFromSupabase() {
  const url = `${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.default&select=payload,updated_at`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return { ok: false, status: res.status, body: await res.text() };
  const rows = await res.json();
  const p = rows[0]?.payload || {};
  return {
    ok: true,
    updated_at: rows[0]?.updated_at,
    comprovantes: p.dk_comprovantes_cliente_pendentes || [],
    banco: p.dk_comprovantes_banco_assinaturas || [],
    locacoes: p.dk_locacoes_cadastro || [],
  };
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
function fmtCpf(c) {
  const d = String(c || "").replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return c;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function rowFromRec(r) {
  const ia = r.iaValidacao;
  if (!ia) {
    return {
      status: r.status,
      protocolo: r.protocolo,
      cliente: String(r.nomeCliente || "").trim(),
      cpf: fmtCpf(r.cpf),
      enviado: (r.enviadoEm || "").slice(0, 19).replace("T", " "),
      assinatura: "(aguarda IA — sem assinatura)",
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
    cpf: fmtCpf(r.cpf),
    enviado: (r.enviadoEm || "").slice(0, 19).replace("T", " "),
    dataIA: ia.dataPagamento || "—",
    horaIA: ia.horaPagamento || "—",
    valorIA: valor > 0 ? fmtBRL(valor) : "—",
    idIA: id || "—",
    assinatura: chave || "(incompleta)",
  };
}

function pagamentosFromLocacoes(locs) {
  const pag = [];
  for (const loc of locs || []) {
    const proto = loc.numeroContrato;
    const scan = (arr) => {
      for (const p of arr || []) {
        if (!p || typeof p !== "object") continue;
        if (!p.confirmadoViaAppCliente && !p.origemComprovanteClienteId && !p.idTransacaoComprovante) continue;
        const id = normId(p.idTransacaoComprovante);
        const valor = Number(p.valor);
        pag.push({
          fonte: "pagamento_protocolo",
          status: "confirmado",
          protocolo: proto,
          cpf: fmtCpf(loc.cpf),
          data: p.data,
          valor: fmtBRL(valor),
          hora: p.horaPagamentoComprovante || "—",
          idIA: id || "—",
          assinatura: id && p.data && p.horaPagamentoComprovante ? `${normProto(proto)}|${p.data}|${p.horaPagamentoComprovante}|${valor.toFixed(2)}|${id}` : "(incompleta)",
        });
      }
    };
    scan(loc.portalLancamentosAluguel);
    scan(loc.portalMultasTransito);
    scan(loc.portalManutencoesRegistro);
  }
  return pag;
}

async function main() {
  let list = [];
  let origem = "";
  let meta = {};

  const cloud = await loadFromSupabase();
  if (cloud.ok && Array.isArray(cloud.comprovantes) && cloud.comprovantes.length) {
    list = cloud.comprovantes;
    origem = `supabase (${cloud.updated_at || ""})`;
    meta.banco = cloud.banco?.length || 0;
  } else {
    const chrome = loadFromChrome();
    if (chrome.comprovantes?.length) {
      list = chrome.comprovantes;
      origem = `chrome ${chrome.file}`;
      meta.banco = chrome.banco?.length || 0;
    } else if (chrome.locacoes?.length) {
      const pag = pagamentosFromLocacoes(chrome.locacoes);
      const out = {
        aviso: "Comprovantes não achados no Chrome; listando pagamentos confirmados via app no protocolo.",
        origem: `chrome locações ${chrome.file}`,
        total: pag.length,
        rows: pag,
      };
      console.log(JSON.stringify(out, null, 2));
      fs.writeFileSync(path.join(__dirname, "comprovantes-export.json"), JSON.stringify(out, null, 2));
      return;
    }
    if (!cloud.ok) meta.supabaseErro = `${cloud.status}: ${String(cloud.body || "").slice(0, 120)}`;
  }

  if (!list.length) {
    console.error(JSON.stringify({ erro: "Nenhum comprovante encontrado.", origem, meta }, null, 2));
    process.exit(1);
  }

  const rows = list.map(rowFromRec).sort((a, b) => String(b.enviado).localeCompare(String(a.enviado)));
  const out = {
    origem,
    total: list.length,
    com_ia: list.filter((r) => r.iaValidacao).length,
    banco_entradas: meta.banco || 0,
    meta,
    rows,
  };
  fs.writeFileSync(path.join(__dirname, "comprovantes-export.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
