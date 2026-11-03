/**
 * Prova de gate REALTIME_AUTH_BLOCKED + catch-up simulado multisessão.
 * Não abre WebSocket real. Não grava dados de negócio.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

const api = fs.readFileSync(path.join(root, "api", "dk-realtime-credencial.js"), "utf8");
const syncSrc = fs.readFileSync(path.join(root, "portal-dk-sync.js"), "utf8");
const auth = fs.readFileSync(path.join(root, "lib", "dk-portal-auth.cjs"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase", "dk-events-broadcast.sql"), "utf8");
const sqlPend = fs.readFileSync(path.join(root, "supabase", "dk-events-broadcast-auth-pendente.sql"), "utf8");
const backup = fs.readFileSync(path.join(root, "lib", "dk-collect-backup.cjs"), "utf8");
const supabaseInit = fs.readFileSync(path.join(root, "supabase-init.js"), "utf8");

assert.match(api, /REALTIME_AUTH_BLOCKED/);
assert.match(api, /ES256/);
assert.match(api, /DK_REALTIME_ES256_TRUSTED|emissorPronto/);
assert.ok(!/Bearer \$\{|service_role_key|SERVICE_ROLE/.test(api));
assert.match(api, /DK_REALTIME_SINAL/);
assert.match(fs.readFileSync(path.join(root, "lib", "dk-realtime-jwt-es256.cjs"), "utf8"), /assinarEs256/);
assert.match(sqlPend, /OR de políticas|drop policy if exists dk_events_broadcast_ler/i);
assert.match(syncSrc, /REALTIME_AUTH_BLOCKED/);
assert.match(syncSrc, /dkSyncTentarRealtime/);
assert.match(syncSrc, /dk_sync_cursor_scope_v1/);
assert.match(syncSrc, /seqsVistos/);
assert.match(syncSrc, /dk:sync:conflito-edicao/);
assert.match(auth, /function signToken/);
assert.match(auth, /createHmac\("sha256"/);
assert.doesNotMatch(auth, /SUPABASE_JWT_SECRET/);
assert.match(sql, /dk:events/);
assert.match(sql, /dk_events_broadcast_seq_ignorado/);
assert.match(sqlPend, /NÃO APLICAR/);
assert.match(backup, /backup_relacional_completo: false/);
assert.match(backup, /completeReason: "contagens_oficiais_sem_dump_relacional_completo"/);
assert.match(supabaseInit, /createClient/);
assert.match(supabaseInit, /dk-supabase-anon-key/);

/** Handler responde 503 REALTIME_AUTH_BLOCKED com sessão fictícia. */
async function testHandlerGate() {
  const calls = [];
  const fakeAuth = {
    applyApiCors(res) {
      calls.push("cors");
    },
    async requireLiveSession() {
      return { ok: true, typ: "equipa", role: "owner", cpf: "00000000000", sid: "sid-teste" };
    },
    assertEquipaClientProtocol() {
      return { ok: true };
    },
  };
  const Module = require("module");
  const handlerPath = path.join(root, "api", "dk-realtime-credencial.js");
  const abs = require.resolve(handlerPath);
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (String(request).includes("dk-portal-auth")) {
      return {
        ...fakeAuth,
        async enforceRateLimit() {
          return false;
        },
        onlyDigits(v) {
          return String(v || "").replace(/\D/g, "");
        },
        async loadOfficialSnapshotPayload() {
          return {};
        },
        findFuncionario() {
          return null;
        },
      };
    }
    return original(request, parent, isMain);
  };
  try {
    delete require.cache[abs];
    const handler = require(handlerPath);
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.JWT_SECRET;
    process.env.DK_REALTIME_SINAL = "0";
    let status = 0;
    let body = null;
    await handler(
      { method: "GET", headers: {} },
      {
        status(code) {
          status = code;
          return this;
        },
        json(payload) {
          body = payload;
          return payload;
        },
        setHeader() {},
      }
    );
    assert.equal(status, 503);
    assert.equal(body.reason, "REALTIME_AUTH_BLOCKED");
    assert.equal(body.realtime, false);
    assert.ok(body.requisito_ausente);
  } finally {
    Module._load = original;
    delete require.cache[abs];
  }
}

/** Catch-up simulado: duas sessões, dedupe, troca de conta, ordem. */
async function testCatchUpSimulado() {
  const storeA = new Map();
  const storeB = new Map();
  function makeWindow(store) {
    const listeners = [];
    return {
      sessionStorage: {
        getItem(k) {
          return store.has(k) ? store.get(k) : null;
        },
        setItem(k, v) {
          store.set(k, String(v));
        },
        removeItem(k) {
          store.delete(k);
        },
      },
      __DK_portalSessao: { cpf: "11111111111", sid: "A" },
      CustomEvent: function CustomEvent(name, init) {
        this.type = name;
        this.detail = init && init.detail;
      },
      dispatchEvent(ev) {
        listeners.forEach((fn) => fn(ev));
        return true;
      },
      addEventListener(type, fn) {
        listeners.push((ev) => {
          if (ev.type === type) fn(ev);
        });
      },
      document: { activeElement: null },
    };
  }

  function loadSync(win, fetchImpl) {
    win.fetch = fetchImpl;
    const moduleObj = { exports: {} };
    const sandbox = {
      window: win,
      module: moduleObj,
      console,
      fetch: fetchImpl,
      setTimeout,
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
    };
    sandbox.self = win;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(syncSrc, sandbox);
    return moduleObj.exports;
  }

  const eventos = [
    { seq: 1, audit_no: 1, event_type: "locacao.updated", entity_type: "locacao", module: "locacao" },
    { seq: 2, audit_no: 2, event_type: "payment.created", entity_type: "pagamento", module: "pagamento" },
    { seq: 4, audit_no: 3, event_type: "cliente.updated", entity_type: "cliente", module: "cliente" },
  ];

  function fetchFactory(sessionTag) {
    return async (url) => {
      const u = String(url);
      const after = Number((/after=(\d+)/.exec(u) || [])[1] || 0);
      const page = eventos.filter((e) => e.seq > after);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            server_event_seq: 4,
            events: page,
            has_more: false,
            next_after: page.length ? page[page.length - 1].seq : after,
            session: sessionTag,
          };
        },
      };
    };
  }

  const winA = makeWindow(storeA);
  const apiA = loadSync(winA, fetchFactory("A"));
  const r1 = await apiA.dkSyncCatchUp("teste");
  assert.equal(r1.ok, true);
  assert.equal(apiA.dkSyncGetStatus().lastAppliedSeq, 4);

  // Cenário 4: mesmo lote duplicado
  const rDup = await apiA.dkSyncCatchUp("dup");
  assert.equal(rDup.ok, true);
  assert.equal(apiA.dkSyncGetStatus().lastAppliedSeq, 4);

  // Sessão B isolada
  const winB = makeWindow(storeB);
  winB.__DK_portalSessao = { cpf: "22222222222", sid: "B" };
  const apiB = loadSync(winB, fetchFactory("B"));
  const rB = await apiB.dkSyncCatchUp("B");
  assert.equal(rB.ok, true);
  assert.equal(apiB.dkSyncGetStatus().lastAppliedSeq, 4);

  // Cenário 10: troca de conta na mesma aba — cursor não reutiliza escopo anterior
  winA.__DK_portalSessao = { cpf: "33333333333", sid: "C" };
  const antes = Number(storeA.get("dk_sync_cursor_seq_v1") || 0);
  assert.ok(antes >= 4);
  await apiA.dkSyncCatchUp("troca");
  assert.equal(storeA.get("dk_sync_cursor_scope_v1"), "33333333333:C");

  // Realtime permanece bloqueado
  const rt = await apiA.dkSyncTentarRealtime();
  assert.equal(rt.ok, false);
  assert.match(String(rt.reason), /REALTIME_AUTH_BLOCKED|canal|auth/i);
  assert.equal(apiA.dkSyncGetStatus().realtimeBloqueado, true);
}

await testHandlerGate();
await testCatchUpSimulado();
console.log("realtime auth bloqueado + catch-up simulado ok");
