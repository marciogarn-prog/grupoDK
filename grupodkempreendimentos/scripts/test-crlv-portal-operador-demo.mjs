/**
 * E2E demo: portal operador — tela Cadastro de locação mostra CRLV enviado.
 * node grupodkempreendimentos/scripts/test-crlv-portal-operador-demo.mjs
 */
import { chromium } from "playwright";

const BASE_URL = "https://demo.grupodkempreendimentos.com.br/";
const CASO = { cpf: "104.554.034-06", cpfDig: "10455403406", proto: "2025111301", placa: "UHK6J56" };

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));

try {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    localStorage.removeItem("dk_instalacao_limpa_v1");
  });
  await page.goto(`${BASE_URL}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(
    () => {
      const panel = document.getElementById("panel-logado");
      const btnOp = document.getElementById("btn-locadora-operacao");
      return panel && !panel.classList.contains("hidden") && btnOp && !btnOp.classList.contains("hidden");
    },
    { timeout: 45000 }
  );
  record("login admin portal demo", true);

  await page.click("#btn-locadora-operacao");
  await page.waitForTimeout(1200);

  const btnLocacao = page.locator("#btn-operacao-cadastro-locacao");
  await btnLocacao.waitFor({ state: "visible", timeout: 20000 });
  await btnLocacao.click();
  await page.waitForTimeout(1000);

  const cpfInput = page.locator("#operacaoLocacaoCpf");
  await cpfInput.waitFor({ state: "visible", timeout: 20000 });
  await cpfInput.fill(CASO.cpf);
  await cpfInput.blur();
  record("campo CPF locação preenchido", true, CASO.cpf);

  await page.waitForFunction(
    (proto) => {
      const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
      if (!sel) return false;
      return Array.from(sel.options || []).some((o) => String(o.value).includes(proto));
    },
    CASO.proto,
    { timeout: 45000 }
  ).catch(() => null);

  const protoSel = await page.evaluate((proto) => {
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    if (!sel) return { ok: false, reason: "select_nao_encontrado" };
    const opt = Array.from(sel.options || []).find((o) => String(o.value).includes(proto));
    if (!opt) {
      return {
        ok: false,
        reason: "protocolo_ausente",
        opcoes: Array.from(sel.options || []).map((o) => o.value).slice(0, 8),
      };
    }
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, value: opt.value };
  }, CASO.proto);
  record("protocolo no selector", protoSel.ok === true, JSON.stringify(protoSel).slice(0, 140));

  await page.waitForTimeout(4000);

  const docState = await page.evaluate(() => {
    const ul = document.getElementById("operacaoLocacaoDocumentosListaCrlv");
    const txt = ul ? ul.textContent || "" : "(lista CRLV não encontrada)";
    const enviadoBtn = ul?.querySelector("[data-loc-doc-enviar]");
    return {
      temLista: Boolean(ul),
      texto: txt.replace(/\s+/g, " ").trim().slice(0, 200),
      botaoEnviar: enviadoBtn ? enviadoBtn.textContent.trim() : null,
      botaoDesativado: enviadoBtn ? enviadoBtn.disabled : null,
    };
  });
  record(
    "CRLV listado no protocolo",
    docState.temLista && /CRLV/i.test(docState.texto),
    docState.texto.slice(0, 120)
  );
  record(
    "estado «Enviado» no portal",
    docState.botaoEnviar === "Enviado" && docState.botaoDesativado === true,
    `botão=${docState.botaoEnviar} disabled=${docState.botaoDesativado}`
  );
  record(
    "status nuvem no cartão",
    /Enviado e confirmado na nuvem/i.test(docState.texto),
    /Enviado e confirmado/i.test(docState.texto) ? "confirmado" : docState.texto.slice(0, 120)
  );
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
