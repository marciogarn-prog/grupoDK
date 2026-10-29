import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fonte = fs.readFileSync(path.join(raiz, "portal-dk-sync.js"), "utf8");
const logUi = fs.readFileSync(path.join(raiz, "portal-log-ui.js"), "utf8");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const sync = require("../portal-dk-sync.js");

assert.ok(!fonte.includes("localStorage"));
assert.ok(!fonte.includes("indexedDB"));
assert.ok(!fonte.includes("setInterval"));
assert.ok(!fonte.includes("setTimeout"));
assert.ok(!fonte.includes("caches."));
assert.ok(!fonte.includes("eval("));
assert.ok(!fonte.includes("innerHTML"));
assert.ok(!fonte.includes("dk_clientes"));
assert.ok(!fonte.includes("dk_pagamento"));
assert.ok(!fonte.includes("service_role"));
assert.ok(fonte.includes("/api/dk-sync?after="));
assert.ok(fonte.includes("cursor_not_advancing"));
assert.ok(fonte.includes('cache: "no-store"'));

assert.ok(logUi.includes('fetch("/api/dk-log"'));
assert.ok(logUi.includes('dkSyncCheckpoint("checkpoint")'));
assert.ok(!logUi.includes("setInterval"));
assert.ok(!logUi.includes("innerHTML"));
const syncSrc = html.indexOf("portal-dk-sync.js?v=20261029logdk10");
const logSrc = html.indexOf("portal-log-ui.js?v=20261029logdk10");
assert.ok(syncSrc > 0 && logSrc > syncSrc);
assert.ok(html.includes("app.js?v=20261029logdk10"));
assert.ok(html.includes("portal-locadora-ui.js?v=20261029logdk10"));

function http(body, status) {
  const code = status || 200;
  return { ok: code >= 200 && code < 300, status: code, json: async () => body };
}

function pagina(events, extra) {
  const lista = events || [];
  const after = extra && extra.after != null ? extra.after : 0;
  return {
    ok: true,
    server_event_seq: extra && extra.server_event_seq != null ? extra.server_event_seq : 12,
    events: lista,
    has_more: Boolean(extra && extra.has_more),
    next_after: extra && extra.next_after != null ? extra.next_after : lista.length ? lista[lista.length - 1].seq : after,
    fallback: false,
  };
}

const cheio = (seq, tipo) => ({
  seq,
  event_type: tipo,
  entity_type: "system",
  action: "initialized",
  module: "system",
  payload: { message: "nao deve sair no callback" },
  actor_user_id: "nao",
  entity_id: "nao",
});

sync.reset();
const vistos = [];
sync.assinar((detalhe) => vistos.push(detalhe));
const pedidos = [];
sync.configurar({
  limite: 100,
  transporte: async (url) => {
    pedidos.push(url);
    return http(pagina([cheio(3, "system.log_initialized"), cheio(12, "system.realtime_initialized")], { next_after: 12 }));
  },
});

const primeiro = await sync.dkSyncCatchUp("startup");
assert.strictEqual(primeiro.ok, true);
assert.strictEqual(pedidos[0].includes("after=0"), true);
assert.strictEqual(pedidos[0].includes("limit=100"), true);
assert.deepStrictEqual(
  vistos.map((item) => item.seq),
  [3, 12]
);
assert.strictEqual(vistos[0].restricted, false);
assert.strictEqual(vistos[0].event_type, "system.log_initialized");
assert.ok(!Object.prototype.hasOwnProperty.call(vistos[0], "payload"));
assert.ok(!Object.prototype.hasOwnProperty.call(vistos[0], "actor_user_id"));
assert.ok(!Object.prototype.hasOwnProperty.call(vistos[0], "entity_id"));
const estado1 = sync.dkSyncEstado();
assert.strictEqual(estado1.lastAppliedSeq, 12);
assert.strictEqual(estado1.lastServerSeq, 12);
assert.strictEqual(estado1.syncInFlight, false);
assert.strictEqual(estado1.lastError, null);

sync.configurar({
  transporte: async (url) => {
    pedidos.push(url);
    return http(pagina([], { next_after: 12, server_event_seq: 12 }));
  },
});
const antesDup = vistos.length;
const segundo = await sync.dkSyncCheckpoint("checkpoint");
assert.strictEqual(segundo.ok, true);
assert.ok(pedidos[pedidos.length - 1].includes("after=12"));
assert.strictEqual(vistos.length, antesDup);
assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 12);

sync.configurar({
  transporte: async () => http(pagina([cheio(12, "system.realtime_initialized")], { next_after: 12 })),
});
await sync.dkSyncCatchUp("manual");
assert.strictEqual(vistos.length, antesDup);
assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 12);

sync.reset();
const restritos = [];
sync.assinar((detalhe) => restritos.push(detalhe));
sync.configurar({
  transporte: async () =>
    http(
      pagina(
        [
          { seq: 3, restricted: true },
          { seq: 12, restricted: true },
        ],
        { next_after: 12 }
      )
    ),
});
const papel = await sync.dkSyncCatchUp("startup");
assert.strictEqual(papel.ok, true);
assert.deepStrictEqual(restritos, [
  { seq: 3, restricted: true },
  { seq: 12, restricted: true },
]);
assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 12);

sync.reset();
const ordem = [];
sync.assinar((detalhe) => ordem.push(detalhe.seq));
sync.configurar({
  limite: 1,
  transporte: async (url) => {
    const after = Number(new URL(url, "https://dk.local").searchParams.get("after"));
    const fila = [1, 2, 3].filter((seq) => seq > after);
    const page = fila.slice(0, 1).map((seq) => cheio(seq, "t"));
    return http(
      pagina(page, {
        has_more: fila.length > 1,
        next_after: page.length ? page[0].seq : after,
        server_event_seq: 3,
        after,
      })
    );
  },
});
const paginado = await sync.dkSyncCatchUp("startup");
assert.strictEqual(paginado.ok, true);
assert.deepStrictEqual(ordem, [1, 2, 3]);
assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 3);
assert.strictEqual(sync.dkSyncEstado().lastServerSeq, 3);

sync.reset();
const regressao = [];
sync.assinar((detalhe) => regressao.push(detalhe.seq));
sync.configurar({
  transporte: async () => http(pagina([cheio(3, "a"), cheio(2, "b")], { next_after: 2, server_event_seq: 3 })),
});
const fora = await sync.dkSyncCatchUp("startup");
assert.strictEqual(fora.ok, false);
assert.strictEqual(fora.reason, "ordem_invalida");
assert.deepStrictEqual(regressao, []);
assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 0);
assert.strictEqual(sync.dkSyncEstado().lastError, "ordem_invalida");

sync.reset();
sync.configurar({
  transporte: async () =>
    http(pagina([cheio(4, "a")], { has_more: true, next_after: 0, server_event_seq: 4 })),
});
const loop = await sync.dkSyncCatchUp("startup");
assert.strictEqual(loop.ok, false);
assert.strictEqual(loop.reason, "cursor_not_advancing");
assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 0);
assert.strictEqual(sync.dkSyncEstado().lastError, "cursor_not_advancing");

sync.reset();
let chamadas = 0;
let liberar = [];
sync.configurar({
  transporte: () => {
    chamadas += 1;
    return new Promise((resolve) => {
      liberar.push(resolve);
    });
  },
});
const voo = sync.dkSyncCatchUp("startup");
await Promise.resolve();
assert.strictEqual(chamadas, 1);
assert.strictEqual(sync.dkSyncEstado().syncInFlight, true);
const outro = sync.dkSyncCatchUp("realtime");
assert.strictEqual(outro, voo);
assert.strictEqual(chamadas, 1);
liberar[0](http(pagina([], { next_after: 0, server_event_seq: 0 })));
for (let i = 0; i < 6 && chamadas < 2; i += 1) await Promise.resolve();
assert.strictEqual(chamadas, 2);
liberar[1](http(pagina([], { next_after: 0, server_event_seq: 0 })));
const extra = await voo;
assert.strictEqual(extra.ok, true);
assert.strictEqual(chamadas, 2);
assert.strictEqual(sync.dkSyncEstado().syncInFlight, false);

sync.reset();
sync.configurar({
  transporte: async () => {
    throw new Error("falha");
  },
});
const rede = await sync.dkSyncCatchUp("startup");
assert.strictEqual(rede.ok, false);
assert.strictEqual(rede.reason, "rede");
assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 0);
assert.strictEqual(sync.dkSyncEstado().lastError, "rede");

for (const status of [401, 403]) {
  sync.reset();
  sync.configurar({
    transporte: async () => http({ ok: false }, status),
  });
  const auth = await sync.dkSyncCatchUp("startup");
  assert.strictEqual(auth.ok, false);
  assert.strictEqual(auth.reason, "auth");
  assert.strictEqual(auth.status, status);
  assert.strictEqual(sync.dkSyncEstado().lastAppliedSeq, 0);
  assert.strictEqual(sync.dkSyncEstado().lastServerSeq, 0);
  assert.strictEqual(sync.dkSyncEstado().lastError, "auth");
}

console.log("sync cursor ok");
