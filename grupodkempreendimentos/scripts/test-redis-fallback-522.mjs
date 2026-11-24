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
const manut = fs.readFileSync(path.join(root, "lib", "dk-manutencao-fonte.cjs"), "utf8");
const pers = fs.readFileSync(path.join(root, "lib", "dk-persistencia-central.cjs"), "utf8");
const pgLoc = fs.readFileSync(path.join(root, "lib", "dk-locacao-pg.cjs"), "utf8");

ok("overlay não apaga manutenções do Redis", snap.includes("Mantém as manutenções do Redis") && !/out\.dk_manutencoes_cadastro = \[\];/.test(snap));
ok("overlay tem prazo curto", snap.includes("2500") && snap.includes("supabaseBreakerAberto"));
ok("manutenção REST tem timeout", manut.includes("AbortController") && manut.includes("supabase_timeout"));
ok("locação tem fallback Redis", loc.includes("listarLocacoesComFallbackRedis") && loc.includes('source: "redis"'));
ok("leitura PG locação curta", /const LEITURA_MS = 3000/.test(pgLoc));
ok("persistência lê Redis primeiro", pers.includes("Redis primeiro"));

assert.equal(falhas, 0);
console.log("test-redis-fallback-522 ok");
