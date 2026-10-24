import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  normalizarPosicao,
  posicaoInalterada,
  gravarPosicao,
  listarPosicoes,
} = require("../lib/dk-cliente-geo-pg.cjs");

const aqui = path.dirname(fileURLToPath(import.meta.url));
const api = fs.readFileSync(path.join(aqui, "../api/dk-cliente-geo.js"), "utf8");
const lib = fs.readFileSync(path.join(aqui, "../lib/dk-cliente-geo-pg.cjs"), "utf8");

let falhas = 0;
function ok(nome, cond) {
  if (!cond) {
    falhas += 1;
    console.error("FALHA", nome);
    return;
  }
  console.log("ok", nome);
}

ok("api sem snapshot", !/dk_cloud_snapshots|ioSnapshotOficial|executarGravacaoCentral|fetchSnapshot|upsertSnapshot|SNAPSHOT_FIELD/.test(api));
ok("lib sem snapshot", !/dk_cloud_snapshots|ioSnapshotOficial|executarGravacaoCentral/.test(lib));
ok("api usa a tabela", api.includes("dk-cliente-geo-pg.cjs"));
ok("lib usa dk_cliente_geo", lib.includes('TABELA = "dk_cliente_geo"'));

const base = {
  cpf: "12345678901",
  nome: "Ana",
  placa: "abc1d23",
  protocolo: "2026102301",
  lat: -9.3891004,
  lng: -40.5027999,
  accuracy: 12.04,
  heading: 90.04,
  speed: 1.234,
  ts: 1_700_000_000_000,
};
const norm = normalizarPosicao(base);
ok("arredonda coordenada", norm.lat === -9.3891 && norm.lng === -40.5028 && norm.placa === "ABC1D23");
ok("igual dentro de 4 min", posicaoInalterada({ ...norm, ts: norm.ts }, { ...norm, ts: norm.ts + 60_000 }));
ok("igual depois de 4 min grava de novo", !posicaoInalterada({ ...norm, ts: norm.ts }, { ...norm, ts: norm.ts + 5 * 60 * 1000 }));
ok("mudou a latitude", !posicaoInalterada(norm, { ...norm, lat: -9.4 }));

function banco() {
  const linhas = [];
  const chamadas = [];
  const rest = async (url, opts = {}) => {
    chamadas.push({ url, method: opts.method || "GET" });
    if ((opts.method || "GET") === "GET" && url.startsWith("dk_cliente_geo?cpf=")) {
      const cpf = decodeURIComponent(url.split("cpf=eq.")[1].split("&")[0]);
      const row = linhas.find((r) => r.cpf === cpf) || null;
      return { ok: true, status: 200, data: row ? [row] : [] };
    }
    if ((opts.method || "GET") === "GET") {
      return { ok: true, status: 200, data: linhas.slice() };
    }
    const row = { ...opts.body, updated_at: "2026-10-23T22:00:00.000Z" };
    const idx = linhas.findIndex((r) => r.cpf === row.cpf);
    if (idx >= 0) linhas[idx] = row;
    else linhas.push(row);
    return { ok: true, status: 201, data: [row] };
  };
  return { linhas, chamadas, rest };
}

const vazio = banco();
const primeira = await gravarPosicao(base, { rest: vazio.rest });
ok("primeira grava", primeira.status === 200 && primeira.inalterado === false && vazio.linhas.length === 1);
ok("post na tabela", vazio.chamadas.some((c) => c.method === "POST" && c.url.startsWith("dk_cliente_geo")));

const repetida = await gravarPosicao({ ...base, ts: base.ts + 30_000 }, { rest: vazio.rest });
ok("repetida nao grava", repetida.status === 200 && repetida.inalterado === true && repetida.body.ok === true);
ok("so um post", vazio.chamadas.filter((c) => c.method === "POST").length === 1);

const mudou = await gravarPosicao({ ...base, lat: -9.4, ts: base.ts + 40_000 }, { rest: vazio.rest });
ok("mudanca grava", mudou.inalterado === false && vazio.chamadas.filter((c) => c.method === "POST").length === 2);

const lista = await listarPosicoes({ rest: vazio.rest });
ok(
  "lista no contrato do mapa",
  lista.ok === true && lista.clientes.length === 1 && lista.clientes[0].cpf === "12345678901" && lista.clientes[0].lat === -9.4
);

const ausente = banco();
ausente.rest = async () => ({
  ok: false,
  status: 404,
  data: { code: "PGRST205", message: "Could not find the table public.dk_cliente_geo in the schema cache" },
});
const semTabela = await gravarPosicao(base, { rest: ausente.rest });
ok("tabela ausente", semTabela.status === 503 && semTabela.body.reason === "geo_tabela_ausente");

assert.equal(falhas, 0);
console.log("test-dk-cliente-geo-pg ok");
