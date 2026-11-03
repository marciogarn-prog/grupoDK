/**
 * Liga a fonte operacional de Manutenção para public.dk_manutencao (Redis flag).
 * Não apaga snapshot. Exige 390/390 já importados.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { definirFonteManutencao, FONTE, FLAG_REDIS } = require("../lib/dk-manutencao-fonte.cjs");
const aqui = path.dirname(fileURLToPath(import.meta.url));

function sb(query) {
  const arquivo = path.join(os.tmpdir(), "dk-cutover-" + Date.now() + ".sql");
  fs.writeFileSync(arquivo, query.endsWith(";") ? query : query + ";", "utf8");
  try {
    const bruto = execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["--yes", "supabase", "db", "query", "--remote", "--read-only", "-f", arquivo, "-o", "json"],
      {
        cwd: path.join(aqui, ".."),
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      }
    );
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

const cont = sb(`select
  count(*) filter (where source_kind='historico' and deleted_at is null)::int as hist,
  count(*) filter (where source_kind='rapida' and deleted_at is null)::int as rap,
  count(*) filter (where deleted_at is null)::int as total
from public.dk_manutencao`);
if (Number(cont[0]?.hist) !== 28 || Number(cont[0]?.rap) !== 362 || Number(cont[0]?.total) !== 390) {
  console.error("PARAR — contagens PG inválidas", cont[0]);
  process.exit(1);
}

const out = await definirFonteManutencao(FONTE);
if (!out.ok) {
  console.error("PARAR — Redis", out);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, flag: FLAG_REDIS, fonte: FONTE, ...cont[0] }, null, 2));
