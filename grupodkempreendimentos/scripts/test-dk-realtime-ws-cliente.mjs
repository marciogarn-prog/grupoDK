/**
 * Cliente WebSocket privado — simulação (não plataforma Realtime real).
 * TESTE SIMULADO ≠ TESTE WEBSOCKET REAL ≠ PRODUÇÃO.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const syncSrc = fs.readFileSync(path.join(root, "portal-dk-sync.js"), "utf8");
const initSrc = fs.readFileSync(path.join(root, "supabase-init.js"), "utf8");
const scope = fs.readFileSync(path.join(root, "lib", "dk-realtime-scope.cjs"), "utf8");

assert.match(syncSrc, /abrirCanalPrivado/);
assert.match(syncSrc, /config:\s*\{\s*private:\s*true\s*\}/);
assert.match(syncSrc, /dkSyncEncerrarRealtime/);
assert.match(syncSrc, /SCOPE_ISOLATION_BLOCKED/);
assert.match(syncSrc, /agendarRenovacao/);
assert.doesNotMatch(syncSrc, /cpf \+ ":" \+ sid/);
assert.match(initSrc, /__DK_criarClienteRealtime/);
assert.match(initSrc, /persistSession:\s*false/);
assert.match(scope, /SCOPE_ISOLATION_BLOCKED/);
assert.match(scope, /dk:events:/);

function loadSync(win, fetchImpl, factory) {
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
  if (factory) api.configurar({ realtimeFactory: factory });
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
    setTimeout,
    clearTimeout,
  };
}

/** Credencial bloqueada → não abre canal */
{
  const store = new Map();
  const win = makeWin(store, { sid: "sid-A", empresa: "locadora" });
  const api = loadSync(win, async () => ({
    ok: false,
    status: 503,
    async json() {
      return { ok: false, reason: "SCOPE_ISOLATION_BLOCKED" };
    },
  }));
  const r = await api.dkSyncTentarRealtime();
  assert.equal(r.ok, false);
  assert.equal(api.dkSyncGetStatus().realtimeConectado, false);
}

/** Credencial ok + factory simulada → SUBSCRIBED + catch-up */
{
  const store = new Map();
  const win = makeWin(store, { sid: "sid-B", empresa: "locadora" });
  let subscribed = false;
  let catchUps = 0;
  const eventos = [
    { seq: 1, audit_no: 1, event_type: "locacao.updated", entity_type: "locacao", module: "locacao", entity_id: "2099010001" },
  ];
  const fetchImpl = async (url) => {
    if (String(url).includes("dk-realtime-credencial")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            token: "jwt-ficticio",
            exp: Math.floor(Date.now() / 1000) + 120,
            canal: "dk:events",
            private: true,
          };
        },
      };
    }
    catchUps += 1;
    const after = Number((/after=(\d+)/.exec(String(url)) || [])[1] || 0);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          server_event_seq: 1,
          events: eventos.filter((e) => e.seq > after),
          has_more: false,
        };
      },
    };
  };
  const factory = (getToken) => {
    assert.ok(getToken);
    return {
      realtime: { setAuth() {} },
      channel(name, opts) {
        assert.equal(name, "dk:events");
        assert.equal(opts.config.private, true);
        const handlers = [];
        return {
          on(type, filter, fn) {
            handlers.push({ type, filter, fn });
            return this;
          },
          subscribe(cb) {
            subscribed = true;
            cb("SUBSCRIBED");
            return this;
          },
        };
      },
      async removeChannel() {},
    };
  };
  const api = loadSync(win, fetchImpl, factory);
  const r = await api.dkSyncTentarRealtime();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(subscribed, true);
  assert.equal(api.dkSyncGetStatus().realtimeConectado, true);
  await api.dkSyncCatchUp("teste");
  assert.ok(catchUps >= 1);
  assert.equal(api.dkSyncGetStatus().lastAppliedSeq, 1);

  /** Encerrar */
  api.dkSyncEncerrarRealtime();
  assert.equal(api.dkSyncGetStatus().realtimeConectado, false);
}

/** Canal inválido rejeitado */
{
  const store = new Map();
  const win = makeWin(store, { sid: "sid-C", empresa: "locadora" });
  const api = loadSync(
    win,
    async () => ({
      ok: true,
      status: 200,
      async json() {
        return { ok: true, token: "x", exp: 9e9, canal: "publico-inseguro", private: true };
      },
    }),
    () => ({ channel() { return { on() { return this; }, subscribe(cb) { cb("SUBSCRIBED"); } }; }, async removeChannel() {} })
  );
  const r = await api.dkSyncTentarRealtime();
  assert.equal(r.ok, false);
  assert.match(String(r.reason), /SCOPE_ISOLATION/);
}

console.log("ok dk-realtime-ws-cliente simulado");
process.exit(0);
