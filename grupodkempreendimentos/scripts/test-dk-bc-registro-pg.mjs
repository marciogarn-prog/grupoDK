/**
 * Testes BC em PostgreSQL real isolado (PGlite) — sem tocar produção.
 * node grupodkempreendimentos/scripts/test-dk-bc-registro-pg.mjs
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { createHash, randomUUID } from "crypto";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail || "") });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function loadPglite() {
  try {
    const { PGlite } = await import("@electric-sql/pglite");
    const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
    return { PGlite, pgcrypto };
  } catch (e) {
    return { error: e };
  }
}

function prepararSql(sql) {
  let s = sql;
  s = s.replace(/notify pgrst, 'reload schema';/gi, "/* notify omitido no isolado */");
  return `
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
${s}
`;
}

async function rpcConfirmar(db, p) {
  const q = `
    select * from public.dk_bc_confirmar(
      $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text,
      $7::text, $8::text, $9::text, $10::text, $11::text, $12::text, $13::jsonb
    )`;
  const r = await db.query(q, [
    p.operation_id,
    p.vm_provisorio || null,
    p.categoria,
    p.subcategoria || "",
    p.origem,
    p.registro_id,
    p.empresa_id || null,
    p.filial_id || null,
    p.estado || "consolidado",
    p.bc_anterior || null,
    p.hash_integridade || null,
    p.historico_ref || null,
    JSON.stringify(p.payload || {}),
  ]);
  return r.rows[0];
}

async function rpcRejeitar(db, p) {
  const q = `select * from public.dk_bc_rejeitar($1::uuid, $2::text, $3::text, $4::jsonb)`;
  const r = await db.query(q, [
    p.operation_id,
    p.vm_provisorio || null,
    p.motivo || "rejeitado",
    JSON.stringify(p.payload || {}),
  ]);
  return r.rows[0];
}

async function lastBc(db) {
  const r = await db.query(`select last_bc_no from public.dk_bc_state where id = 1`);
  return Number(r.rows[0].last_bc_no);
}

let loaded = await loadPglite();
if (loaded.error) {
  console.error("PGlite indisponível — a instalar localmente…");
  const { execSync } = await import("child_process");
  execSync("npm install @electric-sql/pglite@0.5.16 --no-save --no-fund --no-audit", {
    cwd: ROOT,
    stdio: "inherit",
  });
  loaded = await loadPglite();
}

const { PGlite, pgcrypto } = loaded;
if (!PGlite || !pgcrypto) {
  console.error("Falha ao carregar PGlite+pgcrypto", loaded.error || "");
  process.exit(2);
}

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
await db.exec("create extension if not exists pgcrypto");

const sqlPath = path.join(ROOT, "supabase", "dk-bc-registro.sql");
const sql = prepararSql(fs.readFileSync(sqlPath, "utf8"));

try {
  await db.exec(sql);
  rec("PG isolado: schema BC aplicado", true);
} catch (e) {
  rec("PG isolado: schema BC aplicado", false, e.message || e);
  console.error(e);
  process.exit(1);
}

/* 1. Exclusividade */
const a = await rpcConfirmar(db, {
  operation_id: randomUUID(),
  vm_provisorio: "A000123",
  categoria: "teste",
  origem: "pg.isolado",
  registro_id: "reg-A",
});
const b = await rpcConfirmar(db, {
  operation_id: randomUUID(),
  vm_provisorio: "B000045",
  categoria: "teste",
  origem: "pg.isolado",
  registro_id: "reg-B",
});
rec(
  "1. exclusividade BC",
  a.ok && b.ok && a.bc_id !== b.bc_id && Number(a.bc_no) === 1 && Number(b.bc_no) === 2,
  `${a.bc_id} vs ${b.bc_id}`
);

/* 2. Concorrência (transações sequenciais sob lock FOR UPDATE — PGlite single-thread) */
const conc = [];
for (let i = 0; i < 15; i++) {
  conc.push(
    await rpcConfirmar(db, {
      operation_id: randomUUID(),
      vm_provisorio: `C${1000 + i}`,
      categoria: "teste",
      origem: "pg.isolado",
      registro_id: `reg-C-${i}`,
    })
  );
}
const uniq = new Set(conc.map((x) => x.bc_id));
rec("2. concorrência / unicidade sob FOR UPDATE", conc.every((x) => x.ok) && uniq.size === 15, `unicos=${uniq.size}`);

/* 3. Idempotência */
const opIdem = randomUUID();
const base = {
  operation_id: opIdem,
  vm_provisorio: "D000087",
  categoria: "teste",
  origem: "pg.isolado",
  registro_id: "reg-D",
  payload: { n: 1 },
};
const i1 = await rpcConfirmar(db, base);
const i2 = await rpcConfirmar(db, base);
rec(
  "3. idempotência mesmo conteúdo",
  i1.ok && i2.ok && i2.idempotent === true && i1.bc_id === i2.bc_id,
  i1.bc_id
);
const iDiv = await rpcConfirmar(db, { ...base, payload: { n: 99 } });
rec("3b. conteúdo divergente rejeitado", iDiv.ok === false && iDiv.reason === "conteudo_divergente", iDiv.reason);

/* 4. Rejeição sem consumo */
const beforeRej = await lastBc(db);
const opRej = randomUUID();
const rej = await rpcRejeitar(db, { operation_id: opRej, vm_provisorio: "E000001", motivo: "falha" });
const afterRej = await lastBc(db);
rec(
  "4. rejeição sem consumo do contador",
  rej.ok && rej.status === "rejeitado" && afterRej === beforeRej,
  `${beforeRej}->${afterRej}`
);

/* 5. Versões */
const opV1 = randomUUID();
const v1 = await rpcConfirmar(db, {
  operation_id: opV1,
  categoria: "teste",
  origem: "pg.versao",
  registro_id: "ent-1",
  empresa_id: "emp1",
  filial_id: "fil1",
  payload: { v: 1 },
});
const semAnt = await rpcConfirmar(db, {
  operation_id: randomUUID(),
  categoria: "teste",
  origem: "pg.versao",
  registro_id: "ent-1",
  empresa_id: "emp1",
  filial_id: "fil1",
  payload: { v: 2 },
});
rec("5. bc_anterior obrigatório", v1.ok && !semAnt.ok && semAnt.reason === "bc_anterior_obrigatorio", semAnt.reason);

const beforeV2 = await lastBc(db);
const v2 = await rpcConfirmar(db, {
  operation_id: randomUUID(),
  categoria: "teste",
  origem: "pg.versao",
  registro_id: "ent-1",
  empresa_id: "emp1",
  filial_id: "fil1",
  bc_anterior: v1.bc_id,
  payload: { v: 2 },
});
const hist = await db.query(
  `select bc_id, vigente from public.dk_bc_registro
    where origem='pg.versao' and registro_id='ent-1'
      and coalesce(empresa_id,'')='emp1' and coalesce(filial_id,'')='fil1'
    order by bc_no`
);
const vig = hist.rows.filter((r) => r.vigente);
rec(
  "5b. substituição vigente + histórico",
  v2.ok &&
    hist.rows.length === 2 &&
    vig.length === 1 &&
    vig[0].bc_id === v2.bc_id &&
    hist.rows.find((r) => r.bc_id === v1.bc_id)?.vigente === false,
  `vigente=${vig[0]?.bc_id}`
);

const staleBefore = await lastBc(db);
const stale = await rpcConfirmar(db, {
  operation_id: randomUUID(),
  categoria: "teste",
  origem: "pg.versao",
  registro_id: "ent-1",
  empresa_id: "emp1",
  filial_id: "fil1",
  bc_anterior: v1.bc_id,
  payload: { v: 3 },
});
const staleAfter = await lastBc(db);
rec(
  "5c. versão ultrapassada rejeitada sem consumo",
  !stale.ok && stale.reason === "versao_ultrapassada" && staleAfter === staleBefore,
  stale.reason
);

const outra = await rpcConfirmar(db, {
  operation_id: randomUUID(),
  categoria: "teste",
  origem: "pg.versao",
  registro_id: "ent-2",
  empresa_id: "emp1",
  filial_id: "fil1",
  bc_anterior: v2.bc_id,
});
rec("5d. entidade diferente rejeitada", !outra.ok && outra.reason === "bc_anterior_entidade_diferente", outra.reason);

/* 6. Recuperação após falha de validação */
const beforeBad = await lastBc(db);
const bad = await rpcConfirmar(db, {
  operation_id: randomUUID(),
  vm_provisorio: "Z999",
  categoria: "teste",
  origem: "pg.isolado",
  registro_id: "reg-bad",
});
const afterBad = await lastBc(db);
rec("6. falha não avança contador", !bad.ok && afterBad === beforeBad, bad.reason);

/* Proteção do contador */
let guardOk = false;
try {
  await db.exec(`update public.dk_bc_state set last_bc_no = last_bc_no - 1 where id = 1`);
} catch {
  guardOk = true;
}
rec("segurança: contador não decrementa", guardOk);

let delOk = false;
try {
  await db.exec(`delete from public.dk_bc_registro where bc_id = '${v1.bc_id}'`);
} catch {
  delOk = true;
}
rec("segurança: registo BC não apaga", delOk);

/* 7. Integridade histórico */
const histCount = await db.query(`select count(*)::int as n from public.dk_bc_registro`);
const opCount = await db.query(`select count(*)::int as n from public.dk_bc_operacao where status='confirmado'`);
rec(
  "7. histórico íntegro (registos + ops confirmadas)",
  histCount.rows[0].n >= 2 && opCount.rows[0].n === histCount.rows[0].n,
  `regs=${histCount.rows[0].n} ops=${opCount.rows[0].n}`
);

/* Rollback seguro no isolado */
const rollback = fs.readFileSync(path.join(ROOT, "supabase", "dk-bc-registro-rollback.sql"), "utf8")
  .replace(/notify pgrst, 'reload schema';/gi, "/* omit */");
await db.exec(rollback);
const gone = await db.query(`
  select to_regclass('public.dk_bc_state') as s,
         to_regclass('public.dk_bc_registro') as r,
         to_regclass('public.dk_bc_operacao') as o
`);
rec(
  "rollback isolado remove só dk_bc_*",
  gone.rows[0].s == null && gone.rows[0].r == null && gone.rows[0].o == null
);

/* Reaplicar após rollback */
await db.exec(sql);
const estado = await db.query(`select last_bc_no from public.dk_bc_state where id=1`);
rec("reaplicação pós-rollback reinicia contador em 0", Number(estado.rows[0].last_bc_no) === 0);

await db.close();

const outDir = path.join(ROOT, "artifacts", "bc-tests");
fs.mkdirSync(outDir, { recursive: true });
const report = {
  at: new Date().toISOString(),
  engine: "pglite-isolado",
  results,
  pass: results.every((r) => r.ok),
  sha256_sql: createHash("sha256").update(fs.readFileSync(sqlPath)).digest("hex"),
};
const reportFile = path.join(outDir, `pg-isolado-${report.at.replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log("RELATORIO", reportFile);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`FALHOU ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`OK ${results.length}/${results.length}`);
assert.equal(failed.length, 0);
