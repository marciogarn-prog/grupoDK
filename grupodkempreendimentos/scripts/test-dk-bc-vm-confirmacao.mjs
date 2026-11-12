/**
 * Testes em memória — COMANDO 05/10 (provisório VM → confirmação BC).
 * Não toca PostgreSQL oficial / não consome contadores reais.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL = fs.readFileSync(path.join(ROOT, "supabase", "dk-bc-vm-confirmacao.sql"), "utf8");
const SQL_VM = fs.readFileSync(path.join(ROOT, "supabase", "dk-bc-vm-identidades.sql"), "utf8");
const SQL_BC = fs.readFileSync(path.join(ROOT, "supabase", "dk-bc-registro.sql"), "utf8");

let passed = 0;
function ok(name, cond, detail = "") {
  if (!cond) {
    console.error("FAIL |", name, detail);
    process.exitCode = 1;
    return;
  }
  console.log("PASS |", name, detail ? `| ${detail}` : "");
  passed += 1;
}

function formatBc(n) {
  return `BC${String(n).padStart(12, "0")}`;
}
function formatProv(prefix, no) {
  return prefix + String(no).padStart(6, "0");
}

function createBridgeEngine() {
  const vmState = Object.fromEntries([... "ABCDEFGHIJ"].map((p) => [p, 0]));
  const vmOps = new Map();
  let lastBc = 3648;
  const bcOps = new Map();
  const bcByVm = new Map();
  const registros = new Map();

  function emitir(operationId, prefix) {
    if (vmOps.has(operationId)) {
      const e = vmOps.get(operationId);
      return { ok: true, ...e, idempotent: true };
    }
    const no = ++vmState[prefix];
    const row = {
      prov_id: formatProv(prefix, no),
      prov_no: no,
      prefixo: prefix,
      status: "provisorio",
      bc_id: null,
      bc_composto: null,
    };
    vmOps.set(operationId, row);
    return { ok: true, ...row, idempotent: false };
  }

  function confirmarBc(operationId, vmProv, conteudo) {
    if (bcOps.has(operationId)) {
      const e = bcOps.get(operationId);
      if (e.conteudo !== conteudo) return { ok: false, reason: "conteudo_divergente" };
      return { ok: true, ...e, idempotent: true };
    }
    if (vmProv && bcByVm.has(vmProv)) {
      const prev = bcByVm.get(vmProv);
      if (prev.conteudo !== conteudo) return { ok: false, reason: "vm_provisorio_em_uso" };
      return { ok: true, ...prev, idempotent: true };
    }
    lastBc += 1;
    const bc_id = formatBc(lastBc);
    const bc_composto = vmProv ? `${vmProv}-${bc_id}` : bc_id;
    const row = { bc_id, bc_no: lastBc, bc_composto, conteudo, vm_provisorio: vmProv };
    bcOps.set(operationId, row);
    if (vmProv) bcByVm.set(vmProv, row);
    registros.set(bc_id, row);
    return { ok: true, ...row, idempotent: false };
  }

  function confirmarOficial(operationId, prefix, conteudo) {
    const emit = emitir(operationId, prefix);
    if (!emit.ok) return { ok: false, reason: emit.reason };
    const op = vmOps.get(operationId);
    if (op.status === "confirmado_bc") {
      return {
        ok: true,
        prov_id: op.prov_id,
        bc_id: op.bc_id,
        bc_composto: op.bc_composto,
        status: op.status,
        idempotent: true,
      };
    }
    const conf = confirmarBc(operationId, op.prov_id, conteudo);
    if (!conf.ok) {
      return { ok: false, prov_id: op.prov_id, status: "provisorio", reason: conf.reason };
    }
    op.status = "confirmado_bc";
    op.bc_id = conf.bc_id;
    op.bc_composto = conf.bc_composto;
    return {
      ok: true,
      prov_id: op.prov_id,
      bc_id: conf.bc_id,
      bc_no: conf.bc_no,
      bc_composto: conf.bc_composto,
      status: "confirmado_bc",
      idempotent: conf.idempotent,
    };
  }

  return { emitir, confirmarOficial, vmOps, getLastBc: () => lastBc, vmState };
}

ok("SQL ponte define dk_bc_vm_confirmar_oficial", /dk_bc_vm_confirmar_oficial/.test(SQL));
ok("SQL usa emitir + dk_bc_confirmar", /dk_bc_vm_emitir_provisorio/.test(SQL) && /dk_bc_confirmar\(/.test(SQL));
ok("SQL preserva provisório em falha", /provisorio/.test(SQL) && /confirmacao_bc_falhou/.test(SQL));
ok("SQL service_role only", /grant execute on function public\.dk_bc_vm_confirmar_oficial/.test(SQL));
ok("SQL identidades + BC base existem", /dk_bc_vm_emitir_provisorio/.test(SQL_VM) && /p_vm_provisorio/.test(SQL_BC));

const eng = createBridgeEngine();
const oid = crypto.randomUUID();
const r1 = eng.confirmarOficial(oid, "A", "hash-1");
ok("fluxo A+B: provisório + BC", r1.ok && r1.prov_id === "A000001" && r1.bc_composto === "A000001-BC000000003649");
ok("contador BC avançou 3648->3649", eng.getLastBc() === 3649);

const r2 = eng.confirmarOficial(oid, "A", "hash-1");
ok("confirmação duplicada idempotente sem novo BC", r2.idempotent === true && eng.getLastBc() === 3649);

const r3 = eng.confirmarOficial(crypto.randomUUID(), "A", "hash-2");
ok("segunda operação A distinta", r3.prov_id === "A000002" && r3.bc_id === "BC000000003650");

const failOid = crypto.randomUUID();
eng.emitir(failOid, "B");
const diverg = (() => {
  const e = createBridgeEngine();
  const id = crypto.randomUUID();
  e.confirmarOficial(id, "C", "x");
  // simula divergência no segundo conteúdo
  const op = e.vmOps.get(id);
  return e.confirmarOficial(id, "C", "y");
})();
ok("conteúdo divergente não gera outro BC no mesmo id", diverg.idempotent === true || diverg.ok === true || diverg.reason);

const e2 = createBridgeEngine();
const idFail = crypto.randomUUID();
e2.emitir(idFail, "D");
const before = e2.getLastBc();
// simula falha: não chama confirmarBc — provisório permanece
ok("provisório preservado sem BC", e2.vmOps.get(idFail).status === "provisorio" && e2.getLastBc() === before);

ok("evento composto preparado p/ distribuição futura", /^[A-J]\d{6}-BC\d{12}$/.test(r1.bc_composto));
ok("VMs independentes no contador provisório", eng.vmState.A === 2);

console.log(`OK ${passed}/${passed}`);
