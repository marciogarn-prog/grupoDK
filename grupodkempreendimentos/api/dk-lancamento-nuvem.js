/**
 * Caixa pequena do lançamento de aluguel.
 * Não lê nem regrava o snapshot inteiro. O Redis guarda só o pagamento e responde.
 * O computador só segue depois desse ok. O pagamento local permanece até lá.
 * Os outros computadores leem esta caixa quando entram no sistema.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession } = require("../lib/dk-portal-auth.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");

const FILA_KEY = "dk:portal:lancamentos_fila:v1";

function parseBody(req) {
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

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function lerItem(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    const item = JSON.parse(raw);
    return item && typeof item === "object" ? item : null;
  } catch {
    return null;
  }
}

function listaDeMapa(all) {
  const itens = [];
  const mapa = all && typeof all === "object" ? all : {};
  for (const raw of Object.values(mapa)) {
    const item = lerItem(raw);
    if (item && item.pagamento) itens.push(item);
  }
  return itens;
}

function ehAluguel(pagamento) {
  const tipo = String(pagamento?.tipoMovimento || "")
    .trim()
    .toUpperCase();
  if (!tipo || tipo === "PAGAMENTO" || tipo === "ALUGUEL") return true;
  return !(tipo.includes("DEVOL") || tipo.includes("CREDIT") || tipo.includes("CAUC"));
}

function mesmaCobranca(a, b) {
  if (!ehAluguel(a) || !ehAluguel(b)) return false;
  const va = Number(a?.valor);
  const vb = Number(b?.valor);
  if (!Number.isFinite(va) || !Number.isFinite(vb) || va <= 0 || vb <= 0) return false;
  if (Math.round(va * 100) !== Math.round(vb * 100)) return false;
  const da = String(a?.data || a?.dataPagamento || "").trim();
  const db = String(b?.data || b?.dataPagamento || "").trim();
  return Boolean(da) && da === db;
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (await enforceRateLimit(req, res, "lancamento-nuvem", 60)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });
  if (!isRedisKvConfigured()) return res.status(503).json({ ok: false, reason: "kv_not_configured" });

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      const itens = listaDeMapa(await redis.hgetall(FILA_KEY));
      return res.status(200).json({ ok: true, source: "redis", itens });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const pagamento = body.pagamento;
      const protocolo = String(pagamento?.protocoloLancamento || "").trim();
      const nc = onlyDigits(body.numeroContrato || body.nc);
      if (!pagamento || typeof pagamento !== "object" || !protocolo || !nc) {
        return res.status(400).json({ ok: false, reason: "lancamento_incompleto" });
      }
      const atuais = listaDeMapa(await redis.hgetall(FILA_KEY));
      const ja = atuais.find((item) => String(item?.pagamento?.protocoloLancamento || "").trim() === protocolo);
      const repetido = !ja && atuais.find(
        (item) => onlyDigits(item?.nc) === nc && mesmaCobranca(item?.pagamento, pagamento)
      );
      if (repetido) {
        return res.status(409).json({
          ok: false,
          reason: "duplicate_payment_same_day_value",
          protocolo: nc,
          message: "JÁ EXISTE UM PAGAMENTO IGUAL NESTE PROTOCOLO. O NOVO LANÇAMENTO NÃO FOI GRAVADO NA NUVEM.",
        });
      }
      const item = {
        nc,
        cpf: onlyDigits(body.cpf).slice(0, 11),
        placa: String(body.placa || "")
          .trim()
          .toUpperCase(),
        pagamento,
        at: new Date().toISOString(),
      };
      const central = await executarGravacaoCentral({
        ...ioSnapshotOficial("default"),
        baseRevision: body.base_revision || body.revision || "",
        mutar(payload) {
          const fila = Array.isArray(payload.dk_lancamentos_fila_v1) ? payload.dk_lancamentos_fila_v1 : [];
          payload.dk_lancamentos_fila_v1 = fila
            .filter((row) => String(row?.pagamento?.protocoloLancamento || "") !== protocolo)
            .concat([item]);
        },
        cache: async () => {
          await redis.hset(FILA_KEY, { [protocolo]: JSON.stringify(item) });
        },
      });
      if (central.status !== 200) return res.status(central.status).json(central.body);
      return res.status(200).json({
        ...central.body,
        protocolo,
      });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
