import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const acesso = require("../lib/dk-log-acesso.cjs");

const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(raiz, "portal-locadora-ui.js"), "utf8");
const api = fs.readFileSync(path.join(raiz, "api", "dk-log.js"), "utf8");
const doc = html.indexOf('id="btn-locadora-documentos"');
const log = html.indexOf('id="btn-locadora-log"');
const fin = html.indexOf('id="btn-locadora-financeiro"');
assert.ok(doc >= 0 && log > doc && fin > log);
assert.ok(html.includes(">Log</button>"));
assert.ok(html.includes('id="panel-log-locadora"'));
assert.ok(html.includes("Infraestrutura de eventos em preparação"));
assert.ok(html.includes('id="btn-voltar-log-locadora"'));
assert.ok(!html.includes("dk_events_fake"));

assert.ok(ui.includes('id="btn-locadora-log"') || ui.includes("btn-locadora-log"));
assert.ok(ui.includes("portalPodeAcessarLog"));
assert.ok(ui.includes('btnLog?.classList.toggle("hidden", !allowFin)'));
assert.ok(ui.includes('rest === "log"'));
assert.ok(ui.includes("function portalDelegarPagamento"));
assert.ok(!ui.includes("evento inventado"));

const authEm = api.indexOf("requireLiveSession");
const dadosEm = api.indexOf("estadoLog");
assert.ok(authEm >= 0 && dadosEm > authEm);
assert.ok(api.includes("allowService: false"));
assert.ok(!api.includes("dk_pagamento"));
assert.ok(!api.includes("dk_locacao"));
assert.ok(!api.includes("DELETE"));
assert.ok(!api.includes("TRUNCATE"));

assert.deepStrictEqual(acesso.decidirAcessoLog({ ok: true, typ: "equipa", role: "owner" }), { ok: true });
assert.strictEqual(acesso.decidirAcessoLog({ ok: true, typ: "equipa", role: "operacao" }).status, 403);
assert.strictEqual(acesso.decidirAcessoLog({ ok: true, typ: "equipa", role: "operacao" }).reason, "log_somente_administrador");
assert.strictEqual(acesso.decidirAcessoLog({ ok: true, typ: "cliente", role: "owner" }).status, 403);
assert.strictEqual(acesso.decidirAcessoLog({ ok: true, typ: "equipa", role: "owner", service: true }).status, 403);
assert.strictEqual(acesso.decidirAcessoLog({ ok: false, status: 401, reason: "unauthorized" }).status, 401);
const estado = acesso.estadoLog();
assert.strictEqual(estado.estado, "Infraestrutura de eventos em preparação");
assert.strictEqual(estado.fonte, "dk_events");
assert.deepStrictEqual(estado.eventos, []);
assert.deepStrictEqual(estado.colunas, ["seq", "dataHora", "usuario", "sessao", "modulo", "tipo", "entidade", "acao"]);

console.log("log admin ok");
