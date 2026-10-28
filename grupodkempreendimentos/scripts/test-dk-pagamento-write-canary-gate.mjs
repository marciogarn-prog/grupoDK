import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..");
const gate = require("../lib/dk-pagamento-write-canary.cjs");
const store = require("../lib/dk-pagamento-locacao-store.cjs");

const pagamento = {
  data: "28/10/2026",
  valor: 10,
  protocoloLancamento: "20261028010101-001",
  tipoMovimento: "PAGAMENTO",
};
const ligado = { DK_PAGAMENTO_FRACTIONATED_WRITE_CANARY: "1" };
const e2e = {
  autenticado: true,
  numeroContrato: "2026102701",
  pagamento,
};
const real = { ...e2e, numeroContrato: "2025111403" };

assert.strictEqual(String(process.env.DK_PAGAMENTO_FRACTIONATED_WRITE_CANARY || "").trim(), "");
assert.strictEqual(gate.flagLigada(process.env), false);
assert.strictEqual(gate.flagLigada({}), false);
assert.strictEqual(gate.flagLigada({ DK_PAGAMENTO_FRACTIONATED_WRITE_CANARY: "true" }), false);
assert.strictEqual(gate.CONTRATO_CANARIO, "2026102701");

function bloqueado(pedido, env, status, reason) {
  const out = gate.avaliarEscritaCanario(pedido, env);
  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.passar, false);
  assert.strictEqual(out.status, status);
  assert.strictEqual(out.reason, reason);
  assert.strictEqual(out.mutated, false);
  assert.strictEqual(out.fallback, false);
  assert.strictEqual(out.legado, false);
  assert.strictEqual(out.inserted, 0);
  return out;
}

bloqueado({ ...e2e, operacao: "create" }, {}, 405, "write_canary_disabled");
bloqueado({ ...e2e, operacao: "update", version: 3 }, {}, 405, "write_canary_disabled");
bloqueado({ ...e2e, operacao: "remove", version: 3, id: "11111111-1111-4111-8111-111111111111" }, {}, 405, "write_canary_disabled");
bloqueado({ ...e2e, operacao: "create", canary: true }, {}, 405, "write_canary_disabled");
const comCanary = gate.avaliarEscritaCanario({ ...e2e, operacao: "create", canary: true }, ligado);
const semCanary = gate.avaliarEscritaCanario({ ...e2e, operacao: "create" }, ligado);
assert.strictEqual(comCanary.passar, true);
assert.deepStrictEqual(comCanary, semCanary);

const semAuth = gate.avaliarEscritaCanario({ ...e2e, operacao: "create", autenticado: false, canary: true }, ligado);
assert.strictEqual(semAuth.status, 401);
assert.strictEqual(semAuth.reason, "unauthorized");

bloqueado({ ...real, operacao: "create", canary: true, contratos: ["2025111403"] }, ligado, 403, "write_canary_contract_not_allowed");
bloqueado({ ...real, operacao: "update", version: 2, canary: true }, ligado, 403, "write_canary_contract_not_allowed");
bloqueado(
  { ...real, operacao: "remove", version: 2, id: "11111111-1111-4111-8111-111111111111", canary: true },
  ligado,
  403,
  "write_canary_contract_not_allowed"
);
bloqueado({ ...e2e, operacao: "apagar" }, ligado, 400, "acao_invalida");
bloqueado({ ...e2e, operacao: "update" }, ligado, 400, "version_required");
bloqueado({ ...e2e, operacao: "remove", id: "11111111-1111-4111-8111-111111111111" }, ligado, 400, "version_required");
bloqueado({ ...e2e, operacao: "update", version: 2, versionAtual: 1 }, ligado, 409, "version_conflict");
bloqueado({ ...e2e, operacao: "create", existentes: [pagamento] }, ligado, 409, "duplicate_payment_same_day_value");

for (const op of ["create", "update", "remove"]) {
  const pedido = { ...e2e, operacao: op, version: op === "create" ? undefined : 3, id: "11111111-1111-4111-8111-111111111111" };
  const out = gate.avaliarEscritaCanario(pedido, ligado);
  assert.strictEqual(out.passar, true, op);
  assert.strictEqual(out.contrato, "2026102701");
  assert.strictEqual(out.fallback, false);
}

let chamadas = 0;
let mutacoes = 0;
const engine = async () => {
  chamadas += 1;
  return { ok: true, status: 200, inserted: 1 };
};
for (const op of ["create", "update", "remove"]) {
  const out = await gate.aplicarEscritaCanario(
    { ...e2e, operacao: op, version: 3, id: "11111111-1111-4111-8111-111111111111" },
    { env: ligado, engine }
  );
  assert.strictEqual(out.passouGate, true);
  assert.strictEqual(out.engine, true);
  assert.strictEqual(out.inserted, 0);
  assert.strictEqual(out.updated, 0);
  assert.strictEqual(out.deleted, 0);
  assert.strictEqual(out.mutated, false);
  assert.strictEqual(out.fallback, false);
  assert.strictEqual(out.legado, false);
}
assert.strictEqual(chamadas, 3);
assert.strictEqual(mutacoes, 0);

chamadas = 0;
for (const op of ["create", "update", "remove"]) {
  const out = await gate.aplicarEscritaCanario({ ...real, operacao: op, version: 3, id: "11111111-1111-4111-8111-111111111111" }, { env: ligado, engine });
  assert.strictEqual(out.passar, false);
  assert.strictEqual(out.reason, "write_canary_contract_not_allowed");
}
assert.strictEqual(chamadas, 0);

await assert.rejects(
  () => gate.aplicarEscritaCanario({ ...e2e, operacao: "create" }, { env: ligado, engine, fetch: async () => ({}) }),
  /escrita_canario_sem_rede/
);
assert.strictEqual(chamadas, 0);

const httpOff = gate.respostaHttp(gate.avaliarEscritaCanario({ ...e2e, operacao: "create" }, {}));
assert.strictEqual(httpOff.status, 405);
assert.strictEqual(httpOff.body.reason, "write_not_active");
assert.strictEqual(httpOff.body.gate, "write_canary_disabled");
assert.strictEqual(httpOff.body.mutated, false);
const httpOn = gate.respostaHttp(gate.avaliarEscritaCanario({ ...e2e, operacao: "create" }, ligado));
assert.strictEqual(httpOn.status, 405);
assert.strictEqual(httpOn.body.reason, "write_not_active");
assert.strictEqual(httpOn.body.gate, "engine_ausente");
assert.strictEqual(httpOn.body.inserted, 0);

assert.strictEqual(store.gravarUma().reason, "write_not_active");
assert.strictEqual(store.gravarUma().mutated, false);

const api = fs.readFileSync(path.join(raiz, "api", "dk-pagamento-locacao.js"), "utf8");
const authEm = api.indexOf("requirePortalAuth");
const gateEm = api.indexOf("avaliarEscritaCanario");
assert.ok(authEm >= 0 && gateEm > authEm);
assert.ok(!api.includes("body.canary"));
assert.ok(!api.includes("gravarUma"));
assert.ok(!api.includes("localStorage"));

const pagina = fs.readFileSync(path.join(raiz, "portal-pagamento-store.js"), "utf8");
assert.ok(pagina.includes('const MODO_PRODUCAO = "legacy"'));
assert.ok(!pagina.includes("DK_PAGAMENTO_FRACTIONATED_WRITE_CANARY"));

console.log("write canary gate ok");
