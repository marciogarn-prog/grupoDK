/**
 * Cliente sync — Realtime Supabase desligado; sinal Redis + catch-up PG.
 * TESTE SIMULADO ≠ PRODUÇÃO.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const syncSrc = fs.readFileSync(path.join(root, "portal-dk-sync.js"), "utf8");
const initSrc = fs.readFileSync(path.join(root, "supabase-init.js"), "utf8");
const scope = fs.readFileSync(path.join(root, "lib", "dk-realtime-scope.cjs"), "utf8");

assert.match(syncSrc, /dkSyncAplicarSinalRedis/);
assert.match(syncSrc, /dk-area-ocupacao/);
assert.match(syncSrc, /redis_sinal/);
assert.match(syncSrc, /dkSyncEncerrarRealtime/);
assert.match(syncSrc, /REALTIME_AUTH_BLOCKED/);
assert.doesNotMatch(syncSrc, /cpf \+ ":" \+ sid/);
assert.match(initSrc, /__DK_criarClienteRealtime/);
assert.match(initSrc, /persistSession:\s*false/);
assert.match(scope, /SCOPE_ISOLATION_BLOCKED/);
assert.match(scope, /dk:events:/);

function loadSync(win, fetchImpl) {
  win.fetch = fetchImpl;
  const moduleObj = { exports: {} };
  const sandbox = {
    window: win,
    module: moduleObj,
    console,
    fetch: fetchImpl,
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
  return moduleObj.exports;
}

function makeWin(store, sessao) {
  const listeners = new Map();
  return {
    sessionStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    __DK_portalSessao: sessao,
    __DK_portalApiHeaders() {
      return {};
    },
    __DK_portalApiTokenGet() {
      return "tok";
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(ev) {
      const list = listeners.get(ev.type) || [];
      list.forEach((fn) => fn(ev));
      return true;
    },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
  };
}

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
  assert.equal(r.transport, "redis");
}

{
  const store = new Map();
  const win = makeWin(store, { sid: "sid-B", empresa: "locadora" });
  let catchUps = 0;
  const eventos = [
    {
      seq: 1,
      audit_no: 1,
      event_type: "locacao.updated",
      entity_type: "locacao",
      module: "locacao",
      entity_id: "2099010001",
    },
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
  const api = loadSync(win, fetchImpl);
  api.reset();
  const r = await api.dkSyncTentarRealtime();
  assert.equal(r.ok, false);
  assert.equal(api.dkSyncGetStatus().realtimeConectado, false);
  assert.equal(api.dkSyncGetStatus().realtimeBloqueado, true);

  const sinal = api.dkSyncAplicarSinalRedis({ server_event_seq: 1 });
  assert.equal(sinal.ok, true);
  assert.equal(sinal.catchup === true || sinal.skipped === true, true);
  await api.dkSyncCatchUp("redis_sinal");
  assert.ok(catchUps >= 1);
  assert.equal(api.dkSyncGetStatus().lastAppliedSeq, 1);

  api.dkSyncEncerrarRealtime();
  assert.equal(api.dkSyncGetStatus().realtimeConectado, false);
}

{
  const store = new Map();
  const win = makeWin(store, { sid: "sid-C", empresa: "locadora" });
  const api = loadSync(win, async () => ({
    ok: true,
    status: 200,
    async json() {
      return { ok: true, token: "x", exp: 9e9, canal: "publico-inseguro", private: true };
    },
  }));
  const r = await api.dkSyncTentarRealtime();
  assert.equal(r.ok, false);
  assert.match(String(r.reason), /REALTIME_AUTH_BLOCKED|SCOPE_ISOLATION|canal|auth/i);
}

console.log("ok dk-realtime-ws-cliente simulado (redis sinal)");
process.exit(0);
