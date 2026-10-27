/**
 * Copia dk_veiculos_cadastro para public.dk_veiculos.
 * Não grava o snapshot, não escreve no Redis, não mexe no espelho e não liga fonte nova.
 */
const crypto = require("crypto");

const CHAVE = "dk_veiculos_cadastro";
const ESPELHO = "dk_portal_veiculos_cadastro";
const TABELA = "dk_veiculos";
const VEICULO_ID = "1787510118980";
const URL_PADRAO = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function hashInventario(lista) {
  const hashes = (Array.isArray(lista) ? lista : []).map((item) =>
    sha256(JSON.stringify(item, Object.keys(item || {}).sort()))
  );
  hashes.sort();
  return sha256(hashes.join("\n"));
}

function hashObjeto(item) {
  return sha256(JSON.stringify(item || {}, Object.keys(item || {}).sort()));
}

function idDe(item) {
  return item && item.id != null ? String(item.id).trim() : "";
}

function placaDe(item) {
  if (!item || item.placa == null) return "";
  return String(item.placa);
}

function duplicados(valores) {
  const contagem = new Map();
  for (const valor of valores) contagem.set(valor, (contagem.get(valor) || 0) + 1);
  let chaves = 0;
  for (const n of contagem.values()) if (n > 1) chaves += 1;
  return chaves;
}

function digitosDocumento(item) {
  return String(item && item.proprietarioCpfCnpj != null ? item.proprietarioCpfCnpj : "").replace(/\D/g, "");
}

function resumir(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  const ids = [];
  const placas = [];
  let semId = 0;
  let semPlaca = 0;
  for (const item of arr) {
    const id = idDe(item);
    const placa = placaDe(item);
    if (!id) semId += 1;
    else ids.push(id);
    if (!placa.trim()) semPlaca += 1;
    else placas.push(placa);
  }
  return {
    quantidade: arr.length,
    ids: new Set(ids).size,
    placas: new Set(placas).size,
    semId,
    semPlaca,
    idsDuplicados: duplicados(ids),
    placasDuplicadas: duplicados(placas),
    hash: hashInventario(arr),
    listaIds: ids,
    listaPlacas: placas,
  };
}

function relacaoDocumentos(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  const cpfs = [];
  const cnpjs = [];
  let outros = 0;
  for (const item of arr) {
    const doc = digitosDocumento(item);
    if (!doc) continue;
    if (doc.length === 11) cpfs.push(doc);
    else if (doc.length === 14) cnpjs.push(doc);
    else outros += 1;
  }
  return { preenchidos: cpfs.length + cnpjs.length + outros, cpfs, cnpjs, outros };
}

function detalheSeguro(valor) {
  return JSON.stringify(valor == null ? "" : valor)
    .slice(0, 240)
    .replace(/[A-Za-z0-9_\-]{24,}/g, "[longo]");
}

function urlBase() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || URL_PADRAO)
    .trim()
    .replace(/\/$/, "");
}

function chaveServico() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function schemaAusente(res) {
  const data = res && res.data;
  const msg = String((data && (data.message || data.raw || data.hint)) || "");
  return Boolean(
    res &&
      (res.status === 404 ||
        (data && (data.code === "PGRST205" || data.code === "42P01")) ||
        /does not exist|schema cache|Could not find the table/i.test(msg))
  );
}

async function restPadrao(caminho, opts = {}) {
  const key = chaveServico();
  if (!key) return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (opts.prefer) headers.Prefer = opts.prefer;
  let res;
  try {
    res = await fetch(urlBase() + "/rest/v1/" + caminho, {
      method: opts.method || "GET",
      headers,
      body: opts.body == null ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(opts.ms || 25000),
    });
  } catch {
    return { ok: false, status: 522, data: { reason: "leitura_lenta" } };
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

function diffConjuntos(origem, destino) {
  const a = new Set(origem);
  const b = new Set(destino);
  let origemSemDestino = 0;
  let destinoSemOrigem = 0;
  for (const item of a) if (!b.has(item)) origemSemDestino += 1;
  for (const item of b) if (!a.has(item)) destinoSemOrigem += 1;
  return { origemSemDestino, destinoSemOrigem };
}

function publico(resumo) {
  if (!resumo) return null;
  const { listaIds, listaPlacas, ...resto } = resumo;
  return resto;
}

function espelhoDe(lista) {
  const arr = Array.isArray(lista) ? lista : null;
  return {
    chave: ESPELHO,
    existe: Array.isArray(arr),
    quantidade: arr ? arr.length : 0,
    usadoComoFonte: false,
  };
}

function veiculoDe(lista) {
  const item = (Array.isArray(lista) ? lista : []).find((row) => idDe(row) === VEICULO_ID) || null;
  if (!item) {
    return {
      id: VEICULO_ID,
      encontrado: false,
      placa: "",
      proprietario: "",
      proprietarioCpfCnpj: "",
      updatedAt: null,
      hash: "",
    };
  }
  return {
    id: VEICULO_ID,
    encontrado: true,
    placa: placaDe(item),
    proprietario: String(item.proprietario || ""),
    proprietarioCpfCnpj: item.proprietarioCpfCnpj == null ? "" : String(item.proprietarioCpfCnpj),
    updatedAt: item.updatedAt == null ? null : item.updatedAt,
    hash: hashObjeto(item),
  };
}

function relatorioBase(migrationId, extra) {
  return {
    ok: false,
    aprovada: false,
    migrationId,
    fonteLigada: false,
    cutover: false,
    redisAlteradoPelaMigracao: false,
    snapshotAlteradoPelaMigracao: false,
    espelhoAlterado: false,
    timestampTecnico: "TIMESTAMPS TÉCNICOS DA MIGRAÇÃO",
    ...extra,
  };
}

async function lerFonteOficial(rest) {
  const select =
    "updated_at,fonte:payload->dk_veiculos_cadastro,espelho:payload->dk_portal_veiculos_cadastro";
  const res = await rest(
    "dk_cloud_snapshots?label=eq.default&select=" + encodeURIComponent(select),
    { ms: 25000 }
  );
  if (!res.ok) return { ok: false, status: res.status, data: res.data };
  const row = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
  if (!row || !row.updated_at) return { ok: false, status: 404, data: { reason: "snapshot" } };
  return {
    ok: true,
    updated_at: String(row.updated_at),
    origem: Array.isArray(row.fonte) ? row.fonte : null,
    espelho: Array.isArray(row.espelho) ? row.espelho : null,
  };
}

async function gravarLotes(lista, rest) {
  const linhas = (Array.isArray(lista) ? lista : []).map((item) => {
    const payload = JSON.parse(JSON.stringify(item));
    return {
      id: idDe(payload),
      placa: payload.placa == null ? null : String(payload.placa),
      payload,
    };
  });
  let gravados = 0;
  for (let i = 0; i < linhas.length; i += 40) {
    const lote = linhas.slice(i, i + 40);
    const res = await rest(TABELA + "?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: lote,
      ms: 25000,
    });
    if (!res.ok) return { ok: false, status: res.status, data: res.data, gravados };
    gravados += lote.length;
  }
  return { ok: true, gravados };
}

async function correspondenciaClientes(cpfs, rest) {
  const unicos = [...new Set(cpfs)];
  if (!unicos.length) return { ok: true, encontrados: 0, naoEncontrados: 0 };
  const filtro = unicos.map((cpf) => encodeURIComponent(cpf)).join(",");
  const res = await rest(
    "dk_clientes?deleted_at=is.null&select=cpf&cpf=in.(" + filtro + ")&limit=2000"
  );
  if (!res.ok) return { ok: false, status: res.status, encontrados: 0, naoEncontrados: unicos.length };
  const achados = new Set(
    (Array.isArray(res.data) ? res.data : []).map((row) => String(row && row.cpf != null ? row.cpf : "").replace(/\D/g, ""))
  );
  let encontrados = 0;
  for (const cpf of unicos) if (achados.has(cpf)) encontrados += 1;
  return { ok: true, encontrados, naoEncontrados: unicos.length - encontrados };
}

async function executarCopia(deps) {
  const io = deps || {};
  const rest = io.rest || restPadrao;
  const lerFonte = io.lerFonte || ((pedido) => lerFonteOficial(pedido));
  const migrationId =
    io.migrationId || "MIG_VEICULOS_20261027_ITER16_" + new Date().toISOString().replace(/[:.]/g, "");

  const sonda = await rest(TABELA + "?select=id&limit=1");
  if (!sonda.ok && schemaAusente(sonda)) {
    return relatorioBase(migrationId, {
      motivo: "tabela_ausente",
      tabela: { existia: false, criada: false, status: sonda.status, detalhe: detalheSeguro(sonda.data) },
    });
  }
  if (!sonda.ok) {
    return relatorioBase(migrationId, {
      motivo: "leitura_tabela",
      tabela: { existia: false, criada: false, status: sonda.status, detalhe: detalheSeguro(sonda.data) },
    });
  }

  const existentes = await rest(TABELA + "?select=id,placa,deleted_at&order=id.asc&limit=2000");
  if (!existentes.ok) {
    return relatorioBase(migrationId, {
      motivo: "leitura_tabela",
      tabela: { existia: true, criada: false, status: existentes.status },
    });
  }
  const linhas = Array.isArray(existentes.data) ? existentes.data : [];
  if (linhas.length >= 2000) {
    return relatorioBase(migrationId, { motivo: "tabela_grande_demais", tabela: { linhas: linhas.length } });
  }
  if (linhas.some((row) => row && row.deleted_at)) {
    return relatorioBase(migrationId, {
      motivo: "linhas_apagadas_inesperadas",
      tabela: { linhas: linhas.length },
    });
  }

  const antes = await lerFonte(rest);
  if (!antes.ok || !Array.isArray(antes.origem)) {
    return relatorioBase(migrationId, {
      motivo: "colecao",
      r0: antes && antes.updated_at ? String(antes.updated_at) : "",
      detalhe: detalheSeguro(antes.data),
      espelho: espelhoDe(antes && antes.espelho),
    });
  }
  const r0 = String(antes.updated_at || "");
  const fonteAntes = resumir(antes.origem);
  const alvoAntes = veiculoDe(antes.origem);
  if (
    fonteAntes.semId ||
    fonteAntes.semPlaca ||
    fonteAntes.idsDuplicados ||
    fonteAntes.placasDuplicadas ||
    fonteAntes.quantidade !== fonteAntes.ids ||
    fonteAntes.quantidade !== fonteAntes.placas ||
    !alvoAntes.encontrado
  ) {
    return relatorioBase(migrationId, {
      motivo: "fonte_inconsistente",
      r0,
      fonte: { chave: CHAVE, ...publico(fonteAntes) },
      veiculo: alvoAntes,
      espelho: espelhoDe(antes.espelho),
    });
  }

  const idsFonte = new Set(fonteAntes.listaIds);
  const extrasAntes = linhas.filter((row) => !idsFonte.has(String(row && row.id != null ? row.id : "").trim()));
  if (extrasAntes.length) {
    return relatorioBase(migrationId, {
      motivo: "destino_extra",
      r0,
      destinoExtra: extrasAntes.length,
      espelho: espelhoDe(antes.espelho),
      fonte: { chave: CHAVE, quantidade: fonteAntes.quantidade, hash: fonteAntes.hash },
    });
  }

  const copia = await gravarLotes(antes.origem, rest);
  if (!copia.ok) {
    return relatorioBase(migrationId, {
      motivo: "copia",
      r0,
      gravados: copia.gravados || 0,
      detalhe: detalheSeguro(copia.data),
      fonte: { chave: CHAVE, ...publico(fonteAntes) },
      espelho: espelhoDe(antes.espelho),
    });
  }

  const depois = await lerFonte(rest);
  if (!depois.ok || !Array.isArray(depois.origem)) {
    return relatorioBase(migrationId, {
      motivo: "colecao_depois",
      r0,
      copiaAindaNaoAprovada: true,
      gravados: copia.gravados || 0,
    });
  }
  const r1 = String(depois.updated_at || "");
  const fonteDepois = resumir(depois.origem);
  const hashEstavel = fonteAntes.hash === fonteDepois.hash && fonteAntes.quantidade === fonteDepois.quantidade;
  if (!hashEstavel) {
    return relatorioBase(migrationId, {
      motivo: "fonte_mudou",
      r0,
      r1,
      copiaAindaNaoAprovada: true,
      gravados: copia.gravados || 0,
      fonteAntes: { chave: CHAVE, ...publico(fonteAntes) },
      fonteDepois: { chave: CHAVE, ...publico(fonteDepois) },
    });
  }

  const lido = await rest(
    TABELA + "?deleted_at=is.null&select=id,placa,payload&order=id.asc&limit=2000"
  );
  if (!lido.ok) {
    return relatorioBase(migrationId, {
      motivo: "leitura_destino",
      r0,
      r1,
      copiaAindaNaoAprovada: true,
    });
  }
  const destinos = Array.isArray(lido.data) ? lido.data : [];
  const payloads = destinos.map((row) => (row && row.payload && typeof row.payload === "object" ? row.payload : {}));
  const destino = resumir(payloads);
  const ids = diffConjuntos(fonteDepois.listaIds, destino.listaIds);
  const placas = diffConjuntos(fonteDepois.listaPlacas, destino.listaPlacas);
  const alvoOrigem = veiculoDe(depois.origem);
  const alvoDestino = veiculoDe(payloads);
  const relacao = relacaoDocumentos(depois.origem);
  const clientes = await correspondenciaClientes(relacao.cpfs, rest);
  const hashIgual = fonteDepois.hash === destino.hash;
  const quantidadeIgual =
    fonteDepois.quantidade === destino.quantidade &&
    destino.ids === destino.quantidade &&
    destino.placas === destino.quantidade;
  const veiculoIgual =
    alvoOrigem.encontrado &&
    alvoDestino.encontrado &&
    alvoOrigem.hash === alvoDestino.hash &&
    alvoOrigem.placa === alvoDestino.placa;
  const extras = ids.destinoSemOrigem;
  const aprovada =
    quantidadeIgual &&
    ids.origemSemDestino === 0 &&
    ids.destinoSemOrigem === 0 &&
    placas.origemSemDestino === 0 &&
    placas.destinoSemOrigem === 0 &&
    destino.idsDuplicados === 0 &&
    destino.placasDuplicadas === 0 &&
    hashIgual &&
    veiculoIgual &&
    extras === 0;

  return {
    ok: aprovada,
    aprovada,
    motivo: aprovada ? "copia_validada" : extras ? "destino_extra" : "validacao",
    migrationId,
    fonteLigada: false,
    cutover: false,
    redisAlteradoPelaMigracao: false,
    snapshotAlteradoPelaMigracao: false,
    espelhoAlterado: false,
    timestampTecnico: "TIMESTAMPS TÉCNICOS DA MIGRAÇÃO",
    r0,
    r1,
    r0IgualR1: r0 === r1,
    veiculosMudaram: false,
    gravados: copia.gravados || 0,
    fonteAntes: { chave: CHAVE, ...publico(fonteAntes) },
    fonteDepois: { chave: CHAVE, ...publico(fonteDepois) },
    destino: {
      quantidade: destino.quantidade,
      ids: destino.ids,
      placas: destino.placas,
      idsDuplicados: destino.idsDuplicados,
      placasDuplicadas: destino.placasDuplicadas,
      hash: destino.hash,
    },
    destinoExtra: extras,
    ids,
    placas,
    hashIgual,
    espelho: espelhoDe(depois.espelho),
    veiculo: {
      id: VEICULO_ID,
      placa: alvoOrigem.placa,
      proprietarioOrigem: alvoOrigem.proprietario,
      proprietarioDestino: alvoDestino.proprietario,
      proprietarioCpfCnpjOrigem: alvoOrigem.proprietarioCpfCnpj,
      proprietarioCpfCnpjDestino: alvoDestino.proprietarioCpfCnpj,
      updatedAtOrigem: alvoOrigem.updatedAt,
      updatedAtDestino: alvoDestino.updatedAt,
      hashOrigem: alvoOrigem.hash,
      hashDestino: alvoDestino.hash,
      identico: veiculoIgual,
    },
    relacaoClientes: {
      preenchidos: relacao.preenchidos,
      cpfs: relacao.cpfs.length,
      cnpjs: relacao.cnpjs.length,
      outros: relacao.outros,
      cpfsEncontrados: clientes.encontrados,
      cpfsNaoEncontrados: clientes.naoEncontrados,
      consultaOk: clientes.ok === true,
    },
  };
}

module.exports = {
  CHAVE,
  ESPELHO,
  TABELA,
  VEICULO_ID,
  hashInventario,
  hashObjeto,
  resumir,
  executarCopia,
};
