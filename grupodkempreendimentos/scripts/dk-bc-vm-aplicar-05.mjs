/**
 * COMANDO 05/10 — aplica ponte confirmação VM↔BC (aditivo).
 * NÃO emite provisórios nem consome BC no oficial.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "vm-05");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const SQL_FILE = path.join(ROOT, "supabase", "dk-bc-vm-confirmacao.sql");
const BACKUP_DIR = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP");

fs.mkdirSync(OUT_DIR, { recursive: true });

function getLoginPassword() {
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "supabase", "db", "dump", "--remote", "--dry-run", "-f", "NUL"],
    { cwd: ROOT, encoding: "utf8", shell: true }
  );
  const m = `${r.stdout || ""}\n${r.stderr || ""}`.match(/PGPASSWORD="([^"]+)"/);
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
  const r = spawnSync(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-f", tmp, "-A", "-F", "|", "-t", "-q"], {
    env,
    encoding: "utf8",
  });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.status !== 0) throw new Error(`psql_failed: ${String(r.stderr || r.stdout || "").slice(0, 500)}`);
  return String(r.stdout || "").trim();
}

function findBackup() {
  const dumps = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /\.dump$/i.test(f))
    .map((f) => {
      const p = path.join(BACKUP_DIR, f);
      return { path: p, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return dumps[0] || null;
}

const report = { started_at: new Date().toISOString(), comando: "05/10" };
const backup = findBackup();
report.backup = backup
  ? { ok: true, path: backup.path, sha256: crypto.createHash("sha256").update(fs.readFileSync(backup.path)).digest("hex") }
  : { ok: false };

const t1 = spawnSync(process.execPath, [path.join(ROOT, "scripts", "test-dk-bc-vm-identidades.mjs")], { cwd: ROOT, encoding: "utf8" });
const t2 = spawnSync(process.execPath, [path.join(ROOT, "scripts", "test-dk-bc-vm-confirmacao.mjs")], { cwd: ROOT, encoding: "utf8" });
report.tests = {
  identidades: t1.status === 0,
  confirmacao: t2.status === 0,
  tails: {
    identidades: String(t1.stdout || "").trim().split(/\r?\n/).slice(-2),
    confirmacao: String(t2.stdout || "").trim().split(/\r?\n/).slice(-2),
  },
};

if (!report.backup.ok || !report.tests.identidades || !report.tests.confirmacao) {
  report.status = "BLOQUEADA";
  fs.writeFileSync(path.join(OUT_DIR, `report-${Date.now()}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

const password = getLoginPassword();
const before = psql(
  `SELECT last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT count(*)::text FROM public.dk_bc_vm_operacao;`,
  password
);

psql(fs.readFileSync(SQL_FILE, "utf8"), password);

const after = psql(
  `SELECT last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT count(*)::text FROM public.dk_bc_vm_operacao;
   SELECT to_regprocedure('public.dk_bc_vm_confirmar_oficial(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb)')::text;`,
  password
);

report.before = before.split(/\r?\n/);
report.after = after.split(/\r?\n/);
report.counters_preserved =
  report.before[0] === report.after[0] &&
  report.before[1] === report.after[1] &&
  report.before[2] === report.after[2];
report.function_installed = /dk_bc_vm_confirmar_oficial/.test(report.after[3] || "");
report.status = report.counters_preserved && report.function_installed ? "CONCLUIDA" : "PARCIAL";
report.finished_at = new Date().toISOString();
const out = path.join(OUT_DIR, `report-${Date.now()}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, out, before: report.before, after: report.after, counters_preserved: report.counters_preserved }, null, 2));
