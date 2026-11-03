/**
 * Classifica e registra 5 clientes pós-checkpoint 438.
 * Não altera cadastro. Não reescreve a Golden Baseline.
 */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const fidelidade = require(path.join(aqui, "../lib/dk-cliente-fidelidade.cjs"));
const { hashValue } = await import(pathToFileURL(path.join(aqui, "../lib/dk-integrity-canonical.mjs")).href);

const PARENT = "bcafcc5a-e214-4777-8aec-25d41fb31699";
const OLD_CHECKPOINT = "c4ec4c01-2026-4029-8aec-000000000438";
const CHECKPOINT_ID = "c4ec4c01-2026-4029-8aec-000000000443";
const OPERATION_ID = "de17a001-2026-1103-8aec-000000000443";
const GOLDEN_SHA = "9ad7a1c8fe664dfe274cb93bdf79f248c18c166d34b66787266a4be10dc06d56";
const GOLDEN = "C:\\Users\\marci\\OneDrive\\Área de Trabalho\\dk-integrity-golden-baseline-20261029.json.gz";
const SAIDA = "C:\\Users\\marci\\OneDrive\\Área de Trabalho\\dk-integrity-current-checkpoint-20261103.json.gz";
const SCHEMA = fs.readFileSync(path.join(aqui, "../supabase/dk-integrity-checkpoint-supersede.sql"), "utf8");

const DELTAS = [
  {
    id: "d437a001-2026-1103-8aec-000000000437",
    entity_ref: "df9ad9720f83",
    codigo: "0437",
  },
  {
    id: "d440a001-2026-1103-8aec-000000000440",
    entity_ref: "1c8181eaae5f",
    codigo: "0440",
  },
  {
    id: "d441a001-2026-1103-8aec-000000000441",
    entity_ref: "502d3488876e",
    codigo: "0441",
  },
  {
    id: "d442a001-2026-1103-8aec-000000000442",
    entity_ref: "2c389ab6c322",
    codigo: "0442",
  },
  {
    id: "d443a001-2026-1103-8aec-000000000443",
    entity_ref: "91e37b4ff74a",
    codigo: "0443",
  },
];

function shaArquivo(arquivo) {
  return createHash("sha256").update(fs.readFileSync(arquivo)).digest("hex");
}

function entityRef(id) {
  return createHash("sha256").update("cliente\n" + String(id), "utf8").digest("hex").slice(0, 12);
}

function sql(query, escrita = false) {
  const arquivo = path.join(os.tmpdir(), "dk-recon-" + randomUUID() + ".sql");
  fs.writeFileSync(arquivo, query.endsWith(";") ? query : query + ";", "utf8");
  const args = ["--yes", "supabase", "db", "query", "--linked", "-f", arquivo, "-o", "json"];
  if (escrita) args.push("--yes");
  else args.splice(5, 0, "--read-only");
  try {
    const bruto = execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
      cwd: path.join(aqui, ".."),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: { ...process.env, SUPABASE_YES: escrita ? "1" : process.env.SUPABASE_YES },
    });
    const inicio = bruto.indexOf("{");
    if (inicio < 0) return [];
    const corpo = JSON.parse(bruto.slice(inicio));
    return Array.isArray(corpo.rows) ? corpo.rows : [];
  } finally {
    try {
      fs.unlinkSync(arquivo);
    } catch {
      /* ignore */
    }
  }
}

const saude = sql("select 1 as ok");
if (Number(saude[0] && saude[0].ok) !== 1) throw new Error("health");
if (shaArquivo(GOLDEN) !== GOLDEN_SHA) throw new Error("golden_alterada");

const contagem = sql(
  "select " +
    "(select count(*)::int from public.dk_clientes where deleted_at is null) as clientes, " +
    "(select count(*)::int from public.dk_veiculos where deleted_at is null) as veiculos, " +
    "(select count(*)::int from public.dk_locacao where deleted_at is null) as locacoes, " +
    "(select count(*)::int from public.dk_pagamento_locacao where coalesce(removido, false) = false) as pagamentos_ativos, " +
    "(select count(*)::int from public.dk_pagamento_locacao where removido is true) as pagamentos_removidos"
);
const atual = contagem[0];
if (
  Number(atual.clientes) !== 443 ||
  Number(atual.veiculos) !== 199 ||
  Number(atual.locacoes) !== 610 ||
  Number(atual.pagamentos_ativos) !== 1578 ||
  Number(atual.pagamentos_removidos) !== 274
) {
  throw new Error("contagem_inesperada");
}

const linhas = sql(
  "with ordenados as (" +
    "select id::text as id, created_at, updated_at, payload, " +
    "row_number() over (order by created_at nulls last, id) as ordem " +
    "from public.dk_clientes where deleted_at is null" +
    ") select id, created_at, updated_at, payload, ordem from ordenados where ordem between 439 and 443 order by ordem"
);
if (linhas.length !== 5) throw new Error("cinco_ausentes");

const preparados = [];
for (const row of linhas) {
  const ref = entityRef(row.id);
  const meta = DELTAS.find((item) => item.entity_ref === ref);
  if (!meta) throw new Error("ref_inesperada_" + ref);
  const payload = row.payload;
  if (String(payload.codigo || "") !== meta.codigo) throw new Error("codigo_divergente_" + meta.codigo);
  const ida = fidelidade.dkClienteParaTerminal(fidelidade.dkClienteParaPersistencia(payload));
  if (!fidelidade.dkClienteCompararRoundTrip(payload, ida).ok) throw new Error("roundtrip_" + meta.codigo);
  if (String(payload.ambiente || "") !== "real") throw new Error("ambiente_" + meta.codigo);
  if (String(payload.origemPortal || "") !== "true") throw new Error("origem_" + meta.codigo);
  preparados.push({
    ...meta,
    source_created_at: new Date(row.created_at).toISOString(),
    business_hash: hashValue(payload),
    raw_hash: hashValue({ id: String(row.id), created_at: row.created_at, updated_at: row.updated_at, payload }),
    document_manifest_hash: hashValue([]),
  });
}

const corpo = {
  kind: "current",
  parent_baseline_id: PARENT,
  parent_checkpoint_id: OLD_CHECKPOINT,
  checkpoint_id: CHECKPOINT_ID,
  classification: "legitimate_business_change",
  deltas: preparados.map((item) => ({
    delta_id: item.id,
    delta_type: "business_change",
    module: "clientes",
    entity_ref: item.entity_ref,
    change: "created",
    source_created_at: item.source_created_at,
    business_hash: item.business_hash,
    raw_hash: item.raw_hash,
    document_manifest_hash: item.document_manifest_hash,
  })),
  counts: {
    clientes: 443,
    veiculos: 199,
    locacoes: 610,
    pagamentos_ativos: 1578,
    pagamentos_removidos: 274,
    quarentena: 0,
  },
};
const gzip = zlib.gzipSync(Buffer.from(JSON.stringify(corpo), "utf8"));
const manifesto = createHash("sha256").update(gzip).digest("hex");

sql(SCHEMA, true);

const inserts = [];
for (const item of preparados) {
  inserts.push(
    "insert into public.dk_integrity_deltas (id, parent_baseline_id, delta_type, module, entity_ref, change, source_created_at, business_hash, raw_hash, document_manifest_hash) values (" +
      "'" +
      item.id +
      "', '" +
      PARENT +
      "', 'business_change', 'clientes', '" +
      item.entity_ref +
      "', 'created', '" +
      item.source_created_at +
      "', '" +
      item.business_hash +
      "', '" +
      item.raw_hash +
      "', '" +
      item.document_manifest_hash +
      "') on conflict (id) do nothing;"
  );
}
inserts.push(
  "update public.dk_integrity_checkpoints set kind = 'superseded' where id = '" + OLD_CHECKPOINT + "' and kind = 'current';"
);
inserts.push(
  "insert into public.dk_integrity_checkpoints (id, parent_baseline_id, delta_id, kind, manifest_sha256, clientes_count, veiculos_count, locacoes_count, pagamentos_ativos, pagamentos_removidos, quarentena, status) values (" +
    "'" +
    CHECKPOINT_ID +
    "', '" +
    PARENT +
    "', '" +
    preparados[preparados.length - 1].id +
    "', 'current', '" +
    manifesto +
    "', 443, 199, 610, 1578, 274, 0, 'APPROVED') on conflict (id) do nothing;"
);
sql(inserts.join("\n"), true);

fs.writeFileSync(SAIDA, gzip);
fs.writeFileSync(SAIDA.replace(/\.json\.gz$/, ".sha256"), manifesto + "  dk-integrity-current-checkpoint-20261103.json.gz\n");

const evento = sql(
  "select * from public.dk_append_event(" +
    "'" +
    OPERATION_ID +
    "'::uuid, 'system.integrity_delta_batch_registered', 'system', 'integrity-delta-batch', 'registered', null, 'system', null, null, null, null, " +
    `'{"module":"clientes","changes":5,"change_type":"created","current_count":443}'::jsonb, 'admin')`,
  true
);

const lido = sql(
  "select " +
    "(select count(*)::int from public.dk_integrity_deltas where id in (" +
    preparados.map((item) => "'" + item.id + "'").join(",") +
    ")) as deltas, " +
    "(select kind from public.dk_integrity_checkpoints where id = '" +
    OLD_CHECKPOINT +
    "') as old_kind, " +
    "(select json_build_object('id', id::text, 'clientes', clientes_count, 'status', status, 'kind', kind, 'manifest', manifest_sha256) from public.dk_integrity_checkpoints where id = '" +
    CHECKPOINT_ID +
    "') as novo, " +
    "(select json_build_object('audit_no', audit_no, 'seq', seq, 'event_type', event_type) from public.dk_events where operation_id = '" +
    OPERATION_ID +
    "') as evento, " +
    "(select count(*)::int from public.dk_clientes where deleted_at is null) as clientes"
);

if (shaArquivo(GOLDEN) !== GOLDEN_SHA) throw new Error("golden_alterada_depois");
if (Number(lido[0] && lido[0].clientes) !== 443) throw new Error("clientes_alterados");

console.log(
  JSON.stringify({
    ok: true,
    manifesto,
    deltas: preparados.map((item) => item.id),
    checkpoint: CHECKPOINT_ID,
    lido: lido[0] || null,
    evento_rpc: evento[0] || null,
  })
);
