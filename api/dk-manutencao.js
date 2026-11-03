/**
 * Manutenção relacional (public.dk_manutencao).
 * Leitura/escrita com operation_id. Snapshot não é autoridade de write.
 */
const { applyApiCors, enforceRateLimit, requireLiveSession, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");
const { isSupabaseDoormanConfigured } = require("../lib/dk-supabase-doorman.cjs");
const { restRpc } = require("../lib/dk-atomic-write.cjs");
const atomicLpm = require("../lib/dk-atomic-write-lpm.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const FLAG = "dk:portal:manutencao_fonte:v1";
const FONTE = "dk_manutencao";

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL).trim().replace(/\/$/, "");
}

function lerBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

async function rest(path, opts = {}) {
  if (!isSupabaseDoormanConfigured()) return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  const key = serviceRoleKey();
  const res = await fetch(supabaseUrl() + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(opts.prefer ? { Prefer: opts.prefer } : {}),
    },
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
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

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (await enforceRateLimit(req, res, "manutencao-pg", 60)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });

  try {
    if (req.method === "GET") {
      const kind = String(req.query?.kind || "").trim();
      let path =
        "dk_manutencao?deleted_at=is.null&select=id,source_kind,source_id,placa,payload,record_version,updated_at&order=source_kind.asc,source_id.asc&limit=2000";
      if (kind === "historico" || kind === "rapida") {
        path =
          "dk_manutencao?deleted_at=is.null&source_kind=eq." +
          encodeURIComponent(kind) +
          "&select=id,source_kind,source_id,placa,payload,record_version,updated_at&order=source_id.asc&limit=2000";
      }
      const lido = await rest(path);
      if (!lido.ok) return res.status(lido.status || 502).json({ ok: false, reason: "leitura", source: FONTE });
      const rows = Array.isArray(lido.data) ? lido.data : [];
      return res.status(200).json({
        ok: true,
        source: FONTE,
        flag: FLAG,
        quantidade: rows.length,
        data: rows.map((r) => ({ ...(r.payload || {}), id: r.source_id || r.id, _pgId: r.id, _record_version: r.record_version, _kind: r.source_kind })),
      });
    }

    if (req.method === "POST") {
      const writeGate = await requireModuleAccess(req, "manutencao");
      if (!writeGate.ok) return res.status(writeGate.status).json({ ok: false, reason: writeGate.reason });
      const body = lerBody(req);
      const opId = body.operation_id || body.operationId;
      if (!opId) return res.status(400).json({ ok: false, reason: "operation_id_obrigatorio" });
      const atom = await atomicLpm.mutarManutencaoAtomico({
        action: body.op || body.action || "update",
        id: body.id,
        sourceKind: body.source_kind || body.kind || "historico",
        manutencao: body.manutencao || body.registro || body,
        expectedVersion: body.version != null ? body.version : body.record_version,
        operationId: opId,
        actorUserId: writeGate.cpf || null,
        actorSessionId: writeGate.sid || null,
        route: "/api/dk-manutencao",
        method: "POST",
      });
      return res.status(atom.status || 400).json(atom.body || atom);
    }
    return res.status(405).json({ ok: false, reason: "method" });
  } catch (err) {
    return res.status(500).json({ ok: false, reason: String(err && err.message ? err.message : err) });
  }
};
