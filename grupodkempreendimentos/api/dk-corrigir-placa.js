/**
 * Correção pontual pedida pelo titular: SOJ3J33 → SJO3J33.
 * Troca só o texto da placa nesse cadastro. Não cria outro veículo.
 */
const { applyApiCors, enforceRateLimit, requireCeoEmergencyLock } = require("../lib/dk-portal-auth.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");

const ERRADA = "SOJ3J33";
const CERTA = "SJO3J33";
const CHAVES = ["dk_veiculos_cadastro", "dk_portal_veiculos_cadastro"];

function norm(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function resumo(v) {
  return {
    id: v && (v.id || v.createdAt || ""),
    nome: String((v && (v.nome || v.proprietario || v.nomeProprietario)) || "").slice(0, 80),
    placa: v && v.placa,
    status: v && (v.status || v.statusVeiculo || ""),
  };
}

function caminhos(node, alvo, prefix, out) {
  if (out.length >= 12) return;
  if (typeof node === "string") {
    if (norm(node) === alvo) out.push(prefix || "$");
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => caminhos(item, alvo, `${prefix}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) {
      caminhos(node[k], alvo, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

function placaDeCadastro(path) {
  return /^dk_(portal_)?veiculos_cadastro\[\d+\]\.placa$/.test(path);
}

function achar(list, alvo) {
  return (Array.isArray(list) ? list : []).filter((v) => norm(v && v.placa) === alvo).map(resumo);
}

function corrigirLista(list) {
  let n = 0;
  const out = (Array.isArray(list) ? list : []).map((v) => {
    if (!v || typeof v !== "object" || norm(v.placa) !== ERRADA) return v;
    n += 1;
    return { ...v, placa: CERTA };
  });
  return { out, n };
}

function supabaseRestConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co")
    .trim()
    .replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, key };
}

async function rest(path, opts = {}) {
  const { url, key } = supabaseRestConfig();
  if (!key) return { status: 0, data: null, reason: "sem_chave" };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { status: res.status, data };
}

async function lerRelacionais() {
  const loc = await rest(
    `dk_locacao?placa=eq.${ERRADA}&deleted_at=is.null&select=id,numero_contrato,placa,status_locacao,version,campos`
  );
  const locCerta = await rest(
    `dk_locacao?placa=eq.${CERTA}&deleted_at=is.null&select=id,numero_contrato,placa`
  );
  const geo = await rest(`dk_cliente_geo?placa=eq.${ERRADA}&select=id,placa`);
  const geoCerta = await rest(`dk_cliente_geo?placa=eq.${CERTA}&select=id,placa`);
  return { loc, locCerta, geo, geoCerta };
}

async function gravarRelacionais(lido) {
  const { loc, geo } = lido;
  const locacoes = [];
  if (Array.isArray(loc.data)) {
    for (const row of loc.data) {
      const campos = row.campos && typeof row.campos === "object" ? { ...row.campos, placa: CERTA } : row.campos;
      const up = await rest(
        `dk_locacao?id=eq.${encodeURIComponent(row.id)}&version=eq.${encodeURIComponent(row.version)}&deleted_at=is.null`,
        {
          method: "PATCH",
          body: {
            placa: CERTA,
            campos,
            version: Number(row.version) + 1,
            updated_at: new Date().toISOString(),
          },
        }
      );
      locacoes.push({
        numero: row.numero_contrato,
        status: row.status_locacao,
        http: up.status,
        placa: Array.isArray(up.data) && up.data[0] ? up.data[0].placa : "",
      });
    }
  }
  let geoN = 0;
  if (Array.isArray(geo.data) && geo.data.length) {
    const up = await rest(`dk_cliente_geo?placa=eq.${ERRADA}`, {
      method: "PATCH",
      body: { placa: CERTA },
    });
    geoN = Array.isArray(up.data) ? up.data.length : 0;
  }
  return {
    ok: true,
    locacaoHttp: loc.status,
    locacoes,
    geo: geoN,
    geoHttp: geo.status,
  };
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });
  if (await enforceRateLimit(req, res, "corrigir-placa", 6)) return;
  const gate = await requireCeoEmergencyLock(req);
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (norm(body && body.errada) !== ERRADA || norm(body && body.certa) !== CERTA) {
    return res.status(400).json({ ok: false, reason: "placa_nao_autorizada" });
  }

  const io = ioSnapshotOficial("default");
  const atual = await io.ler();
  if (!atual || atual.indisponivel) {
    return res.status(503).json({ ok: false, reason: (atual && atual.reason) || "supabase_indisponivel" });
  }
  const payload = atual.payload && typeof atual.payload === "object" ? atual.payload : {};
  const caminhosErrada = [];
  const caminhosCerta = [];
  caminhos(payload, ERRADA, "", caminhosErrada);
  caminhos(payload, CERTA, "", caminhosCerta);
  if (
    caminhosErrada.length === 0 &&
    caminhosCerta.length === 2 &&
    caminhosCerta.every(placaDeCadastro)
  ) {
    return res.status(200).json({
      ok: true,
      jaCorrigido: true,
      certa: CHAVES.map((k) => achar(payload[k], CERTA)),
      updated_at: atual.updatedAt || null,
    });
  }
  if (caminhosCerta.length || caminhosErrada.length !== 2 || !caminhosErrada.every(placaDeCadastro)) {
    return res.status(409).json({
      ok: false,
      reason: "contagem_inesperada",
      errada: caminhosErrada,
      certa: caminhosCerta,
    });
  }
  const relLido = await lerRelacionais();
  if (Array.isArray(relLido.locCerta.data) && relLido.locCerta.data.length) {
    return res.status(409).json({ ok: false, reason: "placa_certa_ja_em_locacao" });
  }
  if (Array.isArray(relLido.geoCerta.data) && relLido.geoCerta.data.length) {
    return res.status(409).json({ ok: false, reason: "placa_certa_ja_em_geo" });
  }

  let trocas = {};
  let central;
  try {
    central = await executarGravacaoCentral({
      ...io,
      baseRevision: atual.updatedAt || "",
      mutar(alvo) {
        const deNovo = [];
        caminhos(alvo, ERRADA, "", deNovo);
        if (deNovo.length !== 2 || !deNovo.every(placaDeCadastro)) {
          throw new Error("contagem_inesperada");
        }
        for (const k of CHAVES) {
          const r = corrigirLista(alvo[k]);
          if (r.n !== 1) throw new Error("troca_inesperada");
          alvo[k] = r.out;
          trocas[k] = r.n;
        }
      },
      cache: async (gravado, updatedAt) => {
        if (!isRedisKvConfigured()) return;
        const redis = createRedisClient();
        await redis.set("dk:portal:veiculos_cadastro:v1", JSON.stringify(gravado.dk_veiculos_cadastro || []));
        await redis.set(
          "dk:portal:cloud_snapshot:v1",
          JSON.stringify({ label: "default", payload: gravado, updated_at: updatedAt })
        );
        await redis.set("dk:portal:cloud_snapshot:v1:rev", updatedAt);
      },
    });
  } catch (err) {
    return res.status(409).json({ ok: false, reason: String(err && err.message ? err.message : err) });
  }
  if (!central || central.status !== 200) {
    return res.status(central && central.status ? central.status : 502).json(central && central.body ? central.body : { ok: false });
  }

  const rel = await gravarRelacionais(relLido);
  const confirmado = CHAVES.map((k) => achar((central.payload && central.payload[k]) || [], CERTA));
  return res.status(200).json({
    ok: true,
    jaCorrigido: false,
    updated_at: central.body.updated_at,
    persistencia: central.body.persistencia,
    trocas,
    cadastro: confirmado,
    relacional: rel,
    redis: central.body.redis || null,
  });
};
