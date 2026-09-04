/**
 * PDF (imprimir) dos relatórios de rotatividade e inatividade.
 * Usa iframe oculto — sem pop-up (noopener deixava a folha em branco).
 */
(function dkRelatorioOperacaoPdf() {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function framePdf() {
    let f = document.getElementById("dkRelatorioOperacaoPdfFrame");
    if (!f) {
      f = document.createElement("iframe");
      f.id = "dkRelatorioOperacaoPdfFrame";
      f.title = "Folha do relatório para PDF";
      f.setAttribute("aria-hidden", "true");
      f.style.cssText = "position:fixed;width:0;height:0;border:0;left:0;bottom:0;opacity:0;pointer-events:none;";
      document.body.appendChild(f);
    }
    return f;
  }

  function abrirPdf(opts) {
    const titulo = String(opts.titulo || "Relatório");
    const hint = String(document.getElementById(opts.hintId)?.textContent || "").trim();
    const resumo = document.getElementById(opts.resumoId)?.innerHTML || "";
    const lista = document.getElementById(opts.listaId)?.innerHTML || "";
    const caixa = document.getElementById(opts.caixaId);
    const caixaTxt = caixa
      ? `${caixa.querySelector("span")?.textContent || ""}: ${caixa.querySelector("strong")?.textContent || ""}`
      : "";
    if (!lista.trim() && !resumo.trim()) {
      window.alert("Atualize o relatório antes de gerar o PDF.");
      return;
    }
    const inatividade = opts.modo === "inatividade";
    const umDia = inatividade && (lista.match(/class="portal-rotatividade-dia[\s"]/g) || []).length === 1;
    const bodyClass = [inatividade ? "inatividade" : "", umDia ? "um-dia" : ""].filter(Boolean).join(" ");
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${esc(titulo)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 16px; background: #fff; }
    h1 { margin: 0 0 6px; font-size: 18px; }
    .meta { margin: 0 0 12px; font-size: 12px; color: #333; }
    .folha { display: block; }
    .portal-rotatividade__resumo { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; page-break-after: avoid; break-after: avoid; }
    .portal-rotatividade-kpi { border: 1px solid #bbb; padding: 8px 10px; min-width: 8.5rem; background: #fff; }
    .portal-rotatividade-kpi__lab { display: block; font-size: 10px; text-transform: uppercase; color: #444; margin-bottom: 2px; }
    .portal-rotatividade-kpi strong { font-size: 14px; color: #111; }
    .portal-rotatividade__lista { display: flex; flex-direction: column; gap: 12px; page-break-before: avoid; break-before: avoid; }
    .portal-rotatividade-dia { border: 1px solid #ccc; page-break-inside: avoid; }
    .portal-rotatividade-dia__data { margin: 0; padding: 6px 8px; font-size: 13px; background: #f3f3f3; border-bottom: 1px solid #ccc; }
    .portal-rotatividade-dia__cols { display: grid; grid-template-columns: 1fr 1fr; }
    .portal-rotatividade-dia__col { padding: 8px; }
    .portal-rotatividade-dia__col--ent { border-right: 1px solid #ccc; }
    .portal-rotatividade-dia__col-title { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; color: #333; }
    .portal-rotatividade-row { display: grid; grid-template-columns: 6.2rem 1fr 7.5rem 5.2rem; gap: 4px 6px; font-size: 11px; padding: 3px 0; border-bottom: 1px solid #eee; color: #111; }
    .portal-rotatividade-row__proto { font-weight: 700; }
    .portal-rotatividade-row__cli { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .portal-rotatividade-row__val { text-align: right; }
    .portal-rotatividade-empty { margin: 0; font-size: 11px; color: #555; }
    .portal-inatividade-row--head { font-size: 9px; text-transform: uppercase; color: #555; font-weight: 700; }
    body.inatividade .portal-rotatividade-dia__cols { display: flex; flex-direction: column; grid-template-columns: 1fr; }
    body.inatividade .portal-rotatividade-dia__col--ent { border-right: 0; }
    body.inatividade .portal-rotatividade-dia__col--sai { border-bottom: 1px solid #ccc; }
    body.inatividade .portal-rotatividade-row { grid-template-columns: 5.2rem minmax(7rem, 1.8fr) 5rem 6rem 5.8rem 6.5rem 4.4rem; }
    body.inatividade .portal-rotatividade-row__cor { text-transform: uppercase; }
    body.inatividade .portal-rotatividade-row__fim { font-variant-numeric: tabular-nums; white-space: nowrap; }
    body.inatividade .portal-rotatividade-row__loc { font-size: 10px; text-transform: uppercase; }
    body.inatividade .portal-inatividade-row--pronto,
    body.inatividade .portal-inatividade-row--pronto span { color: #15803d; }
    body.inatividade .portal-inatividade-row--roubo { background: #fecaca; }
    body.inatividade .portal-inatividade-row--roubo,
    body.inatividade .portal-inatividade-row--roubo span { color: #7f1d1d; font-weight: 700; }
    body.um-dia { padding: 6px 8px; }
    body.um-dia h1 { font-size: 14px; margin-bottom: 2px; }
    body.um-dia .meta { font-size: 10px; margin-bottom: 6px; }
    body.um-dia .folha { page-break-inside: avoid; break-inside: avoid; }
    body.um-dia .portal-rotatividade__resumo { gap: 4px; margin: 0 0 6px; }
    body.um-dia .portal-rotatividade-kpi { padding: 4px 6px; min-width: 6.2rem; }
    body.um-dia .portal-rotatividade-kpi strong { font-size: 12px; }
    body.um-dia .portal-rotatividade__lista { gap: 6px; }
    body.um-dia .portal-rotatividade-dia { page-break-inside: avoid; }
    body.um-dia .portal-rotatividade-dia__data { padding: 4px 6px; font-size: 11px; }
    body.um-dia .portal-rotatividade-dia__col { padding: 4px 6px; }
    body.um-dia .portal-rotatividade-dia__col-title { margin-bottom: 3px; font-size: 9px; }
    body.um-dia .portal-rotatividade-row { font-size: 9px; padding: 1px 0; gap: 2px 5px; }
    @media print {
      body { padding: 8px; }
      body.um-dia { padding: 0; }
      .portal-rotatividade-dia { break-inside: avoid; }
      .portal-rotatividade__resumo { break-after: avoid; }
      .portal-rotatividade__lista { break-before: avoid; }
    }
  </style>
</head>
<body class="${bodyClass}">
  <h1>${esc(titulo)}</h1>
  <p class="meta">${esc(hint)}${caixaTxt ? ` · ${esc(caixaTxt)}` : ""}</p>
  <div class="folha">
  <div class="portal-rotatividade__resumo">${resumo}</div>
  <div class="portal-rotatividade__lista">${lista}</div>
  </div>
</body>
</html>`;
    const f = framePdf();
    const doc = f.contentDocument || f.contentWindow?.document;
    const w = f.contentWindow;
    if (!doc || !w) {
      window.alert("Não foi possível montar o PDF neste navegador.");
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const imprimir = () => {
      try {
        w.focus();
        w.print();
      } catch {
        window.alert("Não foi possível abrir a impressão. Tente de novo.");
      }
    };
    if (doc.readyState === "complete") setTimeout(imprimir, 80);
    else f.onload = () => setTimeout(imprimir, 80);
  }

  function bind(btnId, atualizarId, opts) {
    document.getElementById(btnId)?.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById(atualizarId)?.click();
      abrirPdf(opts);
    });
  }

  function init() {
    bind("operacaoRotatividadePdfBtn", "operacaoRotatividadeAtualizarBtn", {
      titulo: "Relatório de rotatividade — Grupo DK",
      hintId: "operacaoRotatividadeHint",
      resumoId: "operacaoRotatividadeResumo",
      listaId: "operacaoRotatividadeLista",
      caixaId: "operacaoRotatividadeReceitaAtualBox",
    });
    bind("operacaoInatividadePdfBtn", "operacaoInatividadeAtualizarBtn", {
      titulo: "Relatório de inatividade — Grupo DK",
      hintId: "operacaoInatividadeHint",
      resumoId: "operacaoInatividadeResumo",
      listaId: "operacaoInatividadeLista",
      caixaId: "operacaoInatividadeLivresAgoraBox",
      modo: "inatividade",
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
