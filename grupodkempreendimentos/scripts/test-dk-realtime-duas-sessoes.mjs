/**
 * Duas sessões isoladas — transporte WebSocket SIMULADO (não plataforma Realtime).
 * TESTE SIMULADO ≠ TESTE WEBSOCKET REAL ≠ PRODUÇÃO.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const syncSrc = fs.readFileSync(path.join(root, "portal-dk-sync.js"), "utf8");

function loadApi(win, fetchImpl, factory) {
  win.fetch = fetchImpl;
  const moduleObj = { exports: {} };
  const sandbox = {
    window: win,
    module: moduleObj,
    console,
    fetch: fetchImpl,
    setTimeout: (fn, ms) => setTimeout(fn, ms || 0),
    clearTimeout,
    Date,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Math,
    JSON,
    encodeURIComponent,
    Promise,
  };
  sandbox.self = win;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(syncSrc, sandbox);
  const api = moduleObj.exports;
  if (factory) api.configurar({ realtimeFactory: factory, transporte: fetchImpl });
  return api;
}

function makeWin(store, sessao) {
  const listeners = {};
  return {
    sessionStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    __DK_portalSessao: sessao,
    __DK_portalApiHeaders: () => ({ Authorization: "Bearer fake" }),
    CustomEvent: function (name, init) {
      this.type = name;
      this.detail = init && init.detail;
    },
    dispatchEvent(ev) {
      (listeners[ev.type] || []).forEach((fn) => fn(ev));
      return true;
    },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    document: { visibilityState: "visible", activeElement: null },
    setTimeout: (fn, ms) => setTimeout(fn, ms || 0),
    clearTimeout,
  };
}

let serverSeq = 0;
const log = [];
function pushEvent(ev) {
  serverSeq += 1;
  const row = { ...ev, seq: serverSeq, audit_no: serverSeq };
  log.push(row);
  return row;
}

function makeFetch(label) {
  return async (url) => {
    const u = String(url);
    if (u.includes("dk-realtime-credencial")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            token: "jwt-" + label,
            exp: Math.floor(Date.now() / 1000) + 120,
            canal: "dk:events",
            private: true,
          };
        },
      };
    }
    const after = Number((/after=(\d+)/.exec(u) || [])[1] || 0);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          server_event_seq: serverSeq,
          events: log.filter((e) => e.seq > after),
          has_more: false,
        };
      },
    };
  };
}

function makeBus() {
  const map = new Map();
  return {
    add(id, fn) {
      map.set(id, fn);
    },
    remove(id) {
      map.delete(id);
    },
    broadcast(payload) {
      for (const fn of map.values()) fn(payload);
    },
  };
}

function makeFactory(label, bus) {
  return () => ({
    realtime: { setAuth() {} },
    channel(name, opts) {
      assert.equal(name, "dk:events");
      assert.equal(opts.config.private, true);
      let handler = null;
      const ch = {
        on(_t, _f, fn) {
          handler = fn;
          return ch;
        },
        subscribe(cb) {
          bus.add(label, (payload) => {
            if (handler) handler({ event: "dk_event", payload });
          });
          cb("SUBSCRIBED");
          return ch;
        },
      };
      return ch;
    },
    async removeChannel() {
      bus.remove(label);
    },
  });
}

const bus = makeBus();
const storeA = new Map();
const storeB = new Map();
const winA = makeWin(storeA, { sid: "sid-A", empresa: "locadora" });
const winB = makeWin(storeB, { sid: "sid-B", empresa: "locadora" });
const apiA = loadApi(winA, makeFetch("A"), makeFactory("A", bus));
const apiB = loadApi(winB, makeFetch("B"), makeFactory("B", bus));

assert.equal((await apiB.dkSyncTentarRealtime()).ok, true);
assert.equal(apiB.dkSyncGetStatus().realtimeConectado, true);
assert.equal(apiB.dkSyncGetStatus().realtimeBloqueado, false);

const e1 = pushEvent({
  event_type: "locacao.updated",
  entity_type: "locacao",
  module: "locacao",
  entity_id: "2099010001",
});
bus.broadcast({ kind: "dk_changed", seq: e1.seq });
await Promise.resolve();
await new Promise((r) => setTimeout(r, 20));
assert.equal(apiB.dkSyncGetStatus().lastAppliedSeq, 1);

apiB.dkSyncEncerrarRealtime();
assert.equal(apiB.dkSyncGetStatus().realtimeConectado, false);
pushEvent({
  event_type: "cliente.updated",
  entity_type: "cliente",
  module: "cliente",
  entity_id: "DK-FX-1",
});
assert.equal((await apiB.dkSyncTentarRealtime()).ok, true);
await apiB.dkSyncCatchUp("reconnect");
assert.equal(apiB.dkSyncGetStatus().lastAppliedSeq, 2);

assert.equal((await apiB.dkSyncCatchUp("dup")).ok, true);
assert.equal(apiB.dkSyncGetStatus().lastAppliedSeq, 2);

winB.__DK_portalSessao = { sid: "sid-B2", empresa: "centro" };
apiB.reset();
assert.equal(apiB.dkSyncGetStatus().lastAppliedSeq, 0);

const storeC = new Map();
const winC = makeWin(storeC, { sid: "sid-C", empresa: "locadora" });
const apiC = loadApi(
  winC,
  async () => ({
    ok: false,
    status: 503,
    async json() {
      return { ok: false, reason: "REALTIME_AUTH_BLOCKED" };
    },
  }),
  () => ({
    channel() {
      return {
        on() {
          return this;
        },
        subscribe(cb) {
          cb("SUBSCRIBED");
        },
      };
    },
  })
);
assert.equal((await apiC.dkSyncTentarRealtime()).ok, false);

let conflito = 0;
winB.addEventListener("dk:sync:conflito-edicao", () => {
  conflito += 1;
});
winB.__DK_locacaoFormularioSujo = true;
winB.__DK_portalSessao = { sid: "sid-B", empresa: "locadora" };
assert.equal((await apiB.dkSyncTentarRealtime()).ok, true);
pushEvent({
  event_type: "locacao.updated",
  entity_type: "locacao",
  module: "locacao",
  entity_id: "2099010002",
});
await apiB.dkSyncCatchUp("edit");
assert.ok(conflito >= 1);

/** Sessão A isolada — cursor próprio */
assert.equal((await apiA.dkSyncTentarRealtime()).ok, true);
await apiA.dkSyncCatchUp("A");
assert.equal(apiA.dkSyncGetStatus().lastAppliedSeq, serverSeq);

apiA.dkSyncEncerrarRealtime();
apiB.dkSyncEncerrarRealtime();
console.log(
  JSON.stringify({
    ok: true,
    tipo: "SIMULADO",
    nota: "Não é WebSocket real da plataforma Supabase",
    eventos: serverSeq,
    B_seq: apiB.dkSyncGetStatus().lastAppliedSeq,
    A_seq: apiA.dkSyncGetStatus().lastAppliedSeq,
  })
);
process.exit(0);
