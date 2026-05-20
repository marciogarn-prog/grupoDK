/**
 * Smoke test em produção (headless) — DK Locadora portal cadastro.
 * node scripts/test-portal-producao.mjs
 */
import { chromium } from "playwright";

const BASE_URL = "https://grupodkempreendimentos.com.br/";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });

    const html = await page.content();
    record("HTML com cache banco-unificado", html.includes("banco-unificado"), "scripts");
    const cacheOk =
      html.includes("locadora-hub") ||
      html.includes("data-auto") ||
      html.includes("mascaras") ||
      html.includes("20260520");
    record("HTML com cache app/portal atualizado", cacheOk, "app.js + portal-locadora-ui.js");
    record(
      "views hub locadora no HTML",
      html.includes("view-locadora-hub") && html.includes("view-locadora-cliente")
    );

    const hasPortalFns = await page.evaluate(() => ({
      unify: typeof window.__DK_unifyCadastroSingleDatabaseOnce === "function",
      banco: Boolean(window.DK_BANCO_CADASTRO?.veiculos?.length),
      upsert: typeof window.__DK_upsertPortalClienteByCpf === "function",
      dateMask: typeof window.formatDateMask === "function",
      isDkDate: typeof window.isDkDateFieldInput === "function",
      autoDate: typeof window.bindDateMasksInContainer === "function",
      observer: Boolean(window.__dkDateMaskObserver),
      currencyMask: typeof window.formatCurrencyMask === "function",
    }));
    record("app.js banco unificado", hasPortalFns.unify && hasPortalFns.upsert && hasPortalFns.banco);
    record(
      "mascaras globais carregadas",
      hasPortalFns.dateMask &&
        hasPortalFns.isDkDate &&
        hasPortalFns.autoDate &&
        hasPortalFns.observer &&
        hasPortalFns.currencyMask
    );

    const autoDateDetect = await page.evaluate(() => {
      const el = document.createElement("input");
      el.type = "text";
      el.id = "testeAutoDataCampoNovo";
      document.body.appendChild(el);
      const detected = typeof window.isDkDateFieldInput === "function" && window.isDkDateFieldInput(el);
      if (typeof window.bindDateMaskInput === "function") window.bindDateMaskInput(el);
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.value = "01012030";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      const masked = el.value;
      el.remove();
      return { detected, masked };
    });
    record("auto-detect id com Data", autoDateDetect.detected, "testeAutoDataCampoNovo");
    record("auto-mascara campo novo", autoDateDetect.masked === "01/01/2030", autoDateDetect.masked);

    await page.click("text=DK Locadora", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);

    const hubCliente = page.locator("text=Área do Cliente").first();
    const hubEmpresa = page.locator("text=Área da Empresa").first();
    record(
      "hub DK Locadora (cliente + empresa)",
      (await hubCliente.isVisible().catch(() => false)) && (await hubEmpresa.isVisible().catch(() => false))
    );

    if (await hubEmpresa.isVisible().catch(() => false)) {
      await hubEmpresa.click();
      await page.waitForTimeout(500);
    }

    const colab = page.locator(".role-picker__btn:has-text('Colaborador'), text=Colaborador").first();
    if (await colab.isVisible().catch(() => false)) await colab.click();
    await page.waitForTimeout(400);

    const cpfLogin = page.locator("#login-cpf");
    if (await cpfLogin.isVisible().catch(() => false)) {
      await cpfLogin.fill("00000000000");
      await page.locator("#login-senha, input[type=password]").first().fill("123456");
      await page.locator("button:has-text('Entrar'), #btn-login").first().click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    const operacao = page.locator("text=Operação").first();
    if (await operacao.isVisible().catch(() => false)) {
      await operacao.click();
      await page.waitForTimeout(1500);
    }

    const cloudBtn = page.locator("#btn-dk-cloud-pull, text=Carregar da nuvem").first();
    if (await cloudBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await cloudBtn.click();
      await page.waitForTimeout(5000);
    }

    const storage = await page.evaluate(() => {
      const rawC = localStorage.getItem("dk_clientes_cadastro");
      const rawV = localStorage.getItem("dk_veiculos_cadastro");
      const dig = (s) => String(s ?? "").replace(/\D/g, "");
      const norm = (p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      let clientes = [];
      let veiculos = [];
      try {
        clientes = rawC ? JSON.parse(rawC) : [];
      } catch {
        /* */
      }
      try {
        veiculos = rawV ? JSON.parse(rawV) : [];
      } catch {
        /* */
      }
      const c1 = clientes.find((c) => dig(c.cpf) === "00000000001");
      const ferrari = veiculos.find((v) => norm(v.placa) === "AAA0A00");
      const frota = veiculos.filter((v) => !v.origemPortal);
      const portal = veiculos.filter((v) => v.origemPortal);
      return {
        clientes: clientes.length,
        veiculos: veiculos.length,
        frota: frota.length,
        portal: portal.length,
        teste001: c1?.nome || "",
        ferrari: ferrari ? `${ferrari.modelo} ${ferrari.tag}` : "",
        flag: localStorage.getItem("dk_banco_cadastro_unificado_v2"),
      };
    });

    record("unificação v2 executada", storage.flag === "1", `flag=${storage.flag}`);
    record("banco clientes ≥ 4", storage.clientes >= 4, `count=${storage.clientes}`);
    record("banco veículos ≥ 165", storage.veiculos >= 165, `count=${storage.veiculos}`);
    record("TESTE-001 no localStorage", /teste-001/i.test(storage.teste001), storage.teste001);
    record("Ferrari no banco único", /ferrari/i.test(storage.ferrari) && /DKCR013/.test(storage.ferrari), storage.ferrari);
    record("frota+portal no mesmo arquivo", storage.frota >= 100 && storage.portal >= 3, `frota=${storage.frota} portal=${storage.portal}`);

    const appsHtml = await page.evaluate(() => fetch("./apps.html").then((r) => r.text()));
    record("pagina apps.html disponivel", appsHtml.includes("App Cliente") && appsHtml.includes("App Corporativo"));

    await page.goto(new URL("cliente.html", BASE_URL).href, { waitUntil: "networkidle", timeout: 60000 });
    record("cliente.html carrega", (await page.content()).includes("Partilhar comprovante"));

    const clienteBtn = page.locator("text=Cadastro de cliente").first();
    if (await clienteBtn.isVisible().catch(() => false)) {
      await clienteBtn.click();
      await page.waitForTimeout(800);
      const cpfField = page.locator("#operacaoClienteCpf");
      if (await cpfField.isVisible().catch(() => false)) {
        await cpfField.fill("000.000.000-01");
        await cpfField.dispatchEvent("input");
        await page.waitForTimeout(600);
        const nomeVal = await page.locator("#operacaoClienteNome").inputValue().catch(() => "");
        record("form cliente preenche nome ao digitar CPF", /teste-001/i.test(nomeVal), nomeVal || "(vazio)");
      }
    }

    const locacaoBtn = page.locator("text=Cadastro de locação").first();
    if (await locacaoBtn.isVisible().catch(() => false)) {
      await locacaoBtn.click();
      await page.waitForTimeout(800);
      const dataInicio = page.locator("#operacaoLocacaoDataInicio");
      if (await dataInicio.isVisible().catch(() => false)) {
        await dataInicio.fill("");
        await dataInicio.type("19052026", { delay: 30 });
        await page.waitForTimeout(300);
        const dataVal = await dataInicio.inputValue();
        record("mascara data DD/MM/AAAA", dataVal === "19/05/2026", dataVal);
      }
      const valAluguel = page.locator("#operacaoLocacaoValorAluguel");
      if (await valAluguel.isVisible().catch(() => false)) {
        await valAluguel.fill("");
        await valAluguel.type("12345", { delay: 30 });
        await page.waitForTimeout(300);
        const valRaw = await valAluguel.inputValue();
        const okVal = /R\$\s*123,45/.test(valRaw);
        record("mascara valor R$ xxx,xx", okVal, valRaw);
      }
    }

    const veiculoBtn = page.locator("text=Cadastro de veículo").first();
    if (await veiculoBtn.isVisible().catch(() => false)) {
      await veiculoBtn.click();
      await page.waitForTimeout(800);
      const placaField = page.locator("#operacaoVeiculoPlaca");
      if (await placaField.isVisible().catch(() => false)) {
        await placaField.fill("AAA0A00");
        await placaField.dispatchEvent("input");
        await page.waitForTimeout(600);
        const modelo = await page.locator("#operacaoVeiculoModelo").inputValue().catch(() => "");
        const tag = await page.locator("#operacaoVeiculoTag").inputValue().catch(() => "");
        record(
          "form veículo reconhece AAA0A00",
          /ferrari/i.test(modelo) || tag === "DKCR013",
          `modelo=${modelo} tag=${tag}`
        );
      }
    }
  } catch (e) {
    record("execução sem erro fatal", false, String(e.message || e));
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n--- ${passed}/${results.length} testes passaram ---`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
