/**
 * A pesquisa baixa a lista leve. O contrato aberto baixa um detalhe.
 * Resumo não é gravado como locação.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pgSrc = fs.readFileSync(path.join(dir, "../portal-locacao-pg.js"), "utf8");
const uiSrc = fs.readFileSync(path.join(dir, "../portal-locadora-ui.js"), "utf8");
assert.equal(pgSrc.includes("/api/dk-locacao?op=list"), false);
assert.equal(pgSrc.includes("/api/dk-locacao-lista-leve"), true);
assert.equal(pgSrc.includes("/api/dk-locacao-detalhe"), true);
assert.equal(pgSrc.includes("resumo_nao_e_locacao"), true);
assert.equal(uiSrc.includes("__DK_locacaoPgDetalhe"), true);
assert.equal(uiSrc.includes("if (!selecaoAindaAtual()) return;"), true);

const urls = [];
const posts = [];
const sandbox = {
  console,
  setInterval() { return 0; },
  setTimeout() { return 0; },
  localStorage: { removeItem() {}, setItem() {}, getItem() { return null; } },
  loadCadastro() { return sandbox.window.__DK_locacoesPgCache.slice(); },
  saveCadastro() {},
};
sandbox.window = sandbox;
sandbox.fetch = async (url, opts = {}) => {
  urls.push(String(url));
  if (String(url).includes("op=list")) throw new Error("lista monolitica");
  if ((opts.method || "GET") === "POST") {
    posts.push(JSON.parse(opts.body));
    return { status: 200, async json() { return { ok: true, locacao: JSON.parse(opts.body).locacao }; } };
  }
  if (String(url).includes("dk-locacao-detalhe")) {
    const nc = new URL(url, "https://grupodkempreendimentos.com.br").searchParams.get("numeroContrato");
    if (nc === "999") return { status: 502, async json() { return { ok: false, reason: "leitura" }; } };
    const n = nc === "2025111403" ? 23 : 0;
    return {
      status: 200,
      async json() {
        return {
          ok: true,
          locacao: {
            numeroContrato: nc,
            cpf: "90000000175",
            nome: "CURSOR1",
            placa: "AAA1A11",
            pgId: "det-" + nc,
            pgVersion: nc === "2026102701" ? 2 : 1,
            portalLancamentosAluguel: Array.from({ length: n }, (_, i) => ({ i })),
            portalLancamentosAluguelRemovidos: nc === "2025111403" ? [{}, {}, {}] : [],
          },
        };
      },
    };
  }
  return {
    status: 200,
    async json() {
      return {
        ok: true,
        ativado: true,
        source: "dk_locacao",
        quantidade: 2,
        locacoes: [
          { numeroContrato: "2026102701", nome: "CURSOR1", cpf: "90000000175", placa: "AAA1A11" },
          { numeroContrato: "2025111403", nome: "HISTORICO", cpf: "11111111111", placa: "XYZ1B23" },
        ],
      };
    },
  };
};
sandbox.window.__DK_portalApiHeaders = () => ({ Authorization: "Bearer teste" });
vm.createContext(sandbox);
vm.runInContext(pgSrc, sandbox);
await sandbox.window.__DK_locacaoPgRecarregar();
assert.equal(urls.some((url) => url.includes("/api/dk-locacao-lista-leve")), true);
assert.equal(urls.some((url) => url.includes("op=list")), false);
assert.equal(sandbox.window.__DK_locacoesPgCache.length, 2);
assert.equal(sandbox.window.__DK_locacoesPgCache.every((loc) => loc.__dkResumo === true), true);
assert.equal(sandbox.window.__DK_locacoesPesquisaFonte, "dk_locacao_lista_leve");
sandbox.saveCadastro("dk_locacoes_cadastro", sandbox.window.__DK_locacoesPgCache.slice());
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(posts.length, 0);

const hist = await sandbox.window.__DK_locacaoPgDetalhe("2025111403");
assert.equal(hist.ok, true);
assert.equal(hist.locacao.portalLancamentosAluguel.length, 23);
assert.equal(hist.locacao.portalLancamentosAluguelRemovidos.length, 3);
assert.equal(hist.locacao.__dkResumo, undefined);
const e2e = await sandbox.window.__DK_locacaoPgDetalhe("2026102701");
assert.equal(e2e.locacao.portalLancamentosAluguel.length, 0);
assert.equal(e2e.locacao.pgVersion, 2);
const falha = await sandbox.window.__DK_locacaoPgDetalhe("999");
assert.equal(falha.ok, false);
assert.equal(falha.reason, "leitura");
assert.equal(sandbox.window.__DK_locacaoDetalheAtual.numeroContrato, "2026102701");

sandbox.window.__DK_LOCACAO_PG_ERRO = "";
sandbox.fetch = async () => ({ status: 502, async json() { return { ok: false, ativado: true, reason: "leitura", locacoes: [] }; } });
await sandbox.window.__DK_locacaoPgRecarregar();
assert.equal(sandbox.window.__DK_LOCACAO_PG_ERRO, "leitura");
assert.equal(sandbox.window.__DK_locacoesPgCache.length, 0);
assert.equal(sandbox.window.__DK_locacaoDetalheAtual, null);

console.log("cutover leitura ok");
