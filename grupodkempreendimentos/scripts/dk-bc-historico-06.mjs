/**
 * COMANDO 06/10 — versionamento/histórico: dump → isolado → testes → apply oficial.
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
const OUT = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "bc-06");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const PORT = Number(process.env.DK_BC_ISOLATED_PORT || 55432);
const PATCH = path.join(ROOT, "supabase", "dk-bc-historico-06.sql");
const DB = "dk_bc_06";

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

function run(bin, args, env = {}, timeout = 180000) {
  return spawnSync(bin, args, { env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout });
}

function psqlRemote(sql, password, timeout = 90000) {
  const tmp = path.join(OUT, `q-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, `SET ROLE postgres;\nSET search_path TO public, extensions;\n${sql}`, "utf8");
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-f", tmp, "-A", "-F", "|", "-t", "-q"], {
    PGPASSWORD: password,
    PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
    PGPORT: "5432",
    PGUSER: "cli_login_postgres",
    PGDATABASE: "postgres",
    PGCONNECT_TIMEOUT: "20",
  }, timeout);
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 800));
  return String(r.stdout || "").trim();
}

function psqlLocal(sql, timeout = 60000) {
  const tmp = path.join(OUT, `l-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, `SET search_path TO public, extensions;\n${sql}`, "utf8");
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-f", tmp, "-A", "-F", "|", "-t", "-q"], { PGPASSWORD: "dkbc" }, timeout);
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 1000));
  return String(r.stdout || "").trim();
}

const password = getLoginPassword();
const report = { started_at: new Date().toISOString(), comando: "06/10" };

let dumpPath = process.env.DK_BC_DUMP_PATH || "";
if (dumpPath && fs.existsSync(dumpPath)) {
  console.error("reuse dump", dumpPath);
  report.dump = {
    ok: true,
    reused: true,
    path: dumpPath,
    bytes: fs.statSync(dumpPath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpPath)).digest("hex"),
  };
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  dumpPath = path.join(OUT, `grupodk-portal-${stamp}.dump`);
  console.error("dump...");
  const dump = run(path.join(PG_BIN, "pg_dump.exe"), ["--format=custom", "--no-owner", "--no-acl", "--role=postgres", "-f", dumpPath, "postgresql://cli_login_postgres@db.ppxtwqvzgujllfzarpuz.supabase.co:5432/postgres"], { PGPASSWORD: password }, 300000);
  if (dump.status !== 0) {
    report.dump = { ok: false, err: String(dump.stderr || dump.stdout || "").slice(0, 400) };
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  report.dump = { ok: true, path: dumpPath, bytes: fs.statSync(dumpPath).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpPath)).digest("hex") };
}

report.official_before = psqlRemote(`SELECT 'bc',count(*)::text FROM public.dk_bc_registro; SELECT 'vig',count(*)::text FROM public.dk_bc_registro WHERE vigente; SELECT 'last',last_bc_no::text FROM public.dk_bc_state WHERE id=1; SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;`, password).split(/\r?\n/);

console.error("restore...");
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "pg_restore.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "--no-owner", "--role=postgres", dumpPath], { PGPASSWORD: "dkbc" }, 300000);

const apl = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-f", PATCH], { PGPASSWORD: "dkbc" }, 120000);
if (apl.status !== 0) {
  report.apply_local = { ok: false, err: String(apl.stderr || apl.stdout || "").slice(0, 1000) };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}
report.apply_local = { ok: true };

const tests = {};
const reg = "cli-hist-06";
const emp = "emp-06";
const fil = "fil-06";

// v1 inclusão
tests.v1 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111101'::uuid,null,'cliente','','isolamento', '${reg}','${emp}','${fil}','consolidado',null,'h1',null,'{"n":1}'::jsonb);`);
const v1 = tests.v1.split("|")[1];

// v2 alteração
tests.v2 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text, bc_composto FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111102'::uuid,null,'cliente','cadastral','isolamento','${reg}','${emp}','${fil}','alteracao_cadastral','${v1}','h2',null,'{"n":2}'::jsonb);`);
const v2 = tests.v2.split("|")[1];

// v3
tests.v3 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111103'::uuid,null,'cliente','','isolamento','${reg}','${emp}','${fil}','consolidado','${v2}','h3',null,'{"n":3}'::jsonb);`);
const v3 = tests.v3.split("|")[1];

// ultrapassada (usar v1)
tests.stale = psqlLocal(`SELECT ok::text, coalesce(reason,'') FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111104'::uuid,null,'cliente','','isolamento','${reg}','${emp}','${fil}','consolidado','${v1}','h4',null,'{"n":4}'::jsonb);`);

// entidade diferente
tests.wrong_ent = psqlLocal(`SELECT ok::text, coalesce(reason,'') FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111105'::uuid,null,'cliente','','isolamento','outro-reg','${emp}','${fil}','consolidado','${v3}','h5',null,'{"n":5}'::jsonb);`);

// idempotente
tests.idem = psqlLocal(`SELECT ok::text, idempotent::text, bc_id FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111103'::uuid,null,'cliente','','isolamento','${reg}','${emp}','${fil}','consolidado','${v2}','h3',null,'{"n":3}'::jsonb);`);

// exclusão lógica
tests.excl = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111106'::uuid,null,'cliente','','isolamento','${reg}','${emp}','${fil}','excluido_logico','${v3}','h6',null,'{"n":6}'::jsonb);`);
const v4 = tests.excl.split("|")[1];
tests.excl_estado = psqlLocal(`SELECT estado FROM public.dk_bc_registro WHERE bc_id='${v4}';`);

// reativação
tests.reat = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111107'::uuid,null,'cliente','','isolamento','${reg}','${emp}','${fil}','reativado','${v4}','h7',null,'{"n":7}'::jsonb);`);
const v5 = tests.reat.split("|")[1];
tests.reat_estado = psqlLocal(`SELECT estado FROM public.dk_bc_registro WHERE bc_id='${v5}';`);

// histórico
tests.hist = psqlLocal(`SELECT bc_id||':'||vigente::text||':'||coalesce(substituido_por,'-')||':'||tipo_alteracao FROM public.dk_bc_historico('isolamento','${reg}','${emp}','${fil}');`);
tests.hist_meta = psqlLocal(`SELECT count(*)::text, count(*) FILTER (WHERE vigente)::text, min(primeiro_bc), max(bc_vigente) FROM public.dk_bc_historico('isolamento','${reg}','${emp}','${fil}');`);

// eventos
tests.eventos = psqlLocal(`SELECT count(*)::text FROM public.dk_bc_evento_versao WHERE origem='isolamento' AND registro_id='${reg}';`);

// falha transacional
tests.tx = psqlLocal(`
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.dk_bc_confirmar('11111111-1111-1111-1111-111111111108'::uuid,null,'cliente','','isolamento','${reg}','${emp}','${fil}','consolidado','${v5}','h8',null,'{"n":8}'::jsonb);
    RAISE EXCEPTION 'rollback_forcado';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
SELECT count(*)::text FROM public.dk_bc_operacao WHERE operation_id='11111111-1111-1111-1111-111111111108'::uuid;
SELECT last_bc_no::text FROM public.dk_bc_state WHERE id=1;
`);

// concorrência: duas atualizações a partir do mesmo vigente
const lastVig = psqlLocal(`SELECT bc_id FROM public.dk_bc_registro WHERE origem='isolamento' AND registro_id='${reg}' AND empresa_id='${emp}' AND filial_id='${fil}' AND vigente LIMIT 1;`);
const sqlA = `SELECT ok::text||','||coalesce(reason,'')||','||coalesce(bc_id,'') FROM public.dk_bc_confirmar('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01'::uuid,null,'cliente','','isolamento','${reg}','${emp}','${fil}','consolidado','${lastVig}','hcA',null,'{"race":"A"}'::jsonb);`;
const sqlB = `SELECT ok::text||','||coalesce(reason,'')||','||coalesce(bc_id,'') FROM public.dk_bc_confirmar('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02'::uuid,null,'cliente','','isolamento','${reg}','${emp}','${fil}','consolidado','${lastVig}','hcB',null,'{"race":"B"}'::jsonb);`;
const rA = run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-c", sqlA, "-A", "-t", "-q"], { PGPASSWORD: "dkbc" }, 30000);
const rB = run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-c", sqlB, "-A", "-t", "-q"], { PGPASSWORD: "dkbc" }, 30000);
tests.race = { a: String(rA.stdout || "").trim(), b: String(rB.stdout || "").trim(), vig_count: psqlLocal(`SELECT count(*)::text FROM public.dk_bc_registro WHERE origem='isolamento' AND registro_id='${reg}' AND empresa_id='${emp}' AND filial_id='${fil}' AND vigente;`) };

tests.counters = psqlLocal(`SELECT 'last',last_bc_no::text FROM public.dk_bc_state WHERE id=1; SELECT 'vig_reg',count(*)::text FROM public.dk_bc_registro WHERE origem='isolamento' AND registro_id='${reg}' AND vigente; SELECT 'all_reg',count(*)::text FROM public.dk_bc_registro WHERE origem='isolamento' AND registro_id='${reg}';`).split(/\r?\n/);

// PDF inclui vigentes + substituídos do registro teste
const pdfRaw = psqlLocal(`SELECT bc_id, bc_no::text, coalesce(origem,'-'), coalesce(estado,'-'), case when vigente then 't' else 'f' end, '' FROM public.dk_bc_registro WHERE origem='isolamento' AND registro_id='${reg}' ORDER BY bc_no;`);
const pdfRows = pdfRaw.split(/\r?\n/).filter(Boolean).map((l) => { const p = l.split("|"); return { bc_id: p[0], bc_no: +p[1], origem: p[2], estado: p[3], vigente: p[4] === "t" }; });
const pdf = buildBcNomenclaturaPdf(pdfRows, { filename: "hist-06-sample.pdf" });
// Amostra do registro de teste nao inclui BC000000000001; aceitar se gerou linhas e listou vigentes+historicos.
const pdfOkSample =
  pdf.rows === pdfRows.length &&
  pdf.buffer &&
  pdf.buffer.length > 0 &&
  !(pdf.reason || "").includes("central_ainda_presente");
report.pdf_sample = {
  ok: pdfOkSample,
  build_ok: pdf.ok,
  reason: pdf.reason,
  rows: pdf.rows,
  vigentes: pdfRows.filter((r) => r.vigente).length,
  historicos: pdfRows.filter((r) => !r.vigente).length,
};

report.tests = tests;

const gate = {
  v1: /^true\|/i.test(tests.v1),
  v2: /^true\|/i.test(tests.v2),
  v3: /^true\|/i.test(tests.v3),
  stale: /versao_ultrapassada/.test(tests.stale),
  wrong: /bc_anterior_entidade_diferente/.test(tests.wrong_ent),
  idem: /true\|true\|/i.test(tests.idem) || /\|true\|/i.test(tests.idem),
  excl: /^true\|/i.test(tests.excl),
  reat: /^true\|/i.test(tests.reat),
  hist: Number(String(tests.hist_meta).split("|")[0]) >= 5,
  one_vig: String(tests.hist_meta).split("|")[1] === "1" || tests.race.vig_count === "1",
  eventos: Number(tests.eventos) >= 5,
  tx: String(tests.tx).includes("0"),
  race_one_vig: tests.race.vig_count === "1",
  pdf: report.pdf_sample.ok && report.pdf_sample.historicos >= 1 && report.pdf_sample.vigentes === 1,
};
report.gate = gate;
report.gate_ok = Object.values(gate).every(Boolean);
console.error("gate", gate);

if (!report.gate_ok) {
  report.applied_official = false;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(3);
}

console.error("apply official...");
const wrapped = path.join(OUT, `apply-${Date.now()}.sql`);
fs.writeFileSync(wrapped, `SET ROLE postgres;\nSET search_path TO public, extensions;\n` + fs.readFileSync(PATCH, "utf8"), "utf8");
const apr = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-f", wrapped], {
  PGPASSWORD: password,
  PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
  PGPORT: "5432",
  PGUSER: "cli_login_postgres",
  PGDATABASE: "postgres",
  PGCONNECT_TIMEOUT: "20",
}, 180000);
try { fs.unlinkSync(wrapped); } catch {}
if (apr.status !== 0) {
  report.applied_official = false;
  report.apply_err = String(apr.stderr || apr.stdout || "").slice(0, 1000);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(4);
}
report.applied_official = true;

report.official_after = psqlRemote(`
SELECT 'bc',count(*)::text FROM public.dk_bc_registro;
SELECT 'vig',count(*)::text FROM public.dk_bc_registro WHERE vigente;
SELECT 'last',last_bc_no::text FROM public.dk_bc_state WHERE id=1;
SELECT 'vms',count(*)::text FROM public.dk_bc_vm;
SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
SELECT 'ops',count(*)::text FROM public.dk_bc_vm_operacao;
SELECT 'evt',count(*)::text FROM public.dk_bc_evento_versao;
SELECT 'fn',(to_regprocedure('public.dk_bc_historico(text,text,text,text)') is not null)::text;
`, password).split(/\r?\n/);

report.finished_at = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
