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
const { neverLoseCadastroPayload, mergeFuncionariosAccess } = require(path.join(root, "lib/dk-append-only-merge.cjs"));
const api = require(path.join(root, "api/dk-cloud-snapshot.js"));

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} | ${name}`);
  if (!cond) failed += 1;
}

const existing = {
  dk_clientes_cadastro: [{ cpf: "02357896582", nome: "HEMERSON" }],
  dk_veiculos_cadastro: [{ placa: "QYR9B66", modelo: "X", cadastradoPorCpf: "03037897430" }],
  dk_locacoes_cadastro: [
    {
      numeroContrato: "2026072401",
      origemPortal: true,
      cpf: "02357896582",
      placa: "QYR9B66",
      nome: "HEMERSON",
      inicio: "24/07/2026",
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
    {
      numeroContrato: "2026072401",
      origemPortal: true,
      cpf: "02357896582",
      placa: "QYR9B66",
      portalLancamentosAluguel: [],
    },
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

const colabExisting = {
  dk_funcionarios_access: [
    { cpf: "03037897430", nome: "Márcio Santos", role: "owner", senha: "x" },
    { cpf: "80163513104", nome: "JESIMIEL DE LIMA MATIAS", role: "operacao", senha: "a" },
    { cpf: "09831728548", nome: "WYLKALINE CONCEIÇÃO", role: "operacao", senha: "b" },
  ],
};
const colabIncoming = {
  dk_funcionarios_access: [
    { cpf: "03037897430", nome: "Márcio Santos", role: "owner", senha: "x" },
    { cpf: "00445040556", nome: "Nilza Santos", role: "operacao", senha: "c" },
    { cpf: "06523244440", nome: "Marcus Santos", role: "owner", senha: "d" },
  ],
};
const colabOut = neverLoseCadastroPayload(colabExisting, colabIncoming);
const colabCpfs = (colabOut.dk_funcionarios_access || []).map((f) => String(f.cpf || "").replace(/\D/g, ""));
check("colaborador Jesimiel nao some no snapshot menor", colabCpfs.includes("80163513104"));
check("colaborador Wylkaline nao some no snapshot menor", colabCpfs.includes("09831728548"));
check("semente Nilza entra na uniao", colabCpfs.includes("00445040556"));

const despExisting = {
  dk_financeiro_ceo_despesas_v1: [
    { id: "ceo-marcus-1", descricao: "PRO-LABORE MARCUS", valor: 17000, categoria: "DK_LOCADORA" },
    { id: "ceo-outro-2", descricao: "ALUGUEL", valor: 5000, categoria: "DK_LOCADORA" },
  ],
};
const despIncoming = { dk_clientes_cadastro: [] };
const despOut = neverLoseCadastroPayload(despExisting, despIncoming);
check(
  "despesa CEO nao some se o outro PC nao enviar a chave",
  Array.isArray(despOut.dk_financeiro_ceo_despesas_v1) &&
    despOut.dk_financeiro_ceo_despesas_v1.some((d) => d.id === "ceo-marcus-1") &&
    despOut.dk_financeiro_ceo_despesas_v1.some((d) => d.id === "ceo-outro-2")
);
const despWipe = neverLoseCadastroPayload(despExisting, { dk_financeiro_ceo_despesas_v1: [] });
check(
  "despesa CEO nao some se o snapshot vier vazio",
  Array.isArray(despWipe.dk_financeiro_ceo_despesas_v1) && despWipe.dk_financeiro_ceo_despesas_v1.length === 2
);
const sitExisting = {
  dk_financeiro_ceo_situacao_pag_v1: [
    { chave: "ceo-marcus-1#1#10/09/2026", situacao: "PAGO", pagoEm: "2026-09-10T18:00:00.000Z" },
  ],
};
const sitWipe = neverLoseCadastroPayload(sitExisting, { dk_financeiro_ceo_situacao_pag_v1: [] });
check(
  "confirmacao PAGO nao some se o snapshot vier sem id (une por chave)",
  Array.isArray(sitWipe.dk_financeiro_ceo_situacao_pag_v1) &&
    sitWipe.dk_financeiro_ceo_situacao_pag_v1.some(
      (r) => r.chave === "ceo-marcus-1#1#10/09/2026" && r.situacao === "PAGO"
    )
);
const sitMerge = neverLoseCadastroPayload(sitExisting, {
  dk_financeiro_ceo_situacao_pag_v1: [
    { chave: "ceo-marcus-1#1#10/09/2026", situacao: "A_PAGAR", pagoEm: "" },
    { chave: "ceo-outro-2#1#10/09/2026", situacao: "PAGO", pagoEm: "2026-09-10T19:00:00.000Z" },
  ],
});
check(
  "PAGO do Marcus vence A PAGAR do outro PC na mesma chave",
  Array.isArray(sitMerge.dk_financeiro_ceo_situacao_pag_v1) &&
    sitMerge.dk_financeiro_ceo_situacao_pag_v1.some(
      (r) => r.chave === "ceo-marcus-1#1#10/09/2026" && r.situacao === "PAGO"
    ) &&
    sitMerge.dk_financeiro_ceo_situacao_pag_v1.some(
      (r) => r.chave === "ceo-outro-2#1#10/09/2026" && r.situacao === "PAGO"
    )
);
const mergedColab = mergeFuncionariosAccess(colabExisting.dk_funcionarios_access, colabIncoming.dk_funcionarios_access);
check(
  "merge por CPF une 5 colaboradores",
  mergedColab.length === 5
);

const locPortal = {
  numeroContrato: "2026072401",
  origemPortal: true,
  dataCadastro: "24/07/2026",
  cpf: "02357896582",
  placa: "QYR9B66",
  nome: "HEMERSON",
  inicio: "24/07/2026",
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
    dk_locacoes_cadastro: [
      {
        numeroContrato: "2026072401",
        dataCadastro: "24/07/2026",
        cpf: "02357896582",
        placa: "QYR9B66",
        nome: "HEMERSON",
        inicio: "24/07/2026",
      },
    ],
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
