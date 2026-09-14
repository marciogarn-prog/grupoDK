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
const lixo = filter("dk_clientes_cadastro", [
  { cpf: "06523244440", nome: "MARCUS", codigo: "0628" },
  { cpf: "04292253420", nome: "ANA PAULA", codigo: "0629" },
  { cpf: "07534147409", nome: "Cliente demo", codigo: "7409" },
  { cpf: "00445040556", nome: "NILZA", codigo: "7411" },
  { cpf: "01503608514", nome: "OTAVIO", codigo: "7410" },
  { cpf: "06242649551", nome: "FELIPE", codigo: "0001" },
]);
const otavioCanon = lixo.find((c) => String(c.cpf || "").replace(/\D/g, "") === "01503608514");
const felipe = lixo.find((c) => String(c.codigo || "").trim() === "0001");
if (lixo.length !== 2 || !felipe || !otavioCanon || String(otavioCanon.codigo) !== "0315") {
  console.error("FALHOU: lixo 0628/0629/7409/7411 sai; Otávio fica como 0315", lixo);
  process.exit(1);
}
const locOtavio = filter("dk_locacoes_cadastro", [
  {
    cpf: "01503608514",
    nome: "OTAVIO",
    numeroContrato: "2026052002",
    placa: "UHK3J59",
    inicio: "20/05/2026",
    origemPortal: true,
  },
]);
if (locOtavio.length !== 1 || String(locOtavio[0].numeroContrato) !== "2026052002") {
  console.error("FALHOU: locação real 2026052002 deveria passar", locOtavio);
  process.exit(1);
}

console.log("OK: FINANCEIRO CEO despesas passam pelo guard; cadastros operacionais continuam filtrados.");
