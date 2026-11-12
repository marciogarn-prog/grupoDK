/**
 * Continuação REV2: restore isolado + testes + apply (usa dump já feito).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildBcNomenclaturaPdf, extractPdfTextProbe } = require("../lib/dk-bc-nomenclatura-pdf.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "vm-05-rev2");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const ISOLATED_PORT = Number(process.env.DK_BC_ISOLATED_PORT || 55432);
const PATCH = path.join(ROOT, "supabase", "dk-bc-vm-confirmacao-revisao2.sql");
const DB = "dk_bc_rev2";

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

function run(bin, args, env = {}, timeout = 120000) {
  return spawnSync(bin, args, {
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout,
  });
}

function psqlRemote(sql, password, timeout = 90000) {
  const tmp = path.join(OUT, `q-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, `SET ROLE postgres;\nSET search_path TO public, extensions;\n${sql}`, "utf8");
  const r = run(
    path.join(PG_BIN, "psql.exe"),
    ["-v", "ON_ERROR_STOP=1", "-f", tmp, "-A", "-F", "|", "-t", "-q"],
    {
      PGPASSWORD: password,
      PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
      PGPORT: "5432",
      PGUSER: "cli_login_postgres",
      PGDATABASE: "postgres",
      PGCONNECT_TIMEOUT: "20",
    },
    timeout
  );
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("psql_remote_timeout");
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || r.error || "").slice(0, 800));
  return String(r.stdout || "").trim();
}

function psqlLocal(sql, timeout = 60000) {
  const tmp = path.join(OUT, `l-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, `SET search_path TO public, extensions;\n${sql}`, "utf8");
  const r = run(
    path.join(PG_BIN, "psql.exe"),
    ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "-f", tmp, "-A", "-F", "|", "-t", "-q"],
    { PGPASSWORD: "dkbc" },
    timeout
  );
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 1000));
  return String(r.stdout || "").trim();
}

const dumps = fs
  .readdirSync(OUT)
  .filter((f) => f.endsWith(".dump"))
  .map((f) => ({ f, t: fs.statSync(path.join(OUT, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
if (!dumps.length) throw new Error("dump_missing");
const dumpPath = path.join(OUT, dumps[0].f);
const report = {
  started_at: new Date().toISOString(),
  comando: "05/10-revisao-2-cont",
  dump: {
    path: dumpPath,
    bytes: fs.statSync(dumpPath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpPath)).digest("hex"),
  },
};

console.error("restore...");
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
const restore = run(
  path.join(PG_BIN, "pg_restore.exe"),
  ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "--no-owner", "--role=postgres", dumpPath],
  { PGPASSWORD: "dkbc" },
  300000
);
report.restore_status = restore.status;

console.error("apply patch local...");
const apl = run(
  path.join(PG_BIN, "psql.exe"),
  ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "-f", PATCH],
  { PGPASSWORD: "dkbc" },
  120000
);
if (apl.status !== 0) {
  report.apply_local = { ok: false, err: String(apl.stderr || apl.stdout || "").slice(0, 1000) };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}
report.apply_local = { ok: true };

psqlLocal(`UPDATE public.dk_bc_vm SET status='ativa', colaborador_ref='TEST-COLAB-ISOLADO-REV2', updated_at=now() WHERE prefixo='A';`);

const tests = {};
tests.auth_preparada = psqlLocal(`SELECT ok::text, coalesce(reason,'') FROM public.dk_bc_vm_emitir_provisorio('aaaaaaaa-bbbb-cccc-dddd-0000000000b1'::uuid,'B','{}'::jsonb);`);
tests.auth_ativa = psqlLocal(`SELECT ok::text, coalesce(reason,''), idempotent::text, coalesce(prov_id,'') FROM public.dk_bc_vm_emitir_provisorio('aaaaaaaa-bbbb-cccc-dddd-0000000000a1'::uuid,'A','{"k":1}'::jsonb);`);
tests.idem_emit = psqlLocal(`SELECT ok::text, coalesce(reason,''), idempotent::text, coalesce(prov_id,'') FROM public.dk_bc_vm_emitir_provisorio('aaaaaaaa-bbbb-cccc-dddd-0000000000a1'::uuid,'A','{"k":1}'::jsonb);`);
tests.div_emit = psqlLocal(`SELECT ok::text, coalesce(reason,'') FROM public.dk_bc_vm_emitir_provisorio('aaaaaaaa-bbbb-cccc-dddd-0000000000a1'::uuid,'A','{"k":2}'::jsonb);`);
tests.confirm = psqlLocal(`SELECT ok::text, coalesce(reason,''), idempotent::text, coalesce(bc_composto,''), coalesce(bc_no::text,'') FROM public.dk_bc_vm_confirmar_oficial('aaaaaaaa-bbbb-cccc-dddd-0000000000a2'::uuid,'A','teste','rev2','isolamento','reg-rev2-a2','emp','fil','consolidado',null,'hash-rev2-a2','hist-rev2','{"k":9}'::jsonb);`);
tests.confirm_idem = psqlLocal(`SELECT ok::text, coalesce(reason,''), idempotent::text, coalesce(bc_composto,'') FROM public.dk_bc_vm_confirmar_oficial('aaaaaaaa-bbbb-cccc-dddd-0000000000a2'::uuid,'A','teste','rev2','isolamento','reg-rev2-a2','emp','fil','consolidado',null,'hash-rev2-a2','hist-rev2','{"k":9}'::jsonb);`);
tests.confirm_div = psqlLocal(`SELECT ok::text, coalesce(reason,'') FROM public.dk_bc_vm_confirmar_oficial('aaaaaaaa-bbbb-cccc-dddd-0000000000a2'::uuid,'A','teste','rev2','isolamento','reg-rev2-a2-DIFF','emp','fil','consolidado',null,'hash-rev2-a2','hist-rev2','{"k":9}'::jsonb);`);

const oidSame = "aaaaaaaa-bbbb-cccc-dddd-0000000000c1";
const sqlConc = `SELECT ok::text||','||coalesce(reason,'')||','||idempotent::text||','||coalesce(prov_id,'') FROM public.dk_bc_vm_emitir_provisorio('${oidSame}'::uuid,'A','{"c":1}'::jsonb);`;
const near = [];
for (let i = 0; i < 2; i++) {
  near.push(
    run(
      path.join(PG_BIN, "psql.exe"),
      ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "-c", sqlConc, "-A", "-t", "-q"],
      { PGPASSWORD: "dkbc" },
      30000
    )
  );
}
tests.concurrency_same_oid = {
  near: near.map((k) => String(k.stdout || "").trim()),
  prov_count: psqlLocal(`SELECT count(*)::text FROM public.dk_bc_vm_operacao WHERE operation_id='${oidSame}'::uuid;`),
  last_prov_A: psqlLocal(`SELECT last_prov_no::text FROM public.dk_bc_vm_state WHERE prefixo='A';`),
};

tests.two_ops = psqlLocal(`
SELECT ok::text, prov_id FROM public.dk_bc_vm_emitir_provisorio('aaaaaaaa-bbbb-cccc-dddd-0000000000d1'::uuid,'A','{"d":1}'::jsonb);
SELECT ok::text, prov_id FROM public.dk_bc_vm_emitir_provisorio('aaaaaaaa-bbbb-cccc-dddd-0000000000d2'::uuid,'A','{"d":2}'::jsonb);
`);

tests.tx_fail_ops = psqlLocal(`
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.dk_bc_vm_emitir_provisorio('aaaaaaaa-bbbb-cccc-dddd-0000000000e1'::uuid,'A','{"e":1}'::jsonb);
    RAISE EXCEPTION 'rollback_forcado';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
SELECT count(*)::text FROM public.dk_bc_vm_operacao WHERE operation_id='aaaaaaaa-bbbb-cccc-dddd-0000000000e1'::uuid;
`);

tests.counters = psqlLocal(`
SELECT 'last_bc', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
SELECT 'prov_A', last_prov_no::text FROM public.dk_bc_vm_state WHERE prefixo='A';
SELECT 'ops', count(*)::text FROM public.dk_bc_vm_operacao;
`).split(/\r?\n/);

report.tests = tests;

const pdfRaw = psqlLocal(
  `SELECT r.bc_id, r.bc_no::text, coalesce(r.origem,'-'), coalesce(r.estado,'-'), case when r.vigente then 't' else 'f' end, coalesce(o.bc_composto,'')
   FROM public.dk_bc_registro r
   LEFT JOIN public.dk_bc_vm_operacao o ON o.bc_id=r.bc_id AND o.status='confirmado_bc'
   ORDER BY r.bc_no, r.bc_id;`,
  120000
);
const pdfRows = pdfRaw.split(/\r?\n/).filter(Boolean).map((l) => {
  const p = l.split("|");
  return { bc_id: p[0], bc_no: Number(p[1]), origem: p[2], estado: p[3], vigente: p[4] === "t", bc_composto: p[5] || null };
});
const pdf = buildBcNomenclaturaPdf(pdfRows, { filename: "dk-bc-nomenclatura-rev2.pdf", generatedAt: new Date().toISOString() });
const pdfPath = path.join(OUT, pdf.filename);
fs.writeFileSync(pdfPath, pdf.buffer);
const probe = extractPdfTextProbe(pdf.buffer);
report.pdf = {
  ok: pdf.ok,
  reason: pdf.reason,
  path: pdfPath,
  rows: pdf.rows,
  bytes: pdf.buffer.length,
  sha256: crypto.createHash("sha256").update(pdf.buffer).digest("hex"),
  first: pdf.first,
  last: pdf.last,
  has_central: probe.extractedLines.some((l) => /CENTRAL-/.test(l)),
  pageCount: probe.pageCount,
  extractedLines: probe.extractedLines.length,
};

const truthy = (s) => /^(t|true)\|/i.test(String(s || "").trim());
const authOk =
  tests.auth_preparada.includes("vm_preparada_nao_autorizada") && truthy(tests.auth_ativa);
const idemOk = truthy(tests.idem_emit) && /\|(t|true)\|/i.test(tests.idem_emit);
const divOk = tests.div_emit.includes("conteudo_divergente");
const confOk = truthy(tests.confirm) && truthy(tests.confirm_idem) && /\|(t|true)\|/i.test(tests.confirm_idem);
const confDivOk = tests.confirm_div.includes("conteudo_divergente");
const concOk = tests.concurrency_same_oid.prov_count === "1";
const txOk = String(tests.tx_fail_ops || "").trim().split(/\r?\n/).pop() === "0";
const pdfOk = report.pdf.ok && !report.pdf.has_central && report.pdf.rows >= 3648;

report.gate = { authOk, idemOk, divOk, confOk, confDivOk, concOk, txOk, pdfOk };
report.gate_ok = authOk && idemOk && divOk && confOk && confDivOk && concOk && txOk && pdfOk;

console.error("gate", report.gate);

if (!report.gate_ok) {
  report.applied_official = false;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(3);
}

const password = getLoginPassword();
console.error("apply official...");
const wrapped = path.join(OUT, `apply-remote-${Date.now()}.sql`);
fs.writeFileSync(wrapped, `SET ROLE postgres;\nSET search_path TO public, extensions;\n` + fs.readFileSync(PATCH, "utf8"), "utf8");
const apr = run(
  path.join(PG_BIN, "psql.exe"),
  ["-v", "ON_ERROR_STOP=1", "-f", wrapped],
  {
    PGPASSWORD: password,
    PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
    PGPORT: "5432",
    PGUSER: "cli_login_postgres",
    PGDATABASE: "postgres",
    PGCONNECT_TIMEOUT: "20",
  },
  180000
);
try {
  fs.unlinkSync(wrapped);
} catch {}
if (apr.status !== 0) {
  report.applied_official = false;
  report.apply_remote_err = String(apr.stderr || apr.stdout || "").slice(0, 1000);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(4);
}
report.applied_official = true;

report.official_after = psqlRemote(
  `SELECT 'bc_all', count(*)::text FROM public.dk_bc_registro;
   SELECT 'bc_vig', count(*)::text FROM public.dk_bc_registro WHERE vigente;
   SELECT 'last', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT 'vms', count(*)::text FROM public.dk_bc_vm;
   SELECT 'vm_status', string_agg(prefixo||':'||status||':'||coalesce(nullif(btrim(colaborador_ref),''),'-'), ',' ORDER BY prefixo) FROM public.dk_bc_vm;
   SELECT 'prov_sum', coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT 'vm_ops', count(*)::text FROM public.dk_bc_vm_operacao;`,
  password
).split(/\r?\n/);

report.official_block_probe = psqlRemote(
  `SELECT ok::text, coalesce(reason,'') FROM public.dk_bc_vm_emitir_provisorio('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,'A','{}'::jsonb);`,
  password
);

report.finished_at = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
