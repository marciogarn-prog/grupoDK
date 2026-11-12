/**
 * Testes isolados da infra BC v2 (memória) — sem numerar produção.
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

const sql = fs.readFileSync(path.join(ROOT, "supabase", "dk-bc-registro.sql"), "utf8");
rec("SQL define dk_bc_state / registro / operacao", /dk_bc_state/.test(sql) && /dk_bc_registro/.test(sql) && /dk_bc_operacao/.test(sql));
rec("SQL formata BC com 12 dígitos", /dk_bc_format/.test(sql) && /lpad\(p_no::text, 12, '0'\)/.test(sql));
rec("SQL confirma com FOR UPDATE no contador", /dk_bc_confirmar/.test(sql) && /for update/i.test(sql));
rec("SQL rejeita sem avançar contador", /dk_bc_rejeitar/.test(sql) && /last_bc_no/.test(sql));
rec("SQL não usa SEQUENCE para BC", !/create sequence.*bc/i.test(sql));
rec("SQL RLS + só service_role", /enable row level security/.test(sql) && /grant execute on function public\.dk_bc_confirmar/.test(sql));
rec("SQL aditivo (create if not exists)", /create table if not exists public\.dk_bc_state/.test(sql));
rec("SQL versionamento vigente + índice único", /vigente boolean/.test(sql) && /dk_bc_registro_vigente_unico_idx/.test(sql));
rec("SQL conteudo_hash + rejeição versao_ultrapassada", /dk_bc_conteudo_hash/.test(sql) && /versao_ultrapassada/.test(sql));
rec("SQL protege contador e registos", /dk_bc_state_proteger/.test(sql) && /dk_bc_registro_proteger/.test(sql));
rec("lib formatBc", bc.formatBc(1) === "BC000000000001" && bc.formatBc(3001) === "BC000000003001");
rec("lib vm_provisorio", bc.vmProvisorioOk("A000123") && bc.vmProvisorioOk("J9") && !bc.vmProvisorioOk("K0001") && !bc.vmProvisorioOk("a0001"));

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
  "1. exclusividade: dois registos não recebem o mesmo BC",
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
  "2. concorrência: operações simultâneas com BC distintos",
  concurrent.every((x) => x.ok) && uniq.size === 20,
  `unicos=${uniq.size}`
);

const opRep = bc.novoOperationId();
const firstPayload = {
  operation_id: opRep,
  vm_provisorio: "D000087",
  categoria: "teste",
  subcategoria: "idem",
  origem: "test.isolado",
  registro_id: "reg-D",
  payload: { n: 1 },
};
const first = await mem.confirmar(firstPayload);
const second = await mem.confirmar(firstPayload);
rec(
  "3. idempotência: mesmo id+conteúdo devolve o mesmo BC",
  first.ok && second.ok && second.idempotent === true && first.bc_id === second.bc_id,
  `${first.bc_id} idem=${second.idempotent}`
);

const divergente = await mem.confirmar({
  ...firstPayload,
  payload: { n: 2 },
});
rec(
  "3b. mesmo id com conteúdo diferente é rejeitado",
  divergente.ok === false && divergente.reason === "conteudo_divergente",
  divergente.reason || ""
);

const lastBeforeReject = mem.snapshot().last_bc_no;
const opRej = bc.novoOperationId();
const rej = await mem.rejeitar({
  operation_id: opRej,
  vm_provisorio: "E000001",
  motivo: "validacao_falhou",
});
const lastAfterReject = mem.snapshot().last_bc_no;
const opRejRow = mem.snapshot().operacoes.find((o) => o.operation_id === opRej);
rec(
  "4. rejeição não consome BC nem avança contador",
  rej.ok &&
    rej.status === "rejeitado" &&
    lastAfterReject === lastBeforeReject &&
    opRejRow &&
    opRejRow.bc_id == null,
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
  "após rejeição o próximo BC continua sequencial",
  next.ok && next.bc_no === last + 1,
  `${next.bc_id}`
);

const beforeBad = mem.snapshot().last_bc_no;
const bad = await mem.confirmar({
  operation_id: bc.novoOperationId(),
  vm_provisorio: "Z999",
  categoria: "teste",
  origem: "test.isolado",
  registro_id: "reg-bad",
});
rec(
  "6. falha de validação não avança contador",
  bad.ok === false && mem.snapshot().last_bc_no === beforeBad,
  bad.reason || ""
);

const opV1 = bc.novoOperationId();
const v1 = await mem.confirmar({
  operation_id: opV1,
  categoria: "teste",
  origem: "test.versao",
  registro_id: "ent-1",
  empresa_id: "emp1",
  filial_id: "fil1",
  payload: { v: 1 },
});
const semAnterior = await mem.confirmar({
  operation_id: bc.novoOperationId(),
  categoria: "teste",
  origem: "test.versao",
  registro_id: "ent-1",
  empresa_id: "emp1",
  filial_id: "fil1",
  payload: { v: 2 },
});
rec(
  "5. segunda versão sem bc_anterior é rejeitada",
  v1.ok && semAnterior.ok === false && semAnterior.reason === "bc_anterior_obrigatorio",
  semAnterior.reason || ""
);

const opV2 = bc.novoOperationId();
const v2 = await mem.confirmar({
  operation_id: opV2,
  categoria: "teste",
  origem: "test.versao",
  registro_id: "ent-1",
  empresa_id: "emp1",
  filial_id: "fil1",
  bc_anterior: v1.bc_id,
  payload: { v: 2 },
});
const snapV = mem.snapshot();
const hist = snapV.registros.filter((r) => r.origem === "test.versao" && r.registro_id === "ent-1");
const vigentes = hist.filter((r) => r.vigente);
rec(
  "5b. substituição: só a nova versão fica vigente; histórico preservado",
  v2.ok &&
    hist.length === 2 &&
    vigentes.length === 1 &&
    vigentes[0].bc_id === v2.bc_id &&
    hist.find((r) => r.bc_id === v1.bc_id)?.vigente === false,
  `vigente=${vigentes[0]?.bc_id} hist=${hist.length}`
);

const stale = await mem.confirmar({
  operation_id: bc.novoOperationId(),
  categoria: "teste",
  origem: "test.versao",
  registro_id: "ent-1",
  empresa_id: "emp1",
  filial_id: "fil1",
  bc_anterior: v1.bc_id,
  payload: { v: 3 },
});
rec(
  "5c. versão ultrapassada rejeitada sem consumir BC",
  stale.ok === false &&
    stale.reason === "versao_ultrapassada" &&
    mem.snapshot().last_bc_no === snapV.last_bc_no,
  stale.reason || ""
);

const outraEnt = await mem.confirmar({
  operation_id: bc.novoOperationId(),
  categoria: "teste",
  origem: "test.versao",
  registro_id: "ent-2",
  empresa_id: "emp1",
  filial_id: "fil1",
  bc_anterior: v2.bc_id,
});
rec(
  "5d. bc_anterior de outra entidade rejeitado",
  outraEnt.ok === false && outraEnt.reason === "bc_anterior_entidade_diferente",
  outraEnt.reason || ""
);

rec("7. histórico: ambas as versões permanecem no catálogo", hist.length === 2);

rec("lib exporta garantirSchema/confirmar/rejeitar", typeof bc.garantirSchema === "function" && typeof bc.confirmar === "function");
rec("SQL embutido legível pela lib", bc.lerSqlInfra().includes("dk_bc_confirmar"));
rec(
  "doc backup PG pré-activação existe",
  fs.existsSync(path.join(ROOT, "docs", "dk-bc-backup-restauracao.md"))
);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`FALHOU ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`OK ${results.length}/${results.length}`);
assert.equal(failed.length, 0);
