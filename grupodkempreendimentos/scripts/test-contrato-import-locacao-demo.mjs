/**
 * E2E demo: contrato importado na locação mostra Visualizar/Confirmar/Enviar/Excluir
 * (paridade com CRLV — inclui PDF nomeado só por protocolo).
 * node grupodkempreendimentos/scripts/test-contrato-import-locacao-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));

try {
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
    const b = document.getElementById("btn-locadora-operacao");
    return p && !p.classList.contains("hidden") && b && !b.classList.contains("hidden");
  }, { timeout: 45000 });
  await page.waitForFunction(
    () =>
      typeof window.__DK_docsLocacaoInferTipo === "function" &&
      typeof window.__DK_refreshOperacaoLocacaoDocumentosUi === "function"
  );

  const infer = await page.evaluate(() => ({
    protoPdf: window.__DK_docsLocacaoInferTipo({ nome: "2026021301.pdf" }),
    crlv: window.__DK_docsLocacaoInferTipo({ nome: "CRLVDigital_X.pdf" }),
  }));
  console.log("inferDocTipo:", infer);

  let ok = true;
  if (infer.protoPdf === "contrato" && infer.crlv === "crlv") {
    console.log("PASS | inferDocTipo reconhece contrato por protocolo.pdf");
  } else {
    console.error("FAIL | inferDocTipo", infer);
    ok = false;
  }

  const caso = await page.evaluate(() => {
    const dig = (s) => String(s ?? "").replace(/\D/g, "");
    const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    let locs = [];
    try {
      locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
    } catch {
      locs = [];
    }
    const ativa = (l) => !String(l.fim || l.dataFim || "").trim();
    const hit = locs.find((l) => {
      const nc = norm(l.numeroContrato);
      const cpf = dig(l.cpf).slice(0, 11);
      return nc && cpf.length === 11 && ativa(l);
    });
    if (!hit) return null;
    return { cpfDig: dig(hit.cpf).slice(0, 11), proto: norm(hit.numeroContrato) };
  });

  if (!caso) {
    console.error("FAIL | nenhuma locação ativa para teste");
    process.exit(1);
  }

  await page.click("#btn-locadora-operacao");
  await page.waitForTimeout(1200);
  await page.click("#btn-operacao-cadastro-locacao");
  await page.waitForTimeout(1000);

  const cpfFmt = `${caso.cpfDig.slice(0, 3)}.${caso.cpfDig.slice(3, 6)}.${caso.cpfDig.slice(6, 9)}-${caso.cpfDig.slice(9)}`;
  await page.fill("#operacaoLocacaoCpf", cpfFmt);
  await page.dispatchEvent("#operacaoLocacaoCpf", "input");
  await page.waitForTimeout(1500);

  await page.evaluate((proto) => {
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const opt = Array.from(sel?.options || []).find((o) => String(o.value).includes(proto));
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, caso.proto);
  await page.waitForTimeout(1500);

  const ui = await page.evaluate(({ proto, cpfDig }) => {
    const pdfMini =
      "data:application/pdf;base64," +
      btoa("%PDF-1.4\n% contrato e2e\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
    const docs = [
      {
        id: `ld_e2e_contrato_${Date.now()}`,
        numeroContrato: proto,
        cpf: cpfDig,
        nome: `${proto}.pdf`,
        mimeType: "application/pdf",
        tamanho: 120,
        createdAt: Date.now(),
        registradoPorCpf: "03037897430",
        registradoPorNome: "E2E",
        arquivoBase64: pdfMini,
        origemDepositoId: `doc_e2e_${proto}`,
        origemDepositoCategoria: "contrato",
        enviadoCliente: false,
        conferidoOperador: false,
      },
    ];
    localStorage.setItem("dk_locacao_documentos_v1", JSON.stringify(docs));
    window.__DK_refreshOperacaoLocacaoDocumentosUi?.();
    const ul = document.getElementById("operacaoLocacaoDocumentosListaContrato");
    const html = ul?.innerHTML || "";
    return {
      proto,
      hasVisualizar: html.includes("data-loc-doc-visualizar"),
      hasConfirmar: html.includes("data-loc-doc-confirmar"),
      hasEnviar: html.includes("data-loc-doc-enviar"),
      hasExcluir: html.includes("data-loc-doc-excluir"),
      snippet: html.slice(0, 320),
    };
  }, caso);

  console.log(JSON.stringify(ui, null, 2));

  if (ui.hasVisualizar && ui.hasConfirmar && ui.hasEnviar && ui.hasExcluir) {
    console.log("PASS | lista contrato com botões Visualizar/Confirmar/Enviar/Excluir");
  } else {
    console.error("FAIL | lista contrato sem botões", ui);
    ok = false;
  }

  console.log(ok ? "CONTRATO IMPORT LOCACAO E2E OK" : "CONTRATO IMPORT LOCACAO E2E FAIL");
  process.exit(ok ? 0 : 1);
} finally {
  await browser.close();
}
