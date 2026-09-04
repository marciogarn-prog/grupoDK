/**
 * Teste isolado do relatório de movimentação 1–10.
 * node grupodkempreendimentos/scripts/test-setor-relatorio.mjs
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
const js = fs.readFileSync(path.join(ROOT, "portal-setor-relatorio.js"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");

record("botão RELATÓRIO em Locados (1–3)", html.includes("portalSetorRelatorioBtnLocados"));
record("botão RELATÓRIO em Disponíveis (4–5.4)", html.includes("portalSetorRelatorioBtnDisponiveis"));
record("botão RELATÓRIO em Em manutenção (6–10)", html.includes("portalSetorRelatorioBtnManutencao"));
record("modal com coluna Quem movimentou", html.includes("id=\"portalSetorRelatorioModal\"") && html.includes("Quem movimentou"));
record("grava operador no cadastro da nuvem", js.includes("dk_portal_setor_movimentacoes_v1") && js.includes("operadorLabel"));
record("fluxo do veículo chama o relatório", ui.includes("__DK_portalRegistrarMovimentacaoSetor"));
record("origem da movimentação 6–10 é gravada", ui.includes("de: origemSub"));

const chk = spawnSync(process.execPath, ["--check", path.join(ROOT, "portal-setor-relatorio.js")], {
  encoding: "utf8",
});
record("portal-setor-relatorio.js sintaxe", chk.status === 0, (chk.stderr || "").trim().slice(0, 120));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes relatório de setor ---`);
process.exit(pass === results.length ? 0 : 1);
