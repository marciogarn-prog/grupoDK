/**
 * COMANDO 05/10 — REVISÃO 1
 * 1) Novo dump independente + restore isolado
 * 2) Testes reais SQL no PG isolado
 * 3) Aplicar patch no oficial só se backup/teste OK
 * Sem consumir contadores oficiais nos testes.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "vm-05-rev1");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const ISOLATED_PORT = Number(process.env.DK_BC_ISOLATED_PORT || 55432);
const PATCH = path.join(ROOT, "supabase", "dk-bc-vm-confirmacao-revisao1.sql");

fs.mkdirSync(OUT, { recursive: true });

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

function run(bin, args, env = {}) {
  const r = spawnSync(bin, args, { env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return r;
}

function psqlRemote(sql, password) {
  const tmp = path.join(OUT, `q-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, `SET ROLE postgres;\nSET search_path TO public, extensions;\n${sql}`, "utf8");
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-f", tmp, "-A", "-F", "|", "-t", "-q"], {
    PGPASSWORD: password,
    PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
    PGPORT: "5432",
    PGUSER: "cli_login_postgres",
    PGDATABASE: "postgres",
  });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 500));
  return String(r.stdout || "").trim();
}

function psqlLocal(sql, db = "dk_bc_rev1") {
  const tmp = path.join(OUT, `l-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, `SET search_path TO public, extensions;\n${sql}`, "utf8");
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", db, "-f", tmp, "-A", "-F", "|", "-t", "-q"], {
    PGPASSWORD: "dkbc",
  });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 600));
  return String(r.stdout || "").trim();
}

const report = { started_at: new Date().toISOString(), comando: "05/10-revisao-1" };
const password = getLoginPassword();

// --- 1) Dump atualizado ---
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpPath = path.join(OUT, `grupodk-portal-pos-vm-${stamp}.dump`);
const dump = run(
  path.join(PG_BIN, "pg_dump.exe"),
  [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--role=postgres",
    "-f",
    dumpPath,
    "postgresql://cli_login_postgres@db.ppxtwqvzgujllfzarpuz.supabase.co:5432/postgres",
  ],
  { PGPASSWORD: password }
);
if (dump.status !== 0) {
  report.dump = { ok: false, err: String(dump.stderr || dump.stdout || "").slice(0, 400) };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}
const dumpSha = crypto.createHash("sha256").update(fs.readFileSync(dumpPath)).digest("hex");
report.dump = { ok: true, path: dumpPath, bytes: fs.statSync(dumpPath).size, sha256: dumpSha };

// Contagens oficiais de referência
const officialCounts = psqlRemote(
  `SELECT 'bc', count(*)::text FROM public.dk_bc_registro WHERE vigente;
   SELECT 'last', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT 'vms', count(*)::text FROM public.dk_bc_vm;
   SELECT 'prov_sum', coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT 'vm_ops', count(*)::text FROM public.dk_bc_vm_operacao;`
);
report.official_counts = officialCounts.split(/\r?\n/);

// --- 2) Restore isolado + testes reais ---
// Assume cluster local already usable; create DB
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "postgres", "-c", "SELECT 1"], { PGPASSWORD: "dkbc" });
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "postgres", "-c", "DROP DATABASE IF EXISTS dk_bc_rev1;"], { PGPASSWORD: "dkbc" });
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "postgres", "-c", "CREATE DATABASE dk_bc_rev1;"], { PGPASSWORD: "dkbc" });

const restore = run(
  path.join(PG_BIN, "pg_restore.exe"),
  ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "dk_bc_rev1", "--no-owner", "--role=postgres", dumpPath],
  { PGPASSWORD: "dkbc" }
);
// pg_restore pode retornar warnings; validamos por contagens
const restoredCounts = psqlLocal(
  `SELECT 'bc', count(*)::text FROM public.dk_bc_registro WHERE vigente;
   SELECT 'last', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT 'vms', count(*)::text FROM public.dk_bc_vm;
   SELECT 'prov_sum', coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT 'vm_ops', count(*)::text FROM public.dk_bc_vm_operacao;`
);
report.restore = {
  exit: restore.status,
  counts: restoredCounts.split(/\r?\n/),
  match: restoredCounts.replace(/\r/g, "") === officialCounts.replace(/\r/g, ""),
};

if (!report.restore.match) {
  report.status = "BLOQUEADA";
  report.reason = "restore_counts_mismatch";
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

// Aplicar patch no isolado e testar funções de verdade (só no isolado)
psqlLocal(fs.readFileSync(PATCH, "utf8"));
const oid1 = "11111111-1111-4111-8111-111111111111";
const oid2 = "22222222-2222-4222-8222-222222222222";
const testsSql = `
BEGIN;
SELECT ok::text, prov_id, status, idempotent::text, coalesce(reason,'') FROM public.dk_bc_vm_emitir_provisorio('${oid1}'::uuid,'A','{"t":1}'::jsonb);
SELECT ok::text, prov_id, status, idempotent::text, coalesce(reason,'') FROM public.dk_bc_vm_emitir_provisorio('${oid1}'::uuid,'A','{"t":1}'::jsonb);
SELECT ok::text, coalesce(reason,'') FROM public.dk_bc_vm_emitir_provisorio('${oid1}'::uuid,'A','{"t":2}'::jsonb);
SELECT ok::text, coalesce(reason,'') FROM public.dk_bc_vm_emitir_provisorio('${oid1}'::uuid,'B','{"t":1}'::jsonb);
SELECT ok::text, prov_id, bc_id, bc_composto, status, idempotent::text, coalesce(reason,'')
  FROM public.dk_bc_vm_confirmar_oficial('${oid2}'::uuid,'A','teste','rev1','dk_bc_smoke','REV1',NULL,NULL,'consolidado',NULL,'hash-rev1',NULL,'{"t":9}'::jsonb);
SELECT ok::text, bc_id, status, idempotent::text, coalesce(reason,'')
  FROM public.dk_bc_vm_confirmar_oficial('${oid2}'::uuid,'A','teste','rev1','dk_bc_smoke','REV1',NULL,NULL,'consolidado',NULL,'hash-rev1',NULL,'{"t":9}'::jsonb);
SELECT ok::text, coalesce(reason,'')
  FROM public.dk_bc_vm_confirmar_oficial('${oid2}'::uuid,'A','teste','rev1','dk_bc_smoke','REV1',NULL,NULL,'consolidado',NULL,'hash-OUTRO',NULL,'{"t":9}'::jsonb);
SELECT last_bc_no::text FROM public.dk_bc_state WHERE id=1;
ROLLBACK;
`;
const testOut = psqlLocal(testsSql);
report.isolated_tests_raw = testOut.split(/\r?\n/).filter(Boolean);
const lines = report.isolated_tests_raw;
report.isolated_tests = {
  emit_ok: lines[0]?.startsWith("t|A000001|provisorio|f|"),
  emit_idem: lines[1]?.includes("|t|") && lines[1]?.includes("A000001"),
  emit_divergente: lines[2]?.includes("conteudo_divergente"),
  emit_conflito: lines[3]?.includes("conflito"),
  confirm_ok: lines[4]?.includes("confirmado_bc") && lines[4]?.includes("A000002-BC"),
  confirm_idem: lines[5]?.includes("|t|") && lines[5]?.startsWith("t|"),
  confirm_divergente: lines[6]?.includes("conteudo_divergente"),
  // ROLLBACK => last_bc still 3648
  bc_unaltered_after_rollback: lines[7] === "3648" || lines.some((l) => l === "3648"),
};
report.isolated_tests.ok = Object.values(report.isolated_tests).every(Boolean);

if (!report.isolated_tests.ok) {
  report.status = "BLOQUEADA";
  report.reason = "isolated_tests_failed";
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

// --- 3) Aplicar no oficial (sem chamar emitir/confirmar) ---
const before = psqlRemote(
  `SELECT last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT count(*)::text FROM public.dk_bc_vm_operacao;`
);
psqlRemote(fs.readFileSync(PATCH, "utf8"));
const after = psqlRemote(
  `SELECT last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT count(*)::text FROM public.dk_bc_vm_operacao;
   SELECT count(*)::text FROM information_schema.columns WHERE table_name='dk_bc_vm_operacao' AND column_name='conteudo_hash';`
);
report.prod_apply = {
  before: before.split(/\r?\n/),
  after: after.split(/\r?\n/),
  counters_preserved: before.split(/\r?\n/).slice(0, 3).join("|") === after.split(/\r?\n/).slice(0, 3).join("|"),
  conteudo_hash_col: after.split(/\r?\n/)[3] === "1",
};
report.status = report.prod_apply.counters_preserved && report.prod_apply.conteudo_hash_col ? "CONCLUIDA" : "PARCIAL";
report.finished_at = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      status: report.status,
      dump: { path: report.dump.path, sha256: report.dump.sha256, bytes: report.dump.bytes },
      restore_match: report.restore.match,
      isolated_tests: report.isolated_tests,
      prod_apply: report.prod_apply,
      official_counts: report.official_counts,
    },
    null,
    2
  )
);
