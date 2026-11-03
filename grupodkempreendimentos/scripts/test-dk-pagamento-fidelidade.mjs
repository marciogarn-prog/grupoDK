/**
 * Contrato de fidelidade dos pagamentos.
 * Fixtures fictícias. Prova ao vivo só lê.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const f = require("../lib/dk-pagamento-fidelidade.cjs");
const { sourcePositionConfere } = await import("../lib/dk-integrity-canonical.mjs");
const aqui = path.dirname(fileURLToPath(import.meta.url));

const oficial = {
  id: "11111111-1111-4111-8111-111111111111",
  migration_key: "e2e:fixture-1",
  protocolo_lancamento: "e2e-proto-1",
  numero_contrato: "2099010101",
  tipo: "PAGAMENTO",
  data_pagamento: "2099-01-02",
  valor: 1.03,
  payload: {
    tipo: "PAGAMENTO",
    valor: 1.03,
    data: "02/01/2099",
    campo_futuro: { ok: true },
    lista: ["a", "b"],
    nulo: null,
    vazio: "",
  },
  version: 3,
  removido: false,
  deleted_at: null,
  source_state: "online",
  source_position: 1,
  source_payload_hash: "abc",
  operation_id: "22222222-2222-4222-8222-222222222222",
};

const persistido = f.dkPagamentoParaPersistencia(oficial);
const terminal = f.dkPagamentoParaTerminal(persistido);
assert.equal(f.dkPagamentoCompararRoundTrip(oficial, terminal).ok, true);
assert.equal(terminal.payload.campo_futuro.ok, true);
assert.equal(terminal.payload.nulo, null);
assert.equal(terminal.payload.vazio, "");
assert.deepEqual(terminal.payload.lista, ["a", "b"]);

const patch = f.dkPagamentoAplicarPatch(oficial, { payload: { observacao: "x" } });
assert.equal(patch.numero_contrato, "2099010101");
assert.equal(patch.valor, 1.03);
assert.equal(patch.data_pagamento, "2099-01-02");
assert.equal(patch.tipo, "PAGAMENTO");
assert.equal(patch.source_position, 1);
assert.equal(patch.removido, false);
assert.equal(patch.payload.observacao, "x");
assert.equal(patch.payload.campo_futuro.ok, true);

assert.equal(f.dkPagamentoConflitoVersao(3, 4).status, 409);
assert.equal(f.dkPagamentoConflitoVersao(3, 3).ok, true);
assert.equal(f.sourcePositionConfere(1, 0), true);
assert.equal(f.sourcePositionConfere(2, 0), false);
assert.equal(sourcePositionConfere(5, 4), true);

assert.equal(f.vinculoContrato(oficial, { numeroContrato: "2099010101" }).ok, true);
assert.equal(f.vinculoContrato(oficial, { numeroContrato: "2099010102" }).ok, false);

assert.equal(f.normalizarOperacao("criar"), "create");
assert.equal(f.normalizarOperacao("atualizar"), "update");
assert.equal(f.normalizarOperacao("remover"), "remove");
assert.equal(f.exigirOperationId({ operacao: "criar" }).ok, false);
assert.equal(f.exigirOperationId({ operacao: "criar", operation_id: oficial.operation_id }).ok, true);
assert.equal(
  f.idempotenciaPorOperationId([oficial], oficial.operation_id).idempotent,
  true
);
assert.equal(f.idempotenciaPorOperationId([], oficial.operation_id).idempotent, false);

const atomOk = f.fixtureAtomica(
  () => ({ id: "p1", operation_id: oficial.operation_id }),
  (pag) => ({ event_type: "payment.created", entity_id: pag.id, operation_id: pag.operation_id }),
  false
);
assert.equal(atomOk.ok, true);
const atomFail = f.fixtureAtomica(
  () => ({ id: "p1" }),
  () => ({ event_type: "payment.created" }),
  true
);
assert.equal(atomFail.ok, false);
assert.equal(atomFail.pagamento, null);

assert.equal(f.LEGACY_FALLBACKS.every((item) => item.classe === "LEGACY_FALLBACK"), true);
assert.equal(fs.readFileSync(new URL("../lib/dk-pagamento-locacao-store.cjs", import.meta.url), "utf8").includes("write_not_active"), true);
assert.equal(fs.readFileSync(new URL("../portal-pagamento-store.js", import.meta.url), "utf8").includes('MODO_PRODUCAO = "legacy"'), true);
assert.equal(String(process.env.DK_PAGAMENTO_FRACTIONATED_WRITE_CANARY || "").trim(), "");

console.log("ok dk-pagamento-fidelidade fixtures");

function sql(query) {
  const arquivo = path.join(os.tmpdir(), "dk-pag-fid-" + randomUUID() + ".sql");
  fs.writeFileSync(arquivo, query.endsWith(";") ? query : query + ";", "utf8");
  try {
    const bruto = execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["--yes", "supabase", "db", "query", "--linked", "--read-only", "-f", arquivo, "-o", "json"],
      {
        cwd: path.join(aqui, ".."),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      }
    );
    const inicio = bruto.indexOf("{");
    return JSON.parse(bruto.slice(inicio)).rows || [];
  } finally {
    try {
      fs.unlinkSync(arquivo);
    } catch {
      /* ignore */
    }
  }
}

const meta = sql(`
select json_build_object(
  'total', (select count(*)::int from public.dk_pagamento_locacao),
  'ativos', (select count(*)::int from public.dk_pagamento_locacao where removido = false),
  'removidos', (select count(*)::int from public.dk_pagamento_locacao where removido = true),
  'orfaos', (
    select count(*)::int from public.dk_pagamento_locacao p
    where not exists (
      select 1 from public.dk_locacao l
      where l.deleted_at is null and l.numero_contrato = p.numero_contrato
    )
  ),
  'canario_ativos', (select count(*)::int from public.dk_pagamento_locacao where numero_contrato = '2025092903' and removido = false),
  'canario_removidos', (select count(*)::int from public.dk_pagamento_locacao where numero_contrato = '2025092903' and removido = true),
  'pos_ok', (
    select count(*)::int from (
      select numero_contrato, source_position,
        row_number() over (partition by numero_contrato, removido order by source_position, id) as idx
      from public.dk_pagamento_locacao
    ) t
    where source_position = idx
  ),
  'hash', encode(sha256(convert_to((
    select string_agg(id::text || ':' || coalesce(source_position::text,'') || ':' || coalesce(removido::text,'') || ':' || encode(sha256(convert_to(coalesce(payload::text,'{}'), 'UTF8')), 'hex'), E'\\n' order by id::text)
    from public.dk_pagamento_locacao
  ), 'UTF8')), 'hex')
) as out;
`);

const out = meta[0].out;
assert.equal(Number(out.total), 1852);
assert.equal(Number(out.ativos), 1578);
assert.equal(Number(out.removidos), 274);
assert.equal(Number(out.orfaos), 0);
assert.equal(Number(out.canario_ativos), 52);
assert.equal(Number(out.canario_removidos), 8);
assert.equal(Number(out.pos_ok), 1852);

let ok = 0;
let fail = 0;
for (let offset = 0; offset < 2000; offset += 100) {
  const lote = sql(
    "select id, migration_key, protocolo_lancamento, numero_contrato, tipo, data_pagamento, valor, payload, version, removido, deleted_at, source_state, source_position, source_payload_hash from public.dk_pagamento_locacao order by id limit 100 offset " +
      offset
  );
  if (!lote.length) break;
  for (const row of lote) {
    const ida = f.dkPagamentoParaTerminal(f.dkPagamentoParaPersistencia(row));
    if (f.dkPagamentoCompararRoundTrip(row, ida).ok) ok += 1;
    else fail += 1;
  }
  if (lote.length < 100) break;
}
assert.equal(ok, 1852);
assert.equal(fail, 0);

const hashDepois = String(
  sql(`
select encode(sha256(convert_to((
  select string_agg(id::text || ':' || coalesce(source_position::text,'') || ':' || coalesce(removido::text,'') || ':' || encode(sha256(convert_to(coalesce(payload::text,'{}'), 'UTF8')), 'hex'), E'\\n' order by id::text)
  from public.dk_pagamento_locacao
), 'UTF8')), 'hex') as hash;
`)[0].hash || ""
);
assert.equal(String(out.hash), hashDepois);

const somas = sql(`
with por as (
  select numero_contrato,
    count(*) filter (where removido = false)::int as qtd_ativos,
    coalesce(sum(valor) filter (where removido = false), 0) as soma_ativos,
    count(*) filter (where removido = true)::int as qtd_removidos,
    coalesce(sum(valor) filter (where removido = true), 0) as soma_removidos
  from public.dk_pagamento_locacao
  group by numero_contrato
),
locs as (
  select numero_contrato from public.dk_locacao where deleted_at is null
)
select json_build_object(
  'contratos', (select count(*)::int from locs),
  'com_pagamento', (select count(*)::int from por),
  'soma_ativos_cents', (select coalesce(sum(round(soma_ativos * 100)),0)::bigint from por),
  'soma_removidos_cents', (select coalesce(sum(round(soma_removidos * 100)),0)::bigint from por)
) as out;
`);
assert.equal(Number(somas[0].out.contratos), 610);

fs.writeFileSync(
  path.join(os.tmpdir(), "dk-e2e", "fase4-pag-hash.json"),
  JSON.stringify({
    ok,
    fail,
    hash: out.hash,
    orfaos: out.orfaos,
    pos_ok: out.pos_ok,
    somas: somas[0].out,
  })
);
console.log(
  "ok dk-pagamento-fidelidade live",
  JSON.stringify({ ok, fail, orfaos: out.orfaos, pos_ok: out.pos_ok, hash: String(out.hash).slice(0, 12) })
);
