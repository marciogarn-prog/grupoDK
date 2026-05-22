/**
 * E2E — invalidar pagamento não pode voltar à lista verde após sync simulado.
 * node grupodkempreendimentos/scripts/test-invalidar-pagamento-producao.mjs
 * DK_TEST_BASE=http://127.0.0.1:4173/ node ...  (servidor local com código novo)
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(/\/?$/, "/");
const EXPECT_BUNDLE = process.env.DK_EXPECT_BUNDLE || "invalidar-fix3";
const OWNER_CPF = "03037897430";
const OWNER_SENHA = process.env.DK_OWNER_SENHA || "110499@Gb";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function loginOwner(page) {
  await page.goto(`${BASE}#locadora/empresa/administrador`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);

  const cpf = page.locator("#login-cpf");
  await cpf.waitFor({ state: "visible", timeout: 15000 });
  await cpf.fill(OWNER_CPF);
  await page.locator("#login-senha, input[type=password]").first().fill(OWNER_SENHA);
  await page.locator("#form-login button[type=submit]").first().click();
  const loginFb = page.locator("#login-feedback");
  try {
    await page.waitForSelector("#panel-logado:not(.hidden)", { timeout: 20000 });
  } catch {
    const errTxt = (await loginFb.textContent().catch(() => "")) || "timeout";
    throw new Error(`Login falhou: ${errTxt.trim()}`);
  }
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("dialog", async (d) => {
    await d.accept();
  });

  try {
    await loginOwner(page);

    const sess = await page.evaluate(() => {
      try {
        const s = JSON.parse(localStorage.getItem("dk_sessao_cliente") || "null");
        return { tipo: s?.tipo, role: s?.role, cpf: String(s?.cpf || "").replace(/\D/g, "") };
      } catch {
        return {};
      }
    });
    record("login admin titular (role owner)", sess.role === "owner" && sess.tipo === "admin", JSON.stringify(sess));

    const html = await page.content();
    record(
      `bundle JS ${EXPECT_BUNDLE}`,
      html.includes(EXPECT_BUNDLE),
      html.includes(EXPECT_BUNDLE) ? "ok" : `esperado ${EXPECT_BUNDLE} no HTML`
    );

    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
      }
    });
    await page.waitForTimeout(3000);

    await page.locator("text=Operação").first().click();
    await page.waitForTimeout(800);
    await page.locator("text=Lançamento de aluguel").first().click();
    await page.waitForTimeout(1500);

    await page.locator("#portalComprovanteClienteBtnValidados").click().catch(() => {});
    await page.waitForTimeout(800);

    const prep = await page.evaluate(() => {
      const isOwner =
        typeof window.__DK_isPortalTitularAdministrador === "function" &&
        window.__DK_isPortalTitularAdministrador();
      const listFn = window.__DK_comprovantesClienteListValidados;
      const rows = typeof listFn === "function" ? listFn() : [];
      const alvo = rows.find((r) => !r.pagamentoInvalidado && r.status === "confirmado" && r.id);
      return {
        isOwner,
        hasInvalidateFn: typeof window.__DK_invalidarPagamentoAppCliente === "function",
        totalValidados: rows.length,
        alvoId: alvo?.id || "",
        alvoProto: alvo?.protocolo || "",
      };
    });

    record("sessão é administrador titular (owner)", prep.isOwner);
    record("função __DK_invalidarPagamentoAppCliente existe", prep.hasInvalidateFn);
    record("há pagamento validado para testar", Boolean(prep.alvoId), `id=${prep.alvoId || "—"} n=${prep.totalValidados}`);

    if (!prep.isOwner) {
      throw new Error("Sessão não é owner — login administrador falhou.");
    }
    if (!prep.alvoId) {
      throw new Error("Sem comprovante confirmado na nuvem/local para testar invalidação.");
    }

    const invRes = await page.evaluate(async (id) => {
      const fn = window.__DK_invalidarPagamentoAppCliente;
      if (typeof fn !== "function") return { ok: false, msg: "fn missing" };
      return await fn(id);
    }, prep.alvoId);

    record("invalidar retorna ok", Boolean(invRes?.ok), invRes?.msg || JSON.stringify(invRes));
    await page.waitForTimeout(4000);

    const afterInv = await page.evaluate((id) => {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const arr = raw ? JSON.parse(raw) : [];
      const hit = arr.find((r) => r.id === id);
      const listFn = window.__DK_comprovantesClienteListValidados;
      const validados = typeof listFn === "function" ? listFn() : [];
      const inVerde = validados.some((r) => r.id === id);
      const authority =
        typeof window.__DK_isLocalDataAuthorityActive === "function" &&
        window.__DK_isLocalDataAuthorityActive();
      return {
        hitStatus: hit?.status,
        hitInvalidado: Boolean(hit?.pagamentoInvalidado),
        inVerde,
        authority,
        validadosCount: validados.length,
      };
    }, prep.alvoId);

    record("localStorage: pagamentoInvalidado=true", afterInv.hitInvalidado, `status=${afterInv.hitStatus}`);
    record("localStorage: status rejeitado", afterInv.hitStatus === "rejeitado", afterInv.hitStatus);
    record("não está na lista verde (função)", !afterInv.inVerde, `validados=${afterInv.validadosCount}`);
    record("autoridade local ativa após invalidar", afterInv.authority);

    await page.evaluate(async () => {
      if (typeof window.__DK_refreshComprovantesClienteLista === "function") {
        await window.__DK_refreshComprovantesClienteLista();
      }
    });
    await page.waitForTimeout(3000);

    const afterRefresh = await page.evaluate((id) => {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const arr = raw ? JSON.parse(raw) : [];
      const hit = arr.find((r) => r.id === id);
      const validados = window.__DK_comprovantesClienteListValidados?.() || [];
      return {
        hitInvalidado: Boolean(hit?.pagamentoInvalidado),
        hitStatus: hit?.status,
        inVerde: validados.some((r) => r.id === id),
      };
    }, prep.alvoId);

    record("após refreshComprovantesClienteLista: ainda invalidado", afterRefresh.hitInvalidado);
    record("após refresh: não volta à lista verde", !afterRefresh.inVerde, `status=${afterRefresh.hitStatus}`);

    await page.evaluate(async () => {
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        await window.__DK_pushCloudSnapshotNow();
      }
    });
    await page.waitForTimeout(5000);

    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
      }
    });
    await page.waitForTimeout(3000);

    const afterPush = await page.evaluate((id) => {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const arr = raw ? JSON.parse(raw) : [];
      const hit = arr.find((r) => r.id === id);
      const validados = window.__DK_comprovantesClienteListValidados?.() || [];
      return {
        hitInvalidado: Boolean(hit?.pagamentoInvalidado),
        hitStatus: hit?.status,
        inVerde: validados.some((r) => r.id === id),
      };
    }, prep.alvoId);

    record("após push + pull nuvem: ainda invalidado", afterPush.hitInvalidado);
    record("após push + pull: não volta à lista verde", !afterPush.inVerde, `status=${afterPush.hitStatus}`);

    await page.evaluate(() => {
      if (typeof window.__DK_comprovantesClienteRenderListaValidados === "function") {
        window.__DK_comprovantesClienteRenderListaValidados();
      }
    });
    await page.waitForTimeout(500);

    const rowStillInDom = await page.locator(`[data-dk-inv-pagamento-id="${prep.alvoId}"]`).count();
    record("botão invalidar não reaparece na tabela verde", rowStillInDom === 0, `buttons=${rowStillInDom}`);

    const failed = results.filter((r) => !r.ok);
    console.log(`\n--- ${results.length - failed.length}/${results.length} testes passaram (base: ${BASE}) ---`);
    if (failed.length) {
      console.log("Falhas:", failed.map((f) => f.name).join(", "));
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
