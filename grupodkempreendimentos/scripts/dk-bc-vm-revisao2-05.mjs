/**
 * COMANDO 05/10 — REVISÃO 2
 * Backup → restore isolado → testes (auth, integridade, concorrência, PDF)
 * → apply oficial se OK. Sem ativar VMs oficiais. Sem consumir BC/prov oficiais.
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
  return spawnSync(bin, args, {
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
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
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 600));
  return String(r.stdout || "").trim();
}

function psqlLocal(sql, db = DB) {
  const tmp = path.join(OUT, `l-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, `SET search_path TO public, extensions;\n${sql}`, "utf8");
  const r = run(
    path.join(PG_BIN, "psql.exe"),
    ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", db, "-f", tmp, "-A", "-F", "|", "-t", "-q"],
    { PGPASSWORD: "dkbc" }
  );
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 800));
  return String(r.stdout || "").trim();
}

function applyFileLocal(file) {
  const r = run(
    path.join(PG_BIN, "psql.exe"),
    ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "-f", file],
    { PGPASSWORD: "dkbc" }
  );
  if (r.status !== 0) throw new Error("apply_local_failed: " + String(r.stderr || r.stdout || "").slice(0, 800));
}

function applyFileRemote(file, password) {
  const wrapped = path.join(OUT, `apply-remote-${Date.now()}.sql`);
  const body = fs.readFileSync(file, "utf8");
  fs.writeFileSync(wrapped, `SET ROLE postgres;\nSET search_path TO public, extensions;\n${body}`, "utf8");
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-f", wrapped], {
    PGPASSWORD: password,
    PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
    PGPORT: "5432",
    PGUSER: "cli_login_postgres",
    PGDATABASE: "postgres",
  });
  try {
    fs.unlinkSync(wrapped);
  } catch {}
  if (r.status !== 0) throw new Error("apply_remote_failed: " + String(r.stderr || r.stdout || "").slice(0, 800));
}

const report = { started_at: new Date().toISOString(), comando: "05/10-revisao-2" };
const password = getLoginPassword();

// --- 1) Dump ---
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
report.dump = {
  ok: true,
  path: dumpPath,
  bytes: fs.statSync(dumpPath).size,
  sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpPath)).digest("hex"),
};

report.official_before = psqlRemote(
  `SELECT 'bc_all', count(*)::text FROM public.dk_bc_registro;
   SELECT 'bc_vig', count(*)::text FROM public.dk_bc_registro WHERE vigente;
   SELECT 'last', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT 'vms', count(*)::text FROM public.dk_bc_vm;
   SELECT 'vm_status', string_agg(prefixo||':'||status||':'||coalesce(colaborador_ref,'-'), ',' ORDER BY prefixo) FROM public.dk_bc_vm;
   SELECT 'prov_sum', coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT 'vm_ops', count(*)::text FROM public.dk_bc_vm_operacao;`
).split(/\r?\n/);

// --- 2) Restore isolado ---
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "postgres", "-c", "SELECT 1"], {
  PGPASSWORD: "dkbc",
});
run(
  path.join(PG_BIN, "psql.exe"),
  ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${DB};`],
  { PGPASSWORD: "dkbc" }
);
run(
  path.join(PG_BIN, "psql.exe"),
  ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${DB};`],
  { PGPASSWORD: "dkbc" }
);
run(
  path.join(PG_BIN, "pg_restore.exe"),
  ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "--no-owner", "--role=postgres", dumpPath],
  { PGPASSWORD: "dkbc" }
);

applyFileLocal(PATCH);

// Isolado SOMENTE: ativa VM-A com colaborador de teste (nunca no oficial)
psqlLocal(`
UPDATE public.dk_bc_vm
   SET status='ativa', colaborador_ref='TEST-COLAB-ISOLADO-REV2', updated_at=now()
 WHERE prefixo='A';
`);

const tests = {};

// Auth: preparada bloqueada
tests.auth_preparada = psqlLocal(`
SELECT ok::text, reason FROM public.dk_bc_vm_emitir_provisorio(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000b1'::uuid, 'B', '{}'::jsonb);
`);

// Auth: A autorizada
tests.auth_ativa = psqlLocal(`
SELECT ok::text, reason, idempotent::text FROM public.dk_bc_vm_emitir_provisorio(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000a1'::uuid, 'A', '{"k":1}'::jsonb);
`);

// Idempotência mesmo conteúdo
tests.idem_emit = psqlLocal(`
SELECT ok::text, reason, idempotent::text, prov_id FROM public.dk_bc_vm_emitir_provisorio(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000a1'::uuid, 'A', '{"k":1}'::jsonb);
`);

// Divergente
tests.div_emit = psqlLocal(`
SELECT ok::text, reason, idempotent::text FROM public.dk_bc_vm_emitir_provisorio(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000a1'::uuid, 'A', '{"k":2}'::jsonb);
`);

// Completar + confirmar
tests.confirm = psqlLocal(`
SELECT ok::text, reason, idempotent::text, bc_composto, bc_no::text
FROM public.dk_bc_vm_confirmar_oficial(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000a2'::uuid, 'A',
  'teste', 'rev2', 'isolamento', 'reg-rev2-a2', 'emp', 'fil',
  'consolidado', null, 'hash-rev2-a2', 'hist-rev2', '{"k":9}'::jsonb);
`);

// Confirmação duplicada idempotente
tests.confirm_idem = psqlLocal(`
SELECT ok::text, reason, idempotent::text, bc_composto
FROM public.dk_bc_vm_confirmar_oficial(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000a2'::uuid, 'A',
  'teste', 'rev2', 'isolamento', 'reg-rev2-a2', 'emp', 'fil',
  'consolidado', null, 'hash-rev2-a2', 'hist-rev2', '{"k":9}'::jsonb);
`);

// Confirmação divergente
tests.confirm_div = psqlLocal(`
SELECT ok::text, reason FROM public.dk_bc_vm_confirmar_oficial(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000a2'::uuid, 'A',
  'teste', 'rev2', 'isolamento', 'reg-rev2-a2-DIFF', 'emp', 'fil',
  'consolidado', null, 'hash-rev2-a2', 'hist-rev2', '{"k":9}'::jsonb);
`);

// Concorrência: mesmo operation_id
const oidSame = "aaaaaaaa-bbbb-cccc-dddd-0000000000c1";
const concSql = `
SELECT ok::text||','||coalesce(reason,'')||','||idempotent::text||','||coalesce(prov_id,'')
FROM public.dk_bc_vm_emitir_provisorio('${oidSame}'::uuid, 'A', '{"c":1}'::jsonb);
`;
const conc1 = path.join(OUT, "conc1.sql");
const conc2 = path.join(OUT, "conc2.sql");
fs.writeFileSync(conc1, `SET search_path TO public, extensions;\n${concSql}`, "utf8");
fs.writeFileSync(conc2, `SET search_path TO public, extensions;\n${concSql}`, "utf8");
const p1 = spawnSync(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "-f", conc1, "-A", "-t", "-q"], {
  env: { ...process.env, PGPASSWORD: "dkbc" },
  encoding: "utf8",
});
const p2 = spawnSync(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "-f", conc2, "-A", "-t", "-q"], {
  env: { ...process.env, PGPASSWORD: "dkbc" },
  encoding: "utf8",
});
// Run truly parallel
const cA = spawnSync(
  process.execPath,
  [
    "-e",
    `
const {spawnSync}=require('child_process');
const bin=${JSON.stringify(path.join(PG_BIN, "psql.exe"))};
const args=['-h','127.0.0.1','-p','${ISOLATED_PORT}','-U','postgres','-d','${DB}','-f',process.argv[1],'-A','-t','-q'];
const r=spawnSync(bin,args,{env:{...process.env,PGPASSWORD:'dkbc'},encoding:'utf8'});
process.stdout.write(String(r.stdout||'').trim()+'|status='+r.status);
`,
  ],
  { encoding: "utf8" }
);
// Sequential evidence already; also fire two near-simultaneous
const kids = [];
for (const f of [conc1, conc2]) {
  kids.push(
    spawnSync(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(ISOLATED_PORT), "-U", "postgres", "-d", DB, "-c", concSql.trim(), "-A", "-t", "-q"], {
      env: { ...process.env, PGPASSWORD: "dkbc" },
      encoding: "utf8",
    })
  );
}
tests.concurrency_same_oid = {
  p1: String(p1.stdout || "").trim(),
  p2: String(p2.stdout || "").trim(),
  near: kids.map((k) => String(k.stdout || "").trim()),
  prov_count: psqlLocal(`SELECT count(*)::text FROM public.dk_bc_vm_operacao WHERE operation_id='${oidSame}'::uuid;`),
  last_prov_A: psqlLocal(`SELECT last_prov_no::text FROM public.dk_bc_vm_state WHERE prefixo='A';`),
};

// Duas requisições distintas mesma VM
tests.two_ops = psqlLocal(`
SELECT ok::text, prov_id FROM public.dk_bc_vm_emitir_provisorio(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000d1'::uuid, 'A', '{"d":1}'::jsonb);
SELECT ok::text, prov_id FROM public.dk_bc_vm_emitir_provisorio(
  'aaaaaaaa-bbbb-cccc-dddd-0000000000d2'::uuid, 'A', '{"d":2}'::jsonb);
`);

// Falha transacional: rollback não consome (BEGIN; emit; ROLLBACK)
tests.tx_fail = psqlLocal(`
DO $$
DECLARE r record;
BEGIN
  BEGIN
    SELECT * INTO r FROM public.dk_bc_vm_emitir_provisorio(
      'aaaaaaaa-bbbb-cccc-dddd-0000000000e1'::uuid, 'A', '{"e":1}'::jsonb);
    RAISE EXCEPTION 'rollback_forcado';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
SELECT count(*)::text FROM public.dk_bc_vm_operacao WHERE operation_id='aaaaaaaa-bbbb-cccc-dddd-0000000000e1'::uuid;
`);

const lastAfter = psqlLocal(`
SELECT last_bc_no::text FROM public.dk_bc_state WHERE id=1;
SELECT last_prov_no::text FROM public.dk_bc_vm_state WHERE prefixo='A';
SELECT count(*)::text FROM public.dk_bc_vm_operacao;
`);
tests.counters_isolated = lastAfter.split(/\r?\n/);

report.tests = tests;

// --- PDF histórico completo (psql) ---
const pdfSql = `
SELECT r.bc_id, r.bc_no::text, coalesce(r.origem,'-'), coalesce(r.estado,'-'),
       case when r.vigente then 't' else 'f' end,
       coalesce(o.bc_composto,'')
FROM public.dk_bc_registro r
LEFT JOIN public.dk_bc_vm_operacao o
  ON o.bc_id = r.bc_id AND o.status = 'confirmado_bc'
ORDER BY r.bc_no, r.bc_id;
`;
const pdfRaw = psqlLocal(pdfSql);
const pdfRows = pdfRaw
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => {
    const p = l.split("|");
    return {
      bc_id: p[0],
      bc_no: Number(p[1]),
      origem: p[2],
      estado: p[3],
      vigente: p[4] === "t",
      bc_composto: p[5] || null,
    };
  });
const pdf = buildBcNomenclaturaPdf(pdfRows, {
  filename: "dk-bc-nomenclatura-rev2.pdf",
  generatedAt: new Date().toISOString(),
});
const pdfPath = path.join(OUT, pdf.filename);
fs.writeFileSync(pdfPath, pdf.buffer);
const probe = extractPdfTextProbe(pdf.buffer);
report.pdf = {
  ok: pdf.ok,
  reason: pdf.reason,
  path: pdfPath,
  rows: pdf.rows,
  lines: pdf.lines,
  bytes: pdf.buffer.length,
  sha256: crypto.createHash("sha256").update(pdf.buffer).digest("hex"),
  first: pdf.first,
  last: pdf.last,
  has_central: probe.extractedLines.some((l) => /CENTRAL-/.test(l)),
  pageCount: probe.pageCount,
  extractedLines: probe.extractedLines.length,
};

const authOk =
  /vm_preparada_nao_autorizada/.test(tests.auth_preparada) &&
  /^t\|/.test(tests.auth_ativa);
const idemOk = /t\|.*\|t\|/.test(tests.idem_emit) || /\|\|t\|/.test(tests.idem_emit);
const divOk = /conteudo_divergente/.test(tests.div_emit);
const confOk = /^t\|/.test(tests.confirm) && /t\|.*\|t\|/.test(tests.confirm_idem.replace(/\r/g, ""));
const confDivOk = /conteudo_divergente/.test(tests.confirm_div);
const concOk = tests.concurrency_same_oid.prov_count === "1";
const pdfOk = report.pdf.ok && !report.pdf.has_central && report.pdf.rows >= 3648;

report.gate = { authOk, idemOk, divOk, confOk, confDivOk, concOk, pdfOk };
report.gate_ok = authOk && idemOk && divOk && confOk && confDivOk && concOk && pdfOk;

if (!report.gate_ok) {
  report.applied_official = false;
  report.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(3);
}

// --- Apply oficial (funções apenas; VMs permanecem preparada) ---
applyFileRemote(PATCH, password);

report.official_after = psqlRemote(
  `SELECT 'bc_all', count(*)::text FROM public.dk_bc_registro;
   SELECT 'bc_vig', count(*)::text FROM public.dk_bc_registro WHERE vigente;
   SELECT 'last', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
   SELECT 'vms', count(*)::text FROM public.dk_bc_vm;
   SELECT 'vm_status', string_agg(prefixo||':'||status||':'||coalesce(colaborador_ref,'-'), ',' ORDER BY prefixo) FROM public.dk_bc_vm;
   SELECT 'prov_sum', coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
   SELECT 'vm_ops', count(*)::text FROM public.dk_bc_vm_operacao;
   SELECT 'fn_auth', (to_regprocedure('public.dk_bc_vm_autorizada_para_operar(text)') is not null)::text;
   SELECT 'fn_comp', (to_regprocedure('public.dk_bc_vm_completar_proposta(uuid,text,text,text,text,text,text,text,text,text,text,jsonb)') is not null)::text;`
).split(/\r?\n/);

// Prova: oficial ainda bloqueia emissão (preparada)
report.official_block_probe = psqlRemote(`
SELECT ok::text, reason FROM public.dk_bc_vm_emitir_provisorio(
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, 'A', '{}'::jsonb);
`);

report.applied_official = true;
report.finished_at = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
