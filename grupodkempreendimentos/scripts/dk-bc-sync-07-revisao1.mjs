/**
 * COMANDO 07/10 — REVISÃO 1
 * Cursor contínuo, isolamento escopo central, substituição diferida.
 * Isolado → apply estrutural oficial (sem bootstrap/worker/escopos reais).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "bc-07-rev1");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const PORT = Number(process.env.DK_BC_ISOLATED_PORT || 55432);
const PATCH06 = path.join(ROOT, "supabase", "dk-bc-historico-06.sql");
const PATCH07 = path.join(ROOT, "supabase", "dk-bc-sync-07.sql");
const PATCH07R1 = path.join(ROOT, "supabase", "dk-bc-sync-07-revisao1.sql");
const DB = "dk_bc_07r1";
const ARTIFACTS = path.join(ROOT, "artifacts", "bc-tests");

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ARTIFACTS, { recursive: true });

function getLoginPassword() {
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "supabase", "db", "dump", "--remote", "--dry-run", "-f", "NUL"], { cwd: ROOT, encoding: "utf8", shell: true });
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
    PGPASSWORD: password, PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co", PGPORT: "5432", PGUSER: "cli_login_postgres", PGDATABASE: "postgres", PGCONNECT_TIMEOUT: "20",
  }, timeout);
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 800));
  return String(r.stdout || "").trim();
}
function psqlLocal(sql, timeout = 120000) {
  const tmp = path.join(OUT, `l-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, `SET search_path TO public, extensions;\n${sql}`, "utf8");
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-f", tmp, "-A", "-F", "|", "-t", "-q"], { PGPASSWORD: "dkbc" }, timeout);
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 1400));
  return String(r.stdout || "").trim();
}
function applyLocal(file) {
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-f", file], { PGPASSWORD: "dkbc" }, 120000);
  if (r.status !== 0) throw new Error("apply_local " + path.basename(file) + ": " + String(r.stderr || r.stdout || "").slice(0, 1000));
}

function truthyOk(line) {
  const s = String(line || "").trim().split(/\r?\n/)[0];
  return /^(t|true)\|/i.test(s);
}

const password = getLoginPassword();
const report = { started_at: new Date().toISOString(), comando: "07/10-REVISAO-1" };

let dumpPath = process.env.DK_BC_DUMP_PATH || "";
if (!dumpPath || !fs.existsSync(dumpPath)) {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "DK-BC-BACKUP", "bc-06", "grupodk-portal-2026-11-12T04-04-52-605Z.dump"),
    path.join(process.env.LOCALAPPDATA || "", "DK-BC-BACKUP", "bc-07"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) { dumpPath = c; break; }
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
      const dumps = fs.readdirSync(c).filter((f) => f.endsWith(".dump")).map((f) => path.join(c, f));
      if (dumps.length) { dumpPath = dumps.sort().at(-1); break; }
    }
  }
}
if (!dumpPath || !fs.existsSync(dumpPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  dumpPath = path.join(OUT, `grupodk-portal-${stamp}.dump`);
  console.error("dump...");
  const dump = run(path.join(PG_BIN, "pg_dump.exe"), ["--format=custom", "--no-owner", "--no-acl", "--role=postgres", "-f", dumpPath, "postgresql://cli_login_postgres@db.ppxtwqvzgujllfzarpuz.supabase.co:5432/postgres"], { PGPASSWORD: password }, 300000);
  if (dump.status !== 0) { report.dump = { ok: false, err: String(dump.stderr || "").slice(0, 400) }; console.log(JSON.stringify(report, null, 2)); process.exit(2); }
}
report.dump = { ok: true, path: dumpPath, bytes: fs.statSync(dumpPath).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpPath)).digest("hex") };

report.official_before = psqlRemote(`
SELECT 'bc',count(*)::text FROM public.dk_bc_registro;
SELECT 'vig',count(*)::text FROM public.dk_bc_registro WHERE vigente;
SELECT 'last',last_bc_no::text FROM public.dk_bc_state WHERE id=1;
SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
SELECT 'ops',count(*)::text FROM public.dk_bc_vm_operacao;
SELECT 'ent',count(*)::text FROM public.dk_bc_vm_sync_entrega;
SELECT 'escopo_table', coalesce(to_regclass('public.dk_bc_vm_escopo')::text, 'absent');
`, password).split(/\r?\n/);

console.error("restore...");
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB}' AND pid<>pg_backend_pid();`], { PGPASSWORD: "dkbc" }, 30000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "pg_restore.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "--no-owner", "--role=postgres", dumpPath], { PGPASSWORD: "dkbc" }, 300000);

try { applyLocal(PATCH06); } catch (e) { report.patch06_note = String(e.message || e).slice(0, 200); }
try { applyLocal(PATCH07); } catch (e) { report.patch07_note = String(e.message || e).slice(0, 200); }
applyLocal(PATCH07R1);
report.apply_local = { ok: true };

const tests = {};

// --- Escopos fictícios (somente isolado) ---
psqlLocal(`
INSERT INTO public.dk_bc_vm_escopo (prefixo, empresa_id, filial_id) VALUES
  ('A','emp-alfa','fil-a1'),
  ('J','emp-alfa','fil-a1'),
  ('B','emp-beta','fil-b1')
ON CONFLICT DO NOTHING;
`);

// Limpar sync residual do dump para A/J em testes controlados
psqlLocal(`
DELETE FROM public.dk_bc_vm_projecao WHERE prefixo IN ('A','J','B');
DELETE FROM public.dk_bc_vm_sync_entrega WHERE prefixo IN ('A','J','B');
DELETE FROM public.dk_bc_vm_sync_falha WHERE prefixo IN ('A','J','B');
UPDATE public.dk_bc_vm_sync_state
   SET last_applied_bc_no=0, bootstrap_done=false, status='ociosa',
       pending_count=0, last_error=null, updated_at=now()
 WHERE prefixo IN ('A','J','B','C');
`);

// --- 1) Três eventos A; falha no intermediário; cursor não ultrapassa; recupera ---
tests.conf1 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01'::uuid,null,'cliente','','sync07r1','reg-a','emp-alfa','fil-a1','consolidado',null,'h1',null,'{"n":1}'::jsonb);`);
tests.conf2 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02'::uuid,null,'cliente','','sync07r1','reg-a','emp-alfa','fil-a1','consolidado',(SELECT bc_id FROM public.dk_bc_registro WHERE origem='sync07r1' AND registro_id='reg-a' AND vigente),'h2',null,'{"n":2}'::jsonb);`);
tests.conf3 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03'::uuid,null,'cliente','','sync07r1','reg-a','emp-alfa','fil-a1','consolidado',(SELECT bc_id FROM public.dk_bc_registro WHERE origem='sync07r1' AND registro_id='reg-a' AND vigente),'h3',null,'{"n":3}'::jsonb);`);

const bcIds = [tests.conf1, tests.conf2, tests.conf3].map((l) => String(l).split("|")[1]);
const bcNos = [tests.conf1, tests.conf2, tests.conf3].map((l) => Number(String(l).split("|")[2]));
tests.bc_ids = bcIds;
tests.bc_nos = bcNos;

// Garantir entregas A (trigger já enfileirou para todas; reset A só destes)
psqlLocal(`
UPDATE public.dk_bc_vm_sync_entrega SET status='pendente', last_error=null, applied_at=null
 WHERE prefixo='A' AND bc_id IN ('${bcIds.join("','")}');
UPDATE public.dk_bc_vm_sync_state SET last_applied_bc_no=0, status='ociosa' WHERE prefixo='A';
DELETE FROM public.dk_bc_vm_projecao WHERE prefixo='A';
`);

// Falha no evento 2 (bc intermediário)
tests.fail_mid = psqlLocal(`
SELECT set_config('dk.bc_sync_force_fail_bc_id', '${bcIds[1]}', false);
SELECT ok::text, aplicados::text, last_bc_no::text, coalesce(reason,'-') FROM public.dk_bc_sync_aplicar_lote('A', 50);
SELECT set_config('dk.bc_sync_force_fail_bc_id', '', false);
`);
tests.cursor_after_fail = psqlLocal(`
SELECT last_applied_bc_no::text, status, coalesce(last_error,'-') FROM public.dk_bc_vm_sync_state WHERE prefixo='A';
SELECT bc_no::text||':'||status||':'||coalesce(last_error,'-') FROM public.dk_bc_vm_sync_entrega
 WHERE prefixo='A' AND bc_id IN ('${bcIds.join("','")}') ORDER BY bc_no;
`);

const cursorAfterFail = Number(String(tests.cursor_after_fail).split(/\r?\n/)[0].split("|")[0]);
tests.cursor_nao_ultrapassou = cursorAfterFail < bcNos[1] && cursorAfterFail === bcNos[0];

// Recuperar evento 2 (sem force fail) e depois 3
tests.recover2 = psqlLocal(`SELECT ok::text, aplicados::text, last_bc_no::text, coalesce(reason,'-') FROM public.dk_bc_sync_aplicar_lote('A', 50);`);
tests.cursor_after_recover = psqlLocal(`SELECT last_applied_bc_no::text, status FROM public.dk_bc_vm_sync_state WHERE prefixo='A';`);
tests.idem_A = psqlLocal(`SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('A', 50);`);

// --- 2) VM-J desconectada → reconecta em ordem ---
psqlLocal(`
UPDATE public.dk_bc_vm_sync_state SET last_applied_bc_no=0, status='ociosa', bootstrap_done=false WHERE prefixo='J';
DELETE FROM public.dk_bc_vm_projecao WHERE prefixo='J';
DELETE FROM public.dk_bc_vm_sync_entrega WHERE prefixo='J';
`);
tests.boot_J = psqlLocal(`SELECT ok::text, enfileirados::text FROM public.dk_bc_sync_bootstrap_vm('J', 15);`);
// aplicar só até 15 (bootstrap), depois "offline" enquanto novos eventos
tests.apply_J_boot = psqlLocal(`SELECT ok::text, aplicados::text, last_bc_no::text FROM public.dk_bc_sync_aplicar_lote('J', 100);`);
tests.conf_offline1 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01'::uuid,null,'cliente','','sync07r1','reg-j','emp-alfa','fil-a1','consolidado',null,'hj1',null,'{"j":1}'::jsonb);`);
tests.conf_offline2 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'::uuid,null,'cliente','','sync07r1','reg-j','emp-alfa','fil-a1','consolidado',(SELECT bc_id FROM public.dk_bc_registro WHERE origem='sync07r1' AND registro_id='reg-j' AND vigente),'hj2',null,'{"j":2}'::jsonb);`);
tests.J_before_reconnect = psqlLocal(`SELECT last_applied_bc_no::text, pending_count::text FROM public.dk_bc_vm_sync_state WHERE prefixo='J';`);
tests.J_reconnect = psqlLocal(`SELECT ok::text, aplicados::text, last_bc_no::text FROM public.dk_bc_sync_aplicar_lote('J', 200);`);
tests.J_after = psqlLocal(`
SELECT last_applied_bc_no::text, status FROM public.dk_bc_vm_sync_state WHERE prefixo='J';
SELECT count(*)::text FROM public.dk_bc_vm_sync_entrega WHERE prefixo='J' AND status IN ('pendente','falhou');
`);
tests.J_idem = psqlLocal(`SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('J', 200);`);

// --- 3) Isolamento empresa: A=alfa, B=beta ---
tests.conf_beta = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('cccccccc-cccc-cccc-cccc-cccccccccc01'::uuid,null,'cliente','','sync07r1','reg-b','emp-beta','fil-b1','consolidado',null,'hb1',null,'{"b":1}'::jsonb);`);
const bcBeta = String(tests.conf_beta).split("|")[1];
psqlLocal(`
UPDATE public.dk_bc_vm_sync_state SET last_applied_bc_no=0 WHERE prefixo='B';
DELETE FROM public.dk_bc_vm_projecao WHERE prefixo='B';
UPDATE public.dk_bc_vm_sync_entrega SET status='pendente', last_error=null, applied_at=null WHERE prefixo='B' AND bc_id='${bcBeta}';
`);
tests.apply_B_beta = psqlLocal(`SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('B', 50);`);
tests.proj_B = psqlLocal(`SELECT count(*)::text FROM public.dk_bc_vm_projecao WHERE prefixo='B' AND empresa_id='emp-beta';`);
tests.proj_A_beta = psqlLocal(`SELECT count(*)::text FROM public.dk_bc_vm_projecao WHERE prefixo='A' AND empresa_id='emp-beta';`);

// A com parâmetros forjados emp-beta: autorização NÃO muda (ainda escopo alfa)
psqlLocal(`
UPDATE public.dk_bc_vm_sync_entrega SET status='pendente', last_error=null, applied_at=null
 WHERE prefixo='A' AND bc_id='${bcBeta}';
`);
const cursorABeforeForge = psqlLocal(`SELECT last_applied_bc_no::text FROM public.dk_bc_vm_sync_state WHERE prefixo='A';`);
tests.forge_params = psqlLocal(`SELECT ok::text, aplicados::text, coalesce(reason,'-') FROM public.dk_bc_sync_aplicar_lote('A', 50, 'emp-beta', 'fil-b1');`);
tests.forge_entrega = psqlLocal(`SELECT status||':'||coalesce(last_error,'-') FROM public.dk_bc_vm_sync_entrega WHERE prefixo='A' AND bc_id='${bcBeta}';`);
tests.proj_A_beta_after_forge = psqlLocal(`SELECT count(*)::text FROM public.dk_bc_vm_projecao WHERE prefixo='A' AND empresa_id='emp-beta';`);

// VM C sem escopo
tests.no_scope_C = psqlLocal(`SELECT ok::text, aplicados::text, coalesce(reason,'-') FROM public.dk_bc_sync_aplicar_lote('C', 10);`);

// --- 4) Substituição histórica ---
tests.desmarcar_sem_sucessor = (() => {
  try {
    psqlLocal(`UPDATE public.dk_bc_registro SET vigente=false WHERE bc_id='${bcIds[2]}' AND vigente=true;`);
    return "FAIL_allowed";
  } catch (e) {
    return /vigente_sem_sucessor|sucessor_invalido/.test(String(e.message || e)) ? "blocked_ok" : String(e.message || e).slice(0, 160);
  }
})();

tests.conf_subst = psqlLocal(`SELECT ok::text, bc_id FROM public.dk_bc_confirmar('dddddddd-dddd-dddd-dddd-dddddddddd01'::uuid,null,'cliente','','sync07r1','reg-s','emp-alfa','fil-a1','consolidado',null,'hs1',null,'{"s":1}'::jsonb);`);
const bs1 = String(tests.conf_subst).split("|")[1];
tests.conf_subst2 = psqlLocal(`SELECT ok::text, bc_id FROM public.dk_bc_confirmar('dddddddd-dddd-dddd-dddd-dddddddddd02'::uuid,null,'cliente','','sync07r1','reg-s','emp-alfa','fil-a1','alteracao_cadastral','${bs1}','hs2',null,'{"s":2}'::jsonb);`);
const bs2 = String(tests.conf_subst2).split("|")[1];
tests.subst_link = psqlLocal(`
SELECT (SELECT vigente::text||'|'||coalesce(substituido_por,'-') FROM public.dk_bc_registro WHERE bc_id='${bs1}'),
       (SELECT vigente::text||'|'||coalesce(bc_anterior,'-') FROM public.dk_bc_registro WHERE bc_id='${bs2}');
`);

// --- 5) Interrupção simulada: force fail + restart apply ---
tests.interrupt = psqlLocal(`
SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01'::uuid,null,'cliente','','sync07r1','reg-i','emp-alfa','fil-a1','consolidado',null,'hi1',null,'{"i":1}'::jsonb);
SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02'::uuid,null,'cliente','','sync07r1','reg-i','emp-alfa','fil-a1','consolidado',(SELECT bc_id FROM public.dk_bc_registro WHERE origem='sync07r1' AND registro_id='reg-i' AND vigente),'hi2',null,'{"i":2}'::jsonb);
`);
const bi = String(tests.interrupt).split(/\r?\n/).map((l) => l.split("|")[1]);
psqlLocal(`
UPDATE public.dk_bc_vm_sync_state SET last_applied_bc_no=(
  SELECT coalesce(max(bc_no),0)-2 FROM public.dk_bc_registro
) WHERE prefixo='A';
UPDATE public.dk_bc_vm_sync_entrega SET status='pendente', last_error=null, applied_at=null
 WHERE prefixo='A' AND bc_id IN ('${bi[0]}','${bi[1]}');
SELECT set_config('dk.bc_sync_force_fail_bc_id', '${bi[1]}', false);
SELECT ok::text, aplicados::text, coalesce(reason,'-') FROM public.dk_bc_sync_aplicar_lote('A', 20);
SELECT set_config('dk.bc_sync_force_fail_bc_id', '', false);
SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('A', 20);
`);

tests.counters = psqlLocal(`
SELECT 'last', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
SELECT 'escopos', count(*)::text FROM public.dk_bc_vm_escopo;
SELECT 'prov', coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
`).split(/\r?\n/);

report.tests = tests;

const gate = {
  conf123: truthyOk(tests.conf1) && truthyOk(tests.conf2) && truthyOk(tests.conf3),
  cursor_block: tests.cursor_nao_ultrapassou === true,
  recover: truthyOk(String(tests.recover2).split(/\r?\n/)[0]) && Number(String(tests.cursor_after_recover).split("|")[0]) >= bcNos[2],
  idem: /^true\|0\|/i.test(String(tests.idem_A).split(/\r?\n/)[0]) || /\|0(\||$)/.test(String(tests.idem_A).split(/\r?\n/)[0]),
  j_recover: truthyOk(String(tests.J_reconnect).split(/\r?\n/)[0]),
  j_idem: /^true\|0/i.test(String(tests.J_idem).split(/\r?\n/)[0]) || /\|0(\||$)/.test(String(tests.J_idem)),
  iso_B: Number(tests.proj_B) >= 1,
  iso_A_no_beta: Number(tests.proj_A_beta_after_forge) === 0,
  forge_ignored: /ignorado:fora_do_escopo/.test(String(tests.forge_entrega)),
  no_scope: /sem_escopo_autorizado/.test(String(tests.no_scope_C)),
  subst_block: tests.desmarcar_sem_sucessor === "blocked_ok",
  subst_ok: truthyOk(tests.conf_subst) && truthyOk(tests.conf_subst2) && /false\|BC/.test(String(tests.subst_link)),
};
report.gate = gate;
report.gate_ok = Object.values(gate).every(Boolean);
report.cursor_A_before_forge = cursorABeforeForge;
console.error("gate", gate);

if (!report.gate_ok) {
  report.applied_official = false;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ARTIFACTS, "report-07-rev1.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(3);
}

// Fresh dump before official apply
console.error("dump pre-apply...");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpFresh = path.join(OUT, `grupodk-portal-pre-rev1-${stamp}.dump`);
const dump = run(path.join(PG_BIN, "pg_dump.exe"), ["--format=custom", "--no-owner", "--no-acl", "--role=postgres", "-f", dumpFresh, "postgresql://cli_login_postgres@db.ppxtwqvzgujllfzarpuz.supabase.co:5432/postgres"], { PGPASSWORD: password }, 300000);
if (dump.status !== 0) {
  report.applied_official = false;
  report.dump_fresh_err = String(dump.stderr || "").slice(0, 400);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(4);
}
report.dump_fresh = { ok: true, path: dumpFresh, bytes: fs.statSync(dumpFresh).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpFresh)).digest("hex") };

console.error("apply official (estrutural)...");
const wrapped = path.join(OUT, `apply-${Date.now()}.sql`);
fs.writeFileSync(wrapped, `SET ROLE postgres;\nSET search_path TO public, extensions;\n` + fs.readFileSync(PATCH07R1, "utf8"), "utf8");
const apr = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-f", wrapped], {
  PGPASSWORD: password, PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co", PGPORT: "5432", PGUSER: "cli_login_postgres", PGDATABASE: "postgres", PGCONNECT_TIMEOUT: "20",
}, 180000);
try { fs.unlinkSync(wrapped); } catch {}
if (apr.status !== 0) {
  report.applied_official = false;
  report.apply_err = String(apr.stderr || apr.stdout || "").slice(0, 1000);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(5);
}
report.applied_official = true;

report.official_after = psqlRemote(`
SELECT 'bc',count(*)::text FROM public.dk_bc_registro;
SELECT 'vig',count(*)::text FROM public.dk_bc_registro WHERE vigente;
SELECT 'last',last_bc_no::text FROM public.dk_bc_state WHERE id=1;
SELECT 'vms',count(*)::text||':'||string_agg(prefixo||':'||status,',' ORDER BY prefixo) FROM public.dk_bc_vm;
SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
SELECT 'ops',count(*)::text FROM public.dk_bc_vm_operacao;
SELECT 'sync',count(*)::text FROM public.dk_bc_vm_sync_state;
SELECT 'ent',count(*)::text FROM public.dk_bc_vm_sync_entrega;
SELECT 'proj',count(*)::text FROM public.dk_bc_vm_projecao;
SELECT 'escopo',count(*)::text FROM public.dk_bc_vm_escopo;
`, password).split(/\r?\n/);

report.finished_at = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(ARTIFACTS, "report-07-rev1.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
