/**
 * COMANDO 07/10 — imutabilidade + sync BC→VMs (isolado → apply oficial sem worker).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "bc-07");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const PORT = Number(process.env.DK_BC_ISOLATED_PORT || 55432);
const PATCH06 = path.join(ROOT, "supabase", "dk-bc-historico-06.sql");
const PATCH07 = path.join(ROOT, "supabase", "dk-bc-sync-07.sql");
const DB = "dk_bc_07";

fs.mkdirSync(OUT, { recursive: true });

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
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "").slice(0, 1200));
  return String(r.stdout || "").trim();
}
function applyLocal(file) {
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-f", file], { PGPASSWORD: "dkbc" }, 120000);
  if (r.status !== 0) throw new Error("apply_local " + path.basename(file) + ": " + String(r.stderr || r.stdout || "").slice(0, 1000));
}

const password = getLoginPassword();
const report = { started_at: new Date().toISOString(), comando: "07/10" };

let dumpPath = process.env.DK_BC_DUMP_PATH || "";
if (!dumpPath || !fs.existsSync(dumpPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  dumpPath = path.join(OUT, `grupodk-portal-${stamp}.dump`);
  console.error("dump...");
  const dump = run(path.join(PG_BIN, "pg_dump.exe"), ["--format=custom", "--no-owner", "--no-acl", "--role=postgres", "-f", dumpPath, "postgresql://cli_login_postgres@db.ppxtwqvzgujllfzarpuz.supabase.co:5432/postgres"], { PGPASSWORD: password }, 300000);
  if (dump.status !== 0) { report.dump = { ok: false, err: String(dump.stderr || "").slice(0, 400) }; console.log(JSON.stringify(report, null, 2)); process.exit(2); }
}
report.dump = { ok: true, path: dumpPath, bytes: fs.statSync(dumpPath).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpPath)).digest("hex") };
report.official_before = psqlRemote(`SELECT 'bc',count(*)::text FROM public.dk_bc_registro; SELECT 'last',last_bc_no::text FROM public.dk_bc_state WHERE id=1; SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state; SELECT 'evt',count(*)::text FROM public.dk_bc_evento_versao;`, password).split(/\r?\n/);

console.error("restore...");
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "pg_restore.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "--no-owner", "--role=postgres", dumpPath], { PGPASSWORD: "dkbc" }, 300000);

// garantir 06 + 07
try { applyLocal(PATCH06); } catch (e) { report.patch06_note = String(e.message || e).slice(0, 200); }
applyLocal(PATCH07);
report.apply_local = { ok: true };

const tests = {};

// imutabilidade: tentar alterar payload histórico
tests.imut_payload = (() => {
  try {
    psqlLocal(`UPDATE public.dk_bc_registro SET payload='{"x":1}'::jsonb WHERE bc_id='BC000000000001';`);
    return "FAIL_allowed";
  } catch (e) {
    return /historico_imutavel|imutavel/.test(String(e.message || e)) ? "blocked_ok" : String(e.message || e).slice(0, 120);
  }
})();

// confirmar ainda funciona (substituição)
tests.conf_v1 = psqlLocal(`SELECT ok::text, bc_id FROM public.dk_bc_confirmar('77777777-7777-7777-7777-777777777701'::uuid,null,'cliente','','sync07','reg-07','emp7','fil7','consolidado',null,'hs1',null,'{"s":1}'::jsonb);`);
const b1 = tests.conf_v1.split("|")[1];
tests.conf_v2 = psqlLocal(`SELECT ok::text, bc_id FROM public.dk_bc_confirmar('77777777-7777-7777-7777-777777777702'::uuid,null,'cliente','','sync07','reg-07','emp7','fil7','alteracao_cadastral','${b1}','hs2',null,'{"s":2}'::jsonb);`);
const b2 = tests.conf_v2.split("|")[1];
tests.subst = psqlLocal(`SELECT vigente::text, coalesce(substituido_por,'-') FROM public.dk_bc_registro WHERE bc_id='${b1}';`);

// bootstrap VM-A (só até um marco reduzido para velocidade: 50 primeiros + novos)
// Usar bootstrap completo seria 3648*10; testamos bootstrap de J com filtro via lote após enfileirar só novos + amostra
tests.boot_J = psqlLocal(`SELECT ok::text, enfileirados::text FROM public.dk_bc_sync_bootstrap_vm('J', 20);`);
tests.apply_J = psqlLocal(`SELECT ok::text, aplicados::text, last_bc_no::text FROM public.dk_bc_sync_aplicar_lote('J', 50);`);
tests.apply_J2 = psqlLocal(`SELECT ok::text, aplicados::text, last_bc_no::text FROM public.dk_bc_sync_aplicar_lote('J', 50);`);
tests.proj_J = psqlLocal(`SELECT count(*)::text FROM public.dk_bc_vm_projecao WHERE prefixo='J';`);

// distribuir novos BC (trigger já enfileirou) e aplicar nas 10 VMs
tests.dist = {};
for (const p of "ABCDEFGHIJ".split("")) {
  tests.dist[p] = psqlLocal(`SELECT ok::text, aplicados::text, last_bc_no::text FROM public.dk_bc_sync_aplicar_lote('${p}', 500);`);
}
tests.atraso = psqlLocal(`SELECT prefixo||':'||last_applied_bc_no||':'||atraso FROM public.dk_bc_sync_atraso();`);

// simulação: VM-J "fica offline" — enfileira mais eventos sem aplicar J, aplica outras, depois recupera J
tests.conf_v3 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('77777777-7777-7777-7777-777777777703'::uuid,null,'cliente','','sync07','reg-07','emp7','fil7','consolidado','${b2}','hs3',null,'{"s":3}'::jsonb);`);
tests.conf_v4 = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('77777777-7777-7777-7777-777777777704'::uuid,null,'cliente','','sync07','reg-07','emp7','fil7','consolidado',(SELECT bc_id FROM public.dk_bc_registro WHERE origem='sync07' AND registro_id='reg-07' AND vigente),'hs4',null,'{"s":4}'::jsonb);`);
// aplica A–I
for (const p of "ABCDEFGHI".split("")) {
  psqlLocal(`SELECT ok FROM public.dk_bc_sync_aplicar_lote('${p}', 20);`);
}
const beforeJ = psqlLocal(`SELECT last_applied_bc_no::text, pending_count::text FROM public.dk_bc_vm_sync_state WHERE prefixo='J';`);
tests.J_offline = beforeJ;
tests.J_recover = psqlLocal(`SELECT ok::text, aplicados::text, last_bc_no::text FROM public.dk_bc_sync_aplicar_lote('J', 100);`);
tests.J_after = psqlLocal(`SELECT last_applied_bc_no::text, pending_count::text, status FROM public.dk_bc_vm_sync_state WHERE prefixo='J';`);
tests.J_idem = psqlLocal(`SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('J', 100);`);

// isolamento empresa: aplicar A filtrando outra empresa — deve ignorar
tests.iso = psqlLocal(`SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('A', 10, 'outra-emp', null);`);

// contadores
tests.counters = psqlLocal(`
SELECT 'last', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
SELECT 'prov', coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
SELECT 'sync_states', count(*)::text FROM public.dk_bc_vm_sync_state;
SELECT 'entregas_J', count(*)::text FROM public.dk_bc_vm_sync_entrega WHERE prefixo='J';
`).split(/\r?\n/);

report.tests = tests;
const gate = {
  imut: tests.imut_payload === "blocked_ok",
  conf: /^true\|/i.test(tests.conf_v1) && /^true\|/i.test(tests.conf_v2),
  subst: /false\|BC/.test(tests.subst),
  boot: /^true\|/i.test(tests.boot_J),
  apply: /^true\|/i.test(tests.apply_J),
  recover: /^true\|/i.test(tests.J_recover) && Number(String(tests.J_recover).split("|")[1] || 0) >= 1,
  idem: /^true\|0\|/i.test(tests.J_idem) || /\|0$/.test(tests.J_idem.split("\n")[0]),
  ten_states: tests.counters.some((l) => l.startsWith("sync_states|10")),
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
fs.writeFileSync(wrapped, `SET ROLE postgres;\nSET search_path TO public, extensions;\n` + fs.readFileSync(PATCH07, "utf8"), "utf8");
const apr = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-f", wrapped], {
  PGPASSWORD: password, PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co", PGPORT: "5432", PGUSER: "cli_login_postgres", PGDATABASE: "postgres", PGCONNECT_TIMEOUT: "20",
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
SELECT 'sync',count(*)::text FROM public.dk_bc_vm_sync_state;
SELECT 'ent',count(*)::text FROM public.dk_bc_vm_sync_entrega;
SELECT 'vm_status',string_agg(prefixo||':'||status,',' ORDER BY prefixo) FROM public.dk_bc_vm;
`, password).split(/\r?\n/);

report.finished_at = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
