/**
 * Copia aditiva dos clientes do snapshot para public.dk_clientes.
 * Não grava nem altera a label default. Só o titular CEO chama.
 */
const { applyApiCors, requireLiveSession, TITULAR_CEO_CPF } = require("../lib/dk-portal-auth.cjs");
const { onlyDigits } = require("../lib/dk-deploy-channel-api.cjs");
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { fetchSnapshotRevisionByLabel } = require("../lib/dk-supabase-doorman.cjs");
const clientesPg = require("../lib/dk-clientes-pg.cjs");

async function lerColecaoClientes() {
  const urlBase = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co")
    .trim()
    .replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) return { ok: false, reason: "doorman_key_missing" };
  const select = "clientes:payload->dk_clientes_cadastro,espelho:payload->dk_portal_clientes_cadastro";
  const url = `${urlBase}/rest/v1/dk_cloud_snapshots?label=eq.default&select=${encodeURIComponent(select)}`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
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

  const antes = await fetchSnapshotRevisionByLabel("default");
  if (!antes || !antes.ok) return res.status(503).json({ ok: false, reason: antes && antes.reason || "revisao" });
  const snap = await lerColecaoClientes();
  if (!snap || !snap.ok) {
    return res.status(503).json({ ok: false, reason: (snap && snap.reason) || "snapshot" });
  }
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
  const depois = await fetchSnapshotRevisionByLabel("default");
  const snapshotIgual = Boolean(depois && depois.ok && String(depois.updatedAt) === String(antes.updatedAt));
  if (!comparacao.ok || !snapshotIgual) {
    return res.status(409).json({
      ok: false,
      reason: comparacao.ok ? "snapshot_mudou" : "divergencia",
      comparacao,
      snapshot_antes: antes.updatedAt,
      snapshot_depois: depois && depois.updatedAt,
      fonte_ligada: false,
    });
  }
  const redis = createRedisClient();
  await redis.set(clientesPg.FLAG_REDIS, clientesPg.FONTE);
  return res.status(200).json({
    ok: true,
    fonte: "dk_clientes_cadastro",
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
    snapshot_depois: depois.updatedAt,
    snapshot_alterado: false,
    fonte_ligada: true,
    bytes_clientes: Buffer.byteLength(JSON.stringify(origem)),
  });
};
