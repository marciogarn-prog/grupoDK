import { createRequire } from "module";

const require = createRequire(import.meta.url);
const selo = require("../../api/dk-pre-migracao-selo.js");

const SEGREDO = "segredo-ficticio";
const CHAVE_OFICIAL = "dk:portal:cloud_snapshot:v1";
const AGORA = new Date("2026-10-06T15:00:00.000Z");
const MARCA_REDIS = "ALFA-DIVERGENTE";
const MARCA_SUPABASE = "BETA-DIVERGENTE";
const MARCA_DOC = "PDF-OFICIAL-FICTICIO";
const MARCA_DEMO = "PDF-DEMO-FICTICIO";
const MARCA_PARALELA = "PARALELA-FICTICIA";

function falha(msg) {
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) falha(msg);
}

function memoria(opts) {
  const redis = new Map();
  const sb = new Map();
  const writes = [];
  return {
    redis,
    sb,
    writes,
    async redisGet(chave) {
      return redis.has(chave) ? redis.get(chave) : null;
    },
    async redisSet(chave, valor) {
      writes.push("redis:" + chave);
      redis.set(chave, valor);
    },
    async sbGet(label) {
      return sb.has(label) ? sb.get(label) : null;
    },
    async sbInsert(row) {
      if (opts && opts.falhaLabel && String(row.label).startsWith(opts.falhaLabel)) falha("falha_ficticia");
      writes.push("sb:" + row.label);
      sb.set(row.label, row);
    },
  };
}

function fontes() {
  const redisPayload = { dk_clientes_cadastro: [{ id: "f1", nome: MARCA_REDIS, updatedAt: "2026-01-01T00:00:00.000Z" }] };
  const sbPayload = { dk_clientes_cadastro: [{ id: "f1", nome: MARCA_SUPABASE, updatedAt: "2026-01-02T00:00:00.000Z" }] };
  return {
    redisPayload,
    sbPayload,
    pacote: {
      redis: { payload: redisPayload, updated_at: "2026-10-06T12:31:27.472Z", revisao: "2026-10-06T12:31:27.472Z" },
      supabase: { id: "id-ficticio", payload: sbPayload, updated_at: "2026-10-06T12:30:42.918Z" },
      docblobs: [
        { label: "docblob:default:doc_ficticio", payload: { corpo: MARCA_DOC }, updated_at: "2026-09-01T00:00:00.000Z" },
        { label: "docblob:demo:doc_ficticio", payload: { corpo: MARCA_DEMO }, updated_at: "2026-06-01T00:00:00.000Z" },
      ],
      paralelas: {
        "dk:portal:manutencoes_rapidas:v1": { presente: true, tipo: "string", valor: MARCA_PARALELA },
        "dk:portal:cloud_snapshot:demo:v1": { presente: true, tipo: "string", valor: "DEMO-NAO-COPIAR" },
        "dk:portal:rate_limit:v1": { presente: true, tipo: "string", valor: "RATE-NAO-COPIAR" },
      },
    },
  };
}

function semear(io, base) {
  io.redis.set(CHAVE_OFICIAL, JSON.stringify({
    label: "default",
    payload: base.redisPayload,
    updated_at: base.pacote.redis.updated_at,
  }));
  io.sb.set("default", {
    id: base.pacote.supabase.id,
    label: "default",
    payload: base.sbPayload,
    updated_at: base.pacote.supabase.updated_at,
  });
  io.sb.set("docblob:demo:doc_ficticio", base.pacote.docblobs[1]);
}

function chavesExpostas(valor, caminho) {
  if (!valor || typeof valor !== "object") return;
  for (const chave of Object.keys(valor)) {
    const nome = chave.toLowerCase();
    if (["payload", "senha", "senhahash", "cpf", "token", "arquivobase64", "base64"].includes(nome)) {
      falha("resposta expoe " + caminho + chave);
    }
    chavesExpostas(valor[chave], caminho + chave + ".");
  }
}

function textoLimpo(valor) {
  const texto = JSON.stringify(valor);
  for (const marca of [MARCA_REDIS, MARCA_SUPABASE, MARCA_DOC, MARCA_DEMO, MARCA_PARALELA, "DEMO-NAO-COPIAR", "RATE-NAO-COPIAR"]) {
    if (texto.includes(marca)) falha("resposta contem dado " + marca);
  }
}

const headersBase = {
  "x-dk-pre-migracao": SEGREDO,
  "x-dk-pre-migracao-modo": "gravar-duplo",
  "x-dk-pre-migracao-confirma": "BACKUP_DIVERGENTE",
};

assert(selo.podeGravarDuplo(headersBase, SEGREDO) === true, "duplo autorizado");
assert(selo.decidirEscrita(headersBase, SEGREDO, false) === "gravar-duplo", "divergentes aceitos");
assert(
  selo.decidirEscrita({ "x-dk-pre-migracao": SEGREDO, "x-dk-pre-migracao-modo": "gravar-duplo" }, SEGREDO, false) === "recusado",
  "sem confirmacao"
);
assert(selo.podeGravarDuplo({ ...headersBase, "x-dk-pre-migracao": "" }, SEGREDO) === false, "sem segredo");
assert(selo.podeGravarDuplo({ ...headersBase, "x-dk-pre-migracao": "outro" }, SEGREDO) === false, "segredo errado");
assert(selo.decidirEscrita({ "x-dk-pre-migracao-modo": "comparar", "x-dk-pre-migracao": SEGREDO }, SEGREDO, false) === "leitura", "comparar");
assert(selo.decidirEscrita({ "x-dk-pre-migracao": SEGREDO }, SEGREDO, true) === "leitura", "modo ausente");
assert(selo.chaveParalelaPermitida("dk:portal:manutencoes_rapidas:v1") === true, "paralela central");
assert(selo.chaveParalelaPermitida("dk:portal:cloud_snapshot:demo:v1") === false, "demo fora");
assert(selo.chaveParalelaPermitida("dk:portal:rate_limit:v1") === false, "rate fora");

const dest = selo.destinosBackupDuplo("20261006T150000Z", [{ label: "docblob:default:doc_ficticio" }, { label: "docblob:demo:doc_x" }]);
assert(dest.redisChaveRedis === "dk:portal:backup_pre_migracao:redis:20261006T150000Z", "chave redis");
assert(dest.redisChaveSupabase === "dk:portal:backup_pre_migracao:supabase:20261006T150000Z", "chave supabase no redis");
assert(dest.labelRedis === "backup-pre-migracao-redis-20261006T150000Z", "label redis");
assert(dest.labelSupabase === "backup-pre-migracao-supabase-20261006T150000Z", "label supabase");
assert(dest.labelsDocblob.length === 1, "um docblob oficial");
assert(dest.labelsDocblob[0] === "backup-pre-migracao-docblob-default-20261006T150000Z", "label docblob");
for (const nome of [dest.redisChaveRedis, dest.redisChaveSupabase]) {
  assert(nome !== CHAVE_OFICIAL, "chave oficial nao e destino");
}
for (const nome of [dest.labelRedis, dest.labelSupabase].concat(dest.labelsDocblob)) {
  assert(nome !== "default" && nome !== "demo" && !nome.startsWith("docblob:"), "label oficial nao e destino");
}

const base = fontes();
const io = memoria();
semear(io, base);
const antesRedis = io.redis.get(CHAVE_OFICIAL);
const antesDefault = JSON.stringify(io.sb.get("default"));
const antesDemo = JSON.stringify(io.sb.get("docblob:demo:doc_ficticio"));
const resultado = await selo.executarBackupDuplo(io, base.pacote, AGORA);
chavesExpostas(resultado, "");
textoLimpo(resultado);
assert(resultado.ok === true, "backup ok");
assert(resultado.backup_criado === true, "criado");
assert(resultado.BACKUP_PARCIAL === false, "nao parcial");
assert(resultado.identicos === false, "fontes diferentes");
assert(resultado.origem_inalterada.redis === true && resultado.origem_inalterada.supabase === true, "origens intactas");
assert(resultado.quantidades.docblobs_oficiais === 1, "docblob oficial");
assert(resultado.quantidades.docblobs_demo_ignorados === 1, "demo ignorado");
assert(resultado.quantidades.paralelas === 1, "so paralela permitida");
const porFonte = {};
for (const copia of resultado.copias) {
  assert(copia.verificacao === "integro", "integro " + copia.nome);
  porFonte[copia.fonte] = porFonte[copia.fonte] || copia.sha256;
  assert(copia.sha256 === porFonte[copia.fonte], "hash estavel " + copia.fonte);
}
assert(porFonte.redis !== porFonte.supabase, "hashes proprios");
assert(io.redis.get(CHAVE_OFICIAL) === antesRedis, "redis oficial intocado");
assert(JSON.stringify(io.sb.get("default")) === antesDefault, "default intocado");
assert(JSON.stringify(io.sb.get("docblob:demo:doc_ficticio")) === antesDemo, "demo intocado");
const guardadoRedis = JSON.parse(io.redis.get(dest.redisChaveRedis));
const guardadoSupabase = JSON.parse(io.redis.get(dest.redisChaveSupabase));
assert(guardadoRedis.payload.dk_clientes_cadastro[0].nome === MARCA_REDIS, "copia redis");
assert(guardadoSupabase.payload.dk_clientes_cadastro[0].nome === MARCA_SUPABASE, "copia supabase");
assert(guardadoRedis.chaves_paralelas["dk:portal:manutencoes_rapidas:v1"].valor === MARCA_PARALELA, "paralela no pacote");
assert(!guardadoRedis.chaves_paralelas["dk:portal:cloud_snapshot:demo:v1"], "demo nao entrou");
assert(!io.sb.has("docblob:demo:doc_ficticio:backup"), "demo sem copia");
assert(io.sb.has(dest.labelsDocblob[0]), "docblob backup");
assert(!io.sb.has("default") || io.sb.get("default").label === "default", "default segue default");
const writesComparar = [];
assert(selo.decidirEscrita({ "x-dk-pre-migracao-modo": "comparar" }, SEGREDO, false) === "leitura", "comparar sem escrita");
assert(writesComparar.length === 0, "comparar nao grava");

const ioParcial = memoria({ falhaLabel: "backup-pre-migracao-supabase" });
semear(ioParcial, base);
const parcial = await selo.executarBackupDuplo(ioParcial, base.pacote, AGORA);
textoLimpo(parcial);
assert(parcial.BACKUP_PARCIAL === true, "parcial");
assert(parcial.backup_criado === false, "parcial nao concluido");
assert(parcial.criados.includes(dest.redisChaveRedis), "redis da fonte redis ficou");
assert(parcial.criados.includes(dest.redisChaveSupabase), "redis da fonte supabase ficou");
assert(parcial.nao_criados.some((item) => item.nome === dest.labelSupabase), "label supabase nao criada");
assert(ioParcial.redis.has(dest.redisChaveRedis), "nao apagou copia redis");
assert(ioParcial.redis.get(CHAVE_OFICIAL) === antesRedis, "parcial nao mexe no oficial");

const ioCheio = memoria();
semear(ioCheio, base);
ioCheio.redis.set(dest.redisChaveRedis, "{\"ocupado\":true}");
const writesAntes = ioCheio.writes.length;
const recusado = await selo.executarBackupDuplo(ioCheio, base.pacote, AGORA);
assert(recusado.ok === false && recusado.BACKUP_PARCIAL === false, "destino existente recusado");
assert(recusado.reason === "destino_ja_existe", "motivo existencia");
assert(ioCheio.writes.length === writesAntes, "existencia nao grava");
assert(ioCheio.redis.get(CHAVE_OFICIAL) === antesRedis, "existencia nao mexe no oficial");

console.log("test-dk-backup-duplo-ficticio ok");
