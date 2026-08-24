/**
 * Garante que cliente, veículo, locação e pagamento não desaparecem
 * num snapshot menor (Redis/Supabase).
 *   node grupodkempreendimentos/scripts/test-never-lose-cadastro.mjs
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { neverLoseCadastroPayload } = require(path.join(root, "lib/dk-append-only-merge.cjs"));
const api = require(path.join(root, "api/dk-cloud-snapshot.js"));

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} | ${name}`);
  if (!cond) failed += 1;
}

const existing = {
  dk_clientes_cadastro: [{ cpf: "02357896582", nome: "HEMERSON" }],
  dk_veiculos_cadastro: [{ placa: "QYR9B66", modelo: "X" }],
  dk_locacoes_cadastro: [
    {
      numeroContrato: "2026072401",
      origemPortal: true,
      portalLancamentosAluguel: [
        {
          data: "31/07/2026",
          valor: 300,
          createdAt: 1,
          protocoloLancamento: "20260823222003-030",
        },
      ],
    },
  ],
};
const incoming = {
  dk_clientes_cadastro: [],
  dk_veiculos_cadastro: [],
  dk_locacoes_cadastro: [
    { numeroContrato: "2026072401", origemPortal: true, portalLancamentosAluguel: [] },
  ],
};
const out = neverLoseCadastroPayload(existing, incoming);
check(
  "cliente nao some",
  out.dk_clientes_cadastro.some((c) => c.cpf === "02357896582")
);
check(
  "veiculo nao some",
  out.dk_veiculos_cadastro.some((v) => String(v.placa).toUpperCase() === "QYR9B66")
);
check(
  "locacao nao some",
  out.dk_locacoes_cadastro.some((l) => String(l.numeroContrato) === "2026072401")
);
check(
  "pagamento nao some",
  Array.isArray(out.dk_locacoes_cadastro[0]?.portalLancamentosAluguel) &&
    out.dk_locacoes_cadastro[0].portalLancamentosAluguel.length === 1
);

const locPortal = {
  numeroContrato: "2026072401",
  origemPortal: true,
  dataCadastro: "24/07/2026",
};
const sanitized = api.sanitizePayloadForOficial({ dk_locacoes_cadastro: [locPortal] });
check("sanitize mantem locacao origemPortal", sanitized.dk_locacoes_cadastro.length === 1);

const capped = api.capOficialVirginProtocolos(
  { dk_oficial_sem_protocolos_v1: true, dk_locacoes_cadastro: [locPortal] },
  { dk_oficial_sem_protocolos_v1: true, dk_locacoes_cadastro: [locPortal] }
);
check("virgin cap mantem origemPortal", capped.dk_locacoes_cadastro.length === 1);

const planilha = { numeroContrato: "2026081901", origemPlanilha: true };
const cappedPlanilha = api.capOficialVirginProtocolos(
  { dk_oficial_sem_protocolos_v1: true, dk_locacoes_cadastro: [] },
  { dk_oficial_sem_protocolos_v1: true, dk_locacoes_cadastro: [planilha] }
);
check("virgin cap remove planilha", cappedPlanilha.dk_locacoes_cadastro.length === 0);

const keepExisting = api.sanitizePayloadForOficial(
  {
    dk_locacoes_cadastro: [{ numeroContrato: "2026072401", dataCadastro: "24/07/2026" }],
  },
  "2026-06-10",
  api.cadastroKeepSetsFromPayload({
    dk_locacoes_cadastro: [{ numeroContrato: "2026072401" }],
  })
);
check(
  "sanitize mantem protocolo ja gravado na nuvem",
  keepExisting.dk_locacoes_cadastro.length === 1
);

console.log(`\n--- ${failed ? "FAIL" : "OK"} ---`);
process.exit(failed ? 1 : 0);
