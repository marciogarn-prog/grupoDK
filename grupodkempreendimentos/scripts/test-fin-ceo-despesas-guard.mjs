/**
 * FINANCEIRO CEO: despesas não podem ser apagadas pelo filtro oficial (dataEvento/cadastradoEm).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = readFileSync(join(root, "dk-oficial-cadastro-guard.js"), "utf8");
const sandbox = {
  window: { __DK_IS_DEMO_DEPLOY__: false },
  console,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const filter = sandbox.window.__DK_filterOficialCadastroArray;

const sample = [
  {
    id: "ceo-desp-1756780000000-abc12",
    categoria: "DK_LOCADORA",
    rubrica: "ALUGUEL",
    periodic: true,
    valor: 4000,
    repeticoes: 4,
    dataEvento: "10/09/2026",
    cadastradoEm: "2026-09-01T12:00:00.000Z",
  },
];

const out = filter("dk_financeiro_ceo_despesas_v1", sample);
if (!Array.isArray(out) || out.length !== 1 || out[0].valor !== 4000) {
  console.error("FALHOU: filtro oficial removeu despesa CEO", out);
  process.exit(1);
}

const clientes = filter("dk_clientes_cadastro", [{ cpf: "00000000001", nome: "TESTE" }]);
if (clientes.length !== 0) {
  console.error("FALHOU: filtro de clientes demo deveria bloquear CPF 00000000001");
  process.exit(1);
}

console.log("OK: FINANCEIRO CEO despesas passam pelo guard; cadastros operacionais continuam filtrados.");
