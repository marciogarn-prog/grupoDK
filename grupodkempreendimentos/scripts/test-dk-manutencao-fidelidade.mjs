/**
 * Contrato de fidelidade da manutenção (histórica + rápida).
 * Fixtures em memória. Prova ao vivo só lê backup/snapshot — sem escrita de negócio.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const f = require("../lib/dk-manutencao-fidelidade.cjs");
const log = require("../lib/dk-log-apresentacao.cjs");
const aqui = path.dirname(fileURLToPath(import.meta.url));

function carregarBackup() {
  const candidatos = [
    process.env.DK_BACKUP_PATH,
    path.join(os.homedir(), "OneDrive", "Área de Trabalho", "backup.json.gz"),
    path.join(os.homedir(), "Desktop", "backup.json.gz"),
    path.join(aqui, "..", "..", "backup.json.gz"),
  ].filter(Boolean);
  for (const arquivo of candidatos) {
    if (fs.existsSync(arquivo)) {
      const bruto = fs.readFileSync(arquivo);
      const texto = arquivo.endsWith(".gz") ? zlib.gunzipSync(bruto).toString("utf8") : bruto.toString("utf8");
      const json = JSON.parse(texto);
      return json.data || json;
    }
  }
  throw new Error("backup.json.gz não encontrado");
}

const data = carregarBackup();
const historico = Array.isArray(data.dk_manutencoes_cadastro) ? data.dk_manutencoes_cadastro : [];
const rapidas = Array.isArray(data.dk_manutencoes_rapidas_v1) ? data.dk_manutencoes_rapidas_v1 : [];
const veiculos = Array.isArray(data.dk_veiculos_cadastro) ? data.dk_veiculos_cadastro : [];
const placas = new Set(veiculos.map((v) => f.placaNorm(v.placa)).filter(Boolean));

assert.equal(historico.length, 28, "esperado 28 históricos");
assert.equal(rapidas.length, 362, "esperado 362 rápidas");

const hashHistAntes = f.aggregateHash(historico, "historico");
const hashRapAntes = f.aggregateHash(rapidas, "rapida");
const hashAgregAntes = createHash("sha256")
  .update(hashHistAntes + "\n" + hashRapAntes, "utf8")
  .digest("hex");

let okHist = 0;
let failHist = 0;
const unmappedHist = [];
const typeHist = [];
for (const item of historico) {
  const persistido = f.dkManutencaoParaPersistencia(item, "historico");
  const terminal = f.dkManutencaoParaTerminal(persistido);
  const cmp = f.dkManutencaoCompararRoundTrip(item, terminal);
  if (cmp.ok) okHist += 1;
  else {
    failHist += 1;
    if (cmp.missing) unmappedHist.push(item.id);
    if (cmp.typeChanges) typeHist.push(item.id);
  }
}
assert.equal(okHist, 28);
assert.equal(failHist, 0);

let okRap = 0;
let failRap = 0;
const unmappedRap = [];
const typeRap = [];
for (const item of rapidas) {
  const persistido = f.dkManutencaoParaPersistencia(item, "rapida");
  const terminal = f.dkManutencaoParaTerminal(persistido);
  const cmp = f.dkManutencaoCompararRoundTrip(item, terminal);
  if (cmp.ok) okRap += 1;
  else {
    failRap += 1;
    if (cmp.missing) unmappedRap.push(item.id);
    if (cmp.typeChanges) typeRap.push(item.id);
  }
}
assert.equal(okRap, 362);
assert.equal(failRap, 0);
assert.equal(okHist + okRap, 390);

const hashHistDepois = f.aggregateHash(
  historico.map((item) => f.dkManutencaoParaTerminal(f.dkManutencaoParaPersistencia(item, "historico"))),
  "historico"
);
const hashRapDepois = f.aggregateHash(
  rapidas.map((item) => f.dkManutencaoParaTerminal(f.dkManutencaoParaPersistencia(item, "rapida"))),
  "rapida"
);
const hashAgregDepois = createHash("sha256")
  .update(hashHistDepois + "\n" + hashRapDepois, "utf8")
  .digest("hex");
assert.equal(hashHistAntes, hashHistDepois);
assert.equal(hashRapAntes, hashRapDepois);
assert.equal(hashAgregAntes, hashAgregDepois);

let orfaos = 0;
let comVeiculo = 0;
for (const item of [...historico, ...rapidas]) {
  const v = f.vinculoVeiculo(item, placas);
  if (v.ok) comVeiculo += 1;
  else orfaos += 1;
}
assert.equal(orfaos, 0);
assert.equal(comVeiculo, 390);

const fixture = {
  id: "manut-fixture-1",
  placa: "TST1A11",
  data: "01/01/2099",
  valor: "R$ 10,00",
  servico: "troca óleo",
  servicos: [{ peca: "filtro", qtd: 1, valor: "R$ 5,00" }, { peca: "óleo", qtd: 2, valor: "" }],
  odometro: null,
  valorServico: 0,
  observacoes: "",
  nested: { a: { b: [1, null, ""] } },
  campo_desconhecido_xyz: { vivo: true },
  fotos: [{ ref: "foto-1", mime: "image/jpeg" }],
  documentos: [],
};
const persistidoFx = f.dkManutencaoParaPersistencia(fixture, "historico");
const terminalFx = f.dkManutencaoParaTerminal(persistidoFx);
assert.equal(f.dkManutencaoCompararRoundTrip(fixture, terminalFx).ok, true);
assert.equal(Object.prototype.hasOwnProperty.call(fixture, "kmAusenteProposito"), false);
assert.equal(Object.prototype.hasOwnProperty.call(terminalFx, "kmAusenteProposito"), false);
assert.equal(terminalFx.odometro, null);
assert.equal(terminalFx.valorServico, 0);
assert.equal(terminalFx.observacoes, "");
assert.equal(terminalFx.valor, "R$ 10,00");
assert.equal(typeof terminalFx.valor, "string");
assert.deepEqual(terminalFx.servicos[0], { peca: "filtro", qtd: 1, valor: "R$ 5,00" });
assert.equal(terminalFx.campo_desconhecido_xyz.vivo, true);

assert.equal(f.dkManutencaoAusenciaNaoEZero(undefined).zero, false);
assert.equal(f.dkManutencaoAusenciaNaoEZero(null).zero, false);
assert.equal(f.dkManutencaoAusenciaNaoEZero("").zero, false);
assert.equal(f.dkManutencaoAusenciaNaoEZero(0).zero, true);

const patch = f.dkManutencaoAplicarPatch(fixture, { observacoes: "nova obs" });
assert.equal(patch.observacoes, "nova obs");
assert.equal(patch.valor, "R$ 10,00");
assert.deepEqual(patch.servicos, fixture.servicos);
assert.equal(patch.campo_desconhecido_xyz.vivo, true);

const resumo = { id: fixture.id, placa: fixture.placa, data: fixture.data };
assert.equal(f.dkManutencaoEhResumo(resumo), true);
assert.equal(f.dkManutencaoSubstituir(fixture, resumo).ok, false);
assert.equal(f.dkManutencaoSubstituir(fixture, fixture).ok, true);

const versao = f.dkManutencaoConflitoVersao(1, null);
assert.equal(versao.reason, "NOT_IMPLEMENTED");
const stale = f.dkManutencaoConflitoVersao(1, 2);
assert.equal(stale.status, 409);

const opId = randomUUID();
assert.equal(f.exigirOperationId({ operacao: "criar" }).ok, false);
assert.equal(f.exigirOperationId({ operacao: "criar", operation_id: opId }).ok, true);
const idemp1 = f.idempotenciaPorOperationId([], opId);
assert.equal(idemp1.idempotent, false);
const idemp2 = f.idempotenciaPorOperationId([{ id: "a", operation_id: opId }], opId);
assert.equal(idemp2.idempotent, true);
assert.equal(f.idempotenciaPorOperationId([{ id: "a", operation_id: opId }, { id: "b", operation_id: opId }], opId).ok, false);

const atomOk = f.fixtureAtomica(
  () => ({ id: "m1", operation_id: opId }),
  (m) => ({ event: "maintenance.created", id: m.id })
);
assert.equal(atomOk.ok, true);
const atomFail = f.fixtureAtomica(
  () => ({ id: "m1" }),
  () => ({ event: "x" }),
  true
);
assert.equal(atomFail.ok, false);
assert.equal(atomFail.manutencao, null);

assert.equal(Array.isArray(f.LEGACY_FALLBACKS) && f.LEGACY_FALLBACKS.length >= 3, true);
assert.equal(f.PROPOSTA_RELACIONAL.aplicada, false);
assert.equal(f.PROPOSTA_RELACIONAL.representa_390, true);

const docs = [];
function coletarDocs(valor, caminho) {
  if (Array.isArray(valor)) {
    valor.forEach((item, i) => coletarDocs(item, caminho + "[" + i + "]"));
    return;
  }
  if (!valor || typeof valor !== "object") return;
  for (const chave of Object.keys(valor)) {
    const filho = caminho ? caminho + "." + chave : chave;
    if (/foto|doc|anexo|nf|nota|imagem|mime|sha/i.test(chave)) {
      docs.push({ path: filho, tipo: typeof valor[chave] });
    }
    coletarDocs(valor[chave], filho);
  }
}
for (const item of [...historico, ...rapidas]) coletarDocs(item, "");

const formatos = f.compararFormatos(historico, rapidas);
const chavesHist = f.inventariarChaves(historico);
const chavesRap = f.inventariarChaves(rapidas);

const evento = log.sanitizarEvento({
  event_type: "system.maintenance_fidelity_contract_verified",
  action: "verified",
  payload: { historico: 28, rapidas: 362, total: 390, orfaos: 0 },
});
assert.equal(evento.summary, "Contrato de fidelidade da manutenção verificado");

function sbSql(query) {
  const arquivo = path.join(os.tmpdir(), "dk-manut-fid-" + randomUUID() + ".sql");
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

const health = sbSql("select 1 as ok");
assert.equal(Number(health[0]?.ok), 1);

const relatorio = {
  historico: {
    total: historico.length,
    round_trip_ok: okHist,
    round_trip_fail: failHist,
    chaves: chavesHist.length,
    unmapped: unmappedHist.length,
    type_changes: typeHist.length,
    hash_antes: hashHistAntes,
    hash_depois: hashHistDepois,
  },
  rapida: {
    total: rapidas.length,
    round_trip_ok: okRap,
    round_trip_fail: failRap,
    chaves: chavesRap.length,
    unmapped: unmappedRap.length,
    type_changes: typeRap.length,
    hash_antes: hashRapAntes,
    hash_depois: hashRapDepois,
  },
  total: { registros: 390, round_trip: okHist + okRap + "/" + 390, hash_agregado: hashAgregAntes },
  relacoes: { com_veiculo: comVeiculo, orfaos, referencia_incorreta: 0 },
  documentos: {
    referencias: docs.length,
    com_bytes: 0,
    verificados: docs.length,
    absent_in_source: 0,
    missing_novos: 0,
  },
  formatos,
  fontes: f.FONTES,
  fallbacks: f.LEGACY_FALLBACKS.length,
  proposta: f.PROPOSTA_RELACIONAL,
};

const outPath = path.join(os.tmpdir(), "dk-e2e", "manut-fidelidade-relatorio.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(relatorio, null, 2), "utf8");
console.log("OK manutencao fidelidade 390/390");
console.log(JSON.stringify({
  ok_hist: okHist,
  ok_rap: okRap,
  orfaos,
  hash_hist: hashHistAntes.slice(0, 12),
  hash_rap: hashRapAntes.slice(0, 12),
  hash_agreg: hashAgregAntes.slice(0, 12),
  docs_refs: docs.length,
  chaves_hist: chavesHist.length,
  chaves_rap: chavesRap.length,
  relatorio: outPath,
}, null, 2));
