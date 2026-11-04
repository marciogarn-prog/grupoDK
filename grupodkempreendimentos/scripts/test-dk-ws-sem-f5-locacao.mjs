import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sync = fs.readFileSync(path.join(root, "portal-dk-sync.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const cloud = fs.readFileSync(path.join(root, "portal-supabase-sync.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(sync.includes("Só bloqueia com sujo explícito"), "focus_nao_bloqueia");
assert(sync.includes("__DK_locacaoAplicarEventoRemoto"), "hook_remoto");
assert(sync.includes('dk:log:recarregar'), "log_no_catchup");
assert(ui.includes("__DK_locacaoAplicarEventoRemoto"), "ui_export");
assert(ui.includes("window.__DK_locacaoFormularioSujo = true"), "marca_sujo");
assert(
  cloud.includes("não regravar em silêncio") || cloud.includes("não regravar em silêncio".normalize("NFC")),
  "sem_regravacao_silenciosa"
);
assert(!/await window\.__DK_locacaoSalvarConfirmada\(loc/.test(cloud), "sync_nao_posta_locacao");

console.log(JSON.stringify({ ok: true, foco: "ws_atualiza_sem_f5_e_sem_log_triplo" }));
