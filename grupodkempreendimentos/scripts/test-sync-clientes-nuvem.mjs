import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pacotes = require("../portal-pacotes.js");
const lib = require("../lib/dk-pacotes.cjs");

function assert(cond, name) {
  if (!cond) {
    console.error("FAIL | " + name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS | " + name);
}

let vazias = 0;
const vazio = await pacotes.postarClientesComRevisao(
  async (body) => {
    vazias += 1;
    assert(body.base_revision === "", "conflito sem revisão nova não pede outra tentativa");
    return { status: 409, ok: false, reason: "revisao_conflito", revision: "" };
  },
  [{ cpf: "11111111111", nome: "ANA" }],
  ""
);
assert(vazias === 1 && vazio && vazio.status === 409, "conflito sem revisão nova não fica em loop");

let tentativas = 0;
const ok = await pacotes.postarClientesComRevisao(
  async (body) => {
    tentativas += 1;
    if (tentativas === 1) {
      return { status: 409, ok: false, reason: "revisao_conflito", revision: "2026-10-09T12:00:00.000Z" };
    }
    assert(body.base_revision === "2026-10-09T12:00:00.000Z", "segunda tentativa usa a revisão da nuvem");
    assert(Array.isArray(body.data) && body.data.length === 1, "envia a lista deste PC");
    return { status: 200, ok: true, success: true, revision: "2026-10-09T12:00:01.000Z", count: 1 };
  },
  [{ cpf: "11111111111", nome: "ANA" }],
  ""
);
assert(tentativas === 2 && ok && ok.ok === true && ok.count === 1, "depois da revisão a gravação confirma");

const falha = await lib.postarClientesComRevisao(
  async () => ({ status: 502, ok: false, reason: "supabase_falhou", message: "A nuvem não confirmou." }),
  [],
  "2026-10-09T12:00:00.000Z"
);
assert(falha.reason === "supabase_falhou", "falha da nuvem devolve o motivo");

const nuvem = [{ cpf: "11111111111", nome: "ana", codigo: "0001" }];
const local = nuvem.concat([{ cpf: "22222222222", nome: "bia", codigo: "0002" }]);
assert(pacotes.listasClientesIguais(local, nuvem) === false, "cliente só deste PC não conta como igual");
assert(
  pacotes.listasClientesIguais(local, nuvem.concat(local[1])) === true,
  "as duas listas ficam iguais quando o cliente sobe"
);

const ui = fs.readFileSync(new URL("../portal-locadora-ui.js", import.meta.url), "utf8");
const inicio = ui.indexOf("async function portalAlinharClientesAoEntrarNaTela");
const fim = ui.indexOf("function portalPlacaRelatorioKey", inicio);
const align = ui.slice(inicio, fim);
assert(align.includes("portalEnviarClientesCadastroNaNuvem"), "a comparação envia o cadastro de clientes");
assert(!align.includes("portalPushCloudSnapshotAfterPersist"), "a comparação não empurra o pacote inteiro");
assert(ui.includes('"/api/cadastro-clientes"') || ui.includes("`/api/cadastro-clientes"), "o envio usa a rota de clientes");

const api = fs.readFileSync(new URL("../api/dk-cloud-snapshot.js", import.meta.url), "utf8");
assert(api.includes('require("../lib/dk-pacotes.cjs")'), "o snapshot carrega os pacotes dentro de lib");
assert(!api.includes("res.status(status).send(json)"), "a resposta do snapshot não reentra em json");

if (process.exitCode) {
  console.error("FAIL sync clientes");
} else {
  console.log("OK sync clientes");
}
