/**
 * Manifesto de integridade do Sistema DK.
 * Só lê, canonicaliza, compara e relata.
 * Não grava cliente, veículo, locação, pagamento nem manutenção.
 * A tabela de baseline só é criada depois de aprovação integral, e só recebe hashes.
 */
import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import {
  classificarBlocoDocumento,
  diffTrees,
  dinheiroExato,
  entityRef,
  hashValue,
  inventoryKeys,
  reconstruirLocacao,
  redigirCaminho,
  schemaHash,
  semMarcadoresTecnicos,
  sourcePositionConfere,
} from "../lib/dk-integrity-canonical.mjs";

const PROJECT = "ppxtwqvzgujllfzarpuz";
const SHA_ESPERADO = "6a10f9f116dc3ed60523a3ae64df0d851ebf602dd7eec363089ca322bbe9241c";
const GOLDEN_SHA = "9ad7a1c8fe664dfe274cb93bdf79f248c18c166d34b66787266a4be10dc06d56";
const GOLDEN_ID = "bcafcc5a-e214-4777-8aec-25d41fb31699";
const GOLDEN_NOME = "dk-integrity-golden-baseline-20261029.json.gz";
const BACKUP_PADRAO = "C:\\Users\\marci\\OneDrive\\Área de Trabalho\\backup.json.gz";
const SAIDA_PADRAO = "C:\\Users\\marci\\OneDrive\\Área de Trabalho";
const CANARIO = "2025092903";
const TABELAS = ["dk_clientes", "dk_veiculos", "dk_locacao", "dk_pagamento_locacao"];

const aqui = path.dirname(fileURLToPath(import.meta.url));
const sqlBaseline = path.join(aqui, "..", "supabase", "dk-integrity-baseline.sql");

function token() {
  return String(process.env.DK_SB_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || "").trim();
}

function redigir(texto) {
  return String(texto || "")
    .slice(0, 280)
    .replace(/\d{11,14}/g, "[num]")
    .replace(/eyJ[A-Za-z0-9_\-.]{10,}/g, "[jwt]");
}

async function sql(query, escrita = false) {
  if (!escrita && /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke)\b/i.test(query)) {
    throw new Error("sql_escrita_recusada");
  }
  const chave = token();
  if (!chave) throw new Error("token_ausente");
  const url =
    "https://api.supabase.com/v1/projects/" +
    PROJECT +
    "/database/query" +
    (escrita ? "" : "/read-only");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + chave, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("sql_" + res.status + " " + redigir(text));
  const data = text ? JSON.parse(text) : [];
  return Array.isArray(data) ? data : [];
}

async function sqlUmaVez(query) {
  try {
    return await sql(query);
  } catch (err) {
    if (!/timeout|terminated/i.test(String(err && err.message))) throw err;
    return sql(query);
  }
}

function shaArquivo(arquivo) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(arquivo));
  return hash.digest("hex");
}

function digitos(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function placaNorm(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function diaIso(value) {
  const s = String(value ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
}

function centsNumero(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) return Math.round(Number(value) * 100);
  return null;
}

function somaCents(lista, campo = "valor") {
  let total = 0;
  for (const item of lista) {
    const n = item && typeof item[campo] === "number" && Number.isFinite(item[campo]) ? Math.round(item[campo] * 100) : null;
    if (n == null) return null;
    total += n;
  }
  return total;
}

function limitar(lista, n = 40) {
  return lista.slice(0, n).map((item) => redigirCaminho(item));
}

function moduloVazio(nome) {
  return {
    module: nome,
    count: 0,
    schema_hash: "",
    aggregate_hash: "",
    records: [],
    unmapped_keys: [],
    unmapped_records: [],
    extra_records: [],
    extra_keys: [],
    value_mismatches: [],
    key_inventory: [],
    document_summary: {},
    relationship_summary: {},
  };
}

function fecharModulo(mod) {
  const linhas = mod.records
    .map((row) => row.entity_ref + " " + row.business_hash)
    .sort();
  mod.aggregate_hash = hashValue(linhas);
  mod.count = mod.records.length;
  return mod;
}

function registro(module, id, raw, business) {
  return {
    entity_ref: entityRef(module, id),
    raw_hash: hashValue(raw),
    business_hash: hashValue(business),
  };
}

function juntarDiff(mod, diff) {
  mod.unmapped_keys.push(...diff.missing);
  mod.extra_keys.push(...diff.extra);
  mod.value_mismatches.push(...diff.mismatches);
}

async function consultaOpcional(query) {
  try {
    return { ok: true, rows: await sqlUmaVez(query) };
  } catch (err) {
    return { ok: false, rows: [], erro: redigir(err.message) };
  }
}

async function esquemaDe(tabela) {
  const colunas = await sqlUmaVez(
    "select a.attname as column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type, " +
      "a.attnotnull as not_null, pg_get_expr(ad.adbin, ad.adrelid) as column_default " +
      "from pg_attribute a " +
      "join pg_class c on c.oid = a.attrelid " +
      "join pg_namespace n on n.oid = c.relnamespace " +
      "left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum " +
      "where n.nspname = 'public' and c.relname = '" +
      tabela +
      "' and a.attnum > 0 and not a.attisdropped order by a.attnum"
  );
  const restricoes = await consultaOpcional(
    "select con.contype as tipo, con.conname as nome, pg_get_constraintdef(con.oid) as definicao " +
      "from pg_constraint con " +
      "join pg_class rel on rel.oid = con.conrelid " +
      "join pg_namespace nsp on nsp.oid = rel.relnamespace " +
      "where nsp.nspname = 'public' and rel.relname = '" +
      tabela +
      "'"
  );
  const rls = await consultaOpcional(
    "select c.relrowsecurity as rls, c.relforcerowsecurity as forcar " +
      "from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
      "where n.nspname = 'public' and c.relname = '" +
      tabela +
      "'"
  );
  const grants = await consultaOpcional(
    "select grantee, privilege_type from information_schema.role_table_grants " +
      "where table_schema = 'public' and table_name = '" +
      tabela +
      "' order by grantee, privilege_type"
  );
  const definicao = {
    tabela,
    colunas,
    restricoes: restricoes.rows,
    rls: rls.rows[0] || null,
    grants: grants.rows,
    incompleto: !restricoes.ok || !rls.ok || !grants.ok,
    erros: [restricoes.erro, rls.erro, grants.erro].filter(Boolean),
  };
  return { definicao, schema_hash: schemaHash(definicao), incompleto: definicao.incompleto };
}

async function paginar(selectSql, ordem, pagina) {
  const todos = [];
  for (let offset = 0; offset < 200000; offset += pagina) {
    const q = selectSql + " order by " + ordem + " limit " + pagina + " offset " + offset;
    const lote = await sqlUmaVez(q);
    todos.push(...lote);
    if (lote.length < pagina) break;
  }
  return todos;
}

function tipoDocumento(caminho) {
  const p = caminho.toLowerCase();
  if (p.includes("cnh")) return "cnh";
  if (p.includes("resid")) return "residencia";
  if (p.includes("crlv")) return "crlv";
  if (p.includes("foto")) return "foto";
  if (p.includes("comprov")) return "comprovante";
  if (p.includes("pdf")) return "pdf";
  if (p.includes("manut")) return "manutencao";
  return "anexo";
}

function coletarDocumentos(node, caminho, saida) {
  if (typeof node === "string" && node.startsWith("data:")) {
    const bloco = classificarBlocoDocumento({ data: node });
    if (bloco) saida.push(docItem(caminho, bloco));
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => coletarDocumentos(item, caminho + "[" + index + "]", saida));
    return;
  }
  if (!node || typeof node !== "object") return;
  const bloco = classificarBlocoDocumento(node);
  const blobKeys = new Set(["imagem", "imagemRecortada", "arquivo", "pdf", "conteudo", "data"]);
  if (bloco) saida.push(docItem(caminho, bloco));
  for (const key of Object.keys(node)) {
    if (bloco && blobKeys.has(key)) continue;
    coletarDocumentos(node[key], caminho ? caminho + "." + key : key, saida);
  }
}

function docItem(caminho, bloco) {
  return {
    entity: redigirCaminho(caminho).slice(0, 180),
    doc_type: tipoDocumento(caminho),
    technical_ref: redigirCaminho(caminho).slice(0, 180),
    bytes: bloco.bytes,
    mime: bloco.mime || "",
    sha256: bloco.sha256 || "",
    status: bloco.status,
  };
}

function resumoDocumentos(itens) {
  const contagem = { verified: 0, absent_in_source: 0, document_missing: 0, unknown: 0 };
  for (const item of itens) contagem[item.status] = (contagem[item.status] || 0) + 1;
  return { ...contagem, total: itens.length, items: itens };
}

function canarioLocacao(loc) {
  const prazo = [loc.periodoContrato, loc.periodoLocacao, loc.opcaoContrato, loc.tempoContrato]
    .map((item) => String(item ?? ""))
    .join(" ");
  const checks = {
    nome: loc.nome === "AILTON ALMEIDA PEREIRA",
    codigo: String(loc.clienteCodigo) === "0108",
    placa: String(loc.placa) === "SPA5A67",
    modelo: String(loc.marcaModelo) === "HONDA / CG 160 START",
    inicio: String(loc.inicio) === "29/09/2025",
    diaPagamento: String(loc.diaPagto || "").toLowerCase() === "segunda-feira",
    kmInicial: String(loc.kmInicial) === "41" || Number(loc.kmInicial) === 41,
    aluguel: dinheiroExato(loc.valorLocacao) === 25000,
    investimento: dinheiroExato(loc.valorInvestimento) === 10000,
    semanal: dinheiroExato(loc.valorSemanal) === 35000,
    plano: String(loc.plano) === "DK MINHA MOTO",
    modalidade: String(loc.modalidade || "").toUpperCase() === "MOTO",
    prazo: /150/.test(prazo) && /semana/i.test(prazo),
    status: String(loc.statusLocacao || loc.status || "").toUpperCase() === "ATIVO",
  };
  return {
    ok: Object.values(checks).every(Boolean),
    divergentes: Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([nome]) => nome),
  };
}

function parPorId(lista, idDe) {
  const mapa = new Map();
  const duplicados = [];
  for (const item of lista) {
    const id = String(idDe(item) ?? "");
    if (mapa.has(id)) duplicados.push(id);
    mapa.set(id, item);
  }
  return { mapa, duplicados };
}

function compararMapas(mod, backupMap, atualMap, negocioBackup, negocioAtual, cruAtual, idAtual) {
  for (const [id, item] of backupMap) {
    const atual = atualMap.get(id);
    if (!atual) {
      mod.unmapped_records.push(entityRef(mod.module, id));
      continue;
    }
    const negocioB = negocioBackup(item);
    const negocioA = negocioAtual(atual);
    juntarDiff(mod, diffTrees(negocioB, negocioA));
    mod.records.push(registro(mod.module, idAtual(atual, id), cruAtual(atual), negocioA));
  }
  for (const id of atualMap.keys()) {
    if (!backupMap.has(id)) mod.extra_records.push(entityRef(mod.module, id));
  }
}

function semVeiculo(lista, placas) {
  let n = 0;
  for (const item of lista) {
    const placa = placaNorm(item && (item.placa || item.veiculo));
    if (!placa || !placas.has(placa)) n += 1;
  }
  return n;
}

function amostraDe(records, extras) {
  const refs = new Set(extras.filter(Boolean));
  if (records.length) {
    refs.add(records[0].entity_ref);
    refs.add(records[Math.floor(records.length / 2)].entity_ref);
    refs.add(records[records.length - 1].entity_ref);
  }
  return [...refs];
}

async function aplicarBaseline(baselineId, manifestoSha, relatorio) {
  const texto = fs.readFileSync(sqlBaseline, "utf8");
  const comandos = texto
    .split(";")
    .map((parte) => parte.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
  for (const comando of comandos) {
    if (!/dk_integrity_/i.test(comando) && !/^notify\b/i.test(comando) && !/^create extension\b/i.test(comando)) {
      throw new Error("ddl_fora_da_baseline");
    }
    await sql(comando, true);
  }
  const notes = "Backup 2026-10-28 02:00:14 -03. Hashes sem PII. Manutencao inventariada no backup, sem migrar.";
  await sql(
    "insert into public.dk_integrity_baselines " +
      "(id, backup_sha256, manifest_sha256, status, clientes_count, veiculos_count, locacoes_count, pagamentos_count, manutencoes_count, documents_count, notes) values (" +
      "'" + baselineId + "', '" + SHA_ESPERADO + "', '" + manifestoSha + "', 'APPROVED', " +
      relatorio.gates.clientes.count + ", " +
      relatorio.gates.veiculos.count + ", " +
      relatorio.gates.locacoes.count + ", " +
      relatorio.gates.pagamentos.total + ", " +
      relatorio.gates.manutencao.total + ", " +
      relatorio.document_summary.total + ", " +
      "'" + notes.replace(/'/g, "''") + "')",
    true
  );
  const linhas = [];
  for (const mod of relatorio.modules) {
    for (const row of mod.records) {
      if (!/^[a-z0-9:_-]{3,80}$/i.test(row.entity_ref)) throw new Error("entity_ref_recusada");
      if (!/^[0-9a-f]{64}$/.test(row.raw_hash) || !/^[0-9a-f]{64}$/.test(row.business_hash)) {
        throw new Error("hash_recusado");
      }
      linhas.push(
        "('" +
          baselineId +
          "','" +
          mod.module +
          "','" +
          row.entity_ref +
          "','" +
          row.raw_hash +
          "','" +
          row.business_hash +
          "')"
      );
    }
  }
  for (let i = 0; i < linhas.length; i += 80) {
    const lote = linhas.slice(i, i + 80).join(",");
    await sql(
      "insert into public.dk_integrity_record_hashes (baseline_id, module, entity_ref, raw_hash, business_hash) values " +
        lote,
      true
    );
  }
  return linhas.length;
}

function compactarListas(mod) {
  mod.unmapped_keys = limitar(mod.unmapped_keys);
  mod.extra_keys = limitar(mod.extra_keys);
  mod.value_mismatches = limitar(mod.value_mismatches);
  mod.unmapped_records = mod.unmapped_records.slice(0, 40);
  mod.extra_records = mod.extra_records.slice(0, 40);
}

async function main() {
  let saude;
  try {
    saude = await sql("select 1 as ok");
  } catch (err) {
    console.log(JSON.stringify({ status: "PARADO", motivo: "postgres_indisponivel", detalhe: redigir(err.message) }));
    process.exit(2);
  }
  if (!saude[0] || Number(saude[0].ok) !== 1) {
    console.log(JSON.stringify({ status: "PARADO", motivo: "postgres_indisponivel" }));
    process.exit(2);
  }

  const eventos = await sql(
    "select seq, audit_no, event_type from public.dk_events where audit_no in (1, 2) or seq in (3, 12) order by seq"
  );
  const estado = await sql("select last_audit_no from public.dk_audit_state");
  const porAudit = new Map(eventos.map((row) => [Number(row.audit_no), row]));
  const contadorLog = Number(estado[0]?.last_audit_no);
  const logOk = Number(porAudit.get(1)?.seq) === 3 && Number(porAudit.get(2)?.seq) === 12 && contadorLog >= 2;
  if (!logOk) {
    console.log(
      JSON.stringify({
        status: "PARADO",
        motivo: "log_dk_divergente",
        last_audit_no: estado[0] ? estado[0].last_audit_no : null,
        eventos: eventos.map((row) => ({ seq: row.seq, audit_no: row.audit_no, event_type: row.event_type })),
      })
    );
    process.exit(3);
  }

  const backupPath = process.env.DK_BACKUP_PATH || BACKUP_PADRAO;
  const backupSha = shaArquivo(backupPath);
  if (backupSha !== SHA_ESPERADO) {
    console.log(JSON.stringify({ status: "PARADO", motivo: "backup_sha_divergente", sha256: backupSha }));
    process.exit(3);
  }

  const backup = JSON.parse(zlib.gunzipSync(fs.readFileSync(backupPath)).toString("utf8"));
  const data = backup.data || {};
  const clientesB = data.dk_clientes_cadastro;
  const veiculosB = data.dk_veiculos_cadastro;
  const locacoesB = data.dk_locacoes_cadastro;
  const manutB = data.dk_manutencoes_cadastro;
  const rapidasB = data.dk_manutencoes_rapidas_v1;
  if (!Array.isArray(clientesB) || !Array.isArray(veiculosB) || !Array.isArray(locacoesB)) {
    console.log(JSON.stringify({ status: "PARADO", motivo: "backup_sem_colecoes" }));
    process.exit(3);
  }

  const esquemas = {};
  for (const tabela of TABELAS) esquemas[tabela] = await esquemaDe(tabela);
  const tabelasManut = await sql(
    "select c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
      "where n.nspname = 'public' and c.relkind = 'r' and c.relname ilike '%manut%'"
  );

  function selecionar(tabela, desejadas, expr) {
    const tem = new Set((esquemas[tabela].definicao.colunas || []).map((coluna) => coluna.column_name));
    const cols = desejadas.filter((nome) => tem.has(nome));
    if (!cols.includes("id") && !cols.includes("numero_contrato")) throw new Error("colunas_ausentes_" + tabela);
    return cols.map((nome) => (expr && expr[nome]) || nome).join(", ");
  }
  const clientesA = await paginar(
    "select " + selecionar("dk_clientes", ["id", "cpf", "payload", "created_at", "updated_at", "deleted_at"]) + " from public.dk_clientes",
    "id",
    40
  );
  const veiculosA = await paginar(
    "select " + selecionar("dk_veiculos", ["id", "placa", "payload", "created_at", "updated_at", "deleted_at"]) + " from public.dk_veiculos",
    "id",
    40
  );
  const colunasLoc = selecionar(
    "dk_locacao",
    [
      "id",
      "numero_contrato",
      "id_legado",
      "cpf",
      "placa",
      "status_locacao",
      "campos",
      "version",
      "created_at",
      "updated_at",
      "deleted_at",
      "created_by",
      "updated_by",
    ],
    { id: "id::text as id" }
  );
  const locacoesA = await paginar("select " + colunasLoc + " from public.dk_locacao", "numero_contrato", 5);
  const pagamentosA = await paginar("select * from public.dk_pagamento_locacao", "id", 40);
  const quarentena = await sql("select count(*)::int as n from public.dk_pagamento_locacao_quarentena");

  const modClientes = moduloVazio("clientes");
  modClientes.schema_hash = esquemas.dk_clientes.schema_hash;
  modClientes.key_inventory = inventoryKeys(clientesB);
  const mapCliB = parPorId(clientesB, (item) => item.id);
  const mapCliA = parPorId(clientesA, (item) => item.id);
  compararMapas(
    modClientes,
    mapCliB.mapa,
    mapCliA.mapa,
    (item) => item,
    (item) => item.payload,
    (item) => item,
    (_item, id) => id
  );
  for (const [id, item] of mapCliB.mapa) {
    const atual = mapCliA.mapa.get(id);
    if (!atual) continue;
    if (String(atual.id) !== String(item.id)) modClientes.value_mismatches.push("coluna.id");
    if (digitos(item.cpf) !== digitos(atual.cpf)) modClientes.value_mismatches.push("coluna.cpf");
    if (atual.deleted_at) modClientes.value_mismatches.push("deleted_at");
  }

  const modVeiculos = moduloVazio("veiculos");
  modVeiculos.schema_hash = esquemas.dk_veiculos.schema_hash;
  modVeiculos.key_inventory = inventoryKeys(veiculosB);
  const mapVeiB = parPorId(veiculosB, (item) => item.id);
  const mapVeiA = parPorId(veiculosA, (item) => item.id);
  compararMapas(
    modVeiculos,
    mapVeiB.mapa,
    mapVeiA.mapa,
    (item) => item,
    (item) => item.payload,
    (item) => item,
    (_item, id) => id
  );
  let aaa = 0;
  for (const item of veiculosB) if (placaNorm(item.placa) === "AAA1A11") aaa += 1;
  for (const item of veiculosA) {
    if (placaNorm(item.placa) === "AAA1A11" || placaNorm(item.payload && item.payload.placa) === "AAA1A11") aaa += 1;
  }
  for (const [id, item] of mapVeiB.mapa) {
    const atual = mapVeiA.mapa.get(id);
    if (!atual) continue;
    if (String(atual.placa) !== String(item.placa)) modVeiculos.value_mismatches.push("coluna.placa");
    if (atual.deleted_at) modVeiculos.value_mismatches.push("deleted_at");
  }

  const ativosB = [];
  const removidosB = [];
  for (const loc of locacoesB) {
    const nc = String(loc.numeroContrato || "");
    const ativos = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
    const removidos = Array.isArray(loc.portalLancamentosAluguelRemovidos) ? loc.portalLancamentosAluguelRemovidos : [];
    ativos.forEach((pagamento, index) => ativosB.push({ nc, index, pagamento }));
    removidos.forEach((pagamento, index) => removidosB.push({ nc, index, pagamento }));
  }
  const porContrato = new Map();
  for (const row of pagamentosA) {
    const nc = String(row.numero_contrato || "");
    if (!porContrato.has(nc)) porContrato.set(nc, []);
    porContrato.get(nc).push(row);
  }
  for (const lista of porContrato.values()) {
    lista.sort((a, b) => Number(a.source_position) - Number(b.source_position) || String(a.id).localeCompare(String(b.id)));
  }

  const modLoc = moduloVazio("locacoes");
  modLoc.schema_hash = esquemas.dk_locacao.schema_hash;
  modLoc.key_inventory = inventoryKeys(locacoesB);
  const mapLocB = parPorId(locacoesB, (item) => item.numeroContrato);
  const mapLocA = parPorId(locacoesA, (item) => item.numero_contrato);
  const reconstruidas = new Map();
  for (const [nc, loc] of mapLocB.mapa) {
    const atual = mapLocA.mapa.get(nc);
    if (!atual) {
      modLoc.unmapped_records.push(entityRef("locacoes", nc));
      continue;
    }
    const linhasPg = porContrato.get(nc) || [];
    const ativosPg = linhasPg.filter((row) => row.removido !== true).map((row) => row.payload);
    const removidosPg = linhasPg.filter((row) => row.removido === true).map((row) => row.payload);
    const negocio = reconstruirLocacao(semMarcadoresTecnicos(atual.campos || {}), ativosPg, removidosPg);
    reconstruidas.set(nc, negocio);
    juntarDiff(modLoc, diffTrees(loc, negocio));
    modLoc.records.push(registro("locacoes", nc, atual, negocio));
    if (digitos(atual.cpf) !== digitos(loc.cpf)) modLoc.value_mismatches.push("coluna.cpf");
    if (String(atual.placa || "") !== String(loc.placa || "")) modLoc.value_mismatches.push("coluna.placa");
    const statusOficial = String(loc.statusLocacao || loc.status || "");
    if (String(atual.status_locacao || "") !== statusOficial) modLoc.value_mismatches.push("coluna.status_locacao");
    if (atual.deleted_at) modLoc.value_mismatches.push("deleted_at");
  }
  for (const nc of mapLocA.mapa.keys()) {
    if (!mapLocB.mapa.has(nc)) modLoc.extra_records.push(entityRef("locacoes", nc));
  }

  const modPag = moduloVazio("pagamentos");
  modPag.schema_hash = esquemas.dk_pagamento_locacao.schema_hash;
  modPag.key_inventory = inventoryKeys(ativosB.map((item) => item.pagamento).concat(removidosB.map((item) => item.pagamento)));
  const contratos = new Set(mapLocB.mapa.keys());
  let orfaos = 0;
  let migrationAusente = 0;
  let posicaoDivergente = 0;
  let colunaDivergente = 0;
  const chavesBackup = new Map();
  const chavesAtual = new Map();
  function chavePag(nc, pagamento, removido) {
    const proto = String(pagamento?.protocoloLancamento || pagamento?.protocolo || "");
    return nc + "|" + proto + "|" + (removido ? "1" : "0");
  }
  function consumir(lista, removido) {
    for (const item of lista) {
      const chave = chavePag(item.nc, item.pagamento, removido);
      chavesBackup.set(chave, (chavesBackup.get(chave) || 0) + 1);
      if (!contratos.has(item.nc)) orfaos += 1;
    }
  }
  consumir(ativosB, false);
  consumir(removidosB, true);
  const usados = new Map();
  function casar(lista, removido) {
    for (const item of lista) {
      const linhas = (porContrato.get(item.nc) || []).filter((row) => (row.removido === true) === removido);
      const ja = usados.get(item.nc + "|" + (removido ? "1" : "0")) || 0;
      const row = linhas[ja];
      usados.set(item.nc + "|" + (removido ? "1" : "0"), ja + 1);
      if (!row) {
        modPag.unmapped_records.push(entityRef("pagamentos", item.nc + ":" + item.index + ":" + (removido ? "r" : "a")));
        continue;
      }
      const chave = chavePag(item.nc, row.payload || {}, removido);
      chavesAtual.set(chave, (chavesAtual.get(chave) || 0) + 1);
      juntarDiff(modPag, diffTrees(item.pagamento, row.payload || {}));
      modPag.records.push(registro("pagamentos", row.id, row, row.payload || {}));
      if (!sourcePositionConfere(row.source_position, item.index)) posicaoDivergente += 1;
      if (!String(row.migration_key || "").trim()) migrationAusente += 1;
      if (String(row.numero_contrato || "") !== item.nc) colunaDivergente += 1;
      if (String(row.protocolo_lancamento || "") !== String(item.pagamento?.protocoloLancamento || "")) colunaDivergente += 1;
      const centsPayload = typeof item.pagamento?.valor === "number" ? Math.round(item.pagamento.valor * 100) : null;
      if (centsPayload != null && centsNumero(row.valor) !== centsPayload) colunaDivergente += 1;
      const diaPayload = diaIso(item.pagamento?.data);
      const diaColuna = diaIso(row.data_pagamento);
      if (diaPayload && diaColuna && diaPayload !== diaColuna) colunaDivergente += 1;
    }
  }
  casar(ativosB, false);
  casar(removidosB, true);
  for (const row of pagamentosA) {
    const nc = String(row.numero_contrato || "");
    if (!contratos.has(nc)) orfaos += 1;
  }
  const pagamentosEsperados = ativosB.length + removidosB.length;
  if (pagamentosA.length > modPag.records.length) {
    const conhecidos = new Set(modPag.records.map((row) => row.entity_ref));
    for (const row of pagamentosA) {
      const ref = entityRef("pagamentos", row.id);
      if (!conhecidos.has(ref)) modPag.extra_records.push(ref);
    }
  }
  let duplicidade = 0;
  const chaves = new Set([...chavesBackup.keys(), ...chavesAtual.keys()]);
  for (const chave of chaves) {
    if ((chavesBackup.get(chave) || 0) !== (chavesAtual.get(chave) || 0)) duplicidade += 1;
  }
  let totaisDivergentes = 0;
  for (const loc of locacoesB) {
    const nc = String(loc.numeroContrato || "");
    const ativos = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
    const removidos = Array.isArray(loc.portalLancamentosAluguelRemovidos) ? loc.portalLancamentosAluguelRemovidos : [];
    const linhas = porContrato.get(nc) || [];
    const ativosA = linhas.filter((row) => row.removido !== true).map((row) => row.payload || {});
    const removidosA = linhas.filter((row) => row.removido === true).map((row) => row.payload || {});
    const somaB = somaCents(ativos);
    const somaA = somaCents(ativosA);
    const somaRB = somaCents(removidos);
    const somaRA = somaCents(removidosA);
    if (ativos.length !== ativosA.length || removidos.length !== removidosA.length || somaB !== somaA || somaRB !== somaRA) {
      totaisDivergentes += 1;
    }
  }

  const locCanarioB = mapLocB.mapa.get(CANARIO);
  const locCanarioA = reconstruidas.get(CANARIO);
  const canario = locCanarioA ? canarioLocacao(locCanarioA) : { ok: false, divergentes: ["ausente"] };
  const canarioBackup = locCanarioB ? canarioLocacao(locCanarioB) : { ok: false, divergentes: ["ausente_backup"] };
  const ativosCanarioB = locCanarioB && Array.isArray(locCanarioB.portalLancamentosAluguel) ? locCanarioB.portalLancamentosAluguel.length : -1;
  const removidosCanarioB = locCanarioB && Array.isArray(locCanarioB.portalLancamentosAluguelRemovidos) ? locCanarioB.portalLancamentosAluguelRemovidos.length : -1;
  const linhasCanario = porContrato.get(CANARIO) || [];
  const ativosCanarioA = linhasCanario.filter((row) => row.removido !== true).length;
  const removidosCanarioA = linhasCanario.filter((row) => row.removido === true).length;

  const placas = new Set(veiculosB.map((item) => placaNorm(item.placa)).filter(Boolean));
  const modManut = moduloVazio("manutencao");
  modManut.schema_hash = schemaHash({ tabela: null, origem: "dk_manutencoes_cadastro", tabelas_relacionais: tabelasManut });
  modManut.key_inventory = inventoryKeys(Array.isArray(manutB) ? manutB : []);
  for (const item of Array.isArray(manutB) ? manutB : []) {
    modManut.records.push(registro("manutencao", item.id, item, item));
  }
  const modRapida = moduloVazio("manutencao_rapida");
  modRapida.schema_hash = schemaHash({ tabela: null, origem: "dk_manutencoes_rapidas_v1", tabelas_relacionais: tabelasManut });
  modRapida.key_inventory = inventoryKeys(Array.isArray(rapidasB) ? rapidasB : []);
  for (const item of Array.isArray(rapidasB) ? rapidasB : []) {
    modRapida.records.push(registro("manutencao_rapida", item.id, item, item));
  }
  const semVeiculoManut = semVeiculo(Array.isArray(manutB) ? manutB : [], placas);
  const semVeiculoRapida = semVeiculo(Array.isArray(rapidasB) ? rapidasB : [], placas);

  function resumirEspelho(oficial, espelho) {
    if (!Array.isArray(oficial) || !Array.isArray(espelho)) return { pares: 0, sem_par: -1, campos: [] };
    const a = parPorId(oficial, (item) => item.id);
    const b = parPorId(espelho, (item) => item.id);
    const campos = new Map();
    let semPar = Math.abs(a.mapa.size - b.mapa.size);
    for (const [id, item] of a.mapa) {
      const outro = b.mapa.get(id);
      if (!outro) {
        semPar += 1;
        continue;
      }
      const diff = diffTrees(item, outro);
      for (const caminho of [...diff.missing, ...diff.extra, ...diff.mismatches]) {
        campos.set(caminho, (campos.get(caminho) || 0) + 1);
      }
    }
    return {
      pares: a.mapa.size,
      sem_par: semPar,
      campos: [...campos.entries()].map(([caminho, n]) => ({ caminho, n })),
    };
  }

  function moduloEspelho(nome, lista) {
    const mod = moduloVazio(nome);
    mod.schema_hash = schemaHash({ tabela: null, origem: nome, destino: "manifesto_externo" });
    mod.key_inventory = inventoryKeys(Array.isArray(lista) ? lista : []);
    for (const item of Array.isArray(lista) ? lista : []) {
      mod.records.push(registro(nome, item.id, item, item));
    }
    return mod;
  }

  const modEspelhoClientes = moduloEspelho("clientes_espelho_portal", data.dk_portal_clientes_cadastro);
  const modEspelhoVeiculos = moduloEspelho("veiculos_espelho_portal", data.dk_portal_veiculos_cadastro);
  const espelhoClientes = resumirEspelho(clientesB, data.dk_portal_clientes_cadastro);
  const espelhoVeiculos = resumirEspelho(veiculosB, data.dk_portal_veiculos_cadastro);

  const documentos = [];
  for (const nome of [
    "dk_clientes_cadastro",
    "dk_veiculos_cadastro",
    "dk_locacoes_cadastro",
    "dk_manutencoes_cadastro",
    "dk_manutencoes_rapidas_v1",
    "dk_cliente_docs_v1",
    "dk_patrimonio_crlv_v1",
    "dk_locacao_documentos_v1",
    "dk_documentos_deposito_v1",
  ]) {
    if (data[nome] != null) coletarDocumentos(data[nome], nome, documentos);
  }
  const document_summary = resumoDocumentos(documentos);

  const relacao = {
    pagamentos_orfaos: orfaos,
    duplicidade_nao_explicada: duplicidade,
    totais_locacao_divergentes: totaisDivergentes,
    canario_ativos_backup: ativosCanarioB,
    canario_ativos_atual: ativosCanarioA,
    canario_removidos_backup: removidosCanarioB,
    canario_removidos_atual: removidosCanarioA,
    manutencao_sem_veiculo: semVeiculoManut,
    manutencao_rapida_sem_veiculo: semVeiculoRapida,
    quarentena: Number(quarentena[0]?.n || 0),
    espelho_portal_clientes: espelhoClientes,
    espelho_portal_veiculos: espelhoVeiculos,
    source_position_base: 1,
    source_position_regra: "indice_do_array_original_mais_1",
    source_position_divergente: posicaoDivergente,
    migration_key_ausente: migrationAusente,
    coluna_pagamento_divergente: colunaDivergente,
    tabelas_manutencao: tabelasManut.map((row) => row.nome),
    log: { seq_3_audit_1: true, seq_12_audit_2: true, last_audit_no: 2 },
  };

  const modulos = [modClientes, modVeiculos, modLoc, modPag, modManut, modRapida, modEspelhoClientes, modEspelhoVeiculos];
  for (const mod of modulos) {
    mod.document_summary = {
      verified: document_summary.verified,
      absent_in_source: document_summary.absent_in_source,
      document_missing: document_summary.document_missing,
      unknown: document_summary.unknown,
    };
    mod.relationship_summary = relacao;
    fecharModulo(mod);
  }

  const chavesNegocio = (mod) => mod.unmapped_keys.length;
  const gates = {
    clientes: {
      count: clientesB.length,
      atual: clientesA.length,
      unmapped_records: mapCliB.mapa.size - [...mapCliB.mapa.keys()].filter((id) => mapCliA.mapa.has(id)).length,
      extra_records: [...mapCliA.mapa.keys()].filter((id) => !mapCliB.mapa.has(id)).length,
      unmapped_business_keys: chavesNegocio(modClientes),
      mismatches: modClientes.value_mismatches.length,
      extra_keys: modClientes.extra_keys.length,
    },
    veiculos: {
      count: veiculosB.length,
      atual: veiculosA.length,
      aaa1a11: aaa,
      unmapped_records: [...mapVeiB.mapa.keys()].filter((id) => !mapVeiA.mapa.has(id)).length,
      extra_records: [...mapVeiA.mapa.keys()].filter((id) => !mapVeiB.mapa.has(id)).length,
      unmapped_business_keys: chavesNegocio(modVeiculos),
      mismatches: modVeiculos.value_mismatches.length,
      extra_keys: modVeiculos.extra_keys.length,
    },
    locacoes: {
      count: locacoesB.length,
      atual: locacoesA.length,
      unmapped_records: modLoc.unmapped_records.length,
      extra_records: modLoc.extra_records.length,
      unmapped_business_keys: chavesNegocio(modLoc),
      mismatches: modLoc.value_mismatches.length,
      extra_keys: modLoc.extra_keys.length,
      canario_backup: canarioBackup.ok,
      canario_atual: canario.ok,
      canario_divergentes: canario.divergentes,
    },
    pagamentos: {
      ativos: ativosB.length,
      removidos: removidosB.length,
      total: ativosB.length + removidosB.length,
      atual: pagamentosA.length,
      orfaos,
      duplicidade_nao_explicada: duplicidade,
      unmapped_records: modPag.unmapped_records.length,
      extra_records: modPag.extra_records.length,
      unmapped_business_keys: chavesNegocio(modPag),
      mismatches: modPag.value_mismatches.length,
    },
    manutencao: {
      historico: Array.isArray(manutB) ? manutB.length : -1,
      rapidas: Array.isArray(rapidasB) ? rapidasB.length : -1,
      total: (Array.isArray(manutB) ? manutB.length : 0) + (Array.isArray(rapidasB) ? rapidasB.length : 0),
      no_manifesto: modManut.records.length + modRapida.records.length,
      sem_veiculo: semVeiculoManut + semVeiculoRapida,
      tabela_relacional: tabelasManut.length,
    },
    documentos: document_summary,
  };

  const amostra = [
    ...amostraDe(modClientes.records, []),
    ...amostraDe(modVeiculos.records, []),
    ...amostraDe(modLoc.records, [entityRef("locacoes", CANARIO)]),
    ...amostraDe(modPag.records, []),
  ];
  const porRef = new Map();
  for (const mod of [modClientes, modVeiculos, modLoc, modPag]) {
    for (const row of mod.records) porRef.set(row.entity_ref, row);
  }
  const amostraFalhas = amostra.filter((ref) => !porRef.has(ref));
  const roundtrip = {
    amostra: amostra.length,
    amostra_falhas: amostraFalhas.length,
    registros_com_hash: porRef.size,
    falhas_negocio:
      gates.clientes.unmapped_business_keys +
      gates.clientes.mismatches +
      gates.clientes.extra_keys +
      gates.veiculos.unmapped_business_keys +
      gates.veiculos.mismatches +
      gates.veiculos.extra_keys +
      gates.locacoes.unmapped_business_keys +
      gates.locacoes.mismatches +
      gates.locacoes.extra_keys +
      gates.pagamentos.unmapped_business_keys +
      gates.pagamentos.mismatches,
    instrucao: "amostra representativa, canario 2025092903 e comparacao integral backup para reconstrucao",
  };

  const aprovado =
    gates.clientes.count === 437 &&
    gates.clientes.atual === 437 &&
    gates.clientes.unmapped_records === 0 &&
    gates.clientes.extra_records === 0 &&
    gates.clientes.unmapped_business_keys === 0 &&
    gates.clientes.mismatches === 0 &&
    gates.clientes.extra_keys === 0 &&
    mapCliB.duplicados.length === 0 &&
    gates.veiculos.count === 199 &&
    gates.veiculos.atual === 199 &&
    gates.veiculos.aaa1a11 === 0 &&
    gates.veiculos.unmapped_records === 0 &&
    gates.veiculos.extra_records === 0 &&
    gates.veiculos.unmapped_business_keys === 0 &&
    gates.veiculos.mismatches === 0 &&
    gates.veiculos.extra_keys === 0 &&
    gates.locacoes.count === 610 &&
    gates.locacoes.atual === 610 &&
    gates.locacoes.unmapped_records === 0 &&
    gates.locacoes.extra_records === 0 &&
    gates.locacoes.unmapped_business_keys === 0 &&
    gates.locacoes.mismatches === 0 &&
    gates.locacoes.extra_keys === 0 &&
    gates.locacoes.canario_backup === true &&
    gates.locacoes.canario_atual === true &&
    gates.pagamentos.ativos === 1578 &&
    gates.pagamentos.removidos === 274 &&
    gates.pagamentos.total === 1852 &&
    gates.pagamentos.atual === 1852 &&
    gates.pagamentos.orfaos === 0 &&
    gates.pagamentos.duplicidade_nao_explicada === 0 &&
    gates.pagamentos.unmapped_records === 0 &&
    gates.pagamentos.extra_records === 0 &&
    gates.pagamentos.unmapped_business_keys === 0 &&
    gates.pagamentos.mismatches === 0 &&
    pagamentosEsperados === 1852 &&
    ativosCanarioB === 52 &&
    removidosCanarioB === 8 &&
    ativosCanarioA === 52 &&
    removidosCanarioA === 8 &&
    totaisDivergentes === 0 &&
    posicaoDivergente === 0 &&
    migrationAusente === 0 &&
    colunaDivergente === 0 &&
    relacao.quarentena === 0 &&
    espelhoClientes.sem_par === 0 &&
    espelhoVeiculos.sem_par === 0 &&
    espelhoClientes.pares === 437 &&
    espelhoVeiculos.pares === 199 &&
    gates.manutencao.historico === (Array.isArray(manutB) ? manutB.length : -1) &&
    gates.manutencao.no_manifesto === gates.manutencao.total &&
    gates.manutencao.historico >= 0 &&
    gates.manutencao.rapidas >= 0 &&
    document_summary.document_missing === 0 &&
    document_summary.unknown === 0 &&
    roundtrip.amostra_falhas === 0 &&
    roundtrip.falhas_negocio === 0 &&
    TABELAS.every((tabela) => esquemas[tabela].incompleto !== true);

  const countsAntes = {
    unmapped_keys_clientes: modClientes.unmapped_keys.length,
    unmapped_keys_veiculos: modVeiculos.unmapped_keys.length,
    unmapped_keys_locacoes: modLoc.unmapped_keys.length,
    unmapped_keys_pagamentos: modPag.unmapped_keys.length,
    mismatches_locacoes: modLoc.value_mismatches.length,
    extra_locacoes: modLoc.extra_keys.length,
  };
  for (const mod of modulos) compactarListas(mod);

  const records = modulos.flatMap((mod) => mod.records.map((row) => ({ module: mod.module, ...row })));
  const relatorio = {
    generated_at: new Date().toISOString(),
    backup_sha256: backupSha,
    backup_exportado_em: backup.exportedAtBr || null,
    module: "dk",
    count: records.length,
    schema_hash: schemaHash(Object.fromEntries(TABELAS.map((tabela) => [tabela, esquemas[tabela].definicao]))),
    aggregate_hash: hashValue(records.map((row) => row.module + " " + row.entity_ref + " " + row.business_hash).sort()),
    records,
    unmapped_keys: [modClientes, modVeiculos, modLoc, modPag].flatMap((mod) => mod.unmapped_keys),
    unmapped_records: [modClientes, modVeiculos, modLoc, modPag].flatMap((mod) => mod.unmapped_records),
    extra_records: [modClientes, modVeiculos, modLoc, modPag].flatMap((mod) => mod.extra_records),
    document_summary: {
      verified: document_summary.verified,
      absent_in_source: document_summary.absent_in_source,
      document_missing: document_summary.document_missing,
      unknown: document_summary.unknown,
      total: document_summary.total,
    },
    relationship_summary: relacao,
    status: aprovado ? "APPROVED" : "REJECTED",
    gates,
    roundtrip,
    contagens_brutas: countsAntes,
    schema: Object.fromEntries(TABELAS.map((tabela) => [tabela, esquemas[tabela].definicao])),
    modules: modulos,
    documentos: document_summary.items,
  };

  const dir = process.env.DK_INTEGRITY_DIR || SAIDA_PADRAO;
  const goldenPath = path.join(dir, GOLDEN_NOME);
  const goldenIntacto = fs.existsSync(goldenPath) && shaArquivo(goldenPath) === GOLDEN_SHA;
  let baselineMatch = null;
  if (goldenIntacto) {
    const anterior = JSON.parse(zlib.gunzipSync(fs.readFileSync(goldenPath)).toString("utf8"));
    const modAnterior = (anterior.modules || []).find((item) => item.module === "clientes");
    const docsAntes = (anterior.documentos || [])
      .filter((item) => item.doc_type === "cnh" || item.doc_type === "residencia")
      .map((item) => item.doc_type + ":" + item.status + ":" + item.sha256)
      .sort();
    const docsAgora = (relatorio.documentos || [])
      .filter((item) => item.doc_type === "cnh" || item.doc_type === "residencia")
      .map((item) => item.doc_type + ":" + item.status + ":" + item.sha256)
      .sort();
    baselineMatch = {
      clientes_hash: modAnterior && modAnterior.aggregate_hash === modClientes.aggregate_hash,
      clientes: anterior.gates && anterior.gates.clientes && anterior.gates.clientes.count === 437 && gates.clientes.count === 437,
      veiculos: gates.veiculos.count === 199 && gates.veiculos.atual === 199,
      locacoes: gates.locacoes.count === 610 && gates.locacoes.atual === 610,
      pagamentos: gates.pagamentos.ativos === 1578 && gates.pagamentos.removidos === 274 && gates.pagamentos.atual === 1852,
      quarentena: relacao.quarentena === 0,
      documentos_cliente: JSON.stringify(docsAntes) === JSON.stringify(docsAgora),
    };
    baselineMatch.ok = Object.keys(baselineMatch)
      .filter((chave) => chave !== "ok")
      .every((chave) => baselineMatch[chave] === true);
  }
  let nome = GOLDEN_NOME;
  let manifestoSha = goldenIntacto ? GOLDEN_SHA : "";
  if (!goldenIntacto) {
    nome = aprovado ? GOLDEN_NOME : "dk-integrity-audit-20261029.json.gz";
    const destino = path.join(dir, nome);
    fs.writeFileSync(destino, zlib.gzipSync(Buffer.from(JSON.stringify(relatorio), "utf8")));
    manifestoSha = shaArquivo(destino);
    fs.writeFileSync(path.join(dir, nome.replace(/\.json\.gz$/, ".sha256")), manifestoSha + "  " + nome + "\n");
  }

  let tabela = { gravada: false, baseline_id: goldenIntacto ? GOLDEN_ID : null };
  if (aprovado && !goldenIntacto) {
    try {
      const baselineId = randomUUID();
      const hashes = await aplicarBaseline(baselineId, manifestoSha, relatorio);
      tabela = { gravada: true, baseline_id: baselineId, hashes };
    } catch (err) {
      tabela = { gravada: false, motivo: redigir(err.message) };
    }
  }

  console.log(
    JSON.stringify({
      status: relatorio.status,
      baseline_match: baselineMatch,
      clientes_aggregate_hash: modClientes.aggregate_hash,
      backup_sha256: backupSha,
      manifest_sha256: manifestoSha,
      arquivo: nome,
      gates: {
        clientes: gates.clientes,
        veiculos: gates.veiculos,
        locacoes: {
          count: gates.locacoes.count,
          unmapped_records: gates.locacoes.unmapped_records,
          extra_records: gates.locacoes.extra_records,
          unmapped_business_keys: gates.locacoes.unmapped_business_keys,
          mismatches: gates.locacoes.mismatches,
          extra_keys: gates.locacoes.extra_keys,
          canario_atual: gates.locacoes.canario_atual,
          canario_backup: gates.locacoes.canario_backup,
          canario_divergentes: gates.locacoes.canario_divergentes,
        },
        pagamentos: gates.pagamentos,
        manutencao: gates.manutencao,
        documentos: {
          verified: document_summary.verified,
          absent_in_source: document_summary.absent_in_source,
          document_missing: document_summary.document_missing,
          unknown: document_summary.unknown,
        },
        roundtrip,
        relacao: {
          orfaos: relacao.pagamentos_orfaos,
          duplicidade: relacao.duplicidade_nao_explicada,
          totais: relacao.totais_locacao_divergentes,
          posicao: relacao.source_position_divergente,
          migration_key_ausente: relacao.migration_key_ausente,
          coluna_pagamento: relacao.coluna_pagamento_divergente,
          quarentena: relacao.quarentena,
          espelho_clientes: relacao.espelho_portal_clientes,
          espelho_veiculos: relacao.espelho_portal_veiculos,
          sem_veiculo: relacao.manutencao_sem_veiculo + relacao.manutencao_rapida_sem_veiculo,
          tabelas_manutencao: relacao.tabelas_manutencao,
        },
      },
      tabela,
    })
  );
  if (relatorio.status !== "APPROVED" || (baselineMatch && baselineMatch.ok !== true)) process.exit(3);
}

main().catch((err) => {
  console.log(JSON.stringify({ status: "PARADO", motivo: "falha", detalhe: redigir(err && err.message) }));
  process.exit(4);
});
