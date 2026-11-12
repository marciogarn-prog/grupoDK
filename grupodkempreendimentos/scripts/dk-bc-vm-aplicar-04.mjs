/**
 * COMANDO 04/10 — aplica estrutura A–J no PostgreSQL oficial após backup + testes.
 * Sem deploy, sem merge main, sem alterar APIs/telas.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "vm-04");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const SQL_FILE = path.join(ROOT, "supabase", "dk-bc-vm-identidades.sql");
const BACKUP_DIR = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP");

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

function psql(sql, password) {
  const env = {
    ...process.env,
    PGPASSWORD: password,
    PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
    PGPORT: "5432",
    PGUSER: "cli_login_postgres",
    PGDATABASE: "postgres",
  };
  const wrapped = `SET ROLE postgres;\nSET search_path TO public, extensions;\n${sql}`;
  const tmp = path.join(OUT_DIR, `q-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.sql`);
  fs.writeFileSync(tmp, wrapped, "utf8");
  const r = spawnSync(
    path.join(PG_BIN, "psql.exe"),
    ["-v", "ON_ERROR_STOP=1", "-f", tmp, "-A", "-F", "|", "-t", "-q"],
    { env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.status !== 0) {
    throw new Error(`psql_failed: ${String(r.stderr || r.stdout || "").slice(0, 500)}`);
  }
  return String(r.stdout || "").trim();
}

function findBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const dumps = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /\.dump$/i.test(f))
    .map((f) => {
      const p = path.join(BACKUP_DIR, f);
      const st = fs.statSync(p);
      return { path: p, mtime: st.mtimeMs, size: st.size };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return dumps[0] || null;
}

function runMemoryTests() {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "test-dk-bc-vm-identidades.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { status: r.status, out: `${r.stdout || ""}\n${r.stderr || ""}` };
}

const report = {
  started_at: new Date().toISOString(),
  comando: "04/10",
  backup: null,
  tests: null,
  apply: null,
  verify: null,
};

const backup = findBackup();
report.backup = backup
  ? {
      ok: true,
      path: backup.path,
      size: backup.size,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(backup.path)).digest("hex"),
    }
  : { ok: false, reason: "dump_independente_ausente" };

const tests = runMemoryTests();
report.tests = { ok: tests.status === 0, output_tail: tests.out.trim().split(/\r?\n/).slice(-5) };

if (!report.backup.ok || !report.tests.ok) {
  report.status = "BLOQUEADA";
  report.reason = !report.backup.ok ? "backup_obrigatorio" : "testes_falharam";
  fs.writeFileSync(path.join(OUT_DIR, `report-apply-${Date.now()}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

const password = getLoginPassword();
const sql = fs.readFileSync(SQL_FILE, "utf8");
psql(sql, password);
report.apply = { ok: true, sql_sha256: crypto.createHash("sha256").update(sql).digest("hex") };

// Não chama dk_bc_vm_emitir_provisorio no oficial (proibido consumir códigos reais nos testes).
const verify = psql(
  `SELECT count(*)::text FROM public.dk_bc_vm;
   SELECT prefixo || '|' || vm_id || '|' || status || '|' || last_prov_no::text
     FROM public.dk_bc_vm_estado()
    ORDER BY 1;
   SELECT to_regclass('public.dk_bc_vm_operacao')::text,
          to_regclass('public.dk_bc_vm_state')::text,
          (SELECT sum(last_prov_no)::text FROM public.dk_bc_vm_state);`,
  password
);
report.verify = { raw: verify.split(/\r?\n/).filter(Boolean) };
report.finished_at = new Date().toISOString();
report.status = "CONCLUIDA";
const out = path.join(OUT_DIR, `report-apply-${Date.now()}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, report: out, backup: report.backup.path, verify: report.verify.raw }, null, 2));
