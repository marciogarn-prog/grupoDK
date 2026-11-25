/**
 * Garante que 522/timeout no Supabase não trava GET snapshot nem listagem de locação.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let falhas = 0;
function ok(nome, cond) {
  if (!cond) {
    falhas += 1;
    console.error("FALHA", nome);
    return;
  }
  console.log("ok", nome);
}

const snap = fs.readFileSync(path.join(root, "api", "dk-cloud-snapshot.js"), "utf8");
const loc = fs.readFileSync(path.join(root, "api", "dk-locacao.js"), "utf8");
const listaLeve = fs.readFileSync(path.join(root, "api", "dk-locacao-lista-leve.js"), "utf8");
const detalhe = fs.readFileSync(path.join(root, "api", "dk-locacao-detalhe.js"), "utf8");
const fb = fs.readFileSync(path.join(root, "lib", "dk-locacao-redis-fallback.cjs"), "utf8");
const manut = fs.readFileSync(path.join(root, "lib", "dk-manutencao-fonte.cjs"), "utf8");
const pers = fs.readFileSync(path.join(root, "lib", "dk-persistencia-central.cjs"), "utf8");
const pgLoc = fs.readFileSync(path.join(root, "lib", "dk-locacao-pg.cjs"), "utf8");
const atomic = fs.readFileSync(path.join(root, "lib", "dk-atomic-write.cjs"), "utf8");

ok("overlay não apaga manutenções do Redis", snap.includes("Mantém as manutenções do Redis") && !/out\.dk_manutencoes_cadastro = \[\];/.test(snap));
ok("overlay tem prazo curto", snap.includes("2500") && snap.includes("supabaseBreakerAberto"));
ok("manutenção REST tem timeout", manut.includes("AbortController") && manut.includes("supabase_timeout"));
ok("locação lista com fallback Redis", loc.includes("listarLocacoesComFallbackRedis") && loc.includes('source: "redis"'));
ok("locação grava no Redis se PG falhar", loc.includes("gravarNoRedis") && loc.includes("Gravação confirmada no Redis"));
ok("lista leve cai no Redis", listaLeve.includes("listarDoRedis") && listaLeve.includes("pgComunicacaoFalhou"));
ok("detalhe cai no Redis", detalhe.includes("detalheDoRedis"));
ok("helper Redis de locação existe", fb.includes("gravarNoRedis") && fb.includes("pgComunicacaoFalhou"));
ok("RPC atômico tem timeout", atomic.includes("AbortController") && atomic.includes("supabase_timeout"));
ok("leitura PG locação curta", /const LEITURA_MS = 3000/.test(pgLoc));
ok("persistência lê Redis primeiro", pers.includes("Redis primeiro"));

const { pgComunicacaoFalhou } = await import("../lib/dk-locacao-redis-fallback.cjs");
ok("522/504/gravacao disparam fallback", pgComunicacaoFalhou(522, "gravacao") && pgComunicacaoFalhou(504, "supabase_timeout") && pgComunicacaoFalhou(502, "gravacao"));
ok("409 não dispara fallback", !pgComunicacaoFalhou(409, "revisao_conflito"));

const lanc = fs.readFileSync(path.join(root, "api", "dk-lancamento-nuvem.js"), "utf8");
const merge = fs.readFileSync(path.join(root, "lib", "dk-append-only-merge.cjs"), "utf8");
const pagStore = fs.readFileSync(path.join(root, "lib", "dk-pagamento-locacao-store.cjs"), "utf8");
ok("pagamento PG falha → Redis confirma", lanc.includes("Pagamento confirmado no Redis") && lanc.includes("Sempre espelha no snapshot"));
ok("detalhe Redis hidrata fila", fb.includes("hidratarPagamentosDaFilaRedis"));
ok("merge não colapsa protocolo distinto", merge.includes("Protocolo único = lançamento único") && merge.includes("p:${proto}"));
ok("store de pagamento cai no Redis", pagStore.includes("lerDoRedisSnapshot"));

const { mergePortalLancamentosAluguelEmbutidos } = await import("../lib/dk-append-only-merge.cjs");
const unidos = mergePortalLancamentosAluguelEmbutidos([
  [{ data: "18/11/2026", valor: 350, protocoloLancamento: "20261123214550-030", createdAt: 1 }],
  [{ data: "18/11/2026", valor: 350, protocoloLancamento: "20261124100000-030", createdAt: 2 }],
]);
ok("dois pagamentos mesmo dia/valor com protocolos diferentes ficam os dois", unidos.length === 2);

assert.equal(falhas, 0);
console.log("test-redis-fallback-522 ok");
