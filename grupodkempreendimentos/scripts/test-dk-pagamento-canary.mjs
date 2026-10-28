/**
 * Canário de leitura: desligado por padrão, compara sem substituir a tela e não quebra se a fonte nova falhar.
 */
import fs from "fs";
import vm from "vm";
import assert from "assert";
import { createHash } from "crypto";

function hash(arr) {
  return createHash("sha256").update(JSON.stringify(arr), "utf8").digest("hex");
}

function carregar(fetchImpl) {
  const codigo = fs.readFileSync(new URL("../portal-pagamento-canary.js", import.meta.url), "utf8");
  const sandbox = {
    window: {},
    crypto: globalThis.crypto,
    TextEncoder,
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    encodeURIComponent,
  };
  sandbox.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(codigo, sandbox);
  return sandbox.window;
}

function resposta(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

async function main() {
  const ui = fs.readFileSync(new URL("../portal-locadora-ui.js", import.meta.url), "utf8");
  assert.ok(ui.includes("window.__DK_PAGAMENTO_READ_CANARY__ === true"));
  assert.ok(!ui.includes("window.__DK_PAGAMENTO_READ_CANARY__ = true"));

  const chamadas = [];
  const antigo = [{ data: "01/03/2026", valor: 350, protocoloLancamento: "20260101010101-001" }];
  const removido = [{ data: "02/03/2026", valor: 10, protocoloLancamento: "20260101010102-001", removedAt: "1" }];
  const winOff = carregar(async (url) => {
    chamadas.push(url);
    return resposta({ ok: true, pagamentos: [] });
  });
  const semFlag = await winOff.__DK_pagamentoCanaryComparar({ numeroContrato: "2025111403", portalLancamentosAluguel: antigo });
  assert.strictEqual(semFlag, null);
  assert.strictEqual(chamadas.length, 0);

  const win = carregar(async (url) => {
    chamadas.push(String(url));
    if (String(url).includes("scope=removidos")) return resposta({ ok: true, pagamentos: removido });
    return resposta({ ok: true, pagamentos: antigo });
  });
  win.__DK_PAGAMENTO_READ_CANARY__ = true;
  const loc = { numeroContrato: "2025111403", portalLancamentosAluguel: antigo.slice(), portalLancamentosAluguelRemovidos: removido.slice() };
  const antes = JSON.stringify(loc);
  const ok = await win.__DK_pagamentoCanaryComparar(loc);
  assert.strictEqual(JSON.stringify(loc), antes);
  assert.strictEqual(ok.match, true);
  assert.strictEqual(ok.ativosOld, 1);
  assert.strictEqual(ok.ativosNew, 1);
  assert.strictEqual(ok.removidosOld, 1);
  assert.strictEqual(ok.removidosNew, 1);
  assert.strictEqual(ok.hashAtivosOld, hash(antigo));
  assert.strictEqual(ok.hashAtivosNew, hash(antigo));
  assert.strictEqual(ok.sourceOld, "portalLancamentosAluguel");
  assert.strictEqual(ok.sourceNew, "dk_pagamento_locacao");
  assert.strictEqual(JSON.stringify(ok.metodos), JSON.stringify(["GET", "GET"]));
  assert.ok(!ok.erro);

  const winErro = carregar(async () => {
    const err = new Error("abort");
    err.name = "AbortError";
    throw err;
  });
  winErro.__DK_PAGAMENTO_READ_CANARY__ = true;
  const falha = await winErro.__DK_pagamentoCanaryComparar({
    numeroContrato: "2025111403",
    portalLancamentosAluguel: antigo,
    portalLancamentosAluguelRemovidos: [],
  });
  assert.strictEqual(falha.match, false);
  assert.strictEqual(falha.erro, "supabase_timeout");
  assert.strictEqual(falha.ativosOld, 1);
  assert.strictEqual(falha.sourceOld, "portalLancamentosAluguel");

  const winE2e = carregar(async (url) => {
    if (String(url).includes("scope=removidos")) {
      return resposta({ ok: true, pagamentos: [{ valor: 1.02, protocoloLancamento: "20261028020219-030", removedAt: "1793165957298" }] });
    }
    return resposta({ ok: true, pagamentos: [] });
  });
  winE2e.__DK_PAGAMENTO_READ_CANARY__ = true;
  const delta = await winE2e.__DK_pagamentoCanaryComparar({
    numeroContrato: "2026102701",
    portalLancamentosAluguel: [],
    portalLancamentosAluguelRemovidos: [],
  });
  assert.strictEqual(delta.expectedE2eDelta, true);
  assert.strictEqual(delta.match, false);
  assert.strictEqual(delta.ativosOld, 0);
  assert.strictEqual(delta.ativosNew, 0);
  assert.strictEqual(delta.removidosOld, 0);
  assert.strictEqual(delta.removidosNew, 1);

  console.log("canario leitura ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
