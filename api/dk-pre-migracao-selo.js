/**
 * Selo pré-migração. Só o servidor, com a credencial já usada pelo porteiro.
 * Não grava dk:portal:cloud_snapshot:v1 nem a label default.
 * A rota exige o segredo DK_PRE_MIGRACAO_SELO e será retirada depois do selo.
 */
const crypto = require("crypto");
const { createRedisClient } = require("../lib/dk-redis-env.cjs");

const SB_URL = String(process.env.SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co").replace(/\/$/, "");
const CHAVES_PARALELAS = [
  "dk:portal:manutencoes_rapidas:v1",
  "dk:portal:financeiro_ceo:despesas:h",
  "dk:portal:financeiro_ceo:situacao:h",
  "dk:portal:financeiro_ceo:fontes:h",
  "dk:portal:financeiro_ceo:cartoes:h",
  "dk:portal:financeiro_despesas:h",
  "dk:portal:lancamentos_fila:v1",
  "dk:portal:clientes_cadastro:v1",
  "dk:portal:veiculos_cadastro:v1",
  "dk:portal:locacoes_cadastro:v1",
  "dk:portal:cliente_geo_v1",
  "dk:portal:locacoes_integridade:v1",
];

function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

function sha256(text) {
  return crypto.createHash("sha256").update(Buffer.from(String(text), "utf8")).digest("hex");
}

function bytesDe(text) {
  return Buffer.byteLength(String(text), "utf8");
}

function autorizado(req) {
  const esperado = String(process.env.DK_PRE_MIGRACAO_SELO || "");
  const recebido = String(req.headers["x-dk-pre-migracao"] || "");
  if (!esperado || !recebido || esperado.length !== recebido.length) return false;
  return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

function sbHeaders() {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/json",
  };
}

async function lerLinha(label) {
  const url = SB_URL + "/rest/v1/dk_cloud_snapshots?label=eq." + encodeURIComponent(label) + "&select=id,label,payload,updated_at";
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error("supabase_" + res.status + "_" + detalhe.slice(0, 120));
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function listarDocblobs() {
  const saida = [];
  let offset = 0;
  for (let pagina = 0; pagina < 20; pagina++) {
    const url = SB_URL + "/rest/v1/dk_cloud_snapshots?label=like." + encodeURIComponent("docblob:*") + "&select=label,payload,updated_at&order=label.asc";
    const res = await fetch(url, {
      headers: {
        ...sbHeaders(),
        Range: offset + "-" + (offset + 49),
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      throw new Error("docblob_" + res.status + "_" + detalhe.slice(0, 120));
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of rows) {
      if (!row || !String(row.label || "").startsWith("docblob:")) continue;
      const texto = canon(row.payload == null ? null : row.payload);
      saida.push({
        label: row.label,
        bytes: bytesDe(texto),
        updated_at: row.updated_at || null,
        sha256: sha256(texto),
      });
    }
    if (rows.length < 50) break;
    offset += 50;
  }
  return saida;
}

function registrosAfetados(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  function idDe(row, i) {
    if (row && row.id != null && String(row.id)) return "id:" + String(row.id);
    return "idx:" + i;
  }
  const mb = new Map(b.map((row, i) => [idDe(row, i), canon(row)]));
  const vistos = new Set();
  let diferentes = 0;
  a.forEach((row, i) => {
    const id = idDe(row, i);
    vistos.add(id);
    if (!mb.has(id) || mb.get(id) !== canon(row)) diferentes++;
  });
  b.forEach((row, i) => {
    if (!vistos.has(idDe(row, i))) diferentes++;
  });
  return diferentes;
}

function medir(valor) {
  if (Array.isArray(valor)) return valor.length;
  if (valor && typeof valor === "object") return Object.keys(valor).length;
  if (valor == null || valor === "") return 0;
  return 1;
}

function diferencas(redisPayload, sbPayload) {
  const chaves = [];
  const nomes = new Set(Object.keys(redisPayload || {}).concat(Object.keys(sbPayload || {})));
  for (const nome of Array.from(nomes).sort()) {
    const a = redisPayload ? redisPayload[nome] : undefined;
    const b = sbPayload ? sbPayload[nome] : undefined;
    const temA = redisPayload && Object.prototype.hasOwnProperty.call(redisPayload, nome);
    const temB = sbPayload && Object.prototype.hasOwnProperty.call(sbPayload, nome);
    if (temA && temB && canon(a) === canon(b)) continue;
    chaves.push({
      chave: nome,
      no_redis: temA,
      no_supabase: temB,
      registros_redis: temA ? medir(a) : 0,
      registros_supabase: temB ? medir(b) : 0,
      registros_diferentes: registrosAfetados(a, b),
    });
  }
  return chaves;
}

function senhas(payload) {
  const lista = [];
  for (const nome of Object.keys(payload || {})) {
    const valor = payload[nome];
    if (!Array.isArray(valor)) continue;
    let texto = 0;
    let hash = 0;
    for (const row of valor) {
      if (!row || typeof row !== "object") continue;
      if (typeof row.senha === "string" && row.senha.trim()) texto++;
      if (typeof row.senhaHash === "string" && row.senhaHash.trim()) hash++;
    }
    if (texto || hash) lista.push({ estrutura: nome, senha_preenchida: texto, senha_hash_preenchida: hash });
  }
  return lista;
}

function camposQueDiferem(a, b, idFn) {
  const mb = new Map((b || []).map((item) => [idFn(item), item]));
  const counts = {};
  let soA = 0;
  let soB = 0;
  const idsB = new Set((b || []).map(idFn));
  for (const item of a || []) {
    const outro = mb.get(idFn(item));
    if (!outro) {
      soA++;
      continue;
    }
    const keys = new Set(Object.keys(item || {}).concat(Object.keys(outro || {})));
    for (const k of keys) {
      if (canon(item[k]) !== canon(outro[k])) counts[k] = (counts[k] || 0) + 1;
    }
  }
  for (const item of b || []) if (!idsB.has(idFn(item)) || !(a || []).some((x) => idFn(x) === idFn(item))) soB++;
  const presentes = new Set((a || []).map(idFn));
  soB = (b || []).filter((item) => !presentes.has(idFn(item))).length;
  return { soA, soB, campos: counts };
}

function codigosRepetidos(lista) {
  const freq = {};
  for (const item of lista || []) {
    const codigo = String(item && item.codigo != null ? item.codigo : "").trim();
    if (!codigo) continue;
    freq[codigo] = (freq[codigo] || 0) + 1;
  }
  const repetidos = Object.values(freq).filter((n) => n > 1);
  return { codigos_repetidos: repetidos.length, fichas_atingidas: repetidos.reduce((s, n) => s + n, 0) };
}

function uniq(lista, campo) {
  return new Set((lista || []).map((item) => String(item && item[campo] != null ? item[campo] : "").replace(/\D/g, "")).filter(Boolean)).size;
}

async function lerParalela(redis, chave) {
  const tipo = await redis.type(chave);
  if (!tipo || tipo === "none") return { presente: false, tipo: "none" };
  if (tipo === "hash") {
    const valor = await redis.hgetall(chave);
    return { presente: true, tipo, valor: valor || {} };
  }
  if (tipo === "string") {
    return { presente: true, tipo, valor: await redis.get(chave) };
  }
  return { presente: true, tipo, valor: null, aviso: "tipo_nao_copiado" };
}

function associar(docblobs, payload) {
  const ids = new Set();
  function walk(v) {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v.id === "string" && v.id) ids.add(v.id);
    Object.keys(v).forEach((k) => walk(v[k]));
  }
  walk(payload && payload.dk_documentos_deposito_v1);
  walk(payload && payload.dk_patrimonio_crlv_v1);
  walk(payload && payload.dk_cliente_docs_v1);
  walk(payload && payload.dk_locacao_documentos_v1);
  return docblobs.map((item) => {
    const id = String(item.label || "").split(":").pop();
    return Object.assign({}, item, { associado: ids.has(id) });
  });
}

function resumoDocblobs(lista) {
  return {
    quantidade: lista.length,
    bytes: lista.reduce((s, item) => s + item.bytes, 0),
    itens: lista.map((item) => ({
      label: item.label,
      bytes: item.bytes,
      updated_at: item.updated_at,
      sha256: item.sha256,
      associado: item.associado === true,
    })),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });
  if (!autorizado(req)) return res.status(401).json({ ok: false, reason: "unauthorized" });
  if (!String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) {
    return res.status(503).json({ ok: false, reason: "service_role_ausente" });
  }
  const gravar = String(req.headers["x-dk-pre-migracao-modo"] || "") === "gravar";
  try {
    const redis = createRedisClient();
    const bruto = await redis.get("dk:portal:cloud_snapshot:v1");
    const envelope = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
    const payloadRedis = envelope && envelope.payload && typeof envelope.payload === "object" ? envelope.payload : null;
    if (!payloadRedis) return res.status(500).json({ ok: false, reason: "redis_sem_payload" });
    const linha = await lerLinha("default");
    if (!linha || !linha.payload) return res.status(500).json({ ok: false, reason: "supabase_sem_default" });
    const textoRedis = canon(payloadRedis);
    const textoSb = canon(linha.payload);
    const hashRedis = sha256(textoRedis);
    const hashSb = sha256(textoSb);
    const identicos = hashRedis === hashSb;
    const revisao = await redis.get("dk:portal:cloud_snapshot:v1:rev");
    const docblobs = associar(await listarDocblobs(), payloadRedis);
    const clientes = Array.isArray(payloadRedis.dk_clientes_cadastro) ? payloadRedis.dk_clientes_cadastro : [];
    const base = {
      ok: true,
      identicos,
      redis: {
        updated_at: envelope.updated_at || null,
        bytes: bytesDe(textoRedis),
        chaves: Object.keys(payloadRedis).length,
        sha256: hashRedis,
        revisao: revisao == null ? null : String(revisao),
      },
      supabase: {
        id: linha.id,
        label: linha.label,
        updated_at: linha.updated_at || null,
        bytes: bytesDe(textoSb),
        chaves: Object.keys(linha.payload).length,
        sha256: hashSb,
      },
      updated_at_mais_recente: Date.parse(envelope.updated_at || 0) >= Date.parse(linha.updated_at || 0) ? "redis" : "supabase",
      diferencas: identicos ? [] : diferencas(payloadRedis, linha.payload),
      docblobs: resumoDocblobs(docblobs),
      risco_credencial: {
        RISCO_CRITICO_CREDENCIAL_PLAINTEXT: senhas(payloadRedis).some((item) => item.senha_preenchida > 0),
        ocorrencias: senhas(payloadRedis),
      },
      inconsistencias: {
        clientes: clientes.length,
        cpf_unicos: uniq(clientes, "cpf"),
        codigos_unicos: new Set(clientes.map((item) => String(item.codigo || "").trim()).filter(Boolean)).size,
        codigo_duplicado: codigosRepetidos(clientes),
        listas_clientes: camposQueDiferem(payloadRedis.dk_clientes_cadastro, payloadRedis.dk_portal_clientes_cadastro, (item) => String(item && item.id || "")),
        listas_veiculos: camposQueDiferem(payloadRedis.dk_veiculos_cadastro, payloadRedis.dk_portal_veiculos_cadastro, (item) => String(item && item.placa || "").toUpperCase()),
        estoque_na_nuvem: Object.keys(payloadRedis).some((nome) => /estoque/i.test(nome)),
      },
      backup_criado: false,
    };
    if (!gravar || !identicos) return res.status(200).json(base);

    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const chaveBackup = "dk:portal:backup_pre_migracao:" + stamp;
    const labelBackup = "backup-pre-migracao-" + stamp;
    if (chaveBackup === "dk:portal:cloud_snapshot:v1" || labelBackup === "default") {
      return res.status(500).json({ ok: false, reason: "destino_proibido" });
    }
    if (await redis.get(chaveBackup)) return res.status(409).json({ ok: false, reason: "chave_backup_ja_existe" });
    if (await lerLinha(labelBackup)) return res.status(409).json({ ok: false, reason: "label_backup_ja_existe" });

    const paralelas = {};
    for (const chave of CHAVES_PARALELAS) paralelas[chave] = await lerParalela(redis, chave);
    const pacote = {
      tipo: "backup-pre-migracao",
      backup_em: new Date().toISOString(),
      origem: "redis:dk:portal:cloud_snapshot:v1+supabase:public.dk_cloud_snapshots:default",
      updated_at_original: envelope.updated_at || null,
      updated_at_supabase: linha.updated_at || null,
      sha256_canonico: hashRedis,
      revisao_redis: revisao == null ? null : String(revisao),
      payload: payloadRedis,
      chaves_paralelas: paralelas,
      docblobs: docblobs,
      risco_credencial: base.risco_credencial,
      inconsistencias: base.inconsistencias,
    };
    await redis.set(chaveBackup, JSON.stringify(pacote));
    const insert = await fetch(SB_URL + "/rest/v1/dk_cloud_snapshots", {
      method: "POST",
      headers: { ...sbHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        label: labelBackup,
        payload: pacote,
        updated_at: envelope.updated_at || new Date().toISOString(),
      }),
    });
    if (!insert.ok) {
      const detalhe = await insert.text().catch(() => "");
      return res.status(502).json({
        ok: false,
        reason: "supabase_backup_" + insert.status,
        detalhe: detalhe.slice(0, 180),
        chave_redis_criada: chaveBackup,
        default_nao_tocado: true,
      });
    }

    const deNovoRedis = await redis.get(chaveBackup);
    const pacoteRedis = typeof deNovoRedis === "string" ? JSON.parse(deNovoRedis) : deNovoRedis;
    const deNovoSb = await lerLinha(labelBackup);
    const pacoteSb = deNovoSb && deNovoSb.payload;
    const hashPosRedis = sha256(canon(pacoteRedis && pacoteRedis.payload));
    const hashPosSb = sha256(canon(pacoteSb && pacoteSb.payload));
    const defaultDepois = await lerLinha("default");
    const hashDefaultDepois = sha256(canon(defaultDepois && defaultDepois.payload));
    return res.status(200).json(Object.assign(base, {
      backup_criado: true,
      backup_redis: chaveBackup,
      backup_supabase: labelBackup,
      verificacao: {
        redis: hashPosRedis === hashRedis ? "integro" : "divergente",
        supabase: hashPosSb === hashRedis ? "integro" : "divergente",
        hash_redis: hashPosRedis,
        hash_supabase: hashPosSb,
        default_updated_at: defaultDepois && defaultDepois.updated_at,
        default_sha256: hashDefaultDepois,
        default_inalterado: hashDefaultDepois === hashSb && String(defaultDepois && defaultDepois.updated_at) === String(linha.updated_at),
      },
      paralelas: CHAVES_PARALELAS.map((chave) => ({
        chave,
        presente: Boolean(paralelas[chave] && paralelas[chave].presente),
        tipo: paralelas[chave] && paralelas[chave].tipo,
      })),
    }));
  } catch (e) {
    return res.status(500).json({ ok: false, reason: "falha", detalhe: String(e && e.message ? e.message : e).slice(0, 180) });
  }
};
