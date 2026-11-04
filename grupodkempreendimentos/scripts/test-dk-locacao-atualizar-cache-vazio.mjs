import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ui = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(ui.includes("persistPortalOperacaoLocacaoInlineSubmitAsync"), "async_submit");
assert(ui.includes("A confirmar o cliente na nuvem"), "hidrata_cliente");
assert(ui.includes("atualizandoExistente"), "flag_update");
assert(ui.includes("permitirNomeNoRegistro"), "integridade_update");
assert(app.includes("permitirNomeNoRegistro"), "app_permitir_nome");
assert(ui.includes("prevPeek"), "prev_peek");

console.log(JSON.stringify({ ok: true, foco: "atualizar_locacao_com_cache_local_vazio" }));
