/**
 * Lote do calendário: vários dias gravados no mesmo segundo não podem
 * perder pagamentos por protocolo repetido.
 * node grupodkempreendimentos/scripts/test-calendario-protocolo-lote.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const protoJs = fs.readFileSync(path.join(ROOT, "dk-lancamento-protocolo.js"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const uiJs = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

record(
  "calendário grava cada dia com 1 segundo de diferença",
  uiJs.includes("const createdAt = now0 + tick * 1000"),
  ""
);
record(
  "app.js não apaga pagamento de outra data com o mesmo protocolo",
  appJs.includes("samePay") && appJs.includes("__DK_nextUniqueProtocoloLancamento"),
  ""
);
record(
  "protocolo avança 1 segundo até ficar único",
  protoJs.includes("t += 1000") && protoJs.includes("attempt < 999") && protoJs.includes("__DK_nextUniqueProtocoloLancamento"),
  ""
);

const store = new Map();
const sandbox = {
  window: {
    location: { hostname: "grupodkempreendimentos.com.br" },
    __DK_IS_DEMO_DEPLOY__: false,
  },
  document: { readyState: "complete", addEventListener() {} },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(String(k), String(v)),
    removeItem: (k) => store.delete(String(k)),
  },
  console,
};
sandbox.window.window = sandbox.window;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(protoJs, sandbox);

const t0 = Date.parse("2026-09-14T17:30:00-03:00");
const cpfOp = "12345678901";
const proto = sandbox.window.__DK_gerarProtocoloLancamento(cpfOp, t0);
const loc = {
  cpf: "06523244440",
  numeroContrato: "2025010101",
  placa: "ABC1D23",
  portalLancamentosAluguel: [
    {
      data: "23/10/2025",
      valor: 350,
      createdAt: t0,
      registradoPorCpf: cpfOp,
      registradoPorNome: "Lucelina",
      protocoloLancamento: proto,
    },
    {
      data: "01/11/2025",
      valor: 350,
      createdAt: t0 + 1,
      registradoPorCpf: cpfOp,
      registradoPorNome: "Lucelina",
      protocoloLancamento: proto,
    },
    {
      data: "07/11/2025",
      valor: 350,
      createdAt: t0 + 2,
      registradoPorCpf: cpfOp,
      registradoPorNome: "Lucelina",
      protocoloLancamento: proto,
    },
  ],
};

const merged = sandbox.window.__DK_consolidarLancamentosAluguelLoc(loc, { mutate: true });
const datas = (merged || []).map((x) => String(x.data || "")).sort().join(",");
const protos = new Set((merged || []).map((x) => String(x.protocoloLancamento || "")));
record(
  "consolidar mantém os 3 dias do lote com protocolos distintos",
  Array.isArray(merged) && merged.length === 3 && protos.size === 3,
  `n=${merged?.length || 0} protos=${protos.size} datas=${datas}`
);
record(
  "datas 23/10, 01/11 e 07/11 sobrevivem",
  datas.includes("23/10/2025") && datas.includes("01/11/2025") && datas.includes("07/11/2025"),
  datas
);
record(
  "index cache-bust calendário protocolo",
  indexHtml.includes("dk-lancamento-protocolo.js?v=20260915readd") &&
    indexHtml.includes("app.js?v=20260915readd") &&
    indexHtml.includes("portal-locadora-ui.js?v=20260915rel6ceo"),
  ""
);

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} testes lote calendário ---\n`);
process.exit(ok === results.length ? 0 : 1);
