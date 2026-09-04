/**
 * Teste do cadastro de cliente: docs + corte 04/09/2026.
 * node grupodkempreendimentos/scripts/test-cadastro-cliente-docs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const docs = fs.readFileSync(path.join(ROOT, "portal-cliente-docs.js"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");

record("caixa comprovante de residência", html.includes("operacaoClienteDocResidenciaBox"));
record("caixa CNH", html.includes("operacaoClienteDocCnhBox"));
record("modal Salvar e Atualizar", html.includes("portalClienteConfirmSalvarBtn") && html.includes("portalClienteConfirmAtualizarBtn"));
record("corte 04/09/2026", docs.includes("2026-09-04"));
record("exigência telefone e recados no novo cadastro", ui.includes("informe o telefone do cliente") && ui.includes("Recados 01"));
record("confirmação unificada", ui.includes("iniciarConfirmacaoCliente") && ui.includes("portalAbrirClienteConfirmModal"));

const chk = spawnSync(process.execPath, ["--check", path.join(ROOT, "portal-cliente-docs.js")], { encoding: "utf8" });
record("portal-cliente-docs.js sintaxe", chk.status === 0, (chk.stderr || "").trim().slice(0, 120));
const chkUi = spawnSync(process.execPath, ["--check", path.join(ROOT, "portal-locadora-ui.js")], { encoding: "utf8" });
record("portal-locadora-ui.js sintaxe", chkUi.status === 0, (chkUi.stderr || "").trim().slice(0, 160));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes cadastro cliente docs ---`);
process.exit(pass === results.length ? 0 : 1);
