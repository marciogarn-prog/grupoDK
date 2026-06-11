/**
 * Admin pode corrigir o CPF de colaborador existente (Salvar alterações).
 * node grupodkempreendimentos/scripts/test-colab-editar-cpf-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF_ERRADO = "90090090002";
const CPF_CORRETO = "90090090003";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin CPF Edit" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    localStorage.removeItem("dk_instalacao_limpa_v1");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);

  await page.evaluate(
    ({ cpfErrado }) => {
      const idx = funcionariosAccess.findIndex((x) => String(x.cpf) === cpfErrado || String(x.cpf) === "90090090003");
      if (idx >= 0) funcionariosAccess.splice(idx, 1);
      funcionariosAccess.push({
        cpf: cpfErrado,
        senha: "123456",
        nome: "COLAB CPF EDIT E2E",
        role: "operacao",
        blocked: false,
        mustChangePassword: true,
        funcao: "TESTE",
        dataIngresso: "01/06/2026",
        acessos: {
          cliente: true,
          veiculo: false,
          locacao: false,
          manutencao: false,
          lancamentoAluguel: false,
          lancamentoMultas: false,
          lancamentoManutencao: false,
          lancamentoDespesa: false,
          funcionario: false,
        },
      });
      saveFuncionariosAccess();
    },
    { cpfErrado: CPF_ERRADO }
  );

  await page.locator("#btn-locadora-operacao").click({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.locator("#btn-operacao-cadastro-colaborador").click({ timeout: 15000 });
  await page.waitForTimeout(600);

  await page.locator("#portalColabCpf").fill(CPF_ERRADO);
  await page.locator("#portalColabCpf").dispatchEvent("input");
  await page.waitForTimeout(500);

  const nomeAntes = await page.inputValue("#portalColabNome");
  record("colaborador carregado pelo CPF errado", nomeAntes === "COLAB CPF EDIT E2E", `nome=${nomeAntes}`);

  await page.locator("#portalColabCpf").fill("");
  await page.locator("#portalColabCpf").fill(CPF_CORRETO);
  await page.locator("#portalColabCpf").dispatchEvent("input");
  await page.waitForTimeout(400);

  const nomeMeio = await page.inputValue("#portalColabNome");
  const btnSalvarVis = await page.evaluate(() => {
    const b = document.getElementById("portalColabBtnSalvarAlteracoes");
    return b && !b.classList.contains("hidden");
  });
  record("ao corrigir CPF mantém dados e botão Salvar alterações", nomeMeio === "COLAB CPF EDIT E2E" && btnSalvarVis);

  await page.locator("#portalColabBtnSalvarAlteracoes").click({ timeout: 10000 });
  await page.waitForTimeout(800);
  await page.locator("#portalAdminAlteracaoConfirmSimBtn").click({ timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(1200);

  const depois = await page.evaluate(
    ({ cpfErrado, cpfCorreto }) => {
      const errado = funcionariosAccess.some((x) => String(x.cpf) === cpfErrado);
      const certo = funcionariosAccess.find((x) => String(x.cpf) === cpfCorreto);
      const fb = document.getElementById("portalCadastroColaboradorFeedback")?.textContent || "";
      return {
        erradoAindaExiste: errado,
        cpfGravado: certo?.cpf,
        nome: certo?.nome,
        fb: fb.slice(0, 120),
      };
    },
    { cpfErrado: CPF_ERRADO, cpfCorreto: CPF_CORRETO }
  );
  record("CPF antigo removido do cadastro", depois.erradoAindaExiste === false);
  record("CPF novo gravado", depois.cpfGravado === CPF_CORRETO, `cpf=${depois.cpfGravado}`);
  record("nome mantido após correção", depois.nome === "COLAB CPF EDIT E2E", depois.nome);

  await page.evaluate(async (cpfCorreto) => {
    const idx = funcionariosAccess.findIndex((x) => String(x.cpf) === cpfCorreto);
    if (idx >= 0) funcionariosAccess.splice(idx, 1);
    saveFuncionariosAccess();
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      try {
        await window.__DK_pushCloudSnapshotNow({ force: true });
      } catch {
        /* ignore */
      }
    }
  }, CPF_CORRETO);
  record("limpeza colaborador de teste", true);
} catch (e) {
  record("execução", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
