/**
 * Presença e manutenção rápida fora do snapshot.
 * A flag fica desligada. Nada aqui fala com o Supabase real.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  presencaRelacionalAtiva,
  atenderPresencaRelacional,
  avaliarRollbackPresenca,
  linhasDaOrigem,
  MAX_AGE_MS,
} = require("../lib/dk-equipa-presenca-pg.cjs");
const {
  manutencaoRelacionalAtiva,
  atenderManutencaoRelacional,
  avaliarRollbackManutencao,
  aplicarLista,
  analisarOrigem,
} = require("../lib/dk-manutencao-rapida-pg.cjs");
const { corpoGetPresencaRelacional, corpoPostPresencaRelacional, listFromStore } = require("../api/dk-equipa-presenca.js");
const { corpoGetManutencaoRelacional, corpoPostManutencaoRelacional } = require("../api/cadastro-manutencoes-rapidas.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (nome) => fs.readFileSync(path.join(root, nome), "utf8");

let falhas = 0;
function ok(nome, cond) {
  if (!cond) {
    falhas += 1;
    console.error("FALHA", nome);
    return;
  }
  console.log("ok", nome);
}

const T0 = Date.parse("2026-10-24T12:00:00.000Z");
const agora = () => new Date(T0).toISOString();
const CPF_A = "11111111111";
const CPF_B = "22222222222";

function bancoPresenca() {
  const linhas = [];
  let ledger = null;
  const chamadas = [];
  let ausente = false;
  const rest = async (url, opts = {}) => {
    const method = opts.method || "GET";
    chamadas.push({ url, method, body: opts.body, prefer: opts.prefer || "" });
    if (ausente) return { ok: false, status: 404, data: { code: "PGRST205", message: "Could not find the table" } };
    if (url.startsWith("dk_equipa_presenca_migracao")) {
      if (method === "GET") return { ok: true, status: 200, data: ledger ? [ledger] : [] };
      ledger = { ...opts.body };
      return { ok: true, status: 201, data: [] };
    }
    if (method === "DELETE") {
      const cpf = decodeURIComponent(url.split("cpf=eq.")[1].split("&")[0]);
      const antes = linhas.length;
      for (let i = linhas.length - 1; i >= 0; i -= 1) if (linhas[i].cpf === cpf) linhas.splice(i, 1);
      return { ok: true, status: 200, data: [], removidas: antes - linhas.length };
    }
    if (method === "POST") {
      const rows = Array.isArray(opts.body) ? opts.body : [opts.body];
      const ignore = String(opts.prefer || "").includes("ignore-duplicates");
      for (const row of rows) {
        const idx = linhas.findIndex((r) => r.cpf === row.cpf);
        if (idx >= 0) {
          if (!ignore) linhas[idx] = { ...linhas[idx], ...row };
        } else linhas.push({ ...row });
      }
      return { ok: true, status: 201, data: [] };
    }
    if (url.includes("limit=1")) return { ok: true, status: 200, data: linhas.slice(0, 1).map((r) => ({ cpf: r.cpf })) };
    if (url.includes("cpf=eq.")) {
      const cpf = decodeURIComponent(url.split("cpf=eq.")[1].split("&")[0]);
      const row = linhas.find((r) => r.cpf === cpf) || null;
      return { ok: true, status: 200, data: row ? [row] : [] };
    }
    const corte = Date.parse(decodeURIComponent((url.split("pulso_em=gte.")[1] || "").split("&")[0]));
    const online = linhas
      .filter((r) => Date.parse(r.pulso_em) >= corte)
      .sort((a, b) => Date.parse(b.pulso_em) - Date.parse(a.pulso_em))
      .slice(0, 40);
    return { ok: true, status: 200, data: online };
  };
  return {
    linhas,
    chamadas,
    rest,
    ledger: () => ledger,
    setLedger: (v) => {
      ledger = v;
    },
    setAusente: (v) => {
      ausente = v;
    },
  };
}

function postsTabela(banco, tabela) {
  return banco.chamadas.filter((c) => (c.method === "POST" || c.method === "PATCH") && c.url.startsWith(tabela) && !c.url.startsWith(`${tabela}_migracao`));
}

const flagPresenca = process.env.DK_EQUIPA_PRESENCA_PG;
const flagManut = process.env.DK_MANUTENCOES_RAPIDAS_PG;
delete process.env.DK_EQUIPA_PRESENCA_PG;
delete process.env.DK_MANUTENCOES_RAPIDAS_PG;
ok("presença desligada por omissão", presencaRelacionalAtiva() === false);
ok("manutenção desligada por omissão", manutencaoRelacionalAtiva() === false);
process.env.DK_EQUIPA_PRESENCA_PG = "true";
process.env.DK_MANUTENCOES_RAPIDAS_PG = "true";
ok("texto true não liga presença", presencaRelacionalAtiva() === false);
ok("texto true não liga manutenção", manutencaoRelacionalAtiva() === false);
process.env.DK_EQUIPA_PRESENCA_PG = "1";
process.env.DK_MANUTENCOES_RAPIDAS_PG = "1";
ok("só 1 liga presença", presencaRelacionalAtiva() === true);
ok("só 1 liga manutenção", manutencaoRelacionalAtiva() === true);
delete process.env.DK_EQUIPA_PRESENCA_PG;
delete process.env.DK_MANUTENCOES_RAPIDAS_PG;

const ausente = bancoPresenca();
ausente.setAusente(true);
let leu = 0;
const semTabela = await atenderPresencaRelacional(
  { method: "GET" },
  {
    rest: ausente.rest,
    agora,
    lerOrigem: async () => {
      leu += 1;
      return { payload: {} };
    },
  }
);
ok("tabela ausente cai no fallback", semTabela.fallback === true && leu === 0 && postsTabela(ausente, "dk_equipa_presenca").length === 0);

const online = bancoPresenca();
online.setLedger({ id: 1, estado: "copiada", copiados: 2, updated_at: agora() });
online.linhas.push(
  { cpf: CPF_A, nome: "Ana", pulso_em: new Date(T0 - 60 * 1000).toISOString(), updated_at: agora() },
  { cpf: CPF_B, nome: "Bia", pulso_em: new Date(T0 - 9 * 60 * 1000).toISOString(), updated_at: agora() },
  { cpf: "33333333333", nome: "Caio", pulso_em: new Date(T0 - MAX_AGE_MS).toISOString(), updated_at: agora() }
);
const listaOnline = await atenderPresencaRelacional({ method: "GET" }, { rest: online.rest, agora, lerOrigem: async () => ({ payload: {} }) });
ok("quem pulsou há 1 minuto está online", listaOnline.store.byCpf[CPF_A] && listaOnline.store.byCpf[CPF_A].nome === "Ana");
ok("quem pulsou há 9 minutos fica fora", !listaOnline.store.byCpf[CPF_B]);
ok("pulso exatamente na janela de 8 minutos continua", Boolean(listaOnline.store.byCpf["33333333333"]));

const pulso = bancoPresenca();
pulso.setLedger({ id: 1, estado: "copiada", copiados: 2, updated_at: agora() });
pulso.linhas.push(
  { cpf: CPF_A, nome: "Ana", pulso_em: new Date(T0 - 5 * 60 * 1000).toISOString(), updated_at: new Date(T0 - 5 * 60 * 1000).toISOString() },
  { cpf: CPF_B, nome: "Bia", pulso_em: new Date(T0 - 4 * 60 * 1000).toISOString(), updated_at: new Date(T0 - 4 * 60 * 1000).toISOString() }
);
const pulsoBia = pulso.linhas[1].pulso_em;
const gravouPulso = await atenderPresencaRelacional(
  { method: "POST", entrada: { cpf: CPF_A, vivo: true, nome: "Ana Souza", at: T0 - 30 * 1000 } },
  { rest: pulso.rest, agora, lerOrigem: async () => ({ payload: { dk_equipa_presenca_v1: { byCpf: {} } } }) }
);
const writesPulso = postsTabela(pulso, "dk_equipa_presenca");
ok("pulso grava só o CPF informado", gravouPulso.status === 200 && writesPulso.length === 1 && writesPulso[0].body.cpf === CPF_A && pulso.linhas[1].pulso_em === pulsoBia);
ok("nome acompanha o pulso novo", pulso.linhas.find((r) => r.cpf === CPF_A).nome === "Ana Souza");
ok("lista devolve os dois online", gravouPulso.store.byCpf[CPF_A] && gravouPulso.store.byCpf[CPF_B]);

const antigo = bancoPresenca();
antigo.setLedger({ id: 1, estado: "copiada", copiados: 1, updated_at: agora() });
const pulsoAtual = new Date(T0 - 60 * 1000).toISOString();
antigo.linhas.push({ cpf: CPF_A, nome: "Ana", pulso_em: pulsoAtual, updated_at: pulsoAtual });
const ignorado = await atenderPresencaRelacional(
  { method: "POST", entrada: { cpf: CPF_A, vivo: true, nome: "Outra", at: T0 - 5 * 60 * 1000 } },
  { rest: antigo.rest, agora }
);
ok("pulso mais antigo não substitui o mais novo", ignorado.status === 200 && postsTabela(antigo, "dk_equipa_presenca").length === 0 && antigo.linhas[0].nome === "Ana" && antigo.linhas[0].pulso_em === pulsoAtual);

const sair = bancoPresenca();
sair.setLedger({ id: 1, estado: "copiada", copiados: 1, updated_at: agora() });
sair.linhas.push({ cpf: CPF_A, nome: "Ana", pulso_em: new Date(T0 - 60 * 1000).toISOString(), updated_at: agora() });
const logout = await atenderPresencaRelacional(
  { method: "POST", entrada: { cpf: CPF_A, vivo: false, nome: "Ana", at: T0 } },
  { rest: sair.rest, agora }
);
ok("logout remove a linha", logout.status === 200 && !logout.store.byCpf[CPF_A] && sair.linhas.length === 0 && sair.chamadas.some((c) => c.method === "DELETE"));

const corpoStore = {
  byCpf: {
    [CPF_B]: { at: Date.now(), nome: "Bia" },
    [CPF_A]: { at: Date.now() - 1000, nome: "Ana" },
  },
};
const getCorpo = corpoGetPresencaRelacional("2026-10-24T12:00:00.000Z", corpoStore);
const esperadoGet = {
  ok: true,
  success: true,
  source: "supabase",
  revision: "2026-10-24T12:00:00.000Z",
  updated_at: "2026-10-24T12:00:00.000Z",
  ...listFromStore(corpoStore),
};
ok("GET da presença tem o formato antigo", JSON.stringify(getCorpo) === JSON.stringify(esperadoGet) && getCorpo.cpfs.join(",") === `${CPF_A},${CPF_B}`);
const postCorpo = corpoPostPresencaRelacional("2026-10-24T12:00:00.000Z", corpoStore, false, "redis fora");
ok(
  "POST da presença tem o formato antigo",
  postCorpo.success === true &&
    postCorpo.persistencia === "supabase" &&
    postCorpo.supabase.ok === true &&
    postCorpo.redis.ok === false &&
    postCorpo.redis.reason === "redis fora" &&
    postCorpo.cpfs.length === 2
);

const payloadCopia = {
  outro: 1,
  dk_equipa_presenca_v1: {
    byCpf: {
      [CPF_A]: { at: T0 - 60 * 1000, nome: "Ana" },
      "12": { at: T0, nome: "invalido" },
    },
  },
};
const antesCopia = JSON.stringify(payloadCopia);
const copia = bancoPresenca();
let leiturasCopia = 0;
const migrada = await atenderPresencaRelacional(
  { method: "GET" },
  {
    rest: copia.rest,
    agora,
    lerOrigem: async () => {
      leiturasCopia += 1;
      return { payload: payloadCopia, updatedAt: "2026-10-24T11:00:00.000Z" };
    },
  }
);
ok("cópia inicial traz quem é visível e não mexe no snapshot", migrada.store.byCpf[CPF_A].nome === "Ana" && !migrada.store.byCpf["12"] && JSON.stringify(payloadCopia) === antesCopia && copia.ledger().estado === "copiada");
const postsCopia = postsTabela(copia, "dk_equipa_presenca").length;
await atenderPresencaRelacional(
  { method: "GET" },
  {
    rest: copia.rest,
    agora,
    lerOrigem: async () => {
      leiturasCopia += 1;
      return { payload: payloadCopia };
    },
  }
);
ok("segunda leitura não copia de novo", postsTabela(copia, "dk_equipa_presenca").length === postsCopia && leiturasCopia === 1);

const ambiguo = bancoPresenca();
const payloadAmb = { dk_equipa_presenca_v1: { byCpf: [] } };
const antesAmb = JSON.stringify(payloadAmb);
const recusado = await atenderPresencaRelacional(
  { method: "GET" },
  { rest: ambiguo.rest, agora, lerOrigem: async () => ({ payload: payloadAmb }) }
);
ok("formato ambíguo não migra", recusado.fallback === true && recusado.motivo === "migracao_ambigua" && postsTabela(ambiguo, "dk_equipa_presenca").length === 0 && ambiguo.ledger().estado === "nao_migrar" && JSON.stringify(payloadAmb) === antesAmb);
let leuDepois = 0;
const recusado2 = await atenderPresencaRelacional(
  { method: "GET" },
  {
    rest: ambiguo.rest,
    agora,
    lerOrigem: async () => {
      leuDepois += 1;
      return { payload: payloadAmb };
    },
  }
);
ok("recusa fica registrada e não relê o snapshot", recusado2.fallback === true && leuDepois === 0);

const ocupada = bancoPresenca();
ocupada.linhas.push({ cpf: CPF_B, nome: "Bia", pulso_em: new Date(T0 - 1000).toISOString(), updated_at: agora() });
const payloadOcupada = { dk_equipa_presenca_v1: { byCpf: { [CPF_A]: { at: T0 - 1000, nome: "Ana" } } } };
const jaTinha = await atenderPresencaRelacional(
  { method: "GET" },
  { rest: ocupada.rest, agora, lerOrigem: async () => ({ payload: payloadOcupada }) }
);
ok("tabela já com linha não recebe o snapshot por cima", jaTinha.store.byCpf[CPF_B] && !jaTinha.store.byCpf[CPF_A] && ocupada.ledger().estado === "ja_tinha_dados");

const vazioDepois = bancoPresenca();
vazioDepois.setLedger({ id: 1, estado: "origem_vazia", copiados: 0, updated_at: agora() });
let leuVazio = 0;
const segueVazio = await atenderPresencaRelacional(
  { method: "GET" },
  {
    rest: vazioDepois.rest,
    agora,
    lerOrigem: async () => {
      leuVazio += 1;
      return { payload: { dk_equipa_presenca_v1: { byCpf: { [CPF_A]: { at: T0, nome: "Ana" } } } } };
    },
  }
);
ok("logout que esvaziou a tabela não volta pelo snapshot", segueVazio.store.byCpf && !segueVazio.store.byCpf[CPF_A] && leuVazio === 0);

const planoPresenca = avaliarRollbackPresenca();
ok("rollback da presença não apaga snapshot nem tabela", planoPresenca.podeDesligar === true && planoPresenca.apagaSnapshot === false && planoPresenca.apagaTabela === false);
ok("CPF inválido na origem é o mesmo recorte de hoje", linhasDaOrigem({ dk_equipa_presenca_v1: { byCpf: { "123": { at: 10, nome: "x" } } } }).linhas.length === 0);

function bancoManut() {
  const linhas = [];
  let ledger = null;
  const chamadas = [];
  let ausenteTab = false;
  const rest = async (url, opts = {}) => {
    const method = opts.method || "GET";
    chamadas.push({ url, method, body: opts.body, prefer: opts.prefer || "", headers: opts.headers || {} });
    if (ausenteTab) return { ok: false, status: 404, data: { code: "PGRST205", message: "Could not find the table" } };
    if (url.startsWith("dk_manutencao_rapida_migracao")) {
      if (method === "GET") return { ok: true, status: 200, data: ledger ? [ledger] : [] };
      ledger = { ...opts.body };
      return { ok: true, status: 201, data: [] };
    }
    if (method === "PATCH") {
      const id = decodeURIComponent(url.split("id=eq.")[1].split("&")[0]);
      const idx = linhas.findIndex((r) => r.id === id);
      if (idx >= 0) linhas[idx] = { ...linhas[idx], registro: opts.body.registro, updated_at: opts.body.updated_at };
      return { ok: true, status: 200, data: [] };
    }
    if (method === "POST") {
      const rows = Array.isArray(opts.body) ? opts.body : [opts.body];
      const ignore = String(opts.prefer || "").includes("ignore-duplicates");
      for (const row of rows) {
        const idx = linhas.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          if (!ignore) linhas[idx] = { ...linhas[idx], ...row };
        } else linhas.push({ ...row });
      }
      return { ok: true, status: 201, data: [] };
    }
    if (url.includes("limit=1")) return { ok: true, status: 200, data: linhas.slice(0, 1).map((r) => ({ id: r.id })) };
    const range = String((opts.headers && opts.headers.Range) || "0-999");
    const [ini, fim] = range.split("-").map((n) => Number(n));
    const ordered = linhas.slice().sort((a, b) => Number(a.ordem) - Number(b.ordem));
    return { ok: true, status: 200, data: ordered.slice(ini, fim + 1) };
  };
  return {
    linhas,
    chamadas,
    rest,
    ledger: () => ledger,
    setLedger: (v) => {
      ledger = v;
    },
    setAusente: (v) => {
      ausenteTab = v;
    },
  };
}

const rec = (id, criadoEm, valor, extra = {}) => ({
  id,
  placa: "ABC1D23",
  criadoEm,
  valorPago: valor,
  os: "OS000001",
  origemPortal: true,
  ...extra,
});

const manutAusente = bancoManut();
manutAusente.setAusente(true);
let leuManut = 0;
const manutSem = await atenderManutencaoRelacional(
  { method: "GET" },
  {
    rest: manutAusente.rest,
    lerOrigem: async () => {
      leuManut += 1;
      return { payload: {} };
    },
    lerRedis: async () => [],
  }
);
ok("manutenção sem tabela cai no fallback", manutSem.fallback === true && leuManut === 0);

const baseManut = rec("MR-1", "2026-10-02T12:00:00.000Z", 80);
const criar = bancoManut();
criar.setLedger({ id: 1, estado: "copiada", copiados: 1, updated_at: agora() });
criar.linhas.push({ id: "MR-1", ordem: 1, registro: baseManut, updated_at: "2026-10-02T12:00:00.000Z" });
const novo = rec("MR-2", "2026-10-03T12:00:00.000Z", 40, { os: "OS000002" });
const criado = await atenderManutencaoRelacional(
  { method: "POST", incoming: [baseManut, novo, { ...novo }] },
  { rest: criar.rest, agora, lerOrigem: async () => ({ payload: {} }), lerRedis: async () => [] }
);
const postsCriar = postsTabela(criar, "dk_manutencao_rapida");
ok("cria um lançamento e não duplica", criado.gravou === true && criado.data.length === 2 && postsCriar.length === 1 && postsCriar[0].body.length === 1 && postsCriar[0].body[0].id === "MR-2");
ok("o antigo não foi regravado", criar.linhas.find((r) => r.id === "MR-1").valorPago == null && criar.linhas.find((r) => r.id === "MR-1").registro.valorPago === 80);

const atualizar = bancoManut();
atualizar.setLedger({ id: 1, estado: "copiada", copiados: 1, updated_at: agora() });
atualizar.linhas.push({ id: "MR-1", ordem: 1, registro: baseManut, updated_at: "2026-10-02T12:00:00.000Z" });
const mudado = rec("MR-1", "2026-10-04T12:00:00.000Z", 90);
delete mudado.os;
const atualizado = await atenderManutencaoRelacional(
  { method: "POST", incoming: [mudado] },
  { rest: atualizar.rest, agora, lerOrigem: async () => ({ payload: {} }), lerRedis: async () => [] }
);
ok(
  "atualiza só o lançamento necessário e preserva a OS",
  atualizado.gravou === true &&
    atualizar.chamadas.filter((c) => c.method === "PATCH").length === 1 &&
    atualizar.linhas[0].ordem === 1 &&
    atualizar.linhas[0].registro.valorPago === 90 &&
    atualizar.linhas[0].registro.os === "OS000001"
);

const listar = await atenderManutencaoRelacional(
  { method: "GET" },
  { rest: atualizar.rest, agora, lerOrigem: async () => ({ payload: {} }), lerRedis: async () => [] }
);
const corpoLista = corpoGetManutencaoRelacional(listar.data, listar.revision);
ok(
  "listagem tem o formato antigo",
  listar.data.length === 1 &&
    listar.data[0].valorPago === 90 &&
    corpoLista.ok === true &&
    corpoLista.success === true &&
    corpoLista.source === "supabase" &&
    Array.isArray(corpoLista.data) &&
    Object.keys(corpoLista).sort().join(",") === "data,ok,revision,source,success,updated_at"
);

const repetir = bancoManut();
repetir.setLedger({ id: 1, estado: "copiada", copiados: 1, updated_at: agora() });
repetir.linhas.push({ id: "MR-1", ordem: 1, registro: baseManut, updated_at: "2026-10-02T12:00:00.000Z" });
const igual = await atenderManutencaoRelacional(
  { method: "POST", incoming: [baseManut] },
  { rest: repetir.rest, agora, lerOrigem: async () => ({ payload: {} }), lerRedis: async () => [] }
);
ok("abrir de novo com a mesma lista não grava", igual.gravou === false && igual.data.length === 1 && postsTabela(repetir, "dk_manutencao_rapida").length === 0);

const maisNovo = aplicarLista(
  [{ id: "MR-1", ordem: 1, registro: baseManut, updated_at: "t" }],
  [rec("MR-1", "2026-10-01T12:00:00.000Z", 10)],
  agora()
);
ok("lançamento mais novo não é coberto pelo antigo", maisNovo.writes.length === 0 && maisNovo.finais[0].valorPago === 80);

const payloadMig = {
  clientes: [{ id: "nao-mexer" }],
  dk_manutencoes_rapidas_v1: [rec("MR-1", "2026-10-02T12:00:00.000Z", 80), rec("MR-2", "2026-10-03T12:00:00.000Z", 40, { os: "OS000002" })],
};
const antesMig = JSON.stringify(payloadMig);
const mig = bancoManut();
let leuMig = 0;
const primeiraMig = await atenderManutencaoRelacional(
  { method: "GET" },
  {
    rest: mig.rest,
    agora,
    lerOrigem: async () => {
      leuMig += 1;
      return { payload: payloadMig, updatedAt: "2026-10-24T11:00:00.000Z" };
    },
    lerRedis: async () => payloadMig.dk_manutencoes_rapidas_v1.map((r) => ({ ...r })),
  }
);
ok("migração copia os dois e não altera o snapshot", primeiraMig.data.length === 2 && mig.ledger().estado === "copiada" && JSON.stringify(payloadMig) === antesMig && mig.linhas.length === 2);
const postsMig = postsTabela(mig, "dk_manutencao_rapida").length;
const segundaMig = await atenderManutencaoRelacional(
  { method: "GET" },
  {
    rest: mig.rest,
    agora,
    lerOrigem: async () => {
      leuMig += 1;
      return { payload: payloadMig };
    },
    lerRedis: async () => payloadMig.dk_manutencoes_rapidas_v1,
  }
);
ok("migração é idempotente", segundaMig.data.length === 2 && postsTabela(mig, "dk_manutencao_rapida").length === postsMig && leuMig === 1 && mig.linhas.length === 2);

const ordemTroca = analisarOrigem(
  [{ valorPago: 40, id: "MR-9", criadoEm: "2026-10-01T00:00:00.000Z", placa: "ABC1D23" }],
  [{ id: "MR-9", placa: "ABC1D23", criadoEm: "2026-10-01T00:00:00.000Z", valorPago: 40 }]
);
ok("mesma ficha com chaves em outra ordem não é conflito", ordemTroca.ok === true && ordemTroca.linhas.length === 1);

const conflitoPayload = { dk_manutencoes_rapidas_v1: [rec("MR-1", "2026-10-02T12:00:00.000Z", 80)] };
const antesConflito = JSON.stringify(conflitoPayload);
const conflito = bancoManut();
const recusadoManut = await atenderManutencaoRelacional(
  { method: "GET" },
  {
    rest: conflito.rest,
    agora,
    lerOrigem: async () => ({ payload: conflitoPayload }),
    lerRedis: async () => [rec("MR-1", "2026-10-02T12:00:00.000Z", 81)],
  }
);
ok(
  "snapshot e redis diferentes não migram",
  recusadoManut.fallback === true &&
    recusadoManut.motivo === "migracao_ambigua" &&
    conflito.linhas.length === 0 &&
    conflito.ledger().estado === "nao_migrar" &&
    JSON.stringify(conflitoPayload) === antesConflito
);

const corpoPostManut = corpoPostManutencaoRelacional([baseManut], "2026-10-24T12:00:00.000Z", true, "");
ok(
  "POST da manutenção tem o formato antigo",
  corpoPostManut.success === true &&
    corpoPostManut.count === 1 &&
    corpoPostManut.data[0].id === "MR-1" &&
    corpoPostManut.persistencia === "supabase+redis" &&
    corpoPostManut.supabase.ok === true &&
    corpoPostManut.source === "supabase"
);

const volta = bancoManut();
volta.setLedger({ id: 1, estado: "copiada", copiados: 1, updated_at: agora() });
volta.linhas.push({ id: "MR-1", ordem: 1, registro: baseManut, updated_at: "2026-10-02T12:00:00.000Z" });
const postsAntesRollback = postsTabela(volta, "dk_manutencao_rapida").length;
const rollbackOk = await avaliarRollbackManutencao({
  rest: volta.rest,
  lerOrigem: async () => ({ payload: { dk_manutencoes_rapidas_v1: [baseManut] } }),
});
ok("rollback permitido quando o snapshot já tem a mesma ficha", rollbackOk.podeDesligar === true && rollbackOk.apagaSnapshot === false && rollbackOk.apagaTabela === false && postsTabela(volta, "dk_manutencao_rapida").length === postsAntesRollback);

const rollbackNao = await avaliarRollbackManutencao({
  rest: volta.rest,
  lerOrigem: async () => ({ payload: { dk_manutencoes_rapidas_v1: [] } }),
});
ok("rollback recusado se a tabela tiver lançamento que o snapshot não tem", rollbackNao.podeDesligar === false && rollbackNao.motivo === "registros_so_na_tabela");

function sqlLimpo(nome, tabelas) {
  const sql = ler(nome);
  const alters = [...sql.matchAll(/alter table\s+public\.([a-z0-9_]+)/gi)].map((m) => m[1]);
  return {
    semDrop: !/\bdrop\b/i.test(sql) && !/\btruncate\b/i.test(sql) && !/delete\s+from/i.test(sql),
    soNovas: alters.every((n) => tabelas.includes(n)),
    rls: sql.includes("enable row level security"),
    anon: sql.includes("revoke all on table") && sql.includes("anon") && sql.includes("authenticated"),
    service: sql.includes("to service_role"),
    idempotente: sql.includes("create table if not exists"),
  };
}
const sqlPresenca = sqlLimpo("supabase/dk-equipa-presenca.sql", ["dk_equipa_presenca", "dk_equipa_presenca_migracao"]);
const sqlManut = sqlLimpo("supabase/dk-manutencao-rapida.sql", ["dk_manutencao_rapida", "dk_manutencao_rapida_migracao"]);
ok("SQL da presença é idempotente e não apaga", Object.values(sqlPresenca).every(Boolean));
ok("SQL da manutenção é idempotente e não apaga", Object.values(sqlManut).every(Boolean));
ok("SQL da manutenção não altera a tabela de presença", !/alter table\s+public\.dk_equipa_presenca/i.test(ler("supabase/dk-manutencao-rapida.sql")));
ok("SQL da presença não altera a tabela de manutenção", !/alter table\s+public\.dk_manutencao_rapida/i.test(ler("supabase/dk-equipa-presenca.sql")));

const libPresenca = ler("lib/dk-equipa-presenca-pg.cjs");
const libManut = ler("lib/dk-manutencao-rapida-pg.cjs");
const apiPresenca = ler("api/dk-equipa-presenca.js");
const apiManut = ler("api/cadastro-manutencoes-rapidas.js");
const proibido = /upsertSnapshot|executarGravacaoCentral|dk_cloud_snapshots|cadastro-clientes|cadastro-veiculos|dk_locacao|financeiro|dk-cliente-geo|dk-cloud-snapshot/;
ok("biblioteca da presença não alcança as outras rotinas", !proibido.test(libPresenca));
ok("biblioteca da manutenção não alcança as outras rotinas", !proibido.test(libManut));
const postPresenca = apiPresenca.slice(apiPresenca.indexOf('if (req.method === "POST")'));
const postManut = apiManut.slice(apiManut.indexOf('if (req.method === "POST")'));
ok(
  "API da presença conserva o caminho do snapshot",
  apiPresenca.includes("gravarEquipaPresencaComIo") &&
    apiPresenca.includes("executarGravacaoCentral") &&
    postPresenca.indexOf("presencaRelacionalAtiva()") < postPresenca.indexOf("gravarEquipaPresencaComIo(") &&
    postPresenca.includes("if (!rel.fallback)")
);
ok(
  "API da manutenção conserva o caminho do snapshot",
  apiManut.includes("executarGravacaoCentral") &&
    apiManut.includes("dk_manutencoes_rapidas_v1") &&
    postManut.indexOf("manutencaoRelacionalAtiva()") < postManut.indexOf("executarGravacaoCentral(") &&
    postManut.includes("if (!rel.fallback)")
);
ok("frontend sem chave de serviço", !ler("portal-manutencao-rapida.js").includes("SUPABASE_SERVICE_ROLE_KEY") && !ler("portal-locadora-ui.js").includes("SUPABASE_SERVICE_ROLE_KEY"));

if (flagPresenca == null) delete process.env.DK_EQUIPA_PRESENCA_PG;
else process.env.DK_EQUIPA_PRESENCA_PG = flagPresenca;
if (flagManut == null) delete process.env.DK_MANUTENCOES_RAPIDAS_PG;
else process.env.DK_MANUTENCOES_RAPIDAS_PG = flagManut;

assert.equal(falhas, 0);
console.log("test-dk-disk-io-presenca-manutencao ok");
