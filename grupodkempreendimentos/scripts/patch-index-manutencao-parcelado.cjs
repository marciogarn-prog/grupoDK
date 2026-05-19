/**
 * Substitui o bloco de pagamento simples de manutenção pelo layout parcelado (igual multas).
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "index.html");
let html = fs.readFileSync(file, "utf8");

const startMarker = 'id="operacaoLancManutencaoReferenciaPanel"';
const endMarker = 'id="operacaoLancManutencaoHistorico"';
const i0 = html.indexOf(startMarker);
const i1 = html.indexOf(endMarker);
if (i0 < 0 || i1 < 0 || i1 <= i0) {
  console.error("Marcadores do bloco manutenção não encontrados.");
  process.exit(1);
}

let secStart = html.lastIndexOf("<section", i0);

const newBlock = `            <section id="operacaoLancManutencaoReferenciaPanel" class="portal-lanc-aluguel-referencia hidden" hidden>
              <h4 class="portal-lanc-aluguel-section__title">Dados do protocolo</h4>
              <motion class="operacao-inline-form__grid portal-lanc-aluguel-referencia__grid">
                <div class="portal-lanc-ref-row-top">
                  <label class="portal-field portal-lanc-ref-proto">
                    <span>PROTOCOLO</span>
                    <select id="operacaoLancManutencaoProtocoloSelect" disabled><option value="">&mdash;</option></select>
                  </label>
                  <label class="portal-field portal-lanc-ref-placa">
                    <span>PLACA</span>
                    <input type="text" id="operacaoLancManutencaoPlaca" readonly tabindex="-1">
                  </label>
                </motion>
                <label class="portal-field"><span>DATA IN&Iacute;CIO</span><input type="text" id="operacaoLancManutencaoDataInicio" readonly tabindex="-1"></label>
                <label class="portal-field"><span>DATA FIM</span><input type="text" id="operacaoLancManutencaoDataFim" readonly tabindex="-1"></label>
                <label class="portal-field"><span>TOTAL EM MANUTEN&Ccedil;&Atilde;O (protocolo)</span><input type="text" id="operacaoLancManutencaoValorDevido" readonly tabindex="-1" title="Soma das manuten&ccedil;&otilde;es registadas"></label>
              </motion>
            </section>
            <section id="operacaoLancManutencaoLancamentoPanel" class="portal-lanc-aluguel-pagamento hidden" hidden aria-labelledby="portal-lanc-manutencao-lancamento-title">
              <h4 id="portal-lanc-manutencao-lancamento-title" class="portal-lanc-aluguel-section__title">Dados da manuten&ccedil;&atilde;o</h4>
              <p class="subtext portal-lanc-aluguel-section__hint">Intervalo entre parcelas: <strong>7 dias</strong>. &Uacute;ltima parcela = 1.&ordf; parcela + (quantidade &minus; 1) &times; 7 dias.</p>
              <div class="operacao-inline-form__grid">
                <label class="portal-field">
                  <span>DATA DA MANUTEN&Ccedil;&Atilde;O</span>
                  <input type="text" id="operacaoLancManutencaoDataManutencao" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="DD/MM/AAAA" required>
                </label>
                <label class="portal-field">
                  <span>COD. DA MANUTEN&Ccedil;&Atilde;O</span>
                  <input type="text" id="operacaoLancManutencaoCodManutencao" maxlength="40" autocomplete="off" placeholder="C&oacute;digo do servi&ccedil;o" required>
                </label>
                <label class="portal-field portal-field--wide">
                  <span>DESCRI&Ccedil;&Atilde;O DA MANUTEN&Ccedil;&Atilde;O</span>
                  <input type="text" id="operacaoLancManutencaoDescricao" maxlength="200" autocomplete="off" placeholder="Ex.: troca de &oacute;leo" required>
                </label>
                <label class="portal-field">
                  <span>VALOR DA MANUTEN&Ccedil;&Atilde;O</span>
                  <input type="text" id="operacaoLancManutencaoValorManutencao" inputmode="decimal" autocomplete="off" placeholder="0,00" required>
                </label>
                <label class="portal-field">
                  <span>QUANTIDADE DE PARCELAS</span>
                  <select id="operacaoLancManutencaoQtdParcelas" aria-label="Quantidade de parcelas de 1 a 10">
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                    <option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option>
                    <option value="9">9</option><option value="10">10</option>
                  </select>
                </label>
                <label class="portal-field">
                  <span>DATA DA PRIMEIRA PARCELA</span>
                  <input type="text" id="operacaoLancManutencaoDataPrimeiraParcela" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="DD/MM/AAAA" required>
                </label>
                <label class="portal-field">
                  <span>DATA DA &Uacute;LTIMA PARCELA</span>
                  <input type="text" id="operacaoLancManutencaoDataUltimaParcela" readonly tabindex="-1" placeholder="Calculada automaticamente">
                </label>
                <div class="portal-field portal-field--wide">
                  <p id="operacaoLancManutencaoCronogramaPreview" class="subtext portal-multas-cronograma-preview" role="status"></p>
                </div>
                <div class="operacao-inline-form__actions">
                  <button type="button" class="btn-primary" id="operacaoLancManutencaoCadastrarBtn">Cadastrar manuten&ccedil;&atilde;o</button>
                  <button type="button" class="btn-primary btn-secondary-outline" id="operacaoLancManutencaoLimparLancamentoBtn">Limpar formul&aacute;rio</button>
                  <button type="button" class="btn-primary btn-secondary-outline" id="operacaoLancManutencaoVoltarBtn">Voltar</button>
                </div>
              </motion>
            </section>
          `;

html = html.slice(0, secStart) + newBlock + "\n          " + html.slice(i1);

if (!html.includes("operacaoLancManutencaoRelatorioActions")) {
  html = html.replace(
    'id="operacaoLancManutencaoHistorico"',
    `id="operacaoLancManutencaoRelatorioActions" class="operacao-inline-form__actions portal-multas-relatorio-actions hidden" hidden>
            <button type="button" class="btn-primary" id="operacaoLancManutencaoGerarRelatorioBtn">Relat&oacute;rio de manuten&ccedil;&otilde;es (imprimir / PDF)</button>
          </div>
          <div id="operacaoLancManutencaoHistorico"`
  );
}

html = html.replace(/<motion /g, "<div ").replace(/<\/motion>/g, "</div>");

fs.writeFileSync(file, html, { encoding: "utf8" });
const ok =
  html.includes("operacaoLancManutencaoDataManutencao") &&
  html.includes("operacaoLancManutencaoGerarRelatorioBtn") &&
  html.includes("operacaoLancManutencaoLancamentoPanel");
console.log(ok ? "patch manutenção OK" : "patch manutenção FALHOU");
