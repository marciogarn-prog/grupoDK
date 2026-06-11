/**
 * Situação do protocolo após o pagamento — Lançamento de aluguel.
 * 1) Cadastro de locação: os campos calculados (devido plano, total pago, devido aluguel,
 *    investimento acumulado, total pago no ano) NÃO aparecem mais no formulário.
 * 2) Lançamento de aluguel: após Confirmar um pagamento, aparece o painel
 *    «Situação do protocolo após o pagamento» com os valores formatados.
 * 3) Limpeza: o pagamento de teste é apagado (admin) no fim.
 * node grupodkempreendimentos/scripts/test-lanc-aluguel-situacao-demo.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const CPF_TEST = process.env.DK_LANC_SYNC_CPF || "06523244440";
const PROTO_TEST = process.env.DK_LANC_SYNC_PROTO || "2026010102";
const VALOR_TESTE = "7,77";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function loginAdmin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador Situacao" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    if (window.__DK_IS_DEMO_DEPLOY__ === true) {
      localStorage.removeItem("dk_instalacao_limpa_v1");
    }
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page
    .waitForFunction(() => {
      const panel = document.getElementById("panel-logado");
      return panel && !panel.classList.contains("hidden");
    }, { timeout: 45000 })
    .catch(() => null);
  await page.waitForTimeout(800);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept().catch(() => null));

  try {
    await loginAdmin(page);
    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge({ force: true });
      }
    });
    await page.waitForTimeout(2500);

    // 1) Cadastro de locação: campos calculados ocultos
    await page.locator("#btn-locadora-operacao").click({ timeout: 15000 });
    await page.waitForTimeout(500);
    await page.locator("#btn-operacao-cadastro-locacao").click({ timeout: 15000 });
    await page.waitForTimeout(500);
    await page.waitForSelector("#operacaoLocacaoCpf", { timeout: 15000 });
    const ocultos = await page.evaluate(() => {
      const ids = [
        "operacaoLocacaoValorDevidoPlano",
        "operacaoLocacaoTotalPago",
        "operacaoLocacaoValorDevidoAluguel",
        "operacaoLocacaoInvestimentoAcumulado",
        "operacaoLocacaoTotalPagoAno2025",
      ];
      return ids.map((id) => {
        const el = document.getElementById(id);
        return { id, existe: Boolean(el), visivel: Boolean(el && el.offsetParent !== null) };
      });
    });
    record(
      "cadastro locação: campos calculados existem mas ficam ocultos",
      ocultos.every((o) => o.existe && !o.visivel),
      ocultos.map((o) => `${o.id}:${o.visivel ? "VISIVEL" : "oculto"}`).join(" ")
    );
    const tipoPlanoVisivel = await page.evaluate(() => {
      const el = document.getElementById("operacaoLocacaoTipoPlano");
      return Boolean(el && el.offsetParent !== null);
    });
    record("cadastro locação: TIPO DE PLANO continua visível", tipoPlanoVisivel);

    // 2) Lançamento de aluguel: pesquisa + protocolo
    await page.locator("#btn-operacao-lancamento-aluguel").click({ timeout: 15000 });
    await page.waitForTimeout(800);
    await page.waitForSelector("#operacaoLancAluguelProtocoloBusca", { timeout: 15000 });
    await page.fill("#operacaoLancAluguelProtocoloBusca", PROTO_TEST);
    await page.dispatchEvent("#operacaoLancAluguelProtocoloBusca", "input");
    await page.waitForTimeout(600);
    await page.locator("#operacaoLancAluguelConfirmarPesquisaBtn").click({ timeout: 15000 });
    await page
      .waitForFunction(() => {
        const pag = document.getElementById("operacaoLancAluguelPagamentoPanel");
        return pag && !pag.classList.contains("hidden");
      }, { timeout: 20000 })
      .catch(() => null);
    const pagamentoVisivel = await page.evaluate(() => {
      const pag = document.getElementById("operacaoLancAluguelPagamentoPanel");
      return Boolean(pag && !pag.classList.contains("hidden"));
    });
    record("lanç. aluguel: painel de pagamento aberto", pagamentoVisivel, PROTO_TEST);

    const situacaoAntes = await page.evaluate(() => {
      const p = document.getElementById("operacaoLancAluguelSituacaoPanel");
      return Boolean(p && p.classList.contains("hidden"));
    });
    record("lanç. aluguel: situação oculta antes do Confirmar", situacaoAntes);

    // Confirmar pagamento de teste
    const hoje = new Date();
    const dataStr = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
    await page.fill("#operacaoLancAluguelDataPagamento", dataStr);
    await page.fill("#operacaoLancAluguelValorSimples", VALOR_TESTE);
    await page.locator("#operacaoLancAluguelConfirmarPagamentoBtn").click({ timeout: 15000 });
    await page
      .waitForFunction(() => {
        const m = document.getElementById("portalLancAluguelConfirmModal");
        return m && !m.classList.contains("hidden");
      }, { timeout: 15000 })
      .catch(() => null);
    await page.locator("#portalLancAluguelConfirmSimBtn").click({ timeout: 15000 });

    await page
      .waitForFunction(() => {
        const p = document.getElementById("operacaoLancAluguelSituacaoPanel");
        return p && !p.classList.contains("hidden");
      }, { timeout: 30000 })
      .catch(() => null);

    const situacao = await page.evaluate(() => {
      const p = document.getElementById("operacaoLancAluguelSituacaoPanel");
      const txt = (id) => String(document.getElementById(id)?.textContent || "").trim();
      const acumEl = document.getElementById("operacaoLancAluguelSitInvestAcumulado");
      return {
        visivel: Boolean(p && !p.classList.contains("hidden")),
        devidoPlano: txt("operacaoLancAluguelSitDevidoPlano"),
        totalPago: txt("operacaoLancAluguelSitTotalPago"),
        devidoAluguel: txt("operacaoLancAluguelSitDevidoAluguel"),
        investAcumulado: txt("operacaoLancAluguelSitInvestAcumulado"),
        totalPagoAno: txt("operacaoLancAluguelSitTotalPagoAno"),
        acumClasse: acumEl ? acumEl.className : "",
      };
    });
    record("situação: painel aparece após Confirmar", situacao.visivel);
    const brl = (s) => /R\$\s?[\d.,]+/.test(s);
    record(
      "situação: valores em R$ preenchidos",
      brl(situacao.devidoPlano) && brl(situacao.totalPago) && brl(situacao.devidoAluguel) && brl(situacao.investAcumulado) && brl(situacao.totalPagoAno),
      `plano=${situacao.devidoPlano} pago=${situacao.totalPago} aluguel=${situacao.devidoAluguel} acum=${situacao.investAcumulado} ano=${situacao.totalPagoAno}`
    );
    record(
      "situação: total pago inclui o pagamento de teste (> 0)",
      !/^R\$\s?0,00$/.test(situacao.totalPago.replace(/\u00a0/g, " ")),
      situacao.totalPago
    );
    record(
      "situação: investimento acumulado com cor (positivo/negativo)",
      /portal-lanc-situacao__valor--(negativo|positivo)/.test(situacao.acumClasse),
      situacao.acumClasse
    );

    // 3) Limpeza (melhor esforço): apagar o pagamento de teste pelo histórico.
    // Nota: a fusão na nuvem é append-only para lançamentos — a remoção pode não
    // persistir após o próximo merge. O protocolo 2026010102 é o protocolo de testes do demo.
    await page.waitForTimeout(1500);
    const clicouApagar = await page.evaluate((valorTeste) => {
      const botoes = Array.from(document.querySelectorAll("#operacaoLancAluguelHistorico [data-lanc-aluguel-del]"));
      for (const b of botoes) {
        const tr = b.closest("tr");
        if (String(tr?.textContent || "").includes(valorTeste)) {
          b.click();
          return true;
        }
      }
      return false;
    }, VALOR_TESTE);
    if (clicouApagar) {
      await page
        .waitForFunction(() => {
          const m = document.getElementById("portalLancAluguelConfirmModal");
          return m && !m.classList.contains("hidden");
        }, { timeout: 10000 })
        .catch(() => null);
      await page.locator("#portalLancAluguelConfirmSimBtn").click({ timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(2000);
    }
    record("limpeza (melhor esforço): exclusão admin acionada", clicouApagar);
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- ${ok}/${results.length} testes situação após pagamento ---\n`);
  process.exit(ok === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
