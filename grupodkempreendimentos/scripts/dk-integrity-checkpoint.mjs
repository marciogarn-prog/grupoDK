/**
 * Registra um delta legítimo e o checkpoint atual.
 * Não grava cliente, veículo, locação, pagamento nem snapshot.
 * Não reescreve a Golden Baseline.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const fidelidade = require(path.join(aqui, "../lib/dk-cliente-fidelidade.cjs"));
const { classificarBlocoDocumento, hashValue } = await import(pathToFileURL(path.join(aqui, "../lib/dk-integrity-canonical.mjs")).href);

const PARENT = "bcafcc5a-e214-4777-8aec-25d41fb31699";
const ALVO = "b27b8c03f684";
const DELTA_ID = "c1a0de17-2026-4029-8aec-000000000438";
const CHECKPOINT_ID = "c4ec4c01-2026-4029-8aec-000000000438";
const OPERATION_ID = "de17a001-2026-4029-8aec-000000000438";
const GOLDEN_SHA = "9ad7a1c8fe664dfe274cb93bdf79f248c18c166d34b66787266a4be10dc06d56";
const GOLDEN = "C:\\Users\\marci\\OneDrive\\Área de Trabalho\\dk-integrity-golden-baseline-20261029.json.gz";
const SAIDA = "C:\\Users\\marci\\OneDrive\\Área de Trabalho\\dk-integrity-current-checkpoint-20261029.json.gz";
const SQL = fs.readFileSync(path.join(aqui, "../supabase/dk-integrity-delta.sql"), "utf8");
const PROJECT = "ppxtwqvzgujllfzarpuz";

function token() {
  const valor = String(process.env.DK_SB_TOKEN || "").trim();
  if (!valor) throw new Error("token_ausente");
  return valor;
}

function shaArquivo(arquivo) {
  return createHash("sha256").update(fs.readFileSync(arquivo)).digest("hex");
}

function refCliente(id) {
  return createHash("sha256").update("cliente\n" + String(id), "utf8").digest("hex").slice(0, 12);
}

async function query(texto, escrita) {
  const res = await fetch(
    "https://api.supabase.com/v1/projects/" + PROJECT + "/database/query" + (escrita ? "" : "/read-only"),
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
      body: JSON.stringify({ query: texto }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error("sql_" + res.status + " " + body.slice(0, 180).replace(/\d{11,14}/g, "[num]"));
  return body ? JSON.parse(body) : [];
}

function documentos(payload) {
  const saida = [];
  function walk(node, caminho) {
    if (Array.isArray(node)) {
      node.forEach((item, indice) => walk(item, caminho + "[" + indice + "]"));
      return;
    }
    if (!node || typeof node !== "object") return;
    const bloco = classificarBlocoDocumento(node);
    if (bloco) {
      saida.push({
        tipo: caminho.toLowerCase().includes("resid") ? "residencia" : caminho.toLowerCase().includes("cnh") ? "cnh" : "anexo",
        status: bloco.status,
        bytes: bloco.bytes,
        mime: bloco.mime || "",
        sha256: bloco.sha256 || "",
      });
    }
    for (const chave of Object.keys(node)) {
      if (bloco && ["data", "imagem", "imagemRecortada", "arquivo", "pdf", "conteudo"].includes(chave)) continue;
      walk(node[chave], caminho ? caminho + "." + chave : chave);
    }
  }
  walk(payload, "payload");
  return saida;
}

const saude = await query("select 1 as ok");
if (Number(saude[0] && saude[0].ok) !== 1) throw new Error("health");
if (shaArquivo(GOLDEN) !== GOLDEN_SHA) throw new Error("golden_alterada");

const contagem = await query(
  "select " +
    "(select count(*)::int from public.dk_clientes where deleted_at is null) as clientes, " +
    "(select count(*)::int from public.dk_veiculos where deleted_at is null) as veiculos, " +
    "(select count(*)::int from public.dk_locacao where deleted_at is null) as locacoes, " +
    "(select count(*)::int from public.dk_pagamento_locacao where coalesce(removido, false) = false) as pagamentos_ativos, " +
    "(select count(*)::int from public.dk_pagamento_locacao where removido is true) as pagamentos_removidos, " +
    "(select count(*)::int from public.dk_pagamento_locacao_quarentena) as quarentena"
);
const atual = contagem[0];
if (
  atual.clientes !== 438 ||
  atual.veiculos !== 199 ||
  atual.locacoes !== 610 ||
  atual.pagamentos_ativos !== 1578 ||
  atual.pagamentos_removidos !== 274 ||
  atual.quarentena !== 0
) {
  throw new Error("contagem_inesperada");
}

const linhas = await query("select id::text as id, created_at from public.dk_clientes where deleted_at is null");
const alvo = linhas.filter((row) => refCliente(row.id) === ALVO);
if (alvo.length !== 1) throw new Error("alvo_ausente");
const idSql = String(alvo[0].id).replace(/'/g, "''");
const detalhe = await query(
  "select id::text as id, created_at, updated_at, payload from public.dk_clientes where id = '" + idSql + "'"
);
const row = detalhe[0];
const payload = row.payload;
const ida = fidelidade.dkClienteParaTerminal(fidelidade.dkClienteParaPersistencia(payload));
if (!fidelidade.dkClienteCompararRoundTrip(payload, ida).ok) throw new Error("roundtrip");
const docs = documentos(payload);
const corpo = {
  kind: "current",
  parent_baseline_id: PARENT,
  checkpoint_id: CHECKPOINT_ID,
  delta_id: DELTA_ID,
  delta: {
    delta_type: "business_change",
    module: "clientes",
    entity_ref: ALVO,
    change: "created",
    source_created_at: new Date(row.created_at).toISOString(),
    business_hash: hashValue(payload),
    raw_hash: hashValue({ id: String(row.id), created_at: row.created_at, updated_at: row.updated_at, payload }),
    document_manifest_hash: hashValue(docs),
  },
  counts: {
    clientes: 438,
    veiculos: 199,
    locacoes: 610,
    pagamentos_ativos: 1578,
    pagamentos_removidos: 274,
    quarentena: 0,
  },
};
const gzip = zlib.gzipSync(Buffer.from(JSON.stringify(corpo), "utf8"));
const manifesto = createHash("sha256").update(gzip).digest("hex");

await query(SQL, true);
const deltaSql =
  "insert into public.dk_integrity_deltas (id, parent_baseline_id, delta_type, module, entity_ref, change, source_created_at, business_hash, raw_hash, document_manifest_hash) values (" +
  "'" + DELTA_ID + "', '" + PARENT + "', 'business_change', 'clientes', '" + ALVO + "', 'created', '" +
  new Date(row.created_at).toISOString() + "', '" + corpo.delta.business_hash + "', '" + corpo.delta.raw_hash + "', '" +
  corpo.delta.document_manifest_hash + "') on conflict (id) do nothing";
await query(deltaSql, true);
const checkpointSql =
  "insert into public.dk_integrity_checkpoints (id, parent_baseline_id, delta_id, kind, manifest_sha256, clientes_count, veiculos_count, locacoes_count, pagamentos_ativos, pagamentos_removidos, quarentena, status) values (" +
  "'" + CHECKPOINT_ID + "', '" + PARENT + "', '" + DELTA_ID + "', 'current', '" + manifesto + "', 438, 199, 610, 1578, 274, 0, 'APPROVED') on conflict (id) do nothing";
await query(checkpointSql, true);
fs.writeFileSync(SAIDA, gzip);
fs.writeFileSync(SAIDA.replace(/\.json\.gz$/, ".sha256"), manifesto + "  dk-integrity-current-checkpoint-20261029.json.gz\n");

const evento = await query(
  "select * from public.dk_append_event(" +
    "'" + OPERATION_ID + "'::uuid, 'system.integrity_delta_registered', 'system', 'integrity-delta', 'registered', null, 'system', null, null, null, null, " +
    `'{"module":"clientes","change":"created","current_count":438}'::jsonb, 'admin')`,
  true
);
const lido = await query(
  "select d.entity_ref, d.change, d.module, c.id::text as checkpoint_id, c.clientes_count, c.manifest_sha256, c.status, e.audit_no, e.seq, e.event_type from public.dk_integrity_deltas d join public.dk_integrity_checkpoints c on c.delta_id = d.id left join public.dk_events e on e.operation_id = '" +
    OPERATION_ID + "' where d.id = '" + DELTA_ID + "'"
);
if (shaArquivo(GOLDEN) !== GOLDEN_SHA) throw new Error("golden_alterada_depois");
console.log(JSON.stringify({ ok: true, manifesto, evento: evento[0] || null, lido: lido[0] || null }));
