/**
 * Uma leitura de fundo de cada tipo. A lista e o detalhe passam à frente.
 * Tick ocupado é ignorado. Não há fila.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function novo() {
  delete require.cache[require.resolve("../dk-bg-read.js")];
  return require("../dk-bg-read.js");
}

const relogio = novo();
assert.equal(relogio.__DK_bgTentarRelogio(), true, "0s inicia");
assert.equal(relogio.__DK_bgTentarRelogio(), false, "15s pula");
assert.equal(relogio.__DK_BG_READ_STATE.relogioInFlight, true);
relogio.__DK_bgSoltarRelogio();
assert.equal(relogio.__DK_bgTentarRelogio(), true, "30s inicia");
relogio.__DK_bgSoltarRelogio();
assert.equal(relogio.__DK_BG_READ_STATE.relogioInFlight, false);

const revisao = novo();
assert.equal(revisao.__DK_bgTentarRevisao(), true);
assert.equal(revisao.__DK_bgTentarRevisao(), false);
revisao.__DK_bgSoltarRevisao();
assert.equal(revisao.__DK_bgTentarRevisao(), true);
revisao.__DK_bgSoltarRevisao();

const detalhe = novo();
detalhe.__DK_bgInterativaEntrar();
assert.equal(detalhe.__DK_bgTentarRelogio(), false, "relogio espera o detalhe");
assert.equal(detalhe.__DK_bgTentarRevisao(), false, "revisao espera o detalhe");
assert.equal(detalhe.__DK_bgTentarPull(), false, "pull espera o detalhe");
detalhe.__DK_bgInterativaSair();
assert.equal(detalhe.__DK_bgTentarRelogio(), true, "proximo tick normal");
detalhe.__DK_bgSoltarRelogio();

const lista = novo();
lista.__DK_bgInterativaEntrar();
assert.equal(lista.__DK_bgTentarRelogio(), false);
assert.equal(lista.__DK_bgTentarRevisao(), false);
assert.equal(lista.__DK_bgTentarPull(), false);
lista.__DK_bgInterativaSair();
lista.__DK_bgInterativaSair();
assert.equal(lista.__DK_BG_READ_STATE.interactiveReads, 0, "finally nao deixa flag negativa");
assert.equal(lista.__DK_bgTentarPull(), true);
lista.__DK_bgSoltarPull();

const fuga = novo();
fuga.__DK_bgInterativaEntrar();
assert.equal(fuga.__DK_bgLeituraInterativa(), true);
assert.equal(fuga.__DK_bgTentarPull(), false, "startSilentPull nao inicia");
let pulls = 0;
function pullAutomatico() {
  if (fuga.__DK_bgLeituraInterativa()) return "pulou";
  if (!fuga.__DK_bgTentarPull()) return "ocupado";
  pulls += 1;
  return "iniciou";
}
assert.equal(pullAutomatico(), "pulou", "troca de ecra automatica nao inicia");
fuga.__DK_bgInterativaSair();
assert.equal(pullAutomatico(), "iniciou");
assert.equal(pullAutomatico(), "ocupado", "segundo pull automatico nao inicia");
assert.equal(pulls, 1);
fuga.__DK_bgSoltarPull();
assert.equal(pullAutomatico(), "iniciou", "proximo evento normal pode executar");
fuga.__DK_bgSoltarPull();

const raiz = path.join(dir, "..");
const pg = fs.readFileSync(path.join(raiz, "portal-locacao-pg.js"), "utf8");
const ui = fs.readFileSync(path.join(raiz, "portal-locadora-ui.js"), "utf8");
const sync = fs.readFileSync(path.join(raiz, "portal-supabase-sync.js"), "utf8");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
assert.match(pg, /setInterval\(\(\) => \{[\s\S]*?\}, 15000\)/);
assert.equal(pg.includes("__DK_bgTentarRelogio"), true);
assert.equal(pg.includes("__DK_bgInterativaEntrar"), true);
assert.equal(pg.includes("__DK_bgInterativaSair"), true);
assert.equal(ui.includes("}, 20000);"), true);
assert.equal(sync.includes("leitura_interativa"), true);
assert.equal(sync.includes("__DK_bgTentarPull"), true);
assert.equal(sync.includes("automatico: true"), true);
assert.equal(sync.includes("screenPullAgain = true"), false);
assert.equal(sync.includes("dkBgLeituraInterativa()"), true);
assert.equal(html.includes("dk-bg-read.js?v=20261028bg2"), true);
assert.equal(html.includes("portal-supabase-sync.js?v=20261028bg2"), true);
assert.equal(html.includes("dk-bg-read.js?v=20261028bg"), true);
assert.equal(pg.includes("/api/dk-locacao?op=list"), false);

console.log("bg read ok");
