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
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
    );
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
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

  const ui = await page.evaluate(() => {
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
    if (!hit) return { ok: false, reason: "sem_locacao_ativa" };

    const proto = norm(hit.numeroContrato);
    const cpfDig = dig(hit.cpf).slice(0, 11);
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

    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const cpfEl = document.getElementById("operacaoLocacaoCpf");
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    if (hid) hid.value = proto;
    if (cpfEl && typeof formatCpf === "function") cpfEl.value = formatCpf(cpfDig);
    if (sel) {
      const opt = Array.from(sel.options).find((o) => norm(o.value) === proto);
      if (opt) sel.value = opt.value;
    }

    window.__DK_refreshOperacaoLocacaoDocumentosUi?.();
    const ul = document.getElementById("operacaoLocacaoDocumentosListaContrato");
    const html = ul?.innerHTML || "";
    return {
      ok: true,
      proto,
      hasVisualizar: html.includes("data-loc-doc-visualizar"),
      hasConfirmar: html.includes("data-loc-doc-confirmar"),
      hasEnviar: html.includes("data-loc-doc-enviar"),
      hasExcluir: html.includes("data-loc-doc-excluir"),
      snippet: html.slice(0, 280),
    };
  });

  console.log(JSON.stringify(ui, null, 2));

  if (ui.ok && ui.hasVisualizar && ui.hasConfirmar && ui.hasEnviar && ui.hasExcluir) {
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
