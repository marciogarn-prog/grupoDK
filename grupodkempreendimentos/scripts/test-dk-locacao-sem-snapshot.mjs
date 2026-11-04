import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ui = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const pg = fs.readFileSync(path.join(root, "portal-locacao-pg.js"), "utf8");
const sync = fs.readFileSync(path.join(root, "portal-supabase-sync.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(!ui.includes("LOCAÇÃO NÃO É GRAVADA NO SNAPSHOT"), "sem_msg_snapshot_ui");
assert(ui.includes("módulo oficial (/api/dk-locacao) ainda não carregou"), "msg_fallback_ok");
assert(ui.includes('push.source === "postgres"'), "push_ok_postgres");
assert(pg.includes("Fonte oficial é Postgres desde o cutover"), "pg_flag_early");
assert(!sync.includes("body: JSON.stringify({ locacao: loc"), "sync_sem_snapshot_locacao");
assert(sync.includes("__DK_locacaoSalvarConfirmada"), "sync_usa_api");

console.log(JSON.stringify({ ok: true, foco: "locacao_via_api_dk_locacao" }));
