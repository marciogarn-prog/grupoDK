#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "index.html");
let html = fs.readFileSync(indexPath, "utf8");

const marker = 'id="operacaoLancManutencaoRelatorioActions"';
const idx = html.indexOf(marker);
if (idx === -1) {
  console.error("marker not found");
  process.exit(1);
}

// Find start: orphaned line without opening <div> (after </section>)
const sectionEnd = html.lastIndexOf("</section>", idx);
const afterSection = html.indexOf("\n", sectionEnd) + 1;

const msgStart = html.indexOf('<p id="operacaoLancManutencaoInlineMsg"', idx);
if (msgStart === -1) {
  console.error("inline msg not found");
  process.exit(1);
}

const replacement = `          </form>
          <div id="operacaoLancManutencaoHistorico" class="operacao-lanc-historico hidden" role="region" aria-label="Hist&oacute;rico de manuten&ccedil;&otilde;es do protocolo"></div>
          <div id="operacaoLancManutencaoRelatorioActions" class="operacao-inline-form__actions portal-multas-relatorio-actions hidden" hidden>
            <button type="button" class="btn-primary" id="operacaoLancManutencaoGerarRelatorioBtn">Relat&oacute;rio de manuten&ccedil;&otilde;es (imprimir / PDF)</button>
          </div>
          `;

html = html.slice(0, afterSection) + replacement + html.slice(msgStart);
fs.writeFileSync(indexPath, html, "utf8");
console.log("Fixed manutencao HTML block");
