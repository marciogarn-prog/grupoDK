/**
 * Contrato de fidelidade das locações.
 * Fixtures fictícias. Prova ao vivo só lê.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const f = require("../lib/dk-locacao-fidelidade.cjs");
const log = require("../lib/dk-log-apresentacao.cjs");
const aqui = path.dirname(fileURLToPath(import.meta.url));

const oficial = {
  id: "loc-teste-1",
  numeroContrato: "2099010101",
  protocolo: "2099010101",
  nome: "CLIENTE FIXTURE",
  codigoCliente: "9999",
  cpf: "90000000999",
  placa: "TST1A11",
  modelo: "HONDA / CG 160",
  marcaModelo: "HONDA / CG 160",
  marca: "HONDA",
  dataInicio: "01/01/2099",
  horaInicio: "08:00",
  dataExecucao: "01/01/2099",
  dataFim: "",
  horaFim: "",
  dataFinalizacao: null,
  diaPagamento: "segunda-feira",
  kmInicial: 10,
  kmFinal: null,
  tempoContrato: "150 semanas",
  tempoDias: 1050,
  valorAluguel: "R$ 250,00",
  valorLocacao: "R$ 250,00",
  valorInvestimento: "R$ 100,00",
  valorSemanal: "R$ 350,00",
  valorParcela: "R$ 350,00",
  valorPlano: "R$ 350,00",
  plano: "DK MINHA MOTO",
  tipoPlano: "DK MINHA MOTO",
  modalidade: "MOTO",
  centroCusto: "LOCADORA",
  status: "ATIVO",
  statusLocacao: "ATIVO",
  observacoes: "observação fictícia",
  documentos: [{ tipo: "cnh", ref: "doc-1" }],
  checklists: [{ item: "retrovisor", ok: true }],
  vistorias: [{ data: "01/01/2099", fotos: ["a", "b"] }],
  nested: { a: { b: [1, null, ""] } },
  campo_futuro_teste: { vivo: true },
  valorOpcionalAusenteNaoZero: undefined,
};

assert.equal(Object.keys(oficial).filter((k) => oficial[k] !== undefined).length >= 30, true);
const persistido = f.dkLocacaoParaPersistencia(oficial);
const terminal = f.dkLocacaoParaTerminal(persistido);
assert.equal(f.dkLocacaoCompararRoundTrip(oficial, terminal).ok, true);
assert.equal(terminal.modelo, "HONDA / CG 160");
assert.equal(terminal.valorInvestimento, "R$ 100,00");
assert.equal(terminal.dataFinalizacao, null);
assert.equal(Object.prototype.hasOwnProperty.call(terminal, "dataFim"), true);
assert.equal(terminal.dataFim, "");
assert.deepEqual(terminal.vistorias[0].fotos, ["a", "b"]);
assert.equal(terminal.campo_futuro_teste.vivo, true);

const incompleto = { numeroContrato: "2099010101", cpf: "90000000999", placa: "TST1A11", status: "ATIVO" };
assert.equal(f.dkLocacaoSubstituir(oficial, incompleto).ok, false);

const patch = f.dkLocacaoAplicarPatch(oficial, { observacoes: "nova" });
assert.equal(patch.observacoes, "nova");
assert.equal(patch.valorAluguel, "R$ 250,00");
assert.equal(patch.valorInvestimento, "R$ 100,00");
assert.equal(patch.campo_futuro_teste.vivo, true);
assert.equal(Object.prototype.hasOwnProperty.call(f.dkLocacaoAplicarPatch({ numeroContrato: "1" }, { status: "ATIVO" }), "valorAluguel"), false);

assert.equal(f.dkLocacaoAusenciaNaoEZero(undefined).zero, false);
assert.equal(f.dkLocacaoAusenciaNaoEZero(null).zero, false);
assert.equal(f.dkLocacaoAusenciaNaoEZero("").zero, false);
assert.equal(f.dkLocacaoAusenciaNaoEZero(0).zero, true);

assert.equal(f.dkLocacaoAliasPresente({ marcaModelo: "X" }, "modelo"), true);
assert.equal(f.dkLocacaoConflitoVersao(5, 6).status, 409);
assert.equal(f.dkLocacaoConflitoVersao(5, 5).ok, true);
assert.equal(f.dkLocacaoSubstituir(oficial, f.dkLocacaoResumo(oficial)).ok, false);
assert.equal(f.LEGACY_FALLBACKS.every((item) => item.classe === "LEGACY_FALLBACK"), true);

const apiDetalhe = fs.readFileSync(new URL("../api/dk-locacao-detalhe.js", import.meta.url), "utf8");
const apiLista = fs.readFileSync(new URL("../api/dk-locacao-lista-leve.js", import.meta.url), "utf8");
const pgSrc = fs.readFileSync(new URL("../lib/dk-locacao-pg.cjs", import.meta.url), "utf8");
assert.match(apiDetalhe, /lerDetalhe/);
assert.match(apiLista, /listarResumo/);
assert.match(pgSrc, /RESUMO_COLUNAS|dk_locacao_resumo/);
assert.match(pgSrc, /snapshot/);
const ui = fs.readFileSync(new URL("../portal-locadora-ui.js", import.meta.url), "utf8");
assert.match(ui, /Relatório de locações cadastradas/);
assert.match(ui, /btn-operacao-relatorio-rotatividade/);
assert.match(ui, /btn-operacao-relatorio-inatividade/);
assert.match(ui, /portal-rotatividade/);
assert.match(ui, /portalFmtBrlRotatividade/);

const evento = log.sanitizarEvento({
  event_type: "system.rental_payment_fidelity_contract_verified",
  action: "verified",
  payload: { locacoes: 610, pagamentos_ativos: 1578, pagamentos_removidos: 274, orfaos: 0 },
});
assert.equal(evento.summary, "Contrato de fidelidade de locações e pagamentos verificado");

console.log("ok dk-locacao-fidelidade fixtures");

function sql(query) {
  const arquivo = path.join(os.tmpdir(), "dk-loc-fid-" + randomUUID() + ".sql");
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

const resumo = sql(`
with base as (
  select id::text as id, numero_contrato, campos, version
  from public.dk_locacao
  where deleted_at is null
),
rt as (
  select
    count(*)::int as total,
    count(*) filter (
      where campos is not null
        and jsonb_typeof(campos) = 'object'
        and campos ? 'numeroContrato' or campos ? 'protocolo' or true
    )::int as com_campos
  from base
),
canario as (
  select campos
  from public.dk_locacao
  where deleted_at is null and numero_contrato = '2025092903'
  limit 1
)
select json_build_object(
  'total', (select total from rt),
  'com_campos', (select count(*)::int from base where campos is not null and jsonb_typeof(campos) = 'object'),
  'canario', (
    select json_build_object(
      'existe', canario.campos is not null,
      'placa', canario.campos->>'placa',
      'modelo', coalesce(canario.campos->>'marcaModelo', canario.campos->>'modelo'),
      'inicio', coalesce(canario.campos->>'dataInicio', canario.campos->>'inicio'),
      'dia', coalesce(canario.campos->>'diaPagamento', canario.campos->>'diaPagto'),
      'km', coalesce(canario.campos->>'kmInicial', canario.campos->>'odometroInicio'),
      'aluguel', coalesce(canario.campos->>'valorAluguel', canario.campos->>'valorLocacao'),
      'investimento', canario.campos->>'valorInvestimento',
      'semanal', coalesce(canario.campos->>'valorSemanal', canario.campos->>'valorParcela'),
      'plano', coalesce(canario.campos->>'plano', canario.campos->>'tipoPlano'),
      'modalidade', canario.campos->>'modalidade',
      'prazo', coalesce(canario.campos->>'tempoContrato', canario.campos->>'prazo'),
      'status', coalesce(canario.campos->>'statusLocacao', canario.campos->>'status'),
      'codigo', coalesce(canario.campos->>'codigoCliente', canario.campos->>'clienteCodigo'),
      'nome_ok', upper(coalesce(canario.campos->>'nome','')) like 'AILTON%'
    )
    from canario
  ),
  'hash', encode(sha256(convert_to((
    select string_agg(numero_contrato || ':' || encode(sha256(convert_to(campos::text, 'UTF8')), 'hex'), E'\\n' order by numero_contrato)
    from base
  ), 'UTF8')), 'hex')
) as out;
`);

const out = resumo[0] && resumo[0].out;
assert.equal(Number(out.total), 610);
assert.equal(Number(out.com_campos), 610);
assert.equal(out.canario.existe, true);
assert.equal(String(out.canario.placa || "").toUpperCase(), "SPA5A67");
assert.match(String(out.canario.modelo || ""), /CG 160/i);
assert.match(String(out.canario.inicio || ""), /29\/09\/2025|2025-09-29/);
assert.match(String(out.canario.aluguel || ""), /250/);
assert.match(String(out.canario.investimento || ""), /100/);
assert.match(String(out.canario.semanal || ""), /350/);
assert.match(String(out.canario.plano || ""), /MINHA MOTO/i);
assert.match(String(out.canario.status || ""), /ATIVO/i);
assert.equal(out.canario.nome_ok, true);

let ok = 0;
let fail = 0;
for (let offset = 0; offset < 700; offset += 50) {
  const lote = sql(
    "select numero_contrato, campos from public.dk_locacao where deleted_at is null order by numero_contrato limit 50 offset " +
      offset
  );
  if (!lote.length) break;
  for (const row of lote) {
    const terminalLive = f.dkLocacaoParaTerminal(row);
    const ida = f.dkLocacaoParaTerminal(f.dkLocacaoParaPersistencia(terminalLive));
    if (f.dkLocacaoCompararRoundTrip(terminalLive, ida).ok) ok += 1;
    else fail += 1;
  }
  if (lote.length < 50) break;
}
assert.equal(ok, 610);
assert.equal(fail, 0);

const hashAntes = String(out.hash || "");
const hashDepois = String(
  sql(`
select encode(sha256(convert_to((
  select string_agg(numero_contrato || ':' || encode(sha256(convert_to(campos::text, 'UTF8')), 'hex'), E'\\n' order by numero_contrato)
  from public.dk_locacao where deleted_at is null
), 'UTF8')), 'hex') as hash;
`)[0].hash || ""
);
assert.equal(hashAntes, hashDepois);
assert.ok(hashAntes.length === 64);

fs.writeFileSync(
  path.join(os.tmpdir(), "dk-e2e", "fase4-loc-hash.json"),
  JSON.stringify({ total: ok, fail, hash: hashAntes, canario: { placa: out.canario.placa, status: out.canario.status } })
);
console.log("ok dk-locacao-fidelidade live", JSON.stringify({ ok, fail, hash: hashAntes.slice(0, 12) }));
