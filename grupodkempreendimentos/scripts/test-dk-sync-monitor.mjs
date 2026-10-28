import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fonte = fs.readFileSync(path.join(raiz, "portal-dk-sync.js"), "utf8");
const ui = fs.readFileSync(path.join(raiz, "portal-log-ui.js"), "utf8");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const sync = require("../portal-dk-sync.js");

assert.ok(!fonte.includes("localStorage"));
assert.ok(!fonte.includes("setInterval"));
assert.ok(!fonte.includes("setTimeout"));
assert.ok(fonte.includes("dk:sync:status"));
assert.ok(!ui.includes("setInterval"));
assert.ok(!ui.includes("innerHTML"));
assert.ok(ui.includes("textContent"));
assert.ok(ui.includes('dkSyncCheckpoint("manual")'));
assert.ok(ui.includes('fetch("/api/dk-log"'));
assert.ok(html.includes("Monitoramento de sincronização"));
assert.ok(html.includes("Este navegador"));
assert.ok(html.includes("btn-verificar-sync"));
assert.ok(html.includes(">Verificar sincronização</button>"));
assert.ok(!html.includes("Todos os computadores sincronizados"));
assert.ok(!fonte.includes("dk_sessions"));
assert.ok(!ui.includes("dk_sessions"));

function http(body, status) {
  const code = status || 200;
  return { ok: code >= 200 && code < 300, status: code, json: async () => body };
}

sync.reset();
let inicial = sync.dkSyncGetStatus();
assert.strictEqual(inicial.initialized, false);
assert.strictEqual(inicial.lastCheckpointAt, null);
assert.strictEqual(sync.dkSyncRotulo(inicial), "Inicializando");
assert.strictEqual(sync.dkSyncTextos(inicial).checkpoint, "ainda não realizado");
assert.deepStrictEqual(Object.keys(inicial).sort(), [
  "initialized",
  "lag",
  "lastAppliedSeq",
  "lastCheckpointAt",
  "lastError",
  "lastServerSeq",
  "syncInFlight",
  "syncPending",
].sort());
assert.ok(!JSON.stringify(inicial).includes("token"));
assert.ok(!JSON.stringify(inicial).includes("Bearer"));

let liberar;
sync.configurar({
  transporte: () =>
    new Promise((resolve) => {
      liberar = resolve;
    }),
});
const voo = sync.dkSyncCatchUp("startup");
await Promise.resolve();
assert.strictEqual(sync.dkSyncRotulo(), "Sincronizando");
liberar(http({ ok: false }, 500));
await voo;
assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 0);
assert.strictEqual(sync.dkSyncRotulo(), "Erro");
assert.strictEqual(sync.dkSyncGetStatus().lastCheckpointAt, null);

sync.reset();
sync.configurar({
  transporte: async () => {
    throw new Error("falha");
  },
});
await sync.dkSyncCatchUp("startup");
assert.strictEqual(sync.dkSyncGetStatus().lastError, "rede");
assert.strictEqual(sync.dkSyncGetStatus().lastAppliedSeq, 0);
assert.strictEqual(sync.dkSyncRotulo(), "Erro");
assert.strictEqual(sync.dkSyncTextos().erro, "rede");

sync.reset();
sync.configurar({
  transporte: async () =>
    http({
      ok: true,
      server_event_seq: 12,
      events: [{ seq: 3, event_type: "system.log_initialized", entity_type: "system", action: "initialized", module: "system" }],
      has_more: false,
      next_after: 3,
      fallback: false,
    }),
});
const atrasado = await sync.dkSyncCatchUp("startup");
assert.strictEqual(atrasado.ok, true);
const statusAtraso = sync.dkSyncGetStatus();
assert.strictEqual(statusAtraso.lastServerSeq, 12);
assert.strictEqual(statusAtraso.lastAppliedSeq, 3);
assert.strictEqual(statusAtraso.lag, 9);
assert.strictEqual(sync.dkSyncRotulo(statusAtraso), "Atrasado");
assert.ok(statusAtraso.lag >= 0);

sync.reset();
sync.configurar({
  transporte: async () =>
    http({
      ok: true,
      server_event_seq: 12,
      events: [
        { seq: 3, event_type: "system.log_initialized", entity_type: "system", action: "initialized", module: "system" },
        { seq: 12, event_type: "system.realtime_initialized", entity_type: "system", action: "initialized", module: "system" },
      ],
      has_more: false,
      next_after: 12,
      fallback: false,
    }),
});
const ok = await sync.dkSyncCheckpoint("manual");
assert.strictEqual(ok.ok, true);
const pronto = sync.dkSyncGetStatus();
assert.strictEqual(pronto.lastServerSeq, 12);
assert.strictEqual(pronto.lastAppliedSeq, 12);
assert.strictEqual(pronto.lag, 0);
assert.strictEqual(sync.dkSyncRotulo(pronto), "Sincronizado");
assert.match(String(pronto.lastCheckpointAt), /^\d{4}-\d{2}-\d{2}T/);
const textos = sync.dkSyncTextos(pronto);
assert.strictEqual(textos.servidor, "seq 12");
assert.strictEqual(textos.navegador, "seq 12");
assert.strictEqual(textos.atraso, "0 evento(s)");
assert.strictEqual(textos.estado, "Sincronizado");
assert.ok(!textos.erro.includes("<"));

const malicioso = sync.dkSyncTextos({
  lastAppliedSeq: 12,
  lastServerSeq: 12,
  lag: 0,
  syncInFlight: false,
  syncPending: false,
  initialized: true,
  lastError: "<img src=x onerror=alert(1)>",
  lastCheckpointAt: null,
});
assert.strictEqual(malicioso.erro, "<img src=x onerror=alert(1)>");
assert.strictEqual(malicioso.estado, "Erro");

console.log("sync monitor ok");
