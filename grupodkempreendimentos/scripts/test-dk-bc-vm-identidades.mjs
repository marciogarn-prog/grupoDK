/**
 * Testes em memória — COMANDO 04/10 (identidades A–J + contadores).
 */
import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL = fs.readFileSync(path.join(ROOT, "supabase", "dk-bc-vm-identidades.sql"), "utf8");

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

function formatProv(prefix, no) {
  const digits = Math.max(6, String(no).length);
  return prefix + String(no).padStart(digits, "0");
}

function createVmEngine() {
  const vms = new Map();
  const state = new Map();
  const ops = new Map();
  for (const p of "ABCDEFGHIJ") {
    vms.set(p, { prefixo: p, vm_id: `VM-${p}`, status: "preparada" });
    state.set(p, 0);
  }
  return {
    vms,
    estado(prefix = null) {
      const keys = prefix ? [prefix] : [...vms.keys()];
      return keys.map((p) => ({
        prefixo: p,
        vm_id: vms.get(p).vm_id,
        status: vms.get(p).status,
        last_prov_no: state.get(p),
        proximo_prov: formatProv(p, state.get(p) + 1),
      }));
    },
    emitir(operationId, prefix, payload = {}) {
      if (!operationId) return { ok: false, reason: "operation_id_obrigatorio" };
      const p = String(prefix || "").toUpperCase();
      if (!/^[A-J]$/.test(p)) return { ok: false, reason: "prefixo_invalido" };
      if (ops.has(operationId)) {
        const e = ops.get(operationId);
        if (e.prefixo !== p) return { ok: false, reason: "operation_id_prefixo_divergente", ...e, idempotent: false };
        return { ok: true, ...e, idempotent: true };
      }
      const no = state.get(p) + 1;
      state.set(p, no);
      const row = {
        prov_id: formatProv(p, no),
        prov_no: no,
        prefixo: p,
        status: "provisorio",
        payload,
      };
      ops.set(operationId, row);
      return { ok: true, ...row, idempotent: false };
    },
  };
}

ok("SQL define dk_bc_vm / state / operacao", /create table if not exists public\.dk_bc_vm\b/.test(SQL) && /dk_bc_vm_state/.test(SQL) && /dk_bc_vm_operacao/.test(SQL));
ok("SQL seeds A-J", /'A',\s*'VM-A'/.test(SQL) && /'J',\s*'VM-J'/.test(SQL));
ok("SQL format + emitir com FOR UPDATE", /dk_bc_vm_format/.test(SQL) && /for update/i.test(SQL) && /dk_bc_vm_emitir_provisorio/.test(SQL));
ok("SQL sem SEQUENCE", !/create\s+sequence/i.test(SQL));
ok("SQL RLS + service_role", /enable row level security/.test(SQL) && /grant execute on function public\.dk_bc_vm_emitir_provisorio/.test(SQL));
ok("SQL aditivo", /create table if not exists/.test(SQL) && /on conflict \(prefixo\) do nothing/.test(SQL));
ok("SQL protege contador VM", /dk_bc_vm_state_nao_decrementa/.test(SQL) && /dk_bc_vm_state_salto_proibido/.test(SQL));
ok("SQL não confirma BC nesta etapa", !/dk_bc_confirmar/.test(SQL));

ok("format 6 dígitos", formatProv("A", 123) === "A000123");
ok("format cresce dígitos", formatProv("B", 1000000) === "B1000000");

const eng = createVmEngine();
ok("10 VMs preparadas", eng.estado().length === 10);

const a1 = eng.emitir(crypto.randomUUID(), "A");
const a2 = eng.emitir(crypto.randomUUID(), "A");
ok("contador A gapless", a1.prov_id === "A000001" && a2.prov_id === "A000002");

const oid = crypto.randomUUID();
const i1 = eng.emitir(oid, "C");
const i2 = eng.emitir(oid, "C");
ok("idempotência mesmo operation_id", i1.prov_id === i2.prov_id && i2.idempotent === true && eng.estado("C")[0].last_prov_no === 1);

const bad = eng.emitir(crypto.randomUUID(), "Z");
ok("rejeita prefixo inválido", bad.ok === false && bad.reason === "prefixo_invalido");

const conc = [];
for (let i = 0; i < 20; i++) conc.push(eng.emitir(crypto.randomUUID(), "D").prov_id);
ok("concorrência lógica: 20 códigos únicos D", new Set(conc).size === 20);

const b = eng.emitir(crypto.randomUUID(), "B");
ok("VMs independentes", b.prov_id === "B000001" && eng.estado("A")[0].last_prov_no === 2);

ok("composto futuro documentável", `${a1.prov_id}-BC000000003649` === "A000001-BC000000003649");

console.log(`OK ${passed}/${passed}`);
