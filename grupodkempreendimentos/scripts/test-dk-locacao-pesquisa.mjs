import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const api = require("../dk-locacao-pesquisa-estado.js");

const oficial = [
  { numeroContrato: "2026102701", portalLancamentosAluguel: [] },
  {
    numeroContrato: "2025111403",
    portalLancamentosAluguel: Array.from({ length: 23 }, (_, i) => ({ i })),
  },
];
for (let i = 0; i < 609; i += 1) oficial.push({ numeroContrato: String(2025000000 + i) });
const snapshot = oficial.filter((loc) => loc.numeroContrato !== "2026102701");
const oficiais = api.protocolosDe(oficial);
const legados = api.protocolosDe(snapshot);

assert.equal(oficial.length, 611);
assert.equal(snapshot.length, 610);
assert.equal(oficiais.size, 611);
assert.equal(oficiais.has("2026102701"), true);
assert.equal(legados.has("2026102701"), false);
assert.equal(oficiais.has("2025111403"), true);

const publicados = api.publicarProtocolosOficiais(oficial);
assert.equal(publicados.size, 611);
assert.equal(globalThis.__DK_locacoesPesquisaFonte, "dk_locacao");
assert.equal(globalThis.__DK_locacoesNuvemProtocolos.has("2026102701"), true);

const trintaNove = Array.from({ length: 39 }, () => ({ origem: "snapshot" }));
const vinteTres = Array.from({ length: 23 }, () => ({ origem: "dk_locacao" }));

let ticket = api.pedir(null, "2025111403");
const selecaoA = ticket;
ticket = api.pedir(ticket, "2026102701");
const selecaoB = ticket;
let resultado = api.concluir(selecaoB, {
  seq: selecaoB.seq,
  fonte: "dk_locacao",
  contrato: "2026102701",
  pagamentos: [],
});
assert.equal(resultado.aplicado, true);
assert.equal(resultado.ticket.contratoVisivel, "2026102701");
assert.equal(resultado.ticket.pagamentos.length, 0);
resultado = api.concluir(resultado.ticket, {
  seq: selecaoA.seq,
  fonte: "dk_locacao",
  contrato: "2025111403",
  pagamentos: trintaNove,
});
assert.equal(resultado.aplicado, false);
assert.equal(resultado.ticket.contratoVisivel, "2026102701");
assert.equal(resultado.ticket.pagamentos.length, 0);

ticket = api.pedir(null, "2026102701");
const ida = ticket;
ticket = api.pedir(ticket, "2025111403");
const meio = ticket;
ticket = api.pedir(ticket, "2026102701");
const volta = ticket;
assert.equal(api.concluir(volta, { seq: ida.seq, fonte: "dk_locacao", contrato: "2026102701", pagamentos: trintaNove }).aplicado, false);
assert.equal(api.concluir(volta, { seq: meio.seq, fonte: "dk_locacao", contrato: "2025111403", pagamentos: vinteTres }).aplicado, false);
resultado = api.concluir(volta, { seq: volta.seq, fonte: "dk_locacao", contrato: "2026102701", pagamentos: [] });
assert.equal(resultado.aplicado, true);
assert.equal(resultado.ticket.contratoVisivel, "2026102701");
assert.equal(resultado.ticket.pagamentos.length, 0);

const historico = api.pedir(null, "2025111403");
const seguinte = api.pedir(historico, "2025111403");
resultado = api.concluir(seguinte, {
  seq: seguinte.seq,
  fonte: "dk_locacao",
  contrato: "2025111403",
  pagamentos: vinteTres,
});
assert.equal(resultado.aplicado, true);
assert.equal(resultado.ticket.pagamentos.length, 23);
resultado = api.concluir(resultado.ticket, {
  seq: historico.seq,
  fonte: "snapshot",
  contrato: "2025111403",
  pagamentos: trintaNove,
});
assert.equal(resultado.aplicado, false);
assert.equal(resultado.ticket.pagamentos.length, 23);
assert.equal(resultado.ticket.contratoVisivel, "2025111403");

console.log("pesquisa locacao ok");
