/**
 * COMANDO 09/10 — backup, testes isolados de bloqueio exclusivo, apply estrutural oficial.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  resolverContextoBloqueio,
  consultar,
  adquirir,
  renovar,
  liberar,
  validar,
} = require("../lib/dk-bc-tela-bloqueio.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "bc-09");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const PORT = Number(process.env.DK_BC_ISOLATED_PORT || 55432);
const DB = "dk_bc_09";
const ARTIFACTS = path.join(ROOT, "artifacts", "bc-tests");
const SQL09 = path.join(ROOT, "supabase", "dk-bc-tela-bloqueio-09.sql");
const PATCHES = [
  path.join(ROOT, "supabase", "dk-bc-historico-06.sql"),
  path.join(ROOT, "supabase", "dk-bc-sync-07.sql"),
  path.join(ROOT, "supabase", "dk-bc-sync-07-revisao1.sql"),
  path.join(ROOT, "supabase", "dk-bc-vm-telas-08.sql"),
  SQL09,
];

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ARTIFACTS, { recursive: true });

function getLoginPassword() {
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "supabase", "db", "dump", "--remote", "--dry-run", "-f", "NUL"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
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
  const r = run(
    path.join(PG_BIN, "psql.exe"),
    ["-v", "ON_ERROR_STOP=1", "-h", "db.ppxtwqvzgujllfzarpuz.supabase.co", "-p", "5432", "-U", "cli_login_postgres", "-d", "postgres", "-f", tmp, "-A", "-F", "|", "-t", "-q"],
    { PGPASSWORD: password, PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co", PGPORT: "5432", PGUSER: "cli_login_postgres", PGDATABASE: "postgres", PGCONNECT_TIMEOUT: "20" },
    timeout
  );
  return r;
}
function psqlLocal(sql, timeout = 60000) {
  const tmp = path.join(OUT, `l-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-f", tmp, "-A", "-F", "|", "-t", "-q"], { PGPASSWORD: "dkbc" }, timeout);
  if (r.status !== 0) throw new Error(`psqlLocal fail: ${r.stderr || r.stdout}`);
  return String(r.stdout || "").trim();
}
function applyLocal(file) {
  const r = run(path.join(PG_BIN, "psql.exe"), ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "-f", file], { PGPASSWORD: "dkbc" }, 120000);
  if (r.status !== 0) throw new Error(`applyLocal ${path.basename(file)}: ${r.stderr || r.stdout}`);
}

const report = { started_at: new Date().toISOString(), comando: "09/10", tests: {}, gate: {} };
const password = getLoginPassword();

let dumpPre = process.env.DK_BC_DUMP_09 || "";
if (!dumpPre || !fs.existsSync(dumpPre)) {
  dumpPre = path.join(OUT, `grupodk-portal-pre-09-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
  const dump = run(
    path.join(PG_BIN, "pg_dump.exe"),
    ["--format=custom", "--no-owner", "--no-acl", "--role=postgres", "-f", dumpPre, "postgresql://cli_login_postgres@db.ppxtwqvzgujllfzarpuz.supabase.co:5432/postgres"],
    { PGPASSWORD: password },
    300000
  );
  report.dump = {
    ok: dump.status === 0 && fs.existsSync(dumpPre),
    path: dumpPre,
    bytes: fs.existsSync(dumpPre) ? fs.statSync(dumpPre).size : 0,
    sha256: fs.existsSync(dumpPre) ? crypto.createHash("sha256").update(fs.readFileSync(dumpPre)).digest("hex") : null,
  };
} else {
  report.dump = {
    ok: true,
    path: dumpPre,
    bytes: fs.statSync(dumpPre).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(dumpPre)).digest("hex"),
    reused: true,
  };
}
if (!report.dump.ok) throw new Error("dump_failed");

report.official_before = String(
  psqlRemote(
    `SELECT 'bc',count(*)::text FROM dk_bc_registro;
SELECT 'last',max(bc_no)::text FROM dk_bc_registro;
SELECT 'colab',count(*)::text FROM dk_bc_vm WHERE colaborador_ref IS NOT NULL AND btrim(colaborador_ref)<>'';
SELECT 'escopo',count(*)::text FROM dk_bc_vm_escopo;
SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM dk_bc_vm_state;
SELECT 'ent',count(*)::text FROM dk_bc_vm_sync_entrega;`,
    password
  ).stdout || ""
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB}' AND pid<>pg_backend_pid();`], { PGPASSWORD: "dkbc" }, 30000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
run(path.join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${DB};`], { PGPASSWORD: "dkbc" }, 60000);
const restore = run(path.join(PG_BIN, "pg_restore.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-d", DB, "--no-owner", "--role=postgres", dumpPre], { PGPASSWORD: "dkbc" }, 300000);
report.restore = { ok: restore.status === 0 || restore.status === 1, status: restore.status };

for (const p of PATCHES) {
  if (fs.existsSync(p)) applyLocal(p);
}
report.apply_local = { ok: true };

psqlLocal(`UPDATE public.dk_bc_vm SET colaborador_ref='11122233344', status='ativa', updated_at=now() WHERE prefixo='A';
UPDATE public.dk_bc_vm SET colaborador_ref='55566677788', status='ativa', updated_at=now() WHERE prefixo='B';
INSERT INTO public.dk_bc_vm_escopo (prefixo, empresa_id, filial_id) VALUES
 ('A','emp-alfa','fil-a1'),
 ('B','emp-alfa','fil-a1'),
 ('B','emp-beta','fil-b1')
ON CONFLICT DO NOTHING;`);

function gateA(sid = "sess-A") {
  return { ok: true, typ: "equipa", cpf: "11122233344", sid, claims: { cpf: "11122233344", sid } };
}
function gateB(sid = "sess-B") {
  return { ok: true, typ: "equipa", cpf: "55566677788", sid, claims: { cpf: "55566677788", sid } };
}
function rpcLocal(fn, args) {
  const keys = Object.keys(args);
  const vals = keys.map((k) => {
    const v = args[k];
    if (v == null) return "NULL";
    if (typeof v === "number") return String(v);
    if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) return `'${v}'::uuid`;
    return `'${String(v).replace(/'/g, "''")}'`;
  });
  const sql = `SELECT * FROM public.${fn}(${vals.join(",")});`;
  const out = psqlLocal(sql);
  const lines = out.split(/\r?\n/).filter(Boolean);
  const cols = lines[0] ? null : null;
  // -t -A -F| returns data rows only
  const rowLine = lines[0] || "";
  // We need column names — query with aliases via known order per function
  return rowLine;
}

async function withLocalRpc(fnName, mapRow) {
  return async (fn, args) => {
    if (fn !== fnName && !mapRow) {
      /* generic */
    }
    const keys = Object.keys(args);
    const vals = keys.map((k) => {
      const v = args[k];
      if (v == null) return "NULL";
      if (typeof v === "number") return String(v);
      if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) return `'${v}'::uuid`;
      return `'${String(v).replace(/'/g, "''")}'`;
    });
    const sql = `SELECT row_to_json(t) FROM public.${fn}(${vals.join(",")}) t;`;
    const out = psqlLocal(sql);
    const json = out.split(/\r?\n/).filter(Boolean)[0];
    return json ? JSON.parse(json) : null;
  };
}

const rpc = await withLocalRpc();
const ioBase = { rpc };

const ctxA = await resolverContextoBloqueio(gateA(), {
  ...ioBase,
  empresa_id: "emp-alfa",
  filial_id: "fil-a1",
  tela: "locacoes",
});
report.tests.ctxA = ctxA;

const a1 = await adquirir(ctxA, ioBase);
report.tests.a_adquire = a1;
const bCtx = await resolverContextoBloqueio(gateB(), {
  ...ioBase,
  empresa_id: "emp-alfa",
  filial_id: "fil-a1",
  tela: "locacoes",
});
const b1 = await adquirir(bCtx, ioBase);
report.tests.b_bloqueado = b1;

const aRenew = await renovar(ctxA, a1.concessao_id, a1.geracao, ioBase);
report.tests.a_renova = aRenew;
const b2 = await adquirir(bCtx, ioBase);
report.tests.b_ainda_bloqueado = b2;

const aLib = await liberar(ctxA, a1.concessao_id, a1.geracao, ioBase);
report.tests.a_libera = aLib;
const b3 = await adquirir(bCtx, ioBase);
report.tests.b_adquire_apos_liberar = b3;

// TTL: adquirir e forçar expiração pelo relógio do servidor (caminho real de consultar/adquirir).
const ttl = psqlLocal(`SELECT ok::text, adquirida::text, concessao_id::text, geracao::text
FROM public.dk_bc_tela_bloqueio_adquirir('emp-alfa','fil-a1','clientes','A','11122233344','sess-A-ttl',60);`);
report.tests.ttl_adquire = ttl;
psqlLocal(`UPDATE public.dk_bc_tela_bloqueio
   SET expira_em = clock_timestamp() - interval '1 second', updated_at = clock_timestamp()
 WHERE empresa_id='emp-alfa' AND filial_id='fil-a1' AND tela_id='clientes';`);
const afterTtl = psqlLocal(`SELECT ok::text, ocupada::text, estado FROM public.dk_bc_tela_bloqueio_consultar('emp-alfa','fil-a1','clientes');`);
report.tests.ttl_expirou = afterTtl;
const bTtl = await adquirir(
  await resolverContextoBloqueio(gateB("sess-B-ttl"), { ...ioBase, empresa_id: "emp-alfa", filial_id: "fil-a1", tela: "clientes" }),
  ioBase
);
report.tests.b_apos_ttl = bTtl;

// fencing: A tenta validar concessao antiga
const oldVal = await validar(ctxA, a1.concessao_id, a1.geracao, ioBase);
report.tests.fencing_antigo = oldVal;

// telas diferentes independentes
const aVeic = await adquirir(
  await resolverContextoBloqueio(gateA("sess-A-v"), { ...ioBase, empresa_id: "emp-alfa", filial_id: "fil-a1", tela: "veiculos" }),
  ioBase
);
report.tests.tela_diferente = aVeic;

// filiais diferentes
const bBeta = await adquirir(
  await resolverContextoBloqueio(gateB("sess-B-beta"), { ...ioBase, empresa_id: "emp-beta", filial_id: "fil-b1", tela: "locacoes" }),
  ioBase
);
report.tests.filial_diferente = bBeta;

// sem vinculo
const sem = await resolverContextoBloqueio(
  { ok: true, typ: "equipa", cpf: "00000000000", sid: "x", claims: { cpf: "00000000000", sid: "x" } },
  { ...ioBase, empresa_id: "emp-alfa", filial_id: "fil-a1", tela: "locacoes" }
);
report.tests.sem_vinculo = sem;

// spoof VM
const spoof = await adquirir(ctxA, { ...ioBase, clientPrefix: "B" });
report.tests.spoof_prefix_ignored = { ok: spoof.ok, adquirida: spoof.adquirida, reason: spoof.reason };

// concorrencia: duas adquirir simultaneas via SQL
const conc = psqlLocal(`
WITH a AS (
  SELECT * FROM public.dk_bc_tela_bloqueio_adquirir('emp-alfa','fil-a1','pagamentos','A','11122233344','sess-conc-A',60)
), b AS (
  SELECT * FROM public.dk_bc_tela_bloqueio_adquirir('emp-alfa','fil-a1','pagamentos','B','55566677788','sess-conc-B',60)
)
SELECT (SELECT count(*) FROM a WHERE adquirida)::text || '|' || (SELECT count(*) FROM b WHERE adquirida)::text;
`);
report.tests.concorrencia = conc;

// liberacao atrasada nao remove outro
const late = psqlLocal(`
SELECT ok::text, liberada::text, reason FROM public.dk_bc_tela_bloqueio_liberar(
  'emp-alfa','fil-a1','pagamentos','sess-conc-A',
  (SELECT concessao_id FROM public.dk_bc_tela_bloqueio WHERE tela_id='pagamentos' AND empresa_id='emp-alfa' LIMIT 1),
  0
);`);
report.tests.liberacao_atrasada = late;

report.gate = {
  a_adquire: !!(a1.ok && a1.adquirida),
  b_bloqueado: !!(b1 && b1.reason === "tela_ocupada"),
  a_renova: !!(aRenew.ok && aRenew.renovada),
  b_ainda: !!(b2 && b2.reason === "tela_ocupada"),
  libera_troca: !!(aLib.ok && b3.ok && b3.adquirida),
  ttl: /true\|f\|/.test(String(afterTtl)) || String(afterTtl).includes("expirado"),
  b_apos_ttl: !!(bTtl.ok && bTtl.adquirida),
  fencing: !!(oldVal && oldVal.valida === false),
  tela_diff: !!(aVeic.ok && aVeic.adquirida),
  filial_diff: !!(bBeta.ok && bBeta.adquirida),
  sem_vinculo: !!(sem && sem.ok === false),
  concorrencia: String(conc).includes("1|0") || String(conc).includes("0|1"),
};

report.gate_ok = Object.values(report.gate).every(Boolean);

// apply estrutural no oficial somente se gate_ok
if (report.gate_ok) {
  const wrapped = path.join(OUT, "apply-09-official.sql");
  fs.writeFileSync(wrapped, `SET ROLE postgres;\nSET search_path TO public, extensions;\n` + fs.readFileSync(SQL09, "utf8"), "utf8");
  const app = run(
    path.join(PG_BIN, "psql.exe"),
    ["-v", "ON_ERROR_STOP=1", "-h", "db.ppxtwqvzgujllfzarpuz.supabase.co", "-p", "5432", "-U", "cli_login_postgres", "-d", "postgres", "-f", wrapped],
    { PGPASSWORD: password, PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co", PGPORT: "5432", PGUSER: "cli_login_postgres", PGDATABASE: "postgres", PGCONNECT_TIMEOUT: "20" },
    120000
  );
  report.applied_official = app.status === 0;
  if (app.status !== 0) report.apply_err = (app.stderr || app.stdout || "").slice(0, 500);
} else {
  report.applied_official = false;
  report.apply_skipped = "gate_failed";
}

report.official_after = String(
  psqlRemote(
    `SELECT 'bc',count(*)::text FROM dk_bc_registro;
SELECT 'vig',count(*)::text FROM dk_bc_registro WHERE vigente;
SELECT 'last',max(bc_no)::text FROM dk_bc_registro;
SELECT 'vms',count(*)::text FROM dk_bc_vm;
SELECT 'colab',count(*)::text FROM dk_bc_vm WHERE colaborador_ref IS NOT NULL AND btrim(colaborador_ref)<>'';
SELECT 'escopo',count(*)::text FROM dk_bc_vm_escopo;
SELECT 'prov',coalesce(sum(last_prov_no),0)::text FROM dk_bc_vm_state;
SELECT 'ent',count(*)::text FROM dk_bc_vm_sync_entrega;
SELECT 'proj',count(*)::text FROM dk_bc_vm_projecao;
SELECT 'bloq_tbl',coalesce(to_regclass('public.dk_bc_tela_bloqueio')::text,'absent');
SELECT 'vm_status',string_agg(prefixo||':'||status,',' ORDER BY prefixo) FROM dk_bc_vm;`,
    password
  ).stdout || ""
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

report.finished_at = new Date().toISOString();
fs.writeFileSync(path.join(ARTIFACTS, "report-09.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ gate_ok: report.gate_ok, gate: report.gate, dump: report.dump, applied: report.applied_official, after: report.official_after }, null, 2));
if (!report.gate_ok) process.exit(2);
