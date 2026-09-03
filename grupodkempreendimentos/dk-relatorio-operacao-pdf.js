/**
 * PDF (imprimir) dos relatórios de rotatividade e inatividade.
 */
(function dkRelatorioOperacaoPdf() {
  function abrirPdf(opts) {
    const titulo = String(opts.titulo || "Relatório");
    const hint = String(document.getElementById(opts.hintId)?.textContent || "").trim();
    const resumo = document.getElementById(opts.resumoId)?.innerHTML || "";
    const lista = document.getElementById(opts.listaId)?.innerHTML || "";
    const caixa = document.getElementById(opts.caixaId);
    const caixaTxt = caixa
      ? `${caixa.querySelector("span")?.textContent || ""}: ${caixa.querySelector("strong")?.textContent || ""}`
      : "";
    const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!win) {
      window.alert("Permita janelas pop-up para gerar o PDF do relatório.");
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; padding: 18px; }
    h1 { margin: 0 0 6px; font-size: 20px; }
    .meta { margin: 0 0 12px; font-size: 12px; color: #333; }
    .resumo { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; }
    .kpi { border: 1px solid #ccc; padding: 8px 10px; min-width: 9rem; }
    .kpi span { display: block; font-size: 10px; text-transform: uppercase; color: #555; }
    .kpi strong { font-size: 14px; }
    .dia { page-break-inside: avoid; margin: 0 0 14px; }
    .dia h4 { margin: 0 0 6px; font-size: 14px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .col { border: 1px solid #ddd; padding: 8px; }
    .col-title { display: block; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
    .row { display: grid; grid-template-columns: 7rem 1fr 8rem 5.5rem; gap: 6px; font-size: 11px; padding: 3px 0; border-bottom: 1px solid #eee; }
    .empty { font-size: 11px; color: #666; margin: 0; }
    @media print { body { padding: 8px; } }
  </style>
</head>
<body>
  <h1>${titulo}</h1>
  <p class="meta">${hint || ""}${caixaTxt ? ` · ${caixaTxt}` : ""}</p>
  <div class="resumo">${resumo}</div>
  <div class="lista">${lista}</div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* ignore */
      }
    }, 250);
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
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
