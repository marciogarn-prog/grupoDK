/**
 * Copia dk_clientes_cadastro para public.dk_clientes.
 * Não grava o snapshot, não apaga linhas e não liga a fonte nova.
 */
const clientesPg = require("./dk-clientes-pg.cjs");

const CHAVE = "dk_clientes_cadastro";
const ESPELHO = "dk_portal_clientes_cadastro";
const CURSOR_ID = "1793095213727";
const CURSOR_CPF = "90000000175";
const CURSOR_RECADO = "[E2E:E2E_DK_REAL_20261027_065940_A7F3:ITER4:1793100259479]";
const URL_PADRAO = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function hashInventario(lista) {
  const hashes = (Array.isArray(lista) ? lista : []).map((item) =>
    clientesPg.sha256(JSON.stringify(item, Object.keys(item || {}).sort()))
  );
  hashes.sort();
  return clientesPg.sha256(hashes.join("\n"));
}

function cpfDe(item) {
  return clientesPg.onlyDigits(item && item.cpf).slice(0, 11);
}

function idDe(item) {
  return item && item.id != null ? String(item.id).trim() : "";
}

function duplicados(valores) {
  const contagem = new Map();
  for (const valor of valores) contagem.set(valor, (contagem.get(valor) || 0) + 1);
  let chaves = 0;
  for (const n of contagem.values()) if (n > 1) chaves += 1;
  return chaves;
}

function resumir(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  const ids = [];
  const cpfs = [];
  let semId = 0;
  let semCpf = 0;
  for (const item of arr) {
    const id = idDe(item);
    const cpf = cpfDe(item);
    if (!id) semId += 1;
    else ids.push(id);
    if (cpf.length !== 11) semCpf += 1;
    else cpfs.push(cpf);
  }
  return {
    quantidade: arr.length,
    ids: new Set(ids).size,
    cpfs: new Set(cpfs).size,
    semId,
    semCpf,
    idsDuplicados: duplicados(ids),
    cpfsDuplicados: duplicados(cpfs),
    hash: hashInventario(arr),
    listaIds: ids,
    listaCpfs: cpfs,
  };
}

function cursorDe(lista) {
  const item = (Array.isArray(lista) ? lista : []).find((row) => idDe(row) === CURSOR_ID) || null;
  if (!item) return { encontrado: false, id: "", cpf: "", recado2: "" };
  return {
    encontrado: idDe(item) === CURSOR_ID && cpfDe(item) === CURSOR_CPF && String(item.recado2 || "") === CURSOR_RECADO,
    id: idDe(item),
    cpf: cpfDe(item),
    recado2: String(item.recado2 || ""),
  };
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

async function supabaseGet(select, ms) {
  const key = chaveServico();
  if (!key) return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  const url = `${urlBase()}/rest/v1/dk_cloud_snapshots?label=eq.default&select=${encodeURIComponent(select)}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
      signal: AbortSignal.timeout(ms),
    });
  } catch {
    return { ok: false, status: 522, data: { reason: "snapshot_leitura_lenta" } };
  }
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function lerRevisaoOficial() {
  const res = await supabaseGet("updated_at", 15000);
  if (!res.ok) return { ok: false, status: res.status, data: res.data, updated_at: "" };
  const row = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
  return { ok: Boolean(row && row.updated_at), status: res.status, updated_at: row ? String(row.updated_at) : "" };
}

async function lerColecaoOficial() {
  const select = "updated_at,clientes:payload->dk_clientes_cadastro,espelho:payload->dk_portal_clientes_cadastro";
  const res = await supabaseGet(select, 25000);
  if (!res.ok) return { ok: false, status: res.status, data: res.data };
  const row = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
  if (!row) return { ok: false, status: 404, data: { reason: "snapshot" } };
  return {
    ok: true,
    status: res.status,
    updated_at: String(row.updated_at || ""),
    origem: Array.isArray(row.clientes) ? row.clientes : null,
    espelho: Array.isArray(row.espelho) ? row.espelho : null,
  };
}

async function sqlBruto(query) {
  const key = chaveServico();
  if (!key) return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  let ultimo = { ok: false, status: 404, data: { reason: "sql_indisponivel" } };
  for (const url of [urlBase() + "/pg/query", urlBase() + "/pg-meta/default/query"]) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query }) });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 180) };
    }
    ultimo = { ok: res.ok, status: res.status, data };
    if (res.ok) return ultimo;
  }
  return ultimo;
}

function linhasCompativeis(origem, linhas) {
  const porId = new Map(origem.map((item) => [idDe(item), cpfDe(item)]));
  const divergentes = [];
  for (const row of linhas) {
    const id = String(row && row.id != null ? row.id : "").trim();
    const cpf = cpfDe(row);
    if (!porId.has(id) || porId.get(id) !== cpf) divergentes.push(id || cpf || "?");
  }
  return { ok: divergentes.length === 0, divergentes };
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
  const { listaIds, listaCpfs, ...resto } = resumo;
  return resto;
}

function relatorioBase(migrationId, extra) {
  return {
    ok: false,
    aprovada: false,
    migrationId,
    fonteLigada: false,
    snapshotAlteradoPelaMigracao: false,
    chavesRemovidas: false,
    timestampTecnico: "timestamp técnico de migração",
    ...extra,
  };
}

async function executarCopia(deps) {
  const io = deps || {};
  const rest = io.rest || clientesPg.rest;
  const lerRevisao = io.lerRevisao || lerRevisaoOficial;
  const lerColecao = io.lerColecao || lerColecaoOficial;
  const sql = io.sql || sqlBruto;
  const migrationId =
    io.migrationId || "MIG_CLIENTES_20261027_ITER10_" + new Date().toISOString().replace(/[:.]/g, "");

  const sonda = await rest(
    "dk_clientes?select=id,cpf,payload,created_at,updated_at,deleted_at&limit=1"
  );
  let criada = false;
  if (!sonda.ok && !clientesPg.schemaAusente(sonda)) {
    return relatorioBase(migrationId, {
      motivo: "leitura_tabela",
      tabela: { existia: false, criada: false, status: sonda.status, detalhe: detalheSeguro(sonda.data) },
    });
  }
  if (!sonda.ok && clientesPg.schemaAusente(sonda)) {
    const garantida = await clientesPg.garantirTabela({ rest, sql });
    if (!garantida.ok) {
      return relatorioBase(migrationId, {
        motivo: garantida.reason || "sql",
        tabela: {
          existia: false,
          criada: false,
          status: garantida.status || 0,
          detalhe: detalheSeguro(garantida.detalhe || garantida),
          rls: "nao_aplicado",
        },
      });
    }
    criada = garantida.criada === true;
  }

  const existentes = await rest("dk_clientes?select=id,cpf,payload,deleted_at&order=id.asc&limit=2000");
  if (!existentes.ok) {
    return relatorioBase(migrationId, {
      motivo: "leitura_tabela",
      tabela: { existia: !criada, criada, status: existentes.status, detalhe: detalheSeguro(existentes.data) },
    });
  }
  const linhas = Array.isArray(existentes.data) ? existentes.data : [];
  if (linhas.length >= 2000) {
    return relatorioBase(migrationId, {
      motivo: "tabela_grande_demais",
      tabela: { existia: !criada, criada, linhas: linhas.length },
    });
  }
  const apagadas = linhas.filter((row) => row && row.deleted_at);
  if (apagadas.length) {
    return relatorioBase(migrationId, {
      motivo: "linhas_apagadas_inesperadas",
      tabela: { existia: !criada, criada, apagadas: apagadas.length },
    });
  }

  const privilegio = await sql(
    "select c.relrowsecurity as rls, has_table_privilege('anon', 'public.dk_clientes', 'INSERT') as anon_insert, has_table_privilege('anon', 'public.dk_clientes', 'UPDATE') as anon_update, has_table_privilege('authenticated', 'public.dk_clientes', 'INSERT') as auth_insert from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'dk_clientes'"
  );
  let rls = criada ? "ATIVO" : "INCONCLUSIVO";
  let policyPublicaEscrita = criada ? "NAO" : "INCONCLUSIVO";
  const bruto = privilegio.ok ? privilegio.data : null;
  const row = Array.isArray(bruto)
    ? bruto[0]
    : bruto && Array.isArray(bruto.rows)
      ? bruto.rows[0]
      : bruto && Array.isArray(bruto.result)
        ? bruto.result[0]
        : bruto && (bruto.rls != null || bruto.relrowsecurity != null || bruto.anon_insert != null)
          ? bruto
          : null;
  if (row) {
    const ativo = row.rls === true || row.relrowsecurity === true || String(row.rls || row.relrowsecurity) === "true";
    const escreve = [row.anon_insert, row.anon_update, row.auth_insert].some((v) => v === true || String(v) === "true");
    rls = ativo ? "ATIVO" : "INATIVO";
    policyPublicaEscrita = escreve ? "SIM" : "NAO";
    if (!ativo || escreve) {
      return relatorioBase(migrationId, {
        motivo: "rls_inseguro",
        tabela: { existia: !criada, criada, linhas: linhas.length, rls, policyPublicaEscrita },
      });
    }
  } else if (!criada) {
    return relatorioBase(migrationId, {
      motivo: "rls_inconclusivo",
      tabela: {
        existia: true,
        criada: false,
        linhas: linhas.length,
        rls,
        policyPublicaEscrita,
        detalhe: detalheSeguro(privilegio.data),
      },
    });
  }

  const antes = await lerRevisao();
  if (!antes.ok || !antes.updated_at) {
    return relatorioBase(migrationId, {
      motivo: "r0",
      r0: "",
      tabela: { existia: !criada, criada, linhas: linhas.length, rls, policyPublicaEscrita },
      detalhe: detalheSeguro(antes.data),
    });
  }
  const r0 = String(antes.updated_at);

  const colecao = await lerColecao();
  if (!colecao.ok || !Array.isArray(colecao.origem) || !Array.isArray(colecao.espelho)) {
    return relatorioBase(migrationId, {
      motivo: "colecao",
      r0,
      tabela: { existia: !criada, criada, linhas: linhas.length, rls, policyPublicaEscrita },
      detalhe: detalheSeguro(colecao.data),
    });
  }
  if (String(colecao.updated_at || "") !== r0) {
    return relatorioBase(migrationId, {
      motivo: "snapshot_moveu_antes_da_copia",
      r0,
      revisaoDaColecao: String(colecao.updated_at || ""),
      tabela: { existia: !criada, criada, linhas: linhas.length, rls, policyPublicaEscrita },
    });
  }

  const fonte = resumir(colecao.origem);
  const espelho = resumir(colecao.espelho);
  const identico = fonte.hash === espelho.hash && fonte.quantidade === espelho.quantidade;
  const cursorOrigem = cursorDe(colecao.origem);
  if (!identico) {
    return relatorioBase(migrationId, {
      motivo: "espelho_diferente",
      r0,
      fonte: { chave: CHAVE, ...publico(fonte) },
      espelho: { quantidade: espelho.quantidade, hash: espelho.hash, identico: false },
      tabela: { existia: !criada, criada, linhas: linhas.length, rls, policyPublicaEscrita },
    });
  }
  if (
    fonte.semId ||
    fonte.semCpf ||
    fonte.idsDuplicados ||
    fonte.cpfsDuplicados ||
    fonte.quantidade !== fonte.ids ||
    fonte.quantidade !== fonte.cpfs ||
    !cursorOrigem.encontrado
  ) {
    return relatorioBase(migrationId, {
      motivo: "fonte_inconsistente",
      r0,
      fonte: { chave: CHAVE, ...publico(fonte) },
      espelho: { quantidade: espelho.quantidade, hash: espelho.hash, identico: true },
      cursor1: cursorOrigem,
      tabela: { existia: !criada, criada, linhas: linhas.length, rls, policyPublicaEscrita },
    });
  }

  const compativel = linhasCompativeis(colecao.origem, linhas);
  if (!compativel.ok) {
    return relatorioBase(migrationId, {
      motivo: "linhas_inesperadas",
      r0,
      divergentes: compativel.divergentes.length,
      tabela: { existia: !criada, criada, linhas: linhas.length, rls, policyPublicaEscrita },
      fonte: { chave: CHAVE, quantidade: fonte.quantidade, hash: fonte.hash },
    });
  }

  const copia = await clientesPg.copiarLista(colecao.origem, rest);
  if (!copia.ok) {
    return relatorioBase(migrationId, {
      motivo: "copia",
      r0,
      gravados: copia.gravados || 0,
      detalhe: detalheSeguro(copia.data),
      tabela: { existia: !criada, criada, linhas: linhas.length, rls, policyPublicaEscrita },
      fonte: { chave: CHAVE, quantidade: fonte.quantidade, ids: fonte.ids, cpfs: fonte.cpfs, hash: fonte.hash },
      espelho: { quantidade: espelho.quantidade, hash: espelho.hash, identico: true },
    });
  }

  const depois = await lerRevisao();
  const r1 = depois && depois.ok ? String(depois.updated_at || "") : "";
  if (!depois.ok || r1 !== r0) {
    return relatorioBase(migrationId, {
      motivo: r1 && r1 !== r0 ? "r0_diferente_de_r1" : "r1",
      r0,
      r1,
      copiaAindaNaoAprovada: true,
      gravados: copia.gravados || 0,
      tabela: { existia: !criada, criada, linhasAntes: linhas.length, rls, policyPublicaEscrita },
      fonte: { chave: CHAVE, quantidade: fonte.quantidade, ids: fonte.ids, cpfs: fonte.cpfs, hash: fonte.hash },
      espelho: { quantidade: espelho.quantidade, hash: espelho.hash, identico: true },
    });
  }

  const lido = await clientesPg.listarClientes(rest);
  if (!lido.ok) {
    return relatorioBase(migrationId, {
      motivo: "leitura_destino",
      r0,
      r1,
      copiaAindaNaoAprovada: true,
      tabela: { existia: !criada, criada, rls, policyPublicaEscrita },
    });
  }
  const destino = resumir(lido.clientes);
  const ids = diffConjuntos(fonte.listaIds, destino.listaIds);
  const cpfs = diffConjuntos(fonte.listaCpfs, destino.listaCpfs);
  const cursor = cursorDe(lido.clientes);
  const hashIgual = fonte.hash === destino.hash;
  const quantidadeIgual = fonte.quantidade === destino.quantidade && destino.ids === destino.quantidade && destino.cpfs === destino.quantidade;
  const aprovada =
    quantidadeIgual &&
    ids.origemSemDestino === 0 &&
    ids.destinoSemOrigem === 0 &&
    cpfs.origemSemDestino === 0 &&
    cpfs.destinoSemOrigem === 0 &&
    destino.idsDuplicados === 0 &&
    destino.cpfsDuplicados === 0 &&
    hashIgual &&
    cursor.encontrado === true;

  return {
    ok: aprovada,
    aprovada,
    motivo: aprovada ? "copia_validada" : "validacao",
    migrationId,
    fonteLigada: false,
    snapshotAlteradoPelaMigracao: false,
    chavesRemovidas: false,
    timestampTecnico: "timestamp técnico de migração",
    r0,
    r1,
    tabela: { existia: !criada, criada, linhasAntes: linhas.length, rls, policyPublicaEscrita },
    fonte: {
      chave: CHAVE,
      quantidade: fonte.quantidade,
      ids: fonte.ids,
      cpfs: fonte.cpfs,
      semId: fonte.semId,
      semCpf: fonte.semCpf,
      idsDuplicados: fonte.idsDuplicados,
      cpfsDuplicados: fonte.cpfsDuplicados,
      hash: fonte.hash,
    },
    espelho: { chave: ESPELHO, quantidade: espelho.quantidade, hash: espelho.hash, identico: true },
    destino: {
      quantidade: destino.quantidade,
      ids: destino.ids,
      cpfs: destino.cpfs,
      idsDuplicados: destino.idsDuplicados,
      cpfsDuplicados: destino.cpfsDuplicados,
      hash: destino.hash,
    },
    ids,
    cpfs,
    hashIgual,
    cursor1: cursor,
    gravados: copia.gravados || 0,
  };
}

module.exports = {
  CHAVE,
  ESPELHO,
  hashInventario,
  resumir,
  cursorDe,
  executarCopia,
};
