/**
 * Testes criptográficos ES256 com chaves FICTÍCIAS.
 * Não usa chave do projeto Supabase. Não ativa produção.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const es = require("../lib/dk-realtime-jwt-es256.cjs");

const { kid, privateJwk, publicJwk } = es.gerarParFicticio();
assert.equal(privateJwk.kty, "EC");
assert.equal(privateJwk.crv, "P-256");
assert.ok(privateJwk.d);
assert.ok(!publicJwk.d);

const gateOk = {
  ok: true,
  typ: "equipa",
  role: "owner",
  cpf: "39072202866",
  sid: "sid-ficticio-aaaa-bbbb",
};

const emit = es.emitirCredencialRealtime({
  gate: gateOk,
  empresa: "locadora",
  filial: "petrolina",
  forcarTeste: true,
  jwk: privateJwk,
  kid,
  ttl: 120,
  env: { DK_REALTIME_JWT_ISS: es.DEFAULT_ISS },
});
assert.equal(emit.ok, true, JSON.stringify(emit.body));
assert.ok(emit.body.token);
assert.equal(emit.body.alg, "ES256");
assert.equal(emit.body.canal, "dk:events");
assert.equal(emit.body.revogacao.instantanea, false);
assert.ok(emit.body.revogacao.residual_max_sec >= 30);

const ver = es.verificarEs256(emit.body.token, publicJwk, {
  kid,
  issuer: es.DEFAULT_ISS,
  aud: "authenticated",
});
assert.equal(ver.ok, true, JSON.stringify(ver));
assert.equal(ver.payload.role, "authenticated");
assert.equal(ver.payload.dk_portal, true);
assert.equal(ver.payload.dk_sid, gateOk.sid);
assert.equal(ver.payload.dk_empresa, "locadora");
assert.equal(ver.payload.dk_filial, "petrolina");
assert.equal(ver.header.kid, kid);
assert.equal(ver.header.alg, "ES256");

/** Expiração (reassinado com exp no passado) */
const claimsExpirados = {
  ...ver.payload,
  iat: Math.floor(Date.now() / 1000) - 200,
  nbf: Math.floor(Date.now() / 1000) - 200,
  exp: Math.floor(Date.now() / 1000) - 10,
};
const expiredToken = es.assinarEs256(privateJwk, kid, claimsExpirados);
assert.equal(es.verificarEs256(expiredToken, publicJwk, { kid }).reason, "expirado");

/** Token adulterado (claim sem reassinatura) — assinatura falha */
const parts = emit.body.token.split(".");
const tamperedPayload = { ...ver.payload, dk_role: "owner", dk_empresa: "outra" };
const tampered = `${parts[0]}.${Buffer.from(JSON.stringify(tamperedPayload)).toString("base64url")}.${parts[2]}`;
assert.equal(es.verificarEs256(tampered, publicJwk, { kid }).reason, "assinatura");

/** kid errado */
assert.equal(es.verificarEs256(emit.body.token, publicJwk, { kid: "outro-kid" }).reason, "kid");

/** issuer errado */
assert.equal(
  es.verificarEs256(emit.body.token, publicJwk, { kid, issuer: "https://evil.example/auth/v1" }).reason,
  "issuer"
);

/** sessão inválida / sem sid */
assert.equal(es.emitirCredencialRealtime({ gate: { ok: true, typ: "equipa", role: "x", cpf: "1" }, forcarTeste: true, jwk: privateJwk, kid }).ok, false);
assert.equal(es.emitirCredencialRealtime({ gate: { ok: false }, forcarTeste: true, jwk: privateJwk, kid }).ok, false);

/** cliente sem permissão */
assert.equal(
  es.emitirCredencialRealtime({
    gate: { ok: true, typ: "cliente", role: "cliente", cpf: "123", sid: "s1" },
    forcarTeste: true,
    jwk: privateJwk,
    kid,
  }).status,
  403
);

/** gates produção bloqueiam sem forcarTeste */
const bloqueado = es.emitirCredencialRealtime({
  gate: gateOk,
  jwk: privateJwk,
  kid,
  env: {
    DK_REALTIME_SINAL: "0",
    DK_REALTIME_ES256_TRUSTED: "0",
    DK_REALTIME_ES256_JWK: JSON.stringify(privateJwk),
    DK_REALTIME_ES256_KID: kid,
  },
});
assert.equal(bloqueado.ok, false);
assert.equal(bloqueado.body.reason, "REALTIME_AUTH_BLOCKED");
assert.ok(String(bloqueado.body.requisito_ausente).includes("DK_REALTIME_SINAL"));

const pronto = es.emissorPronto({
  DK_REALTIME_SINAL: "0",
  DK_REALTIME_ES256_TRUSTED: "0",
});
assert.equal(pronto.ok, false);
assert.ok(pronto.falta.includes("DK_REALTIME_ES256_JWK"));

/** Handler HTTP continua bloqueado sem gates (mock sessão) */
const Module = require("module");
const handlerPath = path.join(root, "api", "dk-realtime-credencial.js");
const abs = require.resolve(handlerPath);
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (String(request).includes("dk-portal-auth.cjs") || String(request).endsWith("dk-portal-auth.cjs")) {
    return {
      applyApiCors() {},
      async requireLiveSession() {
        return { ok: true, typ: "equipa", role: "owner", cpf: "39072202866", sid: "sid-http" };
      },
      assertEquipaClientProtocol() {
        return { ok: true };
      },
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
      async readSessaoAtiva() {
        return { at: Date.now(), sid: "sid-http", ip: "", deviceId: "" };
      },
      TITULAR_CEO_CPF: "39072202866",
    };
  }
  return original(request, parent, isMain);
};
try {
  delete require.cache[abs];
  delete require.cache[require.resolve("../lib/dk-realtime-jwt-es256.cjs")];
  const handler = require(handlerPath);
  let status = 0;
  let body = null;
  await handler(
    { method: "GET", headers: {} },
    {
      setHeader() {},
      status(c) {
        status = c;
        return this;
      },
      json(p) {
        body = p;
        return p;
      },
    }
  );
  assert.equal(status, 503);
  assert.ok(
    body.reason === "REALTIME_AUTH_BLOCKED" || body.reason === "SCOPE_ISOLATION_BLOCKED",
    JSON.stringify(body)
  );
  assert.ok(!body.token);
} finally {
  Module._load = original;
  delete require.cache[abs];
}

/** Duas sessões simuladas: A emite claims; B catch-up; edição preservada */
const syncSrc = fs.readFileSync(path.join(root, "portal-dk-sync.js"), "utf8");
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

const storeB = new Map();
const winB = {
  sessionStorage: {
    getItem: (k) => (storeB.has(k) ? storeB.get(k) : null),
    setItem: (k, v) => storeB.set(k, String(v)),
    removeItem: (k) => storeB.delete(k),
  },
  __DK_portalSessao: { cpf: "22222222222", sid: "B" },
  __DK_locacaoFormularioSujo: true,
  __DK_locacaoPgRecarregar: async () => ({ ok: true }),
  CustomEvent: function (name, init) {
    this.type = name;
    this.detail = init && init.detail;
  },
  dispatchEvent() {
    return true;
  },
  document: { activeElement: null },
};
let conflito = 0;
winB.addEventListener = () => {};
winB.dispatchEvent = function (ev) {
  if (ev && ev.type === "dk:sync:conflito-edicao") conflito += 1;
  return true;
};

const eventos = [
  { seq: 10, audit_no: 10, event_type: "locacao.updated", entity_type: "locacao", module: "locacao" },
];
const apiB = loadSync(winB, async (url) => {
  if (String(url).includes("dk-realtime-credencial")) {
    return { ok: false, status: 503, async json() { return { ok: false, reason: "REALTIME_AUTH_BLOCKED" }; } };
  }
  const after = Number((/after=(\d+)/.exec(String(url)) || [])[1] || 0);
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, server_event_seq: 10, events: eventos.filter((e) => e.seq > after), has_more: false };
    },
  };
});
const r = await apiB.dkSyncCatchUp("sim");
assert.equal(r.ok, true);
assert.equal(apiB.dkSyncGetStatus().lastAppliedSeq, 10);
assert.ok(conflito >= 1, "edição aberta deve sinalizar conflito");
const rt = await apiB.dkSyncTentarRealtime();
assert.equal(rt.ok, false);

/** Apagar material fictício da memória (não há ficheiros de chave) */
privateJwk.d = "apagado";
publicJwk.x = "apagado";

console.log("ok dk-realtime-es256 ficticio");
