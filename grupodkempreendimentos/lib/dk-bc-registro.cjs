/**
 * Numeração BC (Banco Central DK) — servidor apenas.
 * Não numera cadastros existentes. Não grava clientes/veículos/locações.
 * Contador gapless espelha public.dk_bc_confirmar / dk_bc_rejeitar.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function formatBc(no) {
  const n = Number(no);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return "";
  return "BC" + String(n).padStart(12, "0");
}

function parseBcNo(bcId) {
  const m = String(bcId || "").trim().match(/^BC(\d{12})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function uuidOk(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(id || "").trim()
  );
}

function vmProvisorioOk(raw) {
  return /^[A-J][0-9]{1,12}$/.test(String(raw || "").trim());
}

function lerSqlInfra() {
  const file = path.join(__dirname, "..", "supabase", "dk-bc-registro.sql");
  return fs.readFileSync(file, "utf8");
}

async function restRpc(fn, args, io) {
  if (io && typeof io.rpc === "function") return io.rpc(fn, args);
  if (!isSupabaseDoormanConfigured()) {
    return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  }
  const key = serviceRoleKey();
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(args || {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function executarSql(sql, io) {
  if (io && typeof io.sql === "function") return io.sql(sql);
  if (!isSupabaseDoormanConfigured()) {
    return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  }
  const key = serviceRoleKey();
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const destinos = [supabaseUrl() + "/pg/query", supabaseUrl() + "/pg-meta/default/query"];
  let ultimo = { ok: false, status: 404, data: { reason: "sql_indisponivel" } };
  for (const url of destinos) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query: sql }) });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 240) };
    }
    ultimo = { ok: res.ok, status: res.status, data };
    if (res.ok) return ultimo;
  }
  return ultimo;
}

async function garantirSchema(io) {
  const sql = lerSqlInfra();
  const aplicado = await executarSql(sql, io);
  if (!aplicado.ok) {
    return { ok: false, reason: "sql", status: aplicado.status, detalhe: aplicado.data };
  }
  return { ok: true, aplicada: true };
}

async function confirmar(params, io) {
  const p = params && typeof params === "object" ? params : {};
  const operationId = String(p.operation_id || p.operationId || "").trim();
  if (!uuidOk(operationId)) {
    return { ok: false, reason: "operation_id_ausente", status: 400 };
  }
  const body = {
    p_operation_id: operationId,
    p_vm_provisorio: p.vm_provisorio || p.vmProvisorio || null,
    p_categoria: p.categoria,
    p_subcategoria: p.subcategoria || "",
    p_origem: p.origem,
    p_registro_id: p.registro_id || p.registroId,
    p_empresa_id: p.empresa_id || p.empresaId || null,
    p_filial_id: p.filial_id || p.filialId || null,
    p_estado: p.estado || "consolidado",
    p_bc_anterior: p.bc_anterior || p.bcAnterior || null,
    p_hash_integridade: p.hash_integridade || p.hashIntegridade || null,
    p_historico_ref: p.historico_ref || p.historicoRef || null,
    p_payload: p.payload && typeof p.payload === "object" ? p.payload : {},
  };
  const res = await restRpc("dk_bc_confirmar", body, io);
  if (!res.ok) {
    return { ok: false, status: res.status, reason: "rpc_falhou", data: res.data };
  }
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  if (!row) return { ok: false, reason: "resposta_vazia", status: 502 };
  return {
    ok: Boolean(row.ok),
    bc_id: row.bc_id || null,
    bc_no: row.bc_no != null ? Number(row.bc_no) : null,
    bc_composto: row.bc_composto || null,
    status: row.status || null,
    idempotent: Boolean(row.idempotent),
    reason: row.reason || null,
  };
}

async function rejeitar(params, io) {
  const p = params && typeof params === "object" ? params : {};
  const operationId = String(p.operation_id || p.operationId || "").trim();
  if (!uuidOk(operationId)) {
    return { ok: false, reason: "operation_id_ausente", status: 400 };
  }
  const body = {
    p_operation_id: operationId,
    p_vm_provisorio: p.vm_provisorio || p.vmProvisorio || null,
    p_motivo: p.motivo || "rejeitado",
    p_payload: p.payload && typeof p.payload === "object" ? p.payload : {},
  };
  const res = await restRpc("dk_bc_rejeitar", body, io);
  if (!res.ok) {
    return { ok: false, status: res.status, reason: "rpc_falhou", data: res.data };
  }
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  if (!row) return { ok: false, reason: "resposta_vazia", status: 502 };
  return {
    ok: Boolean(row.ok),
    status: row.status || null,
    idempotent: Boolean(row.idempotent),
    reason: row.reason || null,
    last_bc_no: row.last_bc_no != null ? Number(row.last_bc_no) : null,
  };
}

/**
 * Simulador transacional em memória — mesmos invariantes do SQL (testes isolados).
 */
function criarMemoriaBc() {
  const state = { last_bc_no: 0 };
  const registros = new Map();
  const operacoesByOp = new Map();
  const operacoesByVm = new Map();
  let lock = Promise.resolve();

  function withLock(fn) {
    const run = lock.then(() => fn());
    lock = run.catch(() => {});
    return run;
  }

  async function confirmarMem(params) {
    return withLock(() => {
      const operationId = String(params.operation_id || "").trim();
      if (!uuidOk(operationId)) return { ok: false, reason: "operation_id_ausente" };
      const categoria = String(params.categoria || "").trim();
      const origem = String(params.origem || "").trim();
      const registroId = String(params.registro_id || "").trim();
      if (!categoria) return { ok: false, reason: "categoria_vazia" };
      if (!origem) return { ok: false, reason: "origem_vazia" };
      if (!registroId) return { ok: false, reason: "registro_id_vazio" };
      const vm = params.vm_provisorio ? String(params.vm_provisorio).trim() : null;
      if (vm && !vmProvisorioOk(vm)) return { ok: false, reason: "vm_provisorio_invalido" };

      const exist = operacoesByOp.get(operationId);
      if (exist && exist.status === "confirmado") {
        return {
          ok: true,
          bc_id: exist.bc_id,
          bc_no: parseBcNo(exist.bc_id),
          bc_composto: exist.bc_composto,
          status: "confirmado",
          idempotent: true,
          reason: null,
        };
      }
      if (exist && exist.status === "rejeitado") {
        return {
          ok: false,
          bc_id: null,
          bc_no: null,
          bc_composto: null,
          status: "rejeitado",
          idempotent: true,
          reason: exist.motivo_rejeicao || "ja_rejeitado",
        };
      }
      if (vm) {
        const byVm = operacoesByVm.get(vm);
        if (byVm && byVm.operation_id !== operationId) {
          return { ok: false, reason: "vm_provisorio_em_uso", status: byVm.status, idempotent: false };
        }
        if (byVm && byVm.status === "confirmado") {
          return {
            ok: true,
            bc_id: byVm.bc_id,
            bc_no: parseBcNo(byVm.bc_id),
            bc_composto: byVm.bc_composto,
            status: "confirmado",
            idempotent: true,
            reason: null,
          };
        }
      }
      if (params.bc_anterior && !registros.has(String(params.bc_anterior).trim())) {
        return { ok: false, reason: "bc_anterior_inexistente" };
      }

      /* Transação simulada: incrementa só se insert completar. */
      const next = state.last_bc_no + 1;
      const bcId = formatBc(next);
      const composto = vm ? `${vm}-${bcId}` : bcId;
      const reg = {
        bc_id: bcId,
        bc_no: next,
        categoria,
        subcategoria: String(params.subcategoria || ""),
        origem,
        registro_id: registroId,
        estado: String(params.estado || "consolidado"),
        versao_bc: bcId,
        bc_anterior: params.bc_anterior || null,
        hash_integridade: params.hash_integridade || null,
        historico_ref: params.historico_ref || null,
        payload: params.payload && typeof params.payload === "object" ? params.payload : {},
      };
      registros.set(bcId, reg);
      state.last_bc_no = next;
      const op = {
        operation_id: operationId,
        vm_provisorio: vm,
        vm_prefix: vm ? vm[0] : null,
        status: "confirmado",
        bc_id: bcId,
        bc_composto: composto,
        motivo_rejeicao: null,
      };
      operacoesByOp.set(operationId, op);
      if (vm) operacoesByVm.set(vm, op);
      return {
        ok: true,
        bc_id: bcId,
        bc_no: next,
        bc_composto: composto,
        status: "confirmado",
        idempotent: false,
        reason: null,
      };
    });
  }

  async function rejeitarMem(params) {
    return withLock(() => {
      const operationId = String(params.operation_id || "").trim();
      if (!uuidOk(operationId)) return { ok: false, reason: "operation_id_ausente" };
      const vm = params.vm_provisorio ? String(params.vm_provisorio).trim() : null;
      if (vm && !vmProvisorioOk(vm)) return { ok: false, reason: "vm_provisorio_invalido" };
      const exist = operacoesByOp.get(operationId);
      if (exist && exist.status === "confirmado") {
        return {
          ok: false,
          status: "confirmado",
          idempotent: true,
          reason: "ja_confirmado",
          last_bc_no: state.last_bc_no,
        };
      }
      if (exist && exist.status === "rejeitado") {
        return {
          ok: true,
          status: "rejeitado",
          idempotent: true,
          reason: null,
          last_bc_no: state.last_bc_no,
        };
      }
      const op = {
        operation_id: operationId,
        vm_provisorio: vm,
        vm_prefix: vm ? vm[0] : null,
        status: "rejeitado",
        bc_id: null,
        bc_composto: null,
        motivo_rejeicao: String(params.motivo || "rejeitado").slice(0, 500),
      };
      operacoesByOp.set(operationId, op);
      if (vm) operacoesByVm.set(vm, op);
      return {
        ok: true,
        status: "rejeitado",
        idempotent: false,
        reason: null,
        last_bc_no: state.last_bc_no,
      };
    });
  }

  function snapshot() {
    return {
      last_bc_no: state.last_bc_no,
      registros: [...registros.values()],
      operacoes: [...operacoesByOp.values()],
    };
  }

  return { confirmar: confirmarMem, rejeitar: rejeitarMem, snapshot, formatBc };
}

function novoOperationId() {
  return crypto.randomUUID();
}

module.exports = {
  formatBc,
  parseBcNo,
  uuidOk,
  vmProvisorioOk,
  lerSqlInfra,
  garantirSchema,
  confirmar,
  rejeitar,
  criarMemoriaBc,
  novoOperationId,
  restRpc,
  executarSql,
};
