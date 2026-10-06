/**
 * Confirmação fictícia do Financeiro CEO. Não grava despesa real e não lê o snapshot default.
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

const id = "55555555-5555-4555-8555-555555555555";
const operationId = "op-ficticio-confirmacao";
const despesa = { id, valor: 1, rubrica: "DK LOCADORA", descricao: "FICTICIO", deleted: false };

function memoria() {
  const linhasMap = new Map();
  const consultas = [];
  const io = {
    async ler(label) {
      consultas.push(String(label));
      if (String(label) === "default" || String(label).includes("eq.default")) throw new Error("consultou default");
      return { ok: true, payload: linhasMap.get(label) || null };
    },
    async gravar(label, payload) {
      if (String(label) === "default") throw new Error("gravou default");
      linhasMap.set(label, payload);
      return { ok: true };
    },
    async listar() {
      throw new Error("listou histórico");
    },
  };
  return { linhasMap, consultas, io };
}

const rapido = await linha.orquestrarGravacaoCeo({
  operationId,
  async post() {
    return { ok: true, r: { success: true } };
  },
  async confirmar() {
    throw new Error("não devia confirmar");
  },
});
rec("A POST rápido é sucesso", rapido.ok === true && rapido.posts === 1 && rapido.via === "post", "");

let emAndamento = 0;
let maxAndamento = 0;
let liberar;
const espera = new Promise((resolve) => {
  liberar = resolve;
});
const lentoP = linha.orquestrarGravacaoCeo({
  operationId,
  async post() {
    emAndamento += 1;
    maxAndamento = Math.max(maxAndamento, emAndamento);
    await espera;
    emAndamento -= 1;
    return { ok: true, r: { success: true } };
  },
  async confirmar() {
    throw new Error("não devia confirmar durante a espera");
  },
});
await new Promise((resolve) => setTimeout(resolve, 30));
rec("B POST lento não dispara outro POST", emAndamento === 1 && maxAndamento === 1, "");
liberar();
const lento = await lentoP;
rec("B a resposta tardia conclui em sucesso", lento.ok === true && lento.posts === 1 && lento.via === "post", "");

const ctxC = memoria();
const label = `entity:financeiro_ceo:despesa:${id}`;
let postsC = 0;
const perdido = await linha.orquestrarGravacaoCeo({
  operationId,
  async post() {
    postsC += 1;
    await linha.gravarLancamentosFinanceiroCeo({
      bundle: { dk_financeiro_ceo_despesas_v1: [despesa] },
      io: ctxC.io,
      agora: () => "2026-10-06T18:00:00.000Z",
      operationId,
    });
    return { ok: false, reason: "timeout" };
  },
  async confirmar() {
    return linha.lerConfirmacaoDespesaCeo(ctxC.io, id);
  },
});
rec(
  "C timeout com linha gravada vira sucesso",
  perdido.ok === true && perdido.via === "confirmacao" && postsC === 1 && ctxC.linhasMap.size === 1 && ctxC.linhasMap.get(label).operation_id === operationId,
  ""
);

const ctxD = memoria();
let postsD = 0;
const ausente = await linha.orquestrarGravacaoCeo({
  operationId: "op-ausente",
  async post() {
    postsD += 1;
    if (postsD === 1) return { ok: false, reason: "timeout" };
    const gravou = await linha.gravarLancamentosFinanceiroCeo({
      bundle: { dk_financeiro_ceo_despesas_v1: [{ ...despesa, id }] },
      io: ctxD.io,
      agora: () => "2026-10-06T18:01:00.000Z",
      operationId: "op-ausente",
    });
    return { ok: gravou.ok === true, r: { success: true, registros: gravou.registros } };
  },
  async confirmar() {
    return linha.lerConfirmacaoDespesaCeo(ctxD.io, id);
  },
});
rec("D timeout sem linha faz uma única nova tentativa", ausente.ok === true && postsD === 2 && ctxD.linhasMap.size === 1, "");

const ctxE = memoria();
let postsE = 0;
let consultasE = 0;
const duas = await linha.orquestrarGravacaoCeo({
  operationId,
  async post() {
    postsE += 1;
    await linha.gravarLancamentosFinanceiroCeo({
      bundle: { dk_financeiro_ceo_despesas_v1: [despesa] },
      io: ctxE.io,
      agora: () => "2026-10-06T18:02:00.000Z",
      operationId,
    });
    if (postsE === 1) return { ok: false, reason: "timeout" };
    return { ok: true, r: { success: true } };
  },
  async confirmar() {
    consultasE += 1;
    if (consultasE === 1) return { ok: true, found: false, operation_id: "" };
    return linha.lerConfirmacaoDespesaCeo(ctxE.io, id);
  },
});
rec("E duas tentativas não criam duas despesas", duas.ok === true && postsE === 2 && ctxE.linhasMap.size === 1, "");

const deNovo = await linha.gravarLancamentosFinanceiroCeo({
  bundle: { dk_financeiro_ceo_despesas_v1: [despesa] },
  io: ctxE.io,
  agora: () => "2026-10-06T18:03:00.000Z",
  operationId,
});
rec(
  "F mesmo operationId continua idempotente",
  deNovo.ok === true && ctxE.linhasMap.size === 1 && ctxE.linhasMap.get(label).revision === 1,
  ""
);

let confirmouG = false;
const falha = await linha.orquestrarGravacaoCeo({
  operationId,
  async post() {
    return { ok: false, reason: "supabase_indisponivel" };
  },
  async confirmar() {
    confirmouG = true;
    return { found: false };
  },
});
rec("G Supabase falha e a linha não existe devolve erro", falha.ok === false && falha.posts === 1 && confirmouG === false, "");

const chamadas = [];
process.env.SUPABASE_SERVICE_ROLE_KEY = "ficticio-nao-e-segredo-real";
const ioHttp = linha.criarIoSupabaseLinhas(async (url) => {
  const endereco = String(url);
  chamadas.push(endereco);
  if (endereco.includes("eq.default") || endereco.includes("label=default")) throw new Error("pediu default");
  return {
    ok: true,
    async json() {
      return [{ label: `entity:financeiro_ceo:despesa:${id}`, payload: { id, revision: 1, updated_at: "2026-10-06T18:00:00.000Z", operation_id: operationId } }];
    },
    async text() {
      return "";
    },
  };
});
const confHttp = await linha.lerConfirmacaoDespesaCeo(ioHttp, id);
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
rec(
  "confirmação lê só a linha pequena",
  confHttp.found === true &&
    confHttp.operation_id === operationId &&
    chamadas.length === 1 &&
    chamadas[0].includes("entity%3Afinanceiro_ceo%3Adespesa%3A") &&
    chamadas.every((url) => !url.includes("eq.default")),
  ""
);

const ceoJs = fs.readFileSync(path.join(ROOT, "portal-financeiro-ceo.js"), "utf8");
const apiJs = fs.readFileSync(path.join(ROOT, "api/cadastro-financeiro-ceo.js"), "utf8");
rec(
  "cliente não declara timeout aos 10s nem sobrepõe POST",
  !ceoJs.includes('reason: "timeout" }), 10000') &&
    !ceoJs.includes("Promise.race") &&
    ceoJs.includes("45000") &&
    ceoJs.includes("/api/cadastro-financeiro-ceo?id=") &&
    ceoJs.includes("finCeoPostAtivo") &&
    apiJs.includes("lerConfirmacaoDespesaCeo") &&
    !apiJs.includes("ioSnapshotOficial"),
  ""
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- ${results.length - failed}/${results.length} testes confirmacao financeiro ceo ---`);
process.exit(failed ? 1 : 0);
