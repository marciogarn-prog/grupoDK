/**
 * E2E demo: botão «Resetar senha (123456)» no Cadastro de colaborador.
 * Semeia colaborador de teste com senha própria, reseta via UI e verifica:
 * senha=123456 + mustChangePassword=true. Limpa no fim.
 * node grupodkempreendimentos/scripts/test-colab-reset-senha-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF_TESTE = "90090090001";

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
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    localStorage.removeItem("dk_instalacao_limpa_v1");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => {
    const p = document.getElementById("panel-logado");
    return p && !p.classList.contains("hidden");
  }, { timeout: 45000 });
  record("login admin portal demo", true);
  await page.waitForTimeout(2000);

  const temBtn = await page.evaluate(() => Boolean(document.getElementById("portalColabResetSenhaBtn")));
  record("botão de reset presente no HTML", temBtn);

  /* semear colaborador de teste com senha própria */
  const seed = await page.evaluate((cpf) => {
    try {
      funcionariosAccess.push({
        cpf,
        senha: "654321",
        nome: "COLAB TESTE RESET",
        role: "operacao",
        blocked: false,
        mustChangePassword: false,
        funcao: "TESTE E2E",
        dataIngresso: "01/06/2026",
        acessos: { cliente: true, veiculo: false, locacao: false, manutencao: false, lancamentoAluguel: false, lancamentoMultas: false, lancamentoManutencao: false, lancamentoDespesa: false, funcionario: false },
      });
      saveFuncionariosAccess();
      return { ok: true };
    } catch (e) {
      return { ok: false, err: String(e?.message || e) };
    }
  }, CPF_TESTE);
  record("colaborador de teste semeado (senha 654321)", seed.ok === true, seed.err || "");

  /* preencher CPF e clicar em resetar (diálogo aceite) */
  await page.evaluate((cpf) => {
    const inp = document.getElementById("portalColabCpf");
    inp.value = cpf;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }, CPF_TESTE);
  await page.waitForTimeout(600);
  const visivel = await page.evaluate(() => {
    const w = document.getElementById("portalColabResetSenhaWrap");
    return w ? !w.classList.contains("hidden") : false;
  });
  record("botão de reset visível ao selecionar colaborador", visivel === true);

  await page.evaluate(() => document.getElementById("portalColabResetSenhaBtn").click());
  await page.waitForTimeout(1200);

  const depois = await page.evaluate((cpf) => {
    const f = funcionariosAccess.find((x) => String(x.cpf) === cpf);
    const fb = document.getElementById("portalCadastroColaboradorFeedback")?.textContent || "";
    let persisted = null;
    try {
      const raw = JSON.parse(localStorage.getItem("dk_funcionarios_access") || localStorage.getItem("dk_funcionarios_access_v1") || "[]");
      persisted = Array.isArray(raw) ? raw.find((x) => String(x.cpf) === cpf) : null;
    } catch { persisted = null; }
    return {
      senha: f?.senha,
      mustChange: f?.mustChangePassword === true,
      fb: fb.slice(0, 140),
      persistedSenha: persisted?.senha ?? null,
    };
  }, CPF_TESTE);
  record("senha voltou para 123456", depois.senha === "123456", `senha=${depois.senha}`);
  record("mustChangePassword=true (troca no próximo login)", depois.mustChange === true);
  record("feedback ao administrador", /resetada para 123456/i.test(depois.fb), depois.fb);

  /* limpeza: remover colaborador de teste e gravar */
  const cleanup = await page.evaluate(async (cpf) => {
    try {
      const idx = funcionariosAccess.findIndex((x) => String(x.cpf) === cpf);
      if (idx >= 0) funcionariosAccess.splice(idx, 1);
      saveFuncionariosAccess();
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        try { await window.__DK_pushCloudSnapshotNow({ force: true }); } catch { /* ignore */ }
      }
      return { ok: !funcionariosAccess.some((x) => String(x.cpf) === cpf) };
    } catch (e) {
      return { ok: false, err: String(e?.message || e) };
    }
  }, CPF_TESTE);
  record("limpeza do colaborador de teste", cleanup.ok === true, cleanup.err || "");
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
