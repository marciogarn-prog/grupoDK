/**
 * Gera PDF de nomenclatura BC via psql (sem PII). Comprovação ADENDO 01.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildBcNomenclaturaPdf } = require("../lib/dk-bc-nomenclatura-pdf.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "numeracao-03-rev1");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";

fs.mkdirSync(OUT_DIR, { recursive: true });

function getLoginPassword() {
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "supabase", "db", "dump", "--remote", "--dry-run", "-f", "NUL"],
    { cwd: ROOT, encoding: "utf8", shell: true }
  );
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  const m = out.match(/PGPASSWORD="([^"]+)"/);
  if (!m) throw new Error("login_role_password_unavailable");
  return m[1];
}

const password = getLoginPassword();
const sql = `SET ROLE postgres;
SET search_path TO public, extensions;
SELECT bc_id, bc_no::text, origem, estado
FROM public.dk_bc_registro
WHERE vigente
ORDER BY bc_no;`;
const tmp = path.join(OUT_DIR, `list-${Date.now()}.sql`);
fs.writeFileSync(tmp, sql, "utf8");
const r = spawnSync(
  path.join(PG_BIN, "psql.exe"),
  ["-v", "ON_ERROR_STOP=1", "-f", tmp, "-A", "-F", "\t", "-t", "-q"],
  {
    env: {
      ...process.env,
      PGPASSWORD: password,
      PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
      PGPORT: "5432",
      PGUSER: "cli_login_postgres",
      PGDATABASE: "postgres",
    },
    encoding: "utf8",
  }
);
try {
  fs.unlinkSync(tmp);
} catch {}
if (r.status !== 0) {
  console.error(String(r.stderr || r.stdout || "").slice(0, 400));
  process.exit(1);
}

const rows = String(r.stdout || "")
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => {
    const p = l.split("\t");
    return { bc_id: p[0], bc_no: Number(p[1]), origem: p[2], estado: p[3] };
  });

const pdf = buildBcNomenclaturaPdf(rows, {
  filename: "dk-bc-nomenclatura-comprovacao-rev1.pdf",
  generatedAt: new Date().toISOString(),
});
const outPath = path.join(OUT_DIR, pdf.filename);
fs.writeFileSync(outPath, pdf.buffer);
const sha256 = crypto.createHash("sha256").update(pdf.buffer).digest("hex");
console.log(
  JSON.stringify(
    {
      ok: true,
      path: outPath,
      bytes: pdf.buffer.length,
      rows: pdf.rows,
      first: pdf.first,
      last: pdf.last,
      sha256,
    },
    null,
    2
  )
);
