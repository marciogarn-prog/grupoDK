/**
 * Garante que disponivelCategoria segue o updatedAt mais recente no merge
 * (evita um PC mostrar moto disponível e outro não).
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import vm from "vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(import.meta.url);

const mergeCjs = require(join(root, "lib/dk-append-only-merge.cjs"));

function loadMergeCadastroVeiculoHistorico() {
  const src = readFileSync(join(root, "app.js"), "utf8");
  const start = src.indexOf("function cadastroRecordScore(");
  const end = src.indexOf("\nfunction mergeCadastroHistoricoImutavel(");
  if (start < 0 || end < 0) throw new Error("não encontrou mergeCadastroVeiculoHistorico em app.js");
  const chunk = src.slice(start, end);
  const sandbox = {
    normalizePlate: (p) =>
      String(p || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
  };
  vm.createContext(sandbox);
  vm.runInContext(chunk + "\nthis.mergeCadastroVeiculoHistorico = mergeCadastroVeiculoHistorico;", sandbox);
  return sandbox.mergeCadastroVeiculoHistorico;
}

const merge = loadMergeCadastroVeiculoHistorico();
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

const localNovo = {
  placa: "ABC1D23",
  disponivelCategoria: "prontos",
  updatedAt: 2_000,
  origemPortal: true,
  cadastradoPorCpf: "03037897430",
  cadastradoPorNome: "TESTE",
};
const nuvemVelha = {
  placa: "ABC1D23",
  disponivelCategoria: "reserva-patio",
  updatedAt: 1_000,
  origemPortal: true,
  cadastradoPorCpf: "03037897430",
  cadastradoPorNome: "TESTE",
};

const m1 = merge(localNovo, nuvemVelha);
ok(m1.disponivelCategoria === "prontos", "local mais novo vence nuvem antiga (prontos)");

const m2 = merge(nuvemVelha, localNovo);
ok(m2.disponivelCategoria === "prontos", "incoming mais novo vence (prontos)");

const emManut = { placa: "ABC1D23", updatedAt: 3_000, origemPortal: true };
delete emManut.disponivelCategoria;
const m3 = merge(localNovo, emManut);
ok(!m3.disponivelCategoria, "registo mais novo sem categoria limpa a marca disponível");

const server = mergeCjs.mergeVeiculosCadastro([nuvemVelha], [localNovo]);
ok(
  server.length === 1 && server[0].disponivelCategoria === "prontos",
  "mergeVeiculosCadastro (servidor) também preserva prontos"
);

if (failed) {
  console.error(`\n${failed} falha(s)`);
  process.exit(1);
}
console.log("\nmerge disponivelCategoria: OK");
