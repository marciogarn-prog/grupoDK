/**
 * Pacotes por tipo e por dia não apagam o histórico.
 * node scripts/test-dk-pacotes.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pacotes = require(path.join(ROOT, "portal-pacotes.js"));

let failed = 0;
function ok(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} | ${name}`);
  if (!cond) failed += 1;
}

const nuvem = {
  dk_clientes_cadastro: [
    { cpf: "11111111111", nome: "ANTIGO", updatedAt: "2026-01-01T10:00:00.000Z" },
    { cpf: "22222222222", nome: "HOJE", updatedAt: "2026-10-08T12:00:00.000Z" },
  ],
  dk_lancamentos_aluguel: [
    { id: "p1", data: "07/10/2026", valor: 100 },
    { id: "p2", data: "08/10/2026", valor: 50 },
  ],
  dk_cliente_docs_v1: {
    "11111111111": { residencia: { nome: "a.jpg", data: "data:image/jpeg;base64,AAAA" } },
  },
};

const extraido = pacotes.extrairPacoteDia(nuvem, "2026-10-08");
ok("o dia só traz o lançamento de hoje", extraido.payload.dk_lancamentos_aluguel.length === 1 && extraido.payload.dk_lancamentos_aluguel[0].id === "p2");
ok("o dia não traz o lançamento de ontem", !extraido.payload.dk_lancamentos_aluguel.some((r) => r.id === "p1"));
ok("a ficha tocada hoje entra no pacote", extraido.payload.dk_clientes_cadastro.length === 1 && extraido.payload.dk_clientes_cadastro[0].cpf === "22222222222");
ok("a ficha antiga não entra no pacote do dia", !extraido.payload.dk_clientes_cadastro.some((r) => r.cpf === "11111111111"));
ok("o ficheiro do cliente não vai dentro do pacote do dia", extraido.payload.dk_cliente_docs_v1 == null);

const local = {
  dk_clientes_cadastro: [{ cpf: "11111111111", nome: "ANTIGO", updatedAt: "2026-01-01T10:00:00.000Z" }],
  dk_lancamentos_aluguel: [
    { id: "p1", data: "07/10/2026", valor: 100 },
    { id: "p2", data: "08/10/2026", valor: 40, arquivoBase64: "data:image/jpeg;base64,BBBB" },
  ],
};
const fundido = pacotes.fundirPacoteDia(local, "2026-10-08", {
  dk_lancamentos_aluguel: [{ id: "p2", data: "08/10/2026", valor: 50 }],
  dk_clientes_cadastro: [{ cpf: "22222222222", nome: "NOVO", updatedAt: "2026-10-08T12:00:00.000Z" }],
});
ok("ontem permanece no pc", fundido.dk_lancamentos_aluguel.some((r) => r.id === "p1" && r.valor === 100));
ok("o pagamento de hoje atualiza", fundido.dk_lancamentos_aluguel.some((r) => r.id === "p2" && r.valor === 50));
ok("a imagem de hoje não se perde quando o pacote vem sem ela", fundido.dk_lancamentos_aluguel.find((r) => r.id === "p2").arquivoBase64.startsWith("data:"));
ok("o cliente antigo permanece", fundido.dk_clientes_cadastro.some((r) => r.cpf === "11111111111"));
ok("o cliente novo entra", fundido.dk_clientes_cadastro.some((r) => r.cpf === "22222222222" && r.nome === "NOVO"));

const vazio = pacotes.fundirPacoteDia(local, "2026-10-08", { dk_lancamentos_aluguel: [] });
ok("um pacote vazio do dia não apaga o pagamento de hoje", vazio.dk_lancamentos_aluguel.some((r) => r.id === "p2"));
ok("um pacote vazio do dia não apaga ontem", vazio.dk_lancamentos_aluguel.some((r) => r.id === "p1"));

const comFicheiro = pacotes.fundirFicheiro(nuvem, "dk_cliente_docs_v1", {
  cpf: "22222222222",
  tipo: "cnh",
  nome: "cnh.pdf",
  data: "data:application/pdf;base64,CCCC",
});
ok("o ficheiro novo não apaga o comprovante antigo", comFicheiro.dk_cliente_docs_v1["11111111111"].residencia.data.startsWith("data:"));
ok("o ficheiro novo fica no cpf certo", comFicheiro.dk_cliente_docs_v1["22222222222"].cnh.nome === "cnh.pdf");

const fichaA = { cpf: "12345678901", codigo: "418", nome: "Ana", celular: "(87) 99999-0000", status: "ATIVO" };
const fichaB = { cpf: "123.456.789-01", codigo: "0418", nome: " ana ", celular: "87999990000", status: "" };
ok("cpf e código iguais contam como a mesma ficha", pacotes.listasClientesIguais([fichaA], [fichaB]));
ok("nome diferente não conta como igual", !pacotes.listasClientesIguais([fichaA], [{ ...fichaB, nome: "Bia" }]));
ok("cliente só no PC não conta como igual", !pacotes.listasClientesIguais([fichaA, { cpf: "10987654321", nome: "Novo", codigo: "419" }], [fichaB]));

console.log(failed ? `FAIL ${failed}` : "OK pacotes");
process.exit(failed ? 1 : 0);
