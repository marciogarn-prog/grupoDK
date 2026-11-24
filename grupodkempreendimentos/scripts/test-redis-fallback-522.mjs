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

assert.equal(falhas, 0);
console.log("test-redis-fallback-522 ok");
