/**
 * GET  /api/dk-maquina-virtual — lista ou lê a VM (?lista=1 | ?cpf= | ?conferir=1)
 * POST /api/dk-maquina-virtual — acao: garantir | garantir-todos | login-espelhar |
 *   sincronizar-pc | espelhar-hub | consultar-delta | conferir
 */
const { applyApiCors, enforceRateLimit, requireLiveSession, onlyDigits } = require("../lib/dk-portal-auth.cjs");
const vm = require("../lib/dk-maquina-virtual.cjs");

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

function isOwner(gate) {
  return Boolean(gate && (gate.service || String(gate.role || "").trim() === "owner"));
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (await enforceRateLimit(req, res, "maquina-virtual", 120)) return;

  /* Cron / serviço pode conferir alinhamento com secret. */
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  const authHeader = String(req.headers.authorization || "");
  const isCron =
    Boolean(cronSecret) && (authHeader === `Bearer ${cronSecret}` || String(req.headers["x-dk-backup-secret"] || "") === cronSecret);

  let gate = { ok: false };
  if (!isCron) {
    gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
    if (!gate.ok) return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized" });
  } else {
    gate = { ok: true, service: true, role: "owner", cpf: "" };
  }

  const cpfSessao = onlyDigits(gate.cpf).slice(0, 11);

  try {
    if (req.method === "GET") {
      if (String((req.query && req.query.conferir) || "") === "1") {
        if (!isOwner(gate) && !isCron) return res.status(403).json({ ok: false, reason: "forbidden" });
        const out = await vm.conferirAlinhamento();
        return res.status(200).json({ ...out, success: out.ok });
      }
      const lista = String((req.query && req.query.lista) || "") === "1";
      if (lista) {
        if (!isOwner(gate) && !isCron) return res.status(403).json({ ok: false, reason: "forbidden" });
        let conf = await vm.conferirAlinhamento();
        let sincronizouCluster = false;
        if (conf.ok && !conf.alinhadas && typeof vm.alinearClusterVms === "function") {
          const alin = await vm.alinearClusterVms();
          sincronizouCluster = Boolean(alin && alin.sincronizou);
          conf = await vm.conferirAlinhamento();
        }
        const metas = await vm.listarMetas();
        const maquinas = [];
        for (const m of metas) {
          const estado = await vm.lerClone(m.cpf);
          const resumo = m.resumo && typeof m.resumo === "object" ? m.resumo : vm.resumirClone(estado || {});
          maquinas.push({ ...m, resumo });
        }
        return res.status(200).json({
          ok: true,
          success: true,
          total: maquinas.length,
          alinhadas: conf.alinhadas,
          sincronizouCluster,
          seq: conf.seq,
          maquinas,
        });
      }
      let dig = vm.cpfOk((req.query && req.query.cpf) || cpfSessao);
      if (dig !== cpfSessao && !isOwner(gate)) {
        return res.status(403).json({ ok: false, reason: "forbidden" });
      }
      if (!dig) return res.status(400).json({ ok: false, reason: "cpf" });
      const meta = await vm.lerMeta(dig);
      const estado = await vm.lerClone(dig);
      const resumo = vm.resumirClone(estado || {});
      return res.status(200).json({
        ok: true,
        success: true,
        existe: Boolean(meta),
        meta: meta || null,
        resumo,
        seq: await vm.lerSeqGlobal(),
        estado: estado || {},
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const acao = String(body.acao || body.action || "")
        .trim()
        .toLowerCase();

      if (acao === "garantir") {
        const dig = vm.cpfOk(body.cpf || cpfSessao);
        if (!dig) return res.status(400).json({ ok: false, reason: "cpf" });
        if (dig !== cpfSessao && !isOwner(gate)) return res.status(403).json({ ok: false, reason: "forbidden" });
        const out = await vm.garantirVm(dig, { nome: body.nome, role: body.role });
        return res.status(out.ok ? 200 : 503).json({ ...out, success: out.ok });
      }

      if (acao === "garantir-todos") {
        if (!isOwner(gate)) return res.status(403).json({ ok: false, reason: "forbidden" });
        const out = await vm.garantirTodasDoHub();
        return res.status(out.ok ? 200 : 503).json({ ...out, success: out.ok });
      }

      if (acao === "login-espelhar") {
        const dig = vm.cpfOk(body.cpf || cpfSessao);
        if (!dig) return res.status(400).json({ ok: false, reason: "cpf" });
        if (dig !== cpfSessao && !isOwner(gate)) return res.status(403).json({ ok: false, reason: "forbidden" });
        const out = await vm.loginEspelhar(dig, {
          nome: body.nome,
          role: body.role || gate.role,
          deviceId: body.deviceId,
        });
        return res.status(out.ok ? 200 : 503).json({ ...out, success: out.ok });
      }

      if (acao === "sincronizar-pc") {
        const dig = vm.cpfOk(body.cpf || cpfSessao);
        if (!dig) return res.status(400).json({ ok: false, reason: "cpf" });
        if (dig !== cpfSessao && !isOwner(gate)) return res.status(403).json({ ok: false, reason: "forbidden" });
        const out = await vm.sincronizarPcParaVm(dig, body.estado || body.payload || {}, {
          nome: body.nome,
          role: body.role || gate.role,
          deviceId: body.deviceId,
        });
        return res.status(out.ok ? 200 : 503).json({ ...out, success: out.ok });
      }

      if (acao === "consultar-delta") {
        const dig = vm.cpfOk(body.cpf || cpfSessao);
        if (!dig) return res.status(400).json({ ok: false, reason: "cpf" });
        if (dig !== cpfSessao && !isOwner(gate)) return res.status(403).json({ ok: false, reason: "forbidden" });
        const out = await vm.consultarDelta(dig, body.lastSeq);
        if (out.ok && out.haNovidade) await vm.limparPendente(dig);
        return res.status(out.ok ? 200 : 503).json({ ...out, success: out.ok });
      }

      if (acao === "conferir") {
        if (!isOwner(gate) && !isCron) return res.status(403).json({ ok: false, reason: "forbidden" });
        const out = await vm.conferirAlinhamento();
        return res.status(200).json({ ...out, success: out.ok });
      }

      if (acao === "espelhar-hub") {
        if (!isOwner(gate) && !body.cpf) {
          const out = await vm.espelharHubNasVms({ cpf: cpfSessao });
          return res.status(out.ok ? 200 : 503).json({ ...out, success: out.ok });
        }
        if (!isOwner(gate)) return res.status(403).json({ ok: false, reason: "forbidden" });
        const out = await vm.espelharHubNasVms({ cpf: body.cpf || "", merge: Boolean(body.merge) });
        return res.status(out.ok ? 200 : 503).json({ ...out, success: out.ok });
      }

      return res.status(400).json({
        ok: false,
        reason: "acao",
        message:
          "Use acao: garantir | garantir-todos | login-espelhar | sincronizar-pc | consultar-delta | conferir | espelhar-hub",
      });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
