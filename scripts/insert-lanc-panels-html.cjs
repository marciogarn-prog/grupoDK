const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "grupodkempreendimentos", "index.html");
let html = fs.readFileSync(indexPath, "utf8");

if (html.includes('id="operacaoInlineLancamentoMultas"')) {
  console.log("Panels already present");
  process.exit(0);
}

function buildPanel(kind, title, lead, arrayLabel) {
  const P = kind === "Multas" ? "Multas" : "Manutencao";
  const id = kind === "Multas" ? "multas" : "manutencao";
  const devido =
    kind === "Multas" ? "VALOR DEVIDO DE MULTAS" : "VALOR DEVIDO DE MANUTENÇÃO";
  const total =
    kind === "Multas" ? "TOTAL PAGO EM MULTAS" : "TOTAL PAGO EM MANUTENÇÃO";
  return `
        <div id="operacaoInlineLancamento${P}" class="operacao-inline-form hidden" role="region" aria-labelledby="operacao-inline-lanc-${id}-title">
          <h3 id="operacao-inline-lanc-${id}-title" class="operacao-inline-form__title">${title}</h3>
          <p class="subtext operacao-inline-form__lead">${lead}</p>
          <form id="formOperacaoLancamento${P}Inline" class="portal-lanc-aluguel-form" novalidate>
            <section class="portal-lanc-aluguel-pesquisa" aria-labelledby="portal-lanc-${id}-pesquisa-title">
              <h4 id="portal-lanc-${id}-pesquisa-title" class="portal-lanc-aluguel-section__title">Pesquisar contrato</h4>
              <p class="subtext portal-lanc-aluguel-section__hint">Informe <strong>nome</strong>, <strong>CPF</strong> ou <strong>número do protocolo</strong> e confirme.</p>
              <motion class="operacao-inline-form__grid portal-lanc-aluguel-pesquisa__grid">
                <label class="portal-field portal-field--wide">
                  <span>Nome do cliente</span>
                  <input type="text" id="operacaoLanc${P}NomeBusca" autocomplete="off" maxlength="120" placeholder="Nome completo ou parte do nome" list="operacaoLanc${P}NomeSugestoes">
                  <datalist id="operacaoLanc${P}NomeSugestoes"></datalist>
                </label>
                <label class="portal-field">
                  <span>CPF</span>
                  <input type="text" id="operacaoLanc${P}Cpf" inputmode="numeric" maxlength="14" autocomplete="off" placeholder="000.000.000-00" list="operacaoLanc${P}CpfSugestoes">
                  <datalist id="operacaoLanc${P}CpfSugestoes"></datalist>
                </label>
                <label class="portal-field">
                  <span>Nº do protocolo</span>
                  <input type="text" id="operacaoLanc${P}ProtocoloBusca" autocomplete="off" maxlength="40" placeholder="Ex.: 2026011601" list="operacaoLanc${P}ProtocoloSugestoes">
                  <datalist id="operacaoLanc${P}ProtocoloSugestoes"></datalist>
                </label>
                <motion class="operacao-inline-form__actions portal-lanc-aluguel-pesquisa__actions">
                  <button type="button" class="btn-primary" id="operacaoLanc${P}ConfirmarPesquisaBtn">Confirmar pesquisa</button>
                  <button type="button" class="btn-primary btn-secondary-outline" id="operacaoLanc${P}LimparPesquisaBtn">Limpar dados</button>
                </motion>
              </motion>
            </section>
            <section id="operacaoLanc${P}ReferenciaPanel" class="portal-lanc-aluguel-referencia hidden" hidden>
              <h4 class="portal-lanc-aluguel-section__title">Dados do protocolo</h4>
              <motion class="operacao-inline-form__grid portal-lanc-aluguel-referencia__grid">
                <motion class="portal-lanc-ref-row-top">
                  <label class="portal-field portal-lanc-ref-proto">
                    <span>PROTOCOLO</span>
                    <select id="operacaoLanc${P}ProtocoloSelect" disabled><option value="">—</option></select>
                  </label>
                  <label class="portal-field portal-lanc-ref-placa">
                    <span>PLACA</span>
                    <input type="text" id="operacaoLanc${P}Placa" readonly tabindex="-1">
                  </label>
                </motion>
                <label class="portal-field"><span>DATA INÍCIO</span><input type="text" id="operacaoLanc${P}DataInicio" readonly tabindex="-1"></label>
                <label class="portal-field"><span>DATA FIM</span><input type="text" id="operacaoLanc${P}DataFim" readonly tabindex="-1"></label>
                <label class="portal-field"><span>${devido}</span><input type="text" id="operacaoLanc${P}ValorDevido" readonly tabindex="-1"></label>
                <label class="portal-field"><span>${total}</span><input type="text" id="operacaoLanc${P}TotalPago" readonly tabindex="-1"></label>
              </motion>
            </section>
            <section id="operacaoLanc${P}PagamentoPanel" class="portal-lanc-aluguel-pagamento hidden" hidden>
              <h4 class="portal-lanc-aluguel-section__title">Lançamento do pagamento</h4>
              <motion class="operacao-inline-form__grid">
                <label class="portal-field"><span>VALOR PAGO</span><input type="text" id="operacaoLanc${P}ValorPago" readonly tabindex="-1"></label>
                <label class="portal-field"><span>DATA DO PAGAMENTO</span><input type="text" id="operacaoLanc${P}DataPagamento" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA"></label>
                <label class="portal-field"><span>Pagamento em espécie</span><input type="text" id="operacaoLanc${P}ValorEspecie" inputmode="decimal" placeholder="0,00"></label>
                <label class="portal-field"><span>Pagamento em Pix</span><input type="text" id="operacaoLanc${P}ValorPix" inputmode="decimal" placeholder="0,00"></label>
                <label class="portal-field"><span>Pagamento em cartão</span><input type="text" id="operacaoLanc${P}ValorCartao" inputmode="decimal" placeholder="0,00"></label>
                <motion class="operacao-inline-form__actions">
                  <button type="button" class="btn-primary" id="operacaoLanc${P}ConfirmarPagamentoBtn">Confirmar pagamento</button>
                  <button type="button" class="btn-primary btn-secondary-outline" id="operacaoLanc${P}LimparBtn">Limpar</button>
                  <button type="button" class="btn-primary btn-secondary-outline" id="operacaoLanc${P}VoltarBtn">Voltar</button>
                </motion>
              </motion>
            </section>
          </form>
          <motion id="operacaoLanc${P}Historico" class="operacao-lanc-historico hidden" role="region" aria-label="Histórico de ${arrayLabel} do protocolo"></motion>
          <p id="operacaoLanc${P}InlineMsg" class="portal-feedback" role="status" aria-live="polite"></p>
        </motion>
`.replace(/<motion/g, "<div").replace(/<\/motion>/g, "</div>");
}

const panels =
  buildPanel(
    "Multas",
    "Lançamento de multas",
    "Registe pagamentos de <strong>multas</strong> no protocolo. O <strong>total pago em multas</strong> é a soma dos lançamentos confirmados neste ecrã.",
    "multas"
  ) +
  buildPanel(
    "Manutencao",
    "Lançamento de manutenção",
    "Registe pagamentos de <strong>manutenção</strong> no protocolo. O <strong>total pago em manutenção</strong> é a soma dos lançamentos confirmados neste ecrã.",
    "manutenção"
  );

const marker = '<div id="operacaoInlineColaborador"';
const idx = html.indexOf(marker);
if (idx < 0) {
  console.error("Marker not found");
  process.exit(1);
}
html = html.slice(0, idx) + panels + "\n" + html.slice(idx);
fs.writeFileSync(indexPath, html);
console.log("Inserted multas + manutencao panels");
