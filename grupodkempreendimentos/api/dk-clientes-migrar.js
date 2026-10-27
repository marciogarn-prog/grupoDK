/**
 * Copia aditiva dos clientes do snapshot para public.dk_clientes.
 * Não grava nem altera a label default. Só o titular CEO chama.
 */
const { applyApiCors, requireLiveSession, TITULAR_CEO_CPF } = require("../lib/dk-portal-auth.cjs");
const { onlyDigits } = require("../lib/dk-deploy-channel-api.cjs");
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const clientesPg = require("../lib/dk-clientes-pg.cjs");

async function lerColecaoClientes() {
  const urlBase = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co")
    .trim()
    .replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) return { ok: false, reason: "doorman_key_missing" };
  const select = "clientes:payload->dk_clientes_cadastro,espelho:payload->dk_portal_clientes_cadastro";
  const url = `${urlBase}/rest/v1/dk_cloud_snapshots?label=eq.default&select=${encodeURIComponent(select)}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return { ok: false, reason: "snapshot_leitura_lenta" };
  }
  if (!res.ok) return { ok: false, reason: `supabase_http_${res.status}` };
  const rows = await res.json().catch(() => null);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) return { ok: false, reason: "snapshot" };
  return {
    ok: true,
    origem: Array.isArray(row.clientes) ? row.clientes : [],
    espelho: Array.isArray(row.espelho) ? row.espelho : [],
  };
}

const HASH_SNAPSHOT_ANTES = "f1895cadb4e918af0edf624f56463f8e1510eb8bf5afe47ab8d7f4e381f8a22f";

function hashInventario(lista) {
  const hashes = (Array.isArray(lista) ? lista : []).map((item) =>
    clientesPg.sha256(JSON.stringify(item, Object.keys(item || {}).sort()))
  );
  hashes.sort();
  return clientesPg.sha256(hashes.join("\n"));
}

async function lerEspelhoRedis(redis) {
  const raw = await redis.get("dk:portal:cloud_snapshot:v1");
  let row = raw;
  if (typeof raw === "string") {
    try { row = JSON.parse(raw); } catch { return null; }
  }
  if (!row || typeof row !== "object" || !row.payload) return null;
  return row;
}

function detalheSeguro(valor) {
  const texto = JSON.stringify(valor || "").slice(0, 240);
  return texto.replace(/[A-Za-z0-9_\-]{24,}/g, "[longo]");
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });
  if (onlyDigits(gate.cpf).slice(0, 11) !== TITULAR_CEO_CPF) {
    return res.status(403).json({ ok: false, reason: "somente_titular" });
  }
  if (!isRedisKvConfigured()) return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  const redis = createRedisClient();

  const snapDireto = await lerColecaoClientes();
  let snap = snapDireto;
  let fonteLida = "dk_clientes_cadastro";
  let antesUpdated = null;
  if (!snap || !snap.ok) {
    const espelhoRedis = await lerEspelhoRedis(redis);
    const payload = espelhoRedis && espelhoRedis.payload;
    const origemRedis = payload && Array.isArray(payload.dk_clientes_cadastro) ? payload.dk_clientes_cadastro : [];
    const espelhoChave = payload && Array.isArray(payload.dk_portal_clientes_cadastro) ? payload.dk_portal_clientes_cadastro : [];
    const hashConfere = origemRedis.length === 437 && hashInventario(origemRedis) === HASH_SNAPSHOT_ANTES;
    if (!hashConfere) {
      return res.status(503).json({
        ok: false,
        reason: (snapDireto && snapDireto.reason) || "snapshot",
        cache_quantidade: origemRedis.length,
        cache_igual_ao_snapshot: false,
        fonte_ligada: false,
      });
    }
    snap = { ok: true, origem: origemRedis, espelho: espelhoChave };
    antesUpdated = (espelhoRedis && espelhoRedis.updated_at) || antesUpdated;
    fonteLida = "redis_espelho_do_snapshot_default";
  }
  const antes = { updatedAt: antesUpdated };
  const origem = snap.origem;
  const espelho = snap.espelho;
  const resumoOrigem = clientesPg.resumirLista(origem);
  const cursor = origem.find((item) => clientesPg.onlyDigits(item && item.cpf).slice(0, 11) === "90000000175") || null;
  const tabela = await clientesPg.garantirTabela();
  if (!tabela.ok) {
    return res.status(503).json({
      ok: false,
      reason: tabela.reason || "tabela",
      status: tabela.status || 0,
      detalhe: detalheSeguro(tabela.detalhe),
      snapshot_updated_at: antes.updatedAt,
      clientes_origem: resumoOrigem.quantidade,
      fonte_ligada: false,
    });
  }
  const copia = await clientesPg.copiarLista(origem);
  if (!copia.ok) {
    return res.status(502).json({
      ok: false,
      reason: "copia",
      gravados: copia.gravados || 0,
      detalhe: detalheSeguro(copia.data),
      fonte_ligada: false,
    });
  }
  const lido = await clientesPg.listarClientes();
  if (!lido.ok) return res.status(502).json({ ok: false, reason: "leitura_tabela", fonte_ligada: false });
  const comparacao = clientesPg.compararListas(origem, lido.clientes);
  const depoisEspelho = await lerEspelhoRedis(redis);
  const depoisUpdated = depoisEspelho && depoisEspelho.updated_at;
  const snapshotIgual = String(depoisUpdated || "") === String(antes.updatedAt || "");
  if (!comparacao.ok || !snapshotIgual) {
    return res.status(409).json({
      ok: false,
      reason: comparacao.ok ? "snapshot_mudou" : "divergencia",
      comparacao,
      snapshot_antes: antes.updatedAt,
      snapshot_depois: depoisUpdated,
      fonte_ligada: false,
    });
  }
  await redis.set(clientesPg.FLAG_REDIS, clientesPg.FONTE);
  return res.status(200).json({
    ok: true,
    fonte: "dk_clientes_cadastro",
    fonte_lida: fonteLida,
    espelho_igual: clientesPg.canon(origem) === clientesPg.canon(espelho),
    tabela: "public.dk_clientes",
    tabela_criada: tabela.criada === true,
    origem: resumoOrigem,
    destino: clientesPg.resumirLista(lido.clientes),
    comparacao,
    cursor1: cursor
      ? { id: String(cursor.id || ""), cpf: "90000000175", nome: String(cursor.nome || ""), recado2: String(cursor.recado2 || "") }
      : null,
    snapshot_antes: antes.updatedAt,
    snapshot_depois: depoisUpdated,
    snapshot_alterado: false,
    fonte_ligada: true,
    bytes_clientes: Buffer.byteLength(JSON.stringify(origem)),
  });
};
