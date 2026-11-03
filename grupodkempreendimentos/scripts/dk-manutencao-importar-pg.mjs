/**
 * Importa 28+362 manutenções do backup para public.dk_manutencao (idempotente).
 * Não apaga snapshot. Não altera outros domínios.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fidelidade = require("../lib/dk-manutencao-fidelidade.cjs");
const aqui = path.dirname(fileURLToPath(import.meta.url));

function carregarBackup() {
  const candidatos = [
    process.env.DK_BACKUP_PATH,
    path.join(os.homedir(), "OneDrive", "Área de Trabalho", "backup.json.gz"),
    path.join(os.homedir(), "Desktop", "backup.json.gz"),
  ].filter(Boolean);
  for (const arquivo of candidatos) {
    if (fs.existsSync(arquivo)) {
      const bruto = fs.readFileSync(arquivo);
      const texto = arquivo.endsWith(".gz") ? zlib.gunzipSync(bruto).toString("utf8") : bruto.toString("utf8");
      const json = JSON.parse(texto);
      return json.data || json;
    }
  }
  throw new Error("backup.json.gz não encontrado");
}

function sqlLiteral(v) {
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function escaparJson(obj) {
  return sqlLiteral(JSON.stringify(obj));
}

function sb(query, escrita) {
  const arquivo = path.join(os.tmpdir(), "dk-manut-imp-" + Date.now() + "-" + Math.random().toString(16).slice(2) + ".sql");
  fs.writeFileSync(arquivo, query.endsWith(";") ? query : query + ";", "utf8");
  try {
    const args = [
      "--yes",
      "supabase",
      "db",
      "query",
      "--remote",
      ...(escrita ? ["--yes"] : ["--read-only"]),
      "-f",
      arquivo,
      "-o",
      "json",
    ];
    const bruto = execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
      cwd: path.join(aqui, ".."),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: { ...process.env, SUPABASE_YES: escrita ? "1" : process.env.SUPABASE_YES },
    });
    const inicio = bruto.indexOf("{");
    return JSON.parse(bruto.slice(inicio)).rows || [];
  } finally {
    try {
      fs.unlinkSync(arquivo);
    } catch {
      /* ignore */
    }
  }
}

const data = carregarBackup();
const hist = Array.isArray(data.dk_manutencoes_cadastro) ? data.dk_manutencoes_cadastro : [];
const rap = Array.isArray(data.dk_manutencoes_rapidas_v1) ? data.dk_manutencoes_rapidas_v1 : [];
if (hist.length !== 28 || rap.length !== 362) {
  throw new Error("contagens origem divergentes: hist=" + hist.length + " rap=" + rap.length);
}

const hashHist = fidelidade.aggregateHash(hist, "historico");
const hashRap = fidelidade.aggregateHash(rap, "rapida");
const hashTot = createHash("sha256").update(hashHist + "\n" + hashRap, "utf8").digest("hex");
console.log(
  JSON.stringify(
    {
      hash_hist: hashHist,
      hash_rap: hashRap,
      hash_tot: hashTot,
      esperado_tot: "75440de5fae699c0b3e13da91265ebe2a51aa1e2218116bdcda8da9460201b3e",
    },
    null,
    2
  )
);
if (hashTot !== "75440de5fae699c0b3e13da91265ebe2a51aa1e2218116bdcda8da9460201b3e") {
  throw new Error("HASH TOTAL divergente — abortar import");
}

function lotes(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function sqlImport(kind, item) {
  const sid = String(item && item.id != null ? item.id : "");
  const placa = String(item && item.placa != null ? item.placa : "");
  const key = kind + ":" + sid;
  return (
    "select * from public.dk_manutencao_import_one(" +
    sqlLiteral(kind) +
    "," +
    sqlLiteral(sid) +
    "," +
    sqlLiteral(placa) +
    "," +
    escaparJson(item) +
    "," +
    sqlLiteral(key) +
    ");"
  );
}

for (const lote of lotes(hist, 20)) {
  const sql = lote.map((item) => sqlImport("historico", item)).join("\n");
  sb(sql, true);
  process.stdout.write(".");
}
for (const lote of lotes(rap, 40)) {
  const sql = lote.map((item) => sqlImport("rapida", item)).join("\n");
  sb(sql, true);
  process.stdout.write(".");
}
console.log("");

const contagens = sb(`select
  count(*) filter (where source_kind='historico' and deleted_at is null)::int as historico,
  count(*) filter (where source_kind='rapida' and deleted_at is null)::int as rapidas,
  count(*) filter (where deleted_at is null)::int as total
from public.dk_manutencao`);
console.log(JSON.stringify(contagens[0], null, 2));
if (Number(contagens[0].historico) !== 28 || Number(contagens[0].rapidas) !== 362 || Number(contagens[0].total) !== 390) {
  throw new Error("contagens PG divergentes após import");
}

const lidos = sb(`select source_kind, source_id, payload from public.dk_manutencao where deleted_at is null order by source_kind, source_id`);
const histPg = lidos.filter((r) => r.source_kind === "historico").map((r) => r.payload);
const rapPg = lidos.filter((r) => r.source_kind === "rapida").map((r) => r.payload);
const h2 = fidelidade.aggregateHash(histPg, "historico");
const r2 = fidelidade.aggregateHash(rapPg, "rapida");
const t2 = createHash("sha256").update(h2 + "\n" + r2, "utf8").digest("hex");
if (h2 !== hashHist || r2 !== hashRap || t2 !== hashTot) {
  throw new Error("round-trip hash divergente após import");
}
console.log("OK import manutencao 390/390 hashes iguais");
