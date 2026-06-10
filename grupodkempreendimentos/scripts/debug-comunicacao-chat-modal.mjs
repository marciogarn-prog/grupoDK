import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);

const info = await page.evaluate(async () => {
  if (typeof window.__DK_pullComunicacaoOperacaoFromCloudMerge === "function") {
    await window.__DK_pullComunicacaoOperacaoFromCloudMerge();
  }
  const pendentes =
    typeof window.__DK_comunicacaoListarPendentes === "function"
      ? window.__DK_comunicacaoListarPendentes("vendas")
      : [];
  const marcus = pendentes.find((p) => String(p.nome || "").toUpperCase().includes("MARCUS"));
  if (!marcus) {
    return { err: "no marcus pending", pendentes: pendentes.slice(0, 5) };
  }
  const tid = marcus.threadId;
  const hist =
    typeof window.__DK_comunicacaoHistorico === "function"
      ? window.__DK_comunicacaoHistorico(tid)
      : [];
  const all = JSON.parse(localStorage.getItem("dk_comunicacao_operacao_v1") || "[]");
  const byCpf = all.filter(
    (m) =>
      String(m?.cpf || "").replace(/\D/g, "").slice(0, 11) === marcus.cpf &&
      (m?.setor === "vendas" || m?.setor === "manutencao")
  );
  const byExactThread = all.filter((m) => m?.threadId === tid);
  const byComputed = all.filter((m) => {
    const mtid =
      m?.threadId ||
      (typeof window.__DK_comunicacaoThreadId === "function"
        ? window.__DK_comunicacaoThreadId(m?.cpf, m?.setor)
        : "");
    return mtid === tid;
  });
  return {
    marcus,
    histLen: hist.length,
    histSample: hist.slice(-3).map((m) => ({ autor: m.autor, texto: m.texto, threadId: m.threadId })),
    byExactThread: byExactThread.length,
    byComputed: byComputed.length,
    byCpfVendas: byCpf.filter((m) => m.setor === "vendas").length,
    msgsWithoutThreadId: all.filter((m) => !m?.threadId && String(m?.cpf || "").includes("6523244440")).length,
  };
});
console.log(JSON.stringify(info, null, 2));

if (info.marcus) {
  const modal = await page.evaluate(async (marcus) => {
    const t0 = Date.now();
    let pullMs = null;
    let pullResult = null;
    try {
      const p = window.__DK_pullComunicacaoOperacaoFromCloudMerge?.();
      if (p) {
        pullResult = await Promise.race([
          p,
          new Promise((_, rej) => window.setTimeout(() => rej(new Error("pull timeout")), 15000)),
        ]);
        pullMs = Date.now() - t0;
      }
    } catch (e) {
      pullMs = Date.now() - t0;
      pullResult = { err: String(e?.message || e) };
    }
    const el = document.getElementById("portalComunicacaoVendasLista");
    const pendentes = window.__DK_comunicacaoListarPendentes("vendas");
    if (el) {
      el.innerHTML = pendentes
        .map(
          (p) =>
            `<button type="button" class="portal-comunicacao-inbox__item" data-chat-thread="${p.threadId}" data-chat-setor="${p.setor}" data-chat-cpf="${p.cpf}" data-chat-nome="${p.nome}" data-chat-placa="${p.placa || ""}">${p.nome}</button>`
        )
        .join("");
    }
    const btn = document.querySelector(`[data-chat-thread="${marcus.threadId}"]`);
    btn?.click();
    await new Promise((r) => window.setTimeout(r, 12000));
    const tid = marcus.threadId;
    const corpo = document.getElementById("portalComunicacaoChatCorpo");
    const hist = window.__DK_comunicacaoHistorico(tid);
    // manual render test
    const manualHtml = hist
      .slice(0, 2)
      .map((m) => `<div class="dk-chat-bubble">${String(m.texto || "")}</div>`)
      .join("");
    return {
      pullMs,
      pullResult,
      clicked: Boolean(btn),
      histLen: hist.length,
      manualHtmlLen: manualHtml.length,
      titulo: document.getElementById("portalComunicacaoChatTitulo")?.textContent,
      corpoHtml: corpo?.innerHTML?.slice(0, 800),
      bubbleCount: corpo?.querySelectorAll(".dk-chat-bubble")?.length || 0,
      hidden: document.getElementById("portalComunicacaoChatModal")?.classList.contains("hidden"),
      hasUiScript: typeof window.__DK_portalComunicacaoRefresh === "function",
    };
  }, info.marcus);
  console.log("MODAL:", JSON.stringify(modal, null, 2));
}

await browser.close();
