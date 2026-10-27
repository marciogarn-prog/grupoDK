/**
 * Sincronização do cadastro de clientes (API no root do projeto para Vercel).
 * Variáveis obrigatórias: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");
const {
  onlyDigits,
  resolveDeployChannel,
  fetchPortalCadastrosFromRedis,
  matchClienteProtocoloGate,
  dropClientesCpfExcluidos,
} = require("../lib/dk-deploy-channel-api.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");
const clientesPg = require("../lib/dk-clientes-pg.cjs");

const STORAGE_KEY = "dk:portal:clientes_cadastro:v1";

function parseRedisArray(raw) {
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

async function clientesFontePronta(redis) {
  try {
    const flag = await redis.get(clientesPg.FLAG_REDIS);
    if (String(flag || "") !== clientesPg.FONTE) return false;
  } catch {
    return false;
  }
  const existe = await clientesPg.tabelaExiste();
  return Boolean(existe && existe.ok && existe.existe);
}

function aplicarUpsertCliente(base, cliente) {
  const cpf = onlyDigits(cliente && cliente.cpf).slice(0, 11);
  const lista = (Array.isArray(base) ? base : []).map((item) => ({ ...item }));
  const idx = lista.findIndex((item) => onlyDigits(item && item.cpf).slice(0, 11) === cpf);
  const recebido = { ...cliente, cpf };
  delete recebido.senha;
  if (idx === -1) {
    lista.push(recebido);
    return lista;
  }
  const prev = lista[idx];
  lista[idx] = {
    ...prev,
    ...recebido,
    cpf,
    id: prev.id || recebido.id,
  };
  if (prev.senha && !lista[idx].senha) lista[idx].senha = prev.senha;
  return lista;
}

module.exports = async function handler(req, res) {
  applyApiCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (await enforceRateLimit(req, res, "cadastro-clientes", 30)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();
  const channel = resolveDeployChannel(req);

  try {
    if (req.method === "GET") {
      const gate = req.query?.gate === "1" || req.query?.gate === "true";
      if (gate) {
        const cpf = onlyDigits(req.query?.cpf || "").slice(0, 11);
        const protoIn = String(req.query?.protocolo || req.query?.proto || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        if (cpf.length !== 11) {
          return res.status(400).json({ ok: false, msg: "Informe um CPF válido (11 dígitos)." });
        }
        if (!protoIn) {
          return res.status(400).json({ ok: false, msg: "Informe o protocolo da locação." });
        }
        const pronta = await clientesFontePronta(redis);
        let clientesGate;
        if (pronta) {
          const lido = await clientesPg.listarClientes();
          if (!lido.ok) return res.status(502).json({ ok: false, msg: "Clientes indisponíveis.", reason: "leitura" });
          clientesGate = dropClientesCpfExcluidos(lido.clientes);
        }
        const pacote = await fetchPortalCadastrosFromRedis(redis, channel);
        if (!pronta) clientesGate = pacote.clientes;
        const result = matchClienteProtocoloGate(cpf, protoIn, clientesGate, pacote.locs);
        if (!result.ok) {
          return res.status(404).json({ ok: false, msg: result.msg });
        }
        return res.status(200).json({
          ok: true,
          cpf: result.cpf,
          proto: result.proto,
          nome: result.nome,
          channel,
        });
      }

      if (await clientesFontePronta(redis)) {
        const t0 = Date.now();
        const lido = await clientesPg.listarClientes();
        if (!lido.ok) {
          return res.status(502).json({ ok: false, reason: "leitura", source: clientesPg.FONTE });
        }
        return res.status(200).json({
          ok: true,
          data: dropClientesCpfExcluidos(lido.clientes),
          channel,
          source: clientesPg.FONTE,
          duracao_ms: Date.now() - t0,
        });
      }

      const { clientes } = await fetchPortalCadastrosFromRedis(redis, channel);
      if (clientes.length) {
        return res.status(200).json({ ok: true, data: clientes, channel });
      }
      const raw = await redis.get(STORAGE_KEY);
      const data = parseRedisArray(raw);
      return res.status(200).json({ ok: true, data, channel });
    }

    if (req.method === "POST") {
      const writeGate = await requireModuleAccess(req, "cliente");
      if (!writeGate.ok) {
        return res.status(writeGate.status).json({ ok: false, reason: writeGate.reason, modulo: writeGate.modulo });
      }
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const operacao = String(body?.operacao || body?.operação || "")
        .trim()
        .toLowerCase();
      const umCliente =
        operacao === "upsert" && body?.cliente && typeof body.cliente === "object" && !Array.isArray(body.cliente);
      if (umCliente && onlyDigits(body.cliente.cpf).slice(0, 11).length !== 11) {
        return res.status(400).json({ ok: false, success: false, reason: "cpf" });
      }
      if (umCliente && !dropClientesCpfExcluidos([body.cliente]).length) {
        return res.status(400).json({ ok: false, success: false, reason: "cliente_rejeitado" });
      }
      if (await clientesFontePronta(redis)) {
        if (umCliente) {
          const um = await clientesPg.upsertUm(body.cliente, body.base_revision || body.revision || "");
          return res.status(um.status).json(um.body);
        }
        const lista = Array.isArray(body?.data) ? body.data : [];
        const aceitos = dropClientesCpfExcluidos(lista);
        for (const item of aceitos) {
          const um = await clientesPg.upsertUm(item, "", null, { ignorarRevisao: true });
          if (!um.ok) return res.status(um.status).json(um.body);
        }
        return res.status(200).json({
          ok: true,
          success: true,
          persistencia: "supabase",
          source: clientesPg.FONTE,
          count: aceitos.length,
          snapshot_gravacoes: 0,
        });
      }
      const incoming = umCliente ? [body.cliente] : Array.isArray(body?.data) ? body.data : [];
      let merged = incoming;
      let guardado = null;
      const central = await executarGravacaoCentral({
        ...ioSnapshotOficial(channel === "demo" ? "demo" : "default"),
        baseRevision: body.base_revision || body.revision || "",
        mutar(payload) {
          const base = Array.isArray(payload.dk_clientes_cadastro) ? payload.dk_clientes_cadastro : [];
          merged = umCliente
            ? dropClientesCpfExcluidos(aplicarUpsertCliente(base, body.cliente))
            : dropClientesCpfExcluidos(mergeClientesCadastro(base, incoming));
          payload.dk_clientes_cadastro = merged;
          payload.dk_portal_clientes_cadastro = merged;
          if (umCliente) {
            const cpfUm = onlyDigits(body.cliente.cpf).slice(0, 11);
            guardado = merged.find((item) => onlyDigits(item && item.cpf).slice(0, 11) === cpfUm) || null;
          }
        },
        cache: async () => {
          await redis.set(STORAGE_KEY, JSON.stringify(merged));
        },
      });
      if (central.status !== 200) return res.status(central.status).json(central.body);
      const eco = guardado
        ? {
            id: String(guardado.id || ""),
            cpf: onlyDigits(guardado.cpf).slice(0, 11),
            nome: String(guardado.nome || ""),
            recado2: String(guardado.recado2 || ""),
          }
        : null;
      return res.status(200).json({
        ...central.body,
        count: merged.length,
        snapshot_gravacoes: 1,
        ...(eco ? { cliente: eco } : {}),
      });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
