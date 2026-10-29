import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = require("../lib/dk-log-apresentacao.cjs");
const sql = fs.readFileSync(path.resolve(raiz, "../supabase/migrations/20261029143000_dk_log_fundacao.sql"), "utf8").toLowerCase();
const append = fs.readFileSync(path.join(raiz, "supabase", "dk-append-event.sql"), "utf8").toLowerCase();

assert.strictEqual(app.mascararTexto("cpf 12345678901 ok"), "cpf •••.•••.•••-•• ok");
const evento = app.sanitizarEvento({
  seq: 12,
  audit_no: 2,
  event_type: "system.realtime_initialized",
  action: "initialized",
  module: "system",
  actor_name_snapshot: "Sistema",
  device_label: "servidor",
  result: "success",
  details: { summary: "Realtime inicializado", cpf: "12345678901" },
  payload: { message: "nao deve ir", foto: "abc" },
});
assert.strictEqual(evento.audit_no, 2);
assert.strictEqual(evento.seq, 12);
assert.strictEqual(evento.summary, "Realtime inicializado");
assert.strictEqual(evento.details.cpf, undefined);
assert.strictEqual(evento.payload, undefined);

const agora = new Date("2026-10-29T15:00:00Z");
assert.strictEqual(app.statusPresenca({ status: "ONLINE", last_activity_at: "2026-10-29T14:50:00Z" }, agora), "ONLINE");
assert.strictEqual(app.statusPresenca({ status: "ONLINE", last_activity_at: "2026-10-29T14:00:00Z" }, agora), "EXPIRADO");
assert.strictEqual(app.statusPresenca({ status: "OFFLINE", last_activity_at: "2026-10-29T14:50:00Z" }, agora), "OFFLINE");
const ordem = app.ordenarSessoes(
  [
    { user_name: "João", role: "op", device_label: "PC-3", session_started_at: "2026-10-29T11:30:00Z", last_activity_at: "2026-10-29T14:50:00Z", status: "ONLINE", current_screen: "Log DK" },
    { user_name: "Márcio", role: "owner", device_label: "PC-1", session_started_at: "2026-10-29T11:00:00Z", last_activity_at: "2026-10-29T14:40:00Z", status: "ONLINE", current_screen: "Log DK" },
    { user_name: "Ana", role: "op", device_label: "PC-2", session_started_at: "2026-10-29T12:00:00Z", last_activity_at: "2026-10-29T13:00:00Z", status: "ONLINE", current_screen: "Log DK" },
  ],
  agora
);
assert.deepStrictEqual(ordem.map((item) => item.usuario), ["Márcio", "João"]);
assert.deepStrictEqual(ordem.map((item) => item.prioridade), [1, 2]);
assert.strictEqual(app.doisPrimeirosNomes("MARCOS RAFAEL DA SILVA SANTOS"), "MARCOS RAFAEL");
assert.strictEqual(app.perfilHumano("owner", ""), "Administrador");
assert.strictEqual(app.perfilHumano("owner", "03037897430"), "Administrador CEO");
assert.strictEqual(app.rotuloMaquina("Win32"), "Windows");
const longo = app.ordenarSessoes(
  [
    {
      user_name: "MARCOS RAFAEL DA SILVA SANTOS",
      role: "owner",
      user_id: "111",
      device_label: "Win32",
      session_started_at: "2026-10-29T14:39:00Z",
      last_activity_at: "2026-10-29T14:50:00Z",
      status: "ONLINE",
      current_screen: "Log DK",
    },
  ],
  agora
);
assert.strictEqual(longo[0].usuario, "MARCOS RAFAEL");
assert.strictEqual(longo[0].perfil, "Administrador");
assert.strictEqual(longo[0].maquina, "Windows");

assert.ok(sql.includes("create table if not exists public.dk_audit_state"));
assert.ok(sql.includes("for update"));
assert.ok(sql.includes("last_audit_no = last_audit_no + 1"));
assert.ok(!sql.includes("generated always as identity"));
assert.ok(!sql.includes("create sequence"));
assert.ok(sql.includes("dk_live_sessions"));
assert.ok(sql.includes("revoke insert, update, delete on table public.dk_events from anon, authenticated"));
assert.ok(sql.includes("evento_imutavel"));
assert.ok(append.includes("for update"));
assert.ok(append.includes("on conflict (operation_id) do nothing"));
assert.ok(!append.includes("max("));

const ui = fs.readFileSync(path.join(raiz, "portal-log-ui.js"), "utf8");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const css = fs.readFileSync(path.join(raiz, "styles.css"), "utf8");
assert.ok(html.includes("dk-log-fundacao"));
assert.ok(html.includes("Usuários ativos"));
assert.ok(html.includes("Detalhes do evento"));
assert.ok(css.includes("grid-template-columns: minmax(0, 54fr) minmax(0, 46fr)"));
assert.ok(html.includes('id="portal-log-usuarios"'));
assert.ok(html.includes('id="portal-log-detalhe"'));
assert.ok(html.includes('id="portal-log-lista"'));
assert.ok(css.includes("overflow-y: auto"));
assert.ok(ui.includes('"Login"'));
assert.ok(!ui.includes("· Login "));
assert.ok(ui.includes("white-space") || css.includes("white-space: nowrap"));
assert.ok(css.includes("grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)"));
assert.ok(ui.includes("mostrarHover"));
assert.ok(!ui.includes("setInterval"));
assert.strictEqual(ui.split("fetch(").length - 1, 1);

console.log("audit no ok");
