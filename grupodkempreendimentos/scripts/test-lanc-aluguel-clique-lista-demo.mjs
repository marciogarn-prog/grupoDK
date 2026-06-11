/**
 * Lançamento de aluguel — clicar numa linha da lista de sugestões da pesquisa
 * deve carregar os dados do contrato (CPF, protocolo, painel de pagamento).
 * node grupodkempreendimentos/scripts/test-lanc-aluguel-clique-lista-demo.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate(() => {
      sessionStorage.removeItem("dk_portal_area_ativa");
      localStorage.setItem(
        "dk_sessao_cliente",
        JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador Lista" })
      );
      localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
      sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
      if (window.__DK_IS_DEMO_DEPLOY__ === true) localStorage.removeItem("dk_instalacao_limpa_v1");
    });
    await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
    await page
      .waitForFunction(() => {
        const panel = document.getElementById("panel-logado");
        return panel && !panel.classList.contains("hidden");
      }, { timeout: 45000 })
      .catch(() => null);
    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge({ force: true });
      }
    });
    await page.waitForTimeout(2500);

    await page.locator("#btn-locadora-operacao").click({ timeout: 15000 });
    await page.waitForTimeout(500);
    await page.locator("#btn-operacao-lancamento-aluguel").click({ timeout: 15000 });
    await page.waitForTimeout(800);
    await page.waitForSelector("#operacaoLancAluguelNomeBusca", { timeout: 15000 });

    // Digitar parte de um nome para abrir a lista de sugestões
    await page.fill("#operacaoLancAluguelNomeBusca", "SILVA");
    await page.dispatchEvent("#operacaoLancAluguelNomeBusca", "input");
    await page
      .waitForFunction(() => {
        const lista = document.getElementById("operacaoLancAluguelPesquisaLista");
        return (
          lista &&
          !lista.classList.contains("hidden") &&
          lista.querySelectorAll(".portal-lanc-pesquisa-linha").length > 0
        );
      }, { timeout: 20000 })
      .catch(() => null);
    const linhas = await page.evaluate(
      () => document.querySelectorAll("#operacaoLancAluguelPesquisaLista .portal-lanc-pesquisa-linha").length
    );
    record("lista de sugestões aparece ao digitar nome", linhas > 0, `linhas=${linhas}`);

    // Clicar na primeira linha — deve carregar tudo
    const alvo = await page.evaluate(() => {
      const btn = document.querySelector("#operacaoLancAluguelPesquisaLista .portal-lanc-pesquisa-linha");
      if (!btn) return null;
      return {
        cpf: btn.getAttribute("data-cpf") || "",
        proto: btn.getAttribute("data-proto") || "",
        nome: btn.getAttribute("data-nome") || "",
      };
    });
    await page.locator("#operacaoLancAluguelPesquisaLista .portal-lanc-pesquisa-linha").first().click({ timeout: 15000 });
    await page
      .waitForFunction(() => {
        const pag = document.getElementById("operacaoLancAluguelPagamentoPanel");
        return pag && !pag.classList.contains("hidden");
      }, { timeout: 20000 })
      .catch(() => null);

    const estado = await page.evaluate(() => {
      const pag = document.getElementById("operacaoLancAluguelPagamentoPanel");
      const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
      const cpf = document.getElementById("operacaoLancAluguelCpf")?.value || "";
      const placa = document.getElementById("operacaoLancAluguelPlaca")?.value || "";
      const resumo = document.getElementById("operacaoLancAluguelResumoTexto")?.textContent || "";
      return {
        pagamentoVisivel: Boolean(pag && !pag.classList.contains("hidden")),
        protoSel: String(sel?.value || ""),
        cpf,
        placa,
        resumo: resumo.trim(),
      };
    });
    record("clique na linha abre painel de pagamento", estado.pagamentoVisivel);
    record(
      "clique na linha carrega CPF do contrato",
      estado.cpf.replace(/\D/g, "") === String(alvo?.cpf || "").replace(/\D/g, "") && estado.cpf.length > 0,
      `cpf=${estado.cpf}`
    );
    record(
      "clique na linha seleciona o protocolo",
      Boolean(estado.protoSel) && estado.protoSel.replace(/\D/g, "").includes(String(alvo?.proto || "").replace(/\D/g, "")),
      `select=${estado.protoSel} esperado=${alvo?.proto}`
    );
    record("resumo do contrato preenchido", estado.resumo.length > 0, estado.resumo.slice(0, 80));
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- ${ok}/${results.length} testes clique na lista de pesquisa ---\n`);
  process.exit(ok === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
