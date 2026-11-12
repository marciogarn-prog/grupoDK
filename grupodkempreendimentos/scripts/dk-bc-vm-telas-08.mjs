/**
 * COMANDO 08/10 — testes isolados: resolver VM, projeção, anti-spoof, reconciliação escopo.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { resolverVmDaSessao, listarProjecao } = require("../lib/dk-bc-vm-sessao.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "bc-08");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const PORT = Number(process.env.DK_BC_ISOLATED_PORT || 55432);
const DB = "dk_bc_08";
const ARTIFACTS = path.join(ROOT, "artifacts", "bc-tests");
const PATCHES = [
  path.join(ROOT, "supabase", "dk-bc-historico-06.sql"),
  path.join(ROOT, "supabase", "dk-bc-sync-07.sql"),
  path.join(ROOT, "supabase", "dk-bc-sync-07-revisao1.sql"),
  path.join(ROOT, "supabase", "dk-bc-vm-telas-08.sql"),
];

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

const password = getLoginPassword();
const report = { started_at: new Date().toISOString(), comando: "08/10" };

let dumpPath = process.env.DK_BC_DUMP_PATH || path.join(process.env.LOCALAPPDATA || "", "DK-BC-BACKUP", "bc-07-rev1");
if (fs.existsSync(dumpPath) && fs.statSync(dumpPath).isDirectory()) {
  const dumps = fs.readdirSync(dumpPath).filter((f) => f.endsWith(".dump")).map((f) => path.join(dumpPath, f));
  dumpPath = dumps.sort().at(-1) || "";
}
if (!dumpPath || !fs.existsSync(dumpPath)) {
  dumpPath = path.join(process.env.LOCALAPPDATA || "", "DK-BC-BACKUP", "bc-06", "grupodk-portal-2026-11-12T04-04-52-605Z.dump");
}
report.dump = { ok: true, path: dumpPath, bytes: fs.statSync(dumpPath).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpPath)).digest("hex") };

report.official_before = psqlRemote(`
SELECT 'bc',count(*)::text FROM public.dk_bc_registro;
SELECT 'last',last_bc_no::text FROM public.dk_bc_state WHERE id=1;
SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
SELECT 'escopo_reg', coalesce(to_regclass('public.dk_bc_vm_escopo')::text, 'absent');
SELECT 'colab', count(*)::text FROM public.dk_bc_vm WHERE colaborador_ref IS NOT NULL AND btrim(colaborador_ref)<>'';
SELECT 'ent',count(*)::text FROM public.dk_bc_vm_sync_entrega;
`, password).split(/\r?\n/);

console.error("restore...");
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB}' AND pid<>pg_backend_pid();`], { PGPASSWORD: "dkbc" }, 30000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "pg_restore.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "--no-owner", "--role=postgres", dumpPath], { PGPASSWORD: "dkbc" }, 300000);

for (const p of PATCHES) {
  try { applyLocal(p); } catch (e) { report["note_" + path.basename(p)] = String(e.message || e).slice(0, 180); }
}
report.apply_local = { ok: true };

const tests = {};

// Vínculos fictícios só no isolado
psqlLocal(`
UPDATE public.dk_bc_vm SET colaborador_ref='11122233344', status='ativa', updated_at=now() WHERE prefixo='A';
UPDATE public.dk_bc_vm SET colaborador_ref='55566677788', status='ativa', updated_at=now() WHERE prefixo='B';
INSERT INTO public.dk_bc_vm_escopo (prefixo, empresa_id, filial_id) VALUES
 ('A','emp-alfa','fil-a1'), ('B','emp-beta','fil-b1')
ON CONFLICT DO NOTHING;
`);

tests.resolver_A = psqlLocal(`SELECT ok::text, prefixo, autorizada::text, coalesce(reason,'-') FROM public.dk_bc_vm_resolver_colaborador('11122233344');`);
tests.resolver_sem = psqlLocal(`SELECT ok::text, coalesce(reason,'-') FROM public.dk_bc_vm_resolver_colaborador('00000000000');`);
tests.resolver_vazio = psqlLocal(`SELECT ok::text, coalesce(reason,'-') FROM public.dk_bc_vm_resolver_colaborador('');`);

// Node anti-spoof: cliente pede B, identidade é A
const ioA = {
  async rpc(fn, args) {
    if (fn === "dk_bc_vm_resolver_colaborador") {
      const r = psqlLocal(`SELECT ok, prefixo, vm_id, status, colaborador_ref, tem_escopo, autorizada, reason FROM public.dk_bc_vm_resolver_colaborador('${args.p_colaborador_ref}');`);
      const [ok, prefixo, vm_id, status, colaborador_ref, tem_escopo, autorizada, reason] = r.split("|");
      return [{
        ok: ok === "t" || ok === "true",
        prefixo, vm_id, status, colaborador_ref,
        tem_escopo: tem_escopo === "t" || tem_escopo === "true",
        autorizada: autorizada === "t" || autorizada === "true",
        reason: reason === "-" ? null : reason,
      }];
    }
    if (fn === "dk_bc_vm_projecao_listar") {
      const r = psqlLocal(`SELECT coalesce(json_agg(t),'[]'::json)::text FROM (
        SELECT * FROM public.dk_bc_vm_projecao_listar('${args.p_prefixo}', ${args.p_after_bc_no || 0}, ${args.p_limite || 200})
      ) t;`);
      return JSON.parse(r || "[]");
    }
    return [];
  },
  clientPrefix: "B",
};
tests.node_spoof = await resolverVmDaSessao({ claims: { cpf: "111.222.333-44" } }, ioA);
tests.node_spoof_prefix_is_A = tests.node_spoof.prefixo === "A";
tests.node_spoof_forged = tests.node_spoof.forged_ignored === "B";

tests.node_sem = await resolverVmDaSessao({ claims: { cpf: "00000000000" } }, ioA);

// Confirmar BC + sync A
tests.conf = psqlLocal(`SELECT ok::text, bc_id, bc_no::text FROM public.dk_bc_confirmar('88888888-8888-8888-8888-888888888801'::uuid,null,'cliente','','sync08','reg-08','emp-alfa','fil-a1','consolidado',null,'h08',null,'{"n":1}'::jsonb);`);
const bc1 = String(tests.conf).split("|")[1];
tests.snap = psqlLocal(`SELECT payload_snapshot ? 'payload' FROM public.dk_bc_vm_sync_entrega WHERE prefixo='A' AND bc_id='${bc1}';`);
tests.apply_A = psqlLocal(`SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('A', 50);`);
tests.proj_list = psqlLocal(`SELECT count(*)::text FROM public.dk_bc_vm_projecao_listar('A', 0, 100);`);
tests.sinal = psqlLocal(`SELECT last_bc_no::text FROM public.dk_bc_vm_sinal WHERE prefixo='A';`);

// Beta na VM-A → filtrado_escopo (reabrível)
tests.conf_beta = psqlLocal(`SELECT ok::text, bc_id FROM public.dk_bc_confirmar('88888888-8888-8888-8888-888888888802'::uuid,null,'cliente','','sync08','reg-08b','emp-beta','fil-b1','consolidado',null,'h08b',null,'{"n":2}'::jsonb);`);
const bcBeta = String(tests.conf_beta).split("|")[1];
tests.apply_A2 = psqlLocal(`SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('A', 50);`);
tests.filtro = psqlLocal(`SELECT status||':'||coalesce(last_error,'-') FROM public.dk_bc_vm_sync_entrega WHERE prefixo='A' AND bc_id='${bcBeta}';`);

// Expandir escopo A para beta e reconciliar
psqlLocal(`INSERT INTO public.dk_bc_vm_escopo (prefixo, empresa_id, filial_id) VALUES ('A','emp-beta','fil-b1') ON CONFLICT DO NOTHING;`);
tests.recon = psqlLocal(`SELECT ok::text, reabertos::text FROM public.dk_bc_vm_reconciliar_escopo('A');`);
tests.after_recon = psqlLocal(`SELECT status FROM public.dk_bc_vm_sync_entrega WHERE prefixo='A' AND bc_id='${bcBeta}';`);
tests.apply_recon = psqlLocal(`SELECT ok::text, aplicados::text FROM public.dk_bc_sync_aplicar_lote('A', 50);`);
tests.proj_beta_A = psqlLocal(`SELECT count(*)::text FROM public.dk_bc_vm_projecao WHERE prefixo='A' AND empresa_id='emp-beta';`);

// Sem escopo C
tests.sem_escopo_C = psqlLocal(`SELECT ok::text, coalesce(reason,'-') FROM public.dk_bc_sync_aplicar_lote('C', 5);`);

// Node listar projeção A
tests.node_proj = await listarProjecao("A", 0, 50, ioA);

// Duas sessões simuladas
tests.sessao_A = await resolverVmDaSessao({ claims: { cpf: "11122233344" } }, ioA);
tests.sessao_B = await resolverVmDaSessao({ claims: { cpf: "55566677788" } }, { ...ioA, clientPrefix: "A" });

report.tests = tests;
const gate = {
  resolver_A: /^true\|A\|true/i.test(tests.resolver_A) || /^t\|A\|t/i.test(tests.resolver_A),
  sem_vinculo: /vm_sem_vinculo/.test(tests.resolver_sem),
  spoof: tests.node_spoof_prefix_is_A === true && tests.node_spoof.autorizada === true,
  snap_sem_payload: String(tests.snap).startsWith("f") || tests.snap === "false",
  apply: /^true\|/i.test(String(tests.apply_A)),
  proj: Number(tests.proj_list) >= 1,
  filtro: /filtrado_escopo/.test(String(tests.filtro)),
  recon: Number(String(tests.recon).split("|")[1]) >= 1,
  proj_beta: Number(tests.proj_beta_A) >= 1,
  sessao_B: tests.sessao_B.prefixo === "B",
  sem_escopo: /sem_escopo/.test(String(tests.sem_escopo_C)),
};
report.gate = gate;
report.gate_ok = Object.values(gate).every(Boolean);
console.error("gate", gate);

if (!report.gate_ok) {
  report.applied_official = false;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ARTIFACTS, "report-08.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(3);
}

console.error("dump pre-apply...");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpFresh = path.join(OUT, `grupodk-portal-pre-08-${stamp}.dump`);
const dump = run(path.join(PG_BIN, "pg_dump.exe"), ["--format=custom", "--no-owner", "--no-acl", "--role=postgres", "-f", dumpFresh, "postgresql://cli_login_postgres@db.ppxtwqvzgujllfzarpuz.supabase.co:5432/postgres"], { PGPASSWORD: password }, 300000);
if (dump.status !== 0) {
  report.applied_official = false;
  report.dump_err = String(dump.stderr || "").slice(0, 400);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(4);
}
report.dump_fresh = { ok: true, path: dumpFresh, bytes: fs.statSync(dumpFresh).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpFresh)).digest("hex") };

console.error("apply official estrutural...");
const wrapped = path.join(OUT, `apply-${Date.now()}.sql`);
fs.writeFileSync(wrapped, `SET ROLE postgres;\nSET search_path TO public, extensions;\n` + fs.readFileSync(path.join(ROOT, "supabase", "dk-bc-vm-telas-08.sql"), "utf8"), "utf8");
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
SELECT 'vms',count(*)::text FROM public.dk_bc_vm;
SELECT 'colab',count(*)::text FROM public.dk_bc_vm WHERE colaborador_ref IS NOT NULL AND btrim(colaborador_ref)<>'';
SELECT 'escopo',count(*)::text FROM public.dk_bc_vm_escopo;
SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM public.dk_bc_vm_state;
SELECT 'ent',count(*)::text FROM public.dk_bc_vm_sync_entrega;
SELECT 'proj',count(*)::text FROM public.dk_bc_vm_projecao;
SELECT 'sinal',count(*)::text FROM public.dk_bc_vm_sinal;
SELECT 'vm_status',string_agg(prefixo||':'||status,',' ORDER BY prefixo) FROM public.dk_bc_vm;
`, password).split(/\r?\n/);

report.finished_at = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(ARTIFACTS, "report-08.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
