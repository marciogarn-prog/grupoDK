import { createRequire } from "module";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.DK_PORTAL_API_SECRET && !process.env.DK_BACKUP_SEND_SECRET && !process.env.CRON_SECRET) {
  process.env.DK_PORTAL_API_SECRET = "segredo-de-teste-iter28";
}

const auth = require(path.join(dir, "../lib/dk-portal-auth.cjs"));
const pg = require(path.join(dir, "../lib/dk-locacao-pg.cjs"));
const diretorio = [
  { cpf: "22222222222", role: "operacao", acessos: { locacao: true } },
  { cpf: "33333333333", role: "operacao", acessos: { locacao: false } },
];
let consultasDiretorio = 0;
auth.loadOfficialSnapshotPayload = async () => {
  consultasDiretorio += 1;
  return { dk_funcionarios_access: diretorio };
};
pg.obterFonteLocacoes = async () => pg.FONTE_LOCACAO;
const capturas = [];
function decidir(pedido) {
  const decidido = pg.decidirAcessoLocacao(pedido.acesso, pedido.funcionarios);
  capturas.push({
    acesso: pedido.acesso,
    funcionarios: pedido.funcionarios,
    decidido,
  });
  if (!decidido.ok) return { ...decidido, linhas_afetadas: 0 };
  return { ok: true, linhas_afetadas: 1, version: 1, id: "uuid-teste" };
}
pg.gravarUma = async (pedido) => decidir(pedido);
pg.excluirUma = async (pedido) => decidir(pedido);
pg.listar = async () => ({ ok: true, schema: true, ativado: true, migracao: "pronta", locacoes: [{ numeroContrato: "1" }] });
const handler = require(path.join(dir, "../api/dk-locacao.js"));

function token(claims) {
  return auth.mintToken({ typ: "equipa", ...claims });
}
async function chamar(method, headers, body) {
  const res = {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(dados) {
      this.body = dados;
      return this;
    },
    end() {
      return this;
    },
  };
  await handler(
    {
      method,
      query: {},
      headers: { "x-dk-client-protocol": "20260913", "x-dk-user-active": "1", ...(headers || {}) },
      body,
    },
    res
  );
  return res;
}
const locacao = {
  numeroContrato: "2099010199",
  cpf: "90000000175",
  nome: "CURSOR1",
  placa: "AAA1A11",
  inicio: "27/10/2026",
};

const reduzido = pg.decidirAcessoLocacao({ ok: true });
assert.strictEqual(reduzido.status, 403);
assert.strictEqual(reduzido.reason, "module_forbidden");

const dono = await chamar(
  "POST",
  { authorization: "Bearer " + token({ cpf: "03037897430", role: "owner" }) },
  { op: "criar", locacao }
);
assert.strictEqual(dono.statusCode, 200);
assert.strictEqual(dono.body.ok, true);
assert.strictEqual(dono.body.linhas_afetadas, 1);
assert.strictEqual(capturas[0].acesso.role, "owner");
assert.strictEqual(capturas[0].acesso.typ, "equipa");
assert.strictEqual(capturas[0].acesso.cpf, "03037897430");
assert.strictEqual(capturas[0].acesso.service, false);
assert.strictEqual(capturas[0].funcionarios, null);
assert.strictEqual(capturas[0].decidido.ok, true);
assert.strictEqual(consultasDiretorio, 0);

const comModulo = await chamar(
  "POST",
  { authorization: "Bearer " + token({ cpf: "22222222222", role: "operacao" }) },
  { op: "criar", locacao }
);
assert.strictEqual(comModulo.statusCode, 200);
assert.strictEqual(comModulo.body.linhas_afetadas, 1);
assert.strictEqual(capturas[1].acesso.role, "operacao");
assert.strictEqual(capturas[1].funcionarios.length, 2);
assert.strictEqual(capturas[1].decidido.ok, true);

const semModulo = await chamar(
  "POST",
  { authorization: "Bearer " + token({ cpf: "33333333333", role: "operacao" }) },
  { op: "criar", locacao }
);
assert.strictEqual(semModulo.statusCode, 403);
assert.strictEqual(semModulo.body.reason, "module_forbidden");
assert.strictEqual(semModulo.body.modulo, "locacao");
assert.strictEqual(semModulo.body.linhas_afetadas, 0);

const antes = capturas.length;
const semSessao = await chamar("POST", {}, { op: "criar", locacao });
assert.strictEqual(semSessao.statusCode, 401);
assert.strictEqual(semSessao.body.reason, "unauthorized");
assert.strictEqual(capturas.length, antes);

const segredo = String(
  process.env.DK_PORTAL_API_SECRET || process.env.DK_BACKUP_SEND_SECRET || process.env.CRON_SECRET || ""
).trim();
const servico = await chamar("POST", { authorization: "Bearer " + segredo }, { op: "criar", locacao });
assert.strictEqual(servico.statusCode, 200);
assert.strictEqual(capturas.at(-1).acesso.service, true);
assert.strictEqual(capturas.at(-1).acesso.role, "owner");
assert.strictEqual(capturas.at(-1).acesso.typ, "service");
assert.strictEqual(capturas.at(-1).funcionarios, null);
assert.strictEqual(capturas.at(-1).decidido.ok, true);

const apagaDono = await chamar(
  "POST",
  { authorization: "Bearer " + token({ cpf: "03037897430", role: "owner" }) },
  { op: "excluir", numero: "2099010199", version: 1 }
);
assert.strictEqual(apagaDono.statusCode, 200);
assert.strictEqual(capturas.at(-1).acesso.role, "owner");
assert.strictEqual(capturas.at(-1).acesso.cpf, "03037897430");

const apagaSem = await chamar(
  "POST",
  { authorization: "Bearer " + token({ cpf: "33333333333", role: "operacao" }) },
  { op: "excluir", numero: "2099010199", version: 1 }
);
assert.strictEqual(apagaSem.statusCode, 403);
assert.strictEqual(apagaSem.body.reason, "module_forbidden");
assert.strictEqual(apagaSem.body.linhas_afetadas, 0);

const leitura = await chamar(
  "GET",
  { authorization: "Bearer " + token({ cpf: "33333333333", role: "operacao" }) },
  null
);
assert.strictEqual(leitura.statusCode, 200);
assert.strictEqual(leitura.body.ok, true);
assert.notStrictEqual(leitura.body.reason, "module_forbidden");
assert.strictEqual(leitura.body.locacoes.length, 1);

console.log("OK autorizacao locacao");
