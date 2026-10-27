/**
 * Posições GPS dos clientes (app DK Cliente).
 * POST /api/dk-cliente-geo — body { cpf, lat, lng, ... }
 * GET  /api/dk-cliente-geo — lista últimas posições (admin mapa)
 *
 * A fonte oficial é public.dk_cliente_geo. Redis só guarda a lista já lida.
 * Web Push (mensagens DK): GET/POST /api/dk-cliente-geo?push=1
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { handleClientePush } = require("../lib/dk-cliente-push-handler.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession } = require("../lib/dk-portal-auth.cjs");
const { listarPosicoes, gravarPosicao, linhaParaCliente } = require("../lib/dk-cliente-geo-pg.cjs");

const REDIS_KEY = "dk:portal:cliente_geo_v1";
const PLACA_ERRADA = "SOJ3J33";
const PLACA_CERTA = "SJO3J33";

function normPlacaVarredura(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function textoTrocaPlaca(value) {
  const bruto = String(value || "");
  if (normPlacaVarredura(bruto) === PLACA_ERRADA) return PLACA_CERTA;
  return bruto.replace(/(^|[^A-Z0-9])SOJ[\s-]*3[\s-]*J[\s-]*33(?=[^A-Z0-9]|$)/gi, (_m, prefixo) => prefixo + PLACA_CERTA);
}

function supabaseVarredura() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co")
    .trim()
    .replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, key };
}

async function restVarredura(path, opts = {}) {
  const { url, key } = supabaseVarredura();
  if (!key) return { status: 0, data: null };
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

function trocarNoJson(node, stats) {
  if (typeof node === "string") {
    const novo = textoTrocaPlaca(node);
    if (novo !== node) stats.n += 1;
    return novo;
  }
  if (Array.isArray(node)) return node.map((item) => trocarNoJson(item, stats));
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = trocarNoJson(node[k], stats);
    return out;
  }
  return node;
}

async function substituirPlacaErrada() {
  const relatorio = { geo: [], locacao: [], manutencao: [], snapshots: [] };
  const geo = await restVarredura("dk_cliente_geo?select=cpf,nome,placa&limit=2000");
  if (!Array.isArray(geo.data)) relatorio.geoStatus = geo.status;
  else {
    for (const row of geo.data) {
      if (normPlacaVarredura(row.placa) !== PLACA_ERRADA && textoTrocaPlaca(row.placa) === row.placa) continue;
      const up = await restVarredura(`dk_cliente_geo?cpf=eq.${encodeURIComponent(row.cpf)}`, {
        method: "PATCH",
        body: { placa: textoTrocaPlaca(row.placa) },
      });
      relatorio.geo.push({
        nome: String(row.nome || "").slice(0, 80),
        de: row.placa,
        para: Array.isArray(up.data) && up.data[0] ? up.data[0].placa : "",
        http: up.status,
      });
    }
  }

  const loc = await restVarredura(
    "dk_locacao?or=(placa.eq.SOJ3J33,placa.ilike.*SOJ*3J33*)&select=id,numero_contrato,placa,version,campos&limit=50"
  );
  if (!Array.isArray(loc.data)) relatorio.locacaoStatus = loc.status;
  else {
    for (const row of loc.data) {
      const placaNova = textoTrocaPlaca(row.placa);
      const campos = row.campos && typeof row.campos === "object" ? trocarNoJson(row.campos, { n: 0 }) : row.campos;
      if (placaNova === row.placa && JSON.stringify(campos) === JSON.stringify(row.campos)) continue;
      const up = await restVarredura(
        `dk_locacao?id=eq.${encodeURIComponent(row.id)}&version=eq.${encodeURIComponent(row.version)}`,
        {
          method: "PATCH",
          body: {
            placa: placaNova,
            campos,
            version: Number(row.version) + 1,
            updated_at: new Date().toISOString(),
          },
        }
      );
      relatorio.locacao.push({ numero: row.numero_contrato, de: row.placa, http: up.status });
    }
  }

  const manut = await restVarredura("dk_manutencao_rapida?registro->>placa=ilike.*SOJ*3J33*&select=id,registro&limit=50");
  if (!Array.isArray(manut.data)) relatorio.manutencaoStatus = manut.status;
  else {
    for (const row of manut.data) {
      const stats = { n: 0 };
      const registro = trocarNoJson(row.registro, stats);
      if (!stats.n) continue;
      const up = await restVarredura(`dk_manutencao_rapida?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: { registro },
      });
      relatorio.manutencao.push({ id: row.id, http: up.status, trocas: stats.n });
    }
  }

  const labels = await restVarredura(
    "dk_cloud_snapshots?label=not.like.docblob:*&select=label,updated_at&order=label.asc&limit=20"
  );
  const lista = Array.isArray(labels.data) ? labels.data : [];
  if (!lista.length) relatorio.snapshotsStatus = labels.status;
  for (const item of lista) {
    const cheio = await restVarredura(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(item.label)}&select=label,payload,updated_at`
    );
    const row = Array.isArray(cheio.data) ? cheio.data[0] : null;
    if (!row || !row.payload) {
      relatorio.snapshots.push({ label: item.label, http: cheio.status });
      continue;
    }
    const stats = { n: 0 };
    const payload = trocarNoJson(row.payload, stats);
    if (!stats.n) {
      relatorio.snapshots.push({ label: item.label, trocas: 0 });
      continue;
    }
    const agora = new Date().toISOString();
    const up = await restVarredura(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(item.label)}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
      { method: "PATCH", prefer: "return=minimal", body: { payload, updated_at: agora } }
    );
    relatorio.snapshots.push({ label: item.label, trocas: stats.n, http: up.status });
  }

  const nomes = await restVarredura(
    "dk_cloud_snapshots?label=like.docblob:*&select=label,nomeArquivo:payload->>nomeArquivo&limit=1000"
  );
  const arquivos = Array.isArray(nomes.data) ? nomes.data : [];
  if (!arquivos.length) relatorio.arquivosStatus = nomes.status;
  for (const arq of arquivos) {
    const nome = String(arq.nomeArquivo || "");
    const novo = textoTrocaPlaca(nome);
    if (!nome || novo === nome) continue;
    const cheio = await restVarredura(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(arq.label)}&select=label,payload,updated_at`
    );
    const row = Array.isArray(cheio.data) ? cheio.data[0] : null;
    if (!row || !row.payload) {
      relatorio.snapshots.push({ label: arq.label, http: cheio.status });
      continue;
    }
    const payload = { ...row.payload, nomeArquivo: novo };
    const agora = new Date().toISOString();
    const up = await restVarredura(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(arq.label)}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
      { method: "PATCH", prefer: "return=minimal", body: { payload, updated_at: agora } }
    );
    relatorio.snapshots.push({ label: arq.label, de: nome, para: novo, http: up.status });
  }
  return { ok: true, relatorio };
}

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

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

function applyCors(res) {
  applyApiCors(res);
}

function storeDeClientes(clientes) {
  const byCpf = {};
  for (const row of clientes || []) {
    if (!row || !row.cpf) continue;
    byCpf[row.cpf] = row;
  }
  return { byCpf, updatedAt: Date.now() };
}

async function cacheGeoRedis(clientes) {
  if (!isRedisKvConfigured()) return { ok: false, reason: "redis_indisponivel" };
  const redis = createRedisClient();
  await redis.set(REDIS_KEY, JSON.stringify(storeDeClientes(clientes)));
  return { ok: true };
}

function parseStore(raw) {
  if (raw == null) return { byCpf: {} };
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { byCpf: {} };
    }
  }
  if (!data || typeof data !== "object" || !data.byCpf || typeof data.byCpf !== "object") return { byCpf: {} };
  return data;
}

let semeaduraTentada = false;

async function semearDoCacheSeVazio(lista) {
  if (lista.clientes.length || semeaduraTentada || !isRedisKvConfigured()) return lista;
  semeaduraTentada = true;
  let raw = null;
  try {
    raw = await createRedisClient().get(REDIS_KEY);
  } catch (err) {
    console.error("[DK geo] cache redis na semeadura", err && err.message ? err.message : err);
    return lista;
  }
  const entradas = Object.values(parseStore(raw).byCpf || {});
  if (!entradas.length) return lista;
  for (const entrada of entradas) {
    const gravou = await gravarPosicao(entrada);
    if (gravou.status !== 200) return lista;
  }
  return listarPosicoes();
}

function respostaLista(lista, redis) {
  return {
    ok: true,
    success: true,
    source: "supabase",
    revision: lista.revision,
    updated_at: lista.revision,
    updatedAt: lista.updatedAt || Date.now(),
    total: lista.clientes.length,
    clientes: lista.clientes,
    persistencia: redis && redis.ok ? "supabase+redis" : "supabase",
    redis: redis && redis.ok ? { ok: true } : { ok: false, reason: (redis && redis.reason) || "redis_indisponivel" },
  };
}

module.exports = async function handler(req, res) {
  if (String(req.query?.push || "") === "1") {
    return handleClientePush(req, res);
  }

  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (await enforceRateLimit(req, res, "cliente-geo", req.method === "GET" ? 20 : 40)) return;
  if (req.method === "GET") {
    const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
    if (!gate.ok) {
      return res.status(gate.status).json({ ok: false, reason: gate.reason });
    }
  } else if (req.method === "POST") {
    const gate = await requireLiveSession(req, { allowCliente: true, allowEquipa: true });
    if (!gate.ok) {
      return res.status(gate.status).json({ ok: false, reason: gate.reason });
    }
    const bodyCpf = onlyDigits(parseBody(req).cpf).slice(0, 11);
    if (gate.typ === "cliente" && gate.cpf !== bodyCpf) {
      return res.status(403).json({ ok: false, reason: "cpf_mismatch" });
    }
  }

  try {
    if (req.method === "GET" && String(req.query?.varrer || "") === PLACA_ERRADA) {
      const dono = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
      if (!dono.ok) return res.status(dono.status).json({ ok: false, reason: dono.reason });
      if (String(dono.role || "") !== "owner") return res.status(403).json({ ok: false, reason: "forbidden" });
      return res.status(200).json(await substituirPlacaErrada());
    }

    if (req.method === "GET") {
      let lista = await listarPosicoes();
      if (!lista.ok) return res.status(lista.status).json(lista.body);
      lista = await semearDoCacheSeVazio(lista);
      if (!lista.ok) return res.status(lista.status).json(lista.body);
      let redis = { ok: false, reason: "redis_indisponivel" };
      try {
        redis = await cacheGeoRedis(lista.clientes);
      } catch (err) {
        console.error("[DK geo] cache redis apos leitura", err && err.message ? err.message : err);
        redis = { ok: false, reason: "redis_indisponivel" };
      }
      return res.status(200).json(respostaLista(lista, redis));
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, msg: "Método não permitido." });
    }

    const body = parseBody(req);
    if (body.adminPreview === true || String(body.source || "").trim() !== "cliente_app") {
      return res.status(403).json({
        ok: false,
        msg: "Localização só pode ser enviada pelo app do cliente (acesso real, não pré-visualização admin).",
      });
    }
    const cpf = onlyDigits(body.cpf).slice(0, 11);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (cpf.length !== 11) {
      return res.status(400).json({ ok: false, msg: "CPF inválido." });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, msg: "Coordenadas inválidas." });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, msg: "Coordenadas fora do intervalo." });
    }

    const central = await gravarPosicao({
      cpf,
      nome: body.nome,
      placa: body.placa,
      protocolo: body.protocolo,
      lat,
      lng,
      accuracy: body.accuracy,
      heading: body.heading,
      speed: body.speed,
      ts: Number(body.ts) || Date.now(),
    });
    if (central.status !== 200) return res.status(central.status).json(central.body);
    let redis = { ok: true, skipped: true };
    if (!central.inalterado) {
      try {
        const lista = await listarPosicoes();
        if (lista.ok) redis = await cacheGeoRedis(lista.clientes);
        else redis = { ok: false, reason: "lista_indisponivel" };
      } catch (err) {
        console.error("[DK geo] cache redis apos gravacao", err && err.message ? err.message : err);
        redis = { ok: false, reason: "redis_indisponivel" };
      }
    }
    return res.status(200).json({
      ...central.body,
      persistencia: redis.ok && !redis.skipped ? "supabase+redis" : "supabase",
      redis,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      success: false,
      msg: "Erro ao processar localização.",
      error: String(e && e.message ? e.message : e),
    });
  }
};

module.exports.linhaParaCliente = linhaParaCliente;
