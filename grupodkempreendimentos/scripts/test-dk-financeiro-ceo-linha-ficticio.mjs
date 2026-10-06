/**
 * Lançamentos fictícios do FINANCEIRO CEO. Não grava despesa real e não abre o snapshot default.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const linha = require(path.join(ROOT, "lib/dk-financeiro-ceo-linha.cjs"));

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function memoria(opts) {
  const linhas = new Map();
  const consultas = [];
  const io = {
    async ler(label) {
      consultas.push({ op: "ler", label: String(label) });
      if (String(label) === "default" || String(label).includes("eq.default")) throw new Error("consultou default");
      return { ok: true, payload: linhas.get(label) || null };
    },
    async gravar(label, payload) {
      const texto = JSON.stringify(payload);
      consultas.push({ op: "gravar", label: String(label), bytes: Buffer.byteLength(texto) });
      if (String(label) === "default" || texto.includes("eq.default")) throw new Error("gravou default");
      linhas.set(label, payload);
      return { ok: true };
    },
    async listar() {
      consultas.push({ op: "listar" });
      return {
        ok: true,
        rows: [...linhas.entries()].map(([label, payload]) => ({ label, payload, updated_at: payload.updated_at })),
      };
    },
    async cache() {
      if (opts && opts.cacheFalha) throw new Error("redis_indisponivel");
    },
  };
  return { linhas, consultas, io };
}

const despesa = {
  id: "11111111-1111-4111-8111-111111111111",
  categoria: "DK LOCADORA",
  rubrica: "DK LOCADORA",
  descricao: "LANCAMENTO FICTICIO",
  valor: 10,
  deleted: false,
};

const ctx = memoria();
const criada = await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [despesa] },
  io: ctx.io,
  agora: () => "2026-10-06T12:00:00.000Z",
  operationId: "op-ficticio-1",
});
const leuDefault = ctx.consultas.some((c) => c.label === "default" || String(c.label || "").includes("eq.default"));
rec("A criação não consulta label=default", criada.ok === true && !leuDefault && ctx.consultas.every((c) => c.op === "listar" || String(c.label || "").startsWith("entity:financeiro_ceo:")), "");

const gravacoes = ctx.consultas.filter((c) => c.op === "gravar");
const payload = ctx.linhas.get("entity:financeiro_ceo:despesa:11111111-1111-4111-8111-111111111111");
rec(
  "B criação grava uma única linha pequena",
  gravacoes.length === 1 &&
    ctx.linhas.size === 1 &&
    gravacoes[0].bytes < 4000 &&
    payload &&
    payload.revision === 1 &&
    payload.deleted === false &&
    payload.rubrica === "DK LOCADORA" &&
    payload.valor === 10,
  ""
);

const ctxRedis = memoria({ cacheFalha: true });
const comRedisOff = await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [{ ...despesa, id: "22222222-2222-4222-8222-222222222222" }] },
  io: ctxRedis.io,
  agora: () => "2026-10-06T12:00:00.000Z",
  operationId: "op-ficticio-redis",
});
rec("C Supabase ok e Redis falha continua sucesso", comRedisOff.ok === true && comRedisOff.status === 200 && ctxRedis.linhas.size === 1, "");

const ctxErro = memoria();
ctxErro.io.gravar = async () => ({ ok: false, reason: "supabase_http_500" });
const falhou = await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [{ ...despesa, id: "33333333-3333-4333-8333-333333333333" }] },
  io: ctxErro.io,
  agora: () => "2026-10-06T12:00:00.000Z",
  operationId: "op-ficticio-erro",
});
rec("D Supabase falha devolve erro", falhou.ok === false && falhou.status === 503, "");

const relido = await linha.lerLinhasFinanceiroCeo(ctx.io);
const outraVez = await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [despesa] },
  io: ctx.io,
  agora: () => "2026-10-06T12:01:00.000Z",
  operationId: "op-ficticio-1",
});
rec(
  "E reload consulta as linhas individuais",
  relido.ok === true &&
    relido.linhas.dk_financeiro_ceo_despesas_v1.length === 1 &&
    relido.linhas.dk_financeiro_ceo_despesas_v1[0].id === despesa.id &&
    outraVez.ok === true &&
    ctx.consultas.some((c) => c.op === "listar"),
  ""
);

const conflito = await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [{ ...despesa, revision: 0, descricao: "ATRASADA" }] },
  io: ctx.io,
  agora: () => "2026-10-06T12:02:00.000Z",
  operationId: "op-ficticio-conflito",
});
rec("F revisão antiga devolve 409", conflito.ok === false && conflito.status === 409 && conflito.reason === "revisao_conflito", "");

const ceoJs = fs.readFileSync(path.join(ROOT, "portal-financeiro-ceo.js"), "utf8");
const apiJs = fs.readFileSync(path.join(ROOT, "api/cadastro-financeiro-ceo.js"), "utf8");
const segredoNoBrowser =
  ceoJs.includes("SUPABASE_SERVICE_ROLE_KEY") || ceoJs.includes("service_role") || ceoJs.includes("sb_secret");
const resposta = JSON.stringify(criada);
rec(
  "G segredo Supabase não vai ao navegador",
  !segredoNoBrowser && !resposta.includes("SUPABASE_SERVICE_ROLE_KEY") && !apiJs.includes("res.json(process.env"),
  ""
);

const chamadasHttp = [];
process.env.SUPABASE_SERVICE_ROLE_KEY = "ficticio-nao-e-segredo-real";
const ioHttp = linha.criarIoSupabaseLinhas(async (url, init) => {
  const endereco = String(url);
  chamadasHttp.push(endereco);
  if (endereco.includes("eq.default") || endereco.includes("label=default")) {
    throw new Error("pediu o snapshot default");
  }
  const corpo = init && init.body ? JSON.parse(init.body) : null;
  if (corpo && corpo.label === "default") throw new Error("gravou default");
  if (init && init.method === "POST") {
    return { ok: true, async text() { return ""; } };
  }
  return { ok: true, async json() { return []; }, async text() { return ""; } };
});
await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [{ ...despesa, id: "44444444-4444-4444-8444-444444444444" }] },
  io: ioHttp,
  agora: () => "2026-10-06T12:03:00.000Z",
  operationId: "op-ficticio-http",
});
await linha.lerLinhasFinanceiroCeo(ioHttp);
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiNaoLeDefault = !apiJs.includes("ioSnapshotOficial") && !apiJs.includes("eq.default") && !apiJs.includes('label === "default"');
rec(
  "H nenhum teste carrega o snapshot default",
  apiNaoLeDefault && chamadasHttp.length > 0 && chamadasHttp.every((url) => !url.includes("eq.default") && !url.includes("label=default")),
  ""
);

const atualizada = await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [{ ...payload, descricao: "SEGUNDA VERSAO" }] },
  io: ctx.io,
  agora: () => "2026-10-06T12:04:00.000Z",
  operationId: "op-ficticio-edicao",
});
const apagada = await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [{ ...ctx.linhas.get(gravacoes[0].label), deleted: true }] },
  io: ctx.io,
  agora: () => "2026-10-06T12:05:00.000Z",
  operationId: "op-ficticio-exclusao",
});
const final = ctx.linhas.get(gravacoes[0].label);
const unido = linha.unirHistoricoComLinhas(
  { dk_financeiro_ceo_despesas_v1: [{ ...despesa, descricao: "HISTORICO" }] },
  { dk_financeiro_ceo_despesas_v1: [payload] }
);
rec(
  "edição soma revisão, exclusão é lógica e o mesmo id não duplica",
  atualizada.ok === true &&
    atualizada.registros[0].revision === 2 &&
    apagada.ok === true &&
    final.deleted === true &&
    Boolean(final.deleted_at) &&
    unido.dk_financeiro_ceo_despesas_v1.length === 1 &&
    ceoJs.includes("if (d.deleted) return") &&
    ceoJs.includes("ESPELHO SUPABASE INDISPONÍVEL"),
  ""
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- ${results.length - failed}/${results.length} testes financeiro ceo linha ---`);
process.exit(failed ? 1 : 0);
