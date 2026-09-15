/**
 * Item extra do check-list (ao lado de Pagou): A/R + caixa livre se R; entra em manutenção com R; bloqueia 4/5.2 se houver R.
 * node grupodkempreendimentos/scripts/test-checklist-item-livre.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const mov = fs.readFileSync(path.join(ROOT, "portal-movimentacoes-manutencao.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

record(
  "HTML do item extra ao lado de Pagou",
  ui.includes("portalChecklistItemLivreWrap") &&
    ui.includes('name="portalChecklistItem30"') &&
    ui.includes('id="portalChecklistObs30"') &&
    ui.includes("Problema (se R)") &&
    !ui.includes("portalChecklistObsSelect30"),
  "sem lista suspensa no item 30"
);
record(
  "R abre caixa livre; A/R 1–29 mantêm SUBSTITUIR/REGULAR/OUTRO",
  ui.includes('inp.placeholder = isR ? "Escreva o problema…" : ""') &&
    ui.includes("portalChecklistItemEhLivre") &&
    ui.includes("SUBSTITUIR") &&
    ui.includes("REGULAR") &&
    ui.includes("OUTRO") &&
    ui.includes("caixa amarela"),
  ""
);
record(
  "R do item extra entra em manutenção e bloqueia disponível",
  ui.includes("function portalChecklistTemItemReprovado") &&
    ui.includes("portalChecklistOleoSim() || temItemR") &&
    ui.includes("A placa só fica disponível para locação se nenhum item estiver em R") &&
    ui.includes("const destDisp = alvo === \"prontos\" || alvo === \"reserva-patio\"") &&
    ui.includes("btn.disabled = !(val.ok && formOk && (!destDisp || !temItemR))"),
  ""
);
record(
  "snapshot e PDF incluem o item 30",
  ui.includes("n: PORTAL_CHECKLIST_ITEM_LIVRE_N") &&
    mov.includes("CHECKLIST_ITENS_COUNT = 30") &&
    mov.includes('if (!sel)') &&
    mov.includes("Item extra (problema livre)"),
  ""
);
record(
  "CSS caixa amarela ao marcar R",
  css.includes("portal-checklist-item-livre") &&
    css.includes("portal-checklist-item-livre-obs--aberto") &&
    css.includes("#e8c547"),
  ""
);
record(
  "cache-bust",
  html.includes("portal-locadora-ui.js?v=20260915itemlivre") &&
    html.includes("styles.css?v=20260915itemlivre") &&
    html.includes("portal-movimentacoes-manutencao.js?v=20260915itemlivre"),
  ""
);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log(`\n${results.length}/${results.length} ok`);
