/**
 * Testes isolados da infra BC (sem numerar produção, sem alterar cadastros).
 * node grupodkempreendimentos/scripts/test-dk-bc-registro.mjs
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bc = require("../lib/dk-bc-registro.cjs");

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

/* ---- SQL estático ---- */
const sql = fs.readFileSync(path.join(ROOT, "supabase", "dk-bc-registro.sql"), "utf8");
rec("SQL define dk_bc_state / registro / operacao", /dk_bc_state/.test(sql) && /dk_bc_registro/.test(sql) && /dk_bc_operacao/.test(sql));
rec("SQL formata BC com 12 dígitos", /dk_bc_format/.test(sql) && /lpad\(p_no::text, 12, '0'\)/.test(sql));
rec("SQL confirma com FOR UPDATE no contador", /dk_bc_confirmar/.test(sql) && /for update/i.test(sql));
rec("SQL rejeita sem avançar contador", /dk_bc_rejeitar/.test(sql) && /last_bc_no/.test(sql));
rec("SQL não usa SEQUENCE para BC", !/create sequence.*bc/i.test(sql));
rec("SQL RLS + só service_role", /enable row level security/.test(sql) && /grant execute on function public\.dk_bc_confirmar/.test(sql));
rec("SQL aditivo (create if not exists)", /create table if not exists public\.dk_bc_state/.test(sql));
rec("lib formatBc", bc.formatBc(1) === "BC000000000001" && bc.formatBc(3001) === "BC000000003001");
rec("lib vm_provisorio", bc.vmProvisorioOk("A000123") && bc.vmProvisorioOk("J9") && !bc.vmProvisorioOk("K0001") && !bc.vmProvisorioOk("a0001"));

/* ---- Memória: testes 1–4 ---- */
const mem = bc.criarMemoriaBc();

const opA = bc.novoOperationId();
const opB = bc.novoOperationId();
const r1 = await mem.confirmar({
  operation_id: opA,
  vm_provisorio: "A000123",
  categoria: "teste",
  subcategoria: "infra",
  origem: "test.isolado",
  registro_id: "reg-A",
});
const r2 = await mem.confirmar({
  operation_id: opB,
  vm_provisorio: "B000045",
  categoria: "teste",
  subcategoria: "infra",
  origem: "test.isolado",
  registro_id: "reg-B",
});
rec(
  "1. dois registos diferentes não recebem o mesmo BC",
  r1.ok && r2.ok && r1.bc_id !== r2.bc_id && r1.bc_no === 1 && r2.bc_no === 2,
  `${r1.bc_id} vs ${r2.bc_id}`
);
rec(
  "composto VM-BC",
  r1.bc_composto === "A000123-BC000000000001" && r2.bc_composto === "B000045-BC000000000002",
  `${r1.bc_composto} | ${r2.bc_composto}`
);

const concurrent = await Promise.all(
  Array.from({ length: 20 }, (_, i) =>
    mem.confirmar({
      operation_id: bc.novoOperationId(),
      vm_provisorio: `C${String(1000 + i)}`,
      categoria: "teste",
      subcategoria: "concorrencia",
      origem: "test.isolado",
      registro_id: `reg-C-${i}`,
    })
  )
);
const bcIds = concurrent.map((x) => x.bc_id);
const uniq = new Set(bcIds);
rec(
  "2. operações simultâneas recebem identificadores diferentes",
  concurrent.every((x) => x.ok) && uniq.size === 20,
  `unicos=${uniq.size}`
);

const opRep = bc.novoOperationId();
const first = await mem.confirmar({
  operation_id: opRep,
  vm_provisorio: "D000087",
  categoria: "teste",
  subcategoria: "idem",
  origem: "test.isolado",
  registro_id: "reg-D",
});
const second = await mem.confirmar({
  operation_id: opRep,
  vm_provisorio: "D000087",
  categoria: "teste",
  subcategoria: "idem",
  origem: "test.isolado",
  registro_id: "reg-D",
});
const snapAposIdem = mem.snapshot();
rec(
  "3. operação repetida preserva identificação original",
  first.ok &&
    second.ok &&
    second.idempotent === true &&
    first.bc_id === second.bc_id &&
    first.bc_composto === second.bc_composto,
  `${first.bc_id} idem=${second.idempotent}`
);

const lastBeforeReject = mem.snapshot().last_bc_no;
const opRej = bc.novoOperationId();
const rej = await mem.rejeitar({
  operation_id: opRej,
  vm_provisorio: "E000001",
  motivo: "validacao_falhou",
});
const lastAfterReject = mem.snapshot().last_bc_no;
const temBcRejeitado = mem.snapshot().registros.some((r) => r.registro_id === "nao-deve-existir");
const opRejRow = mem.snapshot().operacoes.find((o) => o.operation_id === opRej);
rec(
  "4. operação rejeitada não gera BC nem avança contador",
  rej.ok &&
    rej.status === "rejeitado" &&
    lastAfterReject === lastBeforeReject &&
    opRejRow &&
    opRejRow.bc_id == null &&
    !temBcRejeitado,
  `last=${lastBeforeReject}->${lastAfterReject}`
);

const rejAgain = await mem.rejeitar({ operation_id: opRej, motivo: "de_novo" });
rec("rejeição repetida é idempotente", rejAgain.ok && rejAgain.idempotent === true);

const afterRejectConfirm = await mem.confirmar({
  operation_id: opRej,
  vm_provisorio: "E000001",
  categoria: "teste",
  origem: "test.isolado",
  registro_id: "reg-E",
});
rec(
  "rejeitada não pode ser confirmada com o mesmo operation_id",
  afterRejectConfirm.ok === false && afterRejectConfirm.status === "rejeitado",
  afterRejectConfirm.reason || ""
);

const last = mem.snapshot().last_bc_no;
const next = await mem.confirmar({
  operation_id: bc.novoOperationId(),
  vm_provisorio: "F000001",
  categoria: "teste",
  origem: "test.isolado",
  registro_id: "reg-F",
});
rec(
  "após rejeição o próximo BC continua sequencial sem lacuna artificial da rejeição",
  next.ok && next.bc_no === last + 1,
  `${next.bc_id} (esperado ${bc.formatBc(last + 1)})`
);

/* Cancelamento simulado: se a «transação» falha antes de commit, contador não avança.
   Na memória, confirmar é atómico; validamos que falha de validação não incrementa. */
const beforeBad = mem.snapshot().last_bc_no;
const bad = await mem.confirmar({
  operation_id: bc.novoOperationId(),
  vm_provisorio: "Z999",
  categoria: "teste",
  origem: "test.isolado",
  registro_id: "reg-bad",
});
rec(
  "validação inválida não avança contador (sem lacuna)",
  bad.ok === false && mem.snapshot().last_bc_no === beforeBad,
  bad.reason || ""
);

rec("lib exporta garantirSchema/confirmar/rejeitar", typeof bc.garantirSchema === "function" && typeof bc.confirmar === "function");
rec("SQL embutido legível pela lib", bc.lerSqlInfra().includes("dk_bc_confirmar"));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`FALHOU ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`OK ${results.length}/${results.length}`);
assert.equal(failed.length, 0);
