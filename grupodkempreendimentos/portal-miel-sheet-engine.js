/**
 * Motor de renderização MIEL — grelha Excel célula-a-célula (layout exportado da planilha).
 */
(function mielSheetEngine() {
  function numToCol(n) {
    let s = "";
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function excelWidthPx(w) {
    if (!w || w <= 0) return 0;
    return Math.max(0, Math.round(w * 7 + 5));
  }

  function cellStyleCss(cell) {
    const parts = [];
    if (cell.fill) parts.push(`background:${cell.fill}`);
    if (cell.color) parts.push(`color:${cell.color}`);
    if (cell.bold) parts.push("font-weight:700");
    if (cell.sz) parts.push(`font-size:${cell.sz}pt`);
    return parts.join(";");
  }

  function renderCell(cell, extraStyle) {
    if (!cell) return "";
    const cs = cellStyleCss(cell) + (extraStyle ? `;${extraStyle}` : "");
    const attrs = [];
    if (cell.colspan > 1) attrs.push(`colspan="${cell.colspan}"`);
    if (cell.rowspan > 1) attrs.push(`rowspan="${cell.rowspan}"`);
    if (cs) attrs.push(`style="${cs}"`);
    return `<td ${attrs.join(" ")}>${esc(cell.text)}</td>`;
  }

  function renderColgroup(colWidths) {
    return `<colgroup>${colWidths
      .map((w) => {
        const px = excelWidthPx(w);
        if (px <= 0) return `<col style="width:0;visibility:hidden" />`;
        return `<col style="width:${px}px" />`;
      })
      .join("")}</colgroup>`;
  }

  function renderSheet(layout, opts = {}) {
    const { dataRows, patchHeaderCell, cellStyleFn } = opts;
    const zoom = layout.zoom ? layout.zoom / 100 : 1;
    const headerHtml = layout.rows
      .map((row) => {
        const ht = row.height ? ` style="height:${row.height}pt"` : "";
        const cells = row.cells.map((cell) => {
          const patch = patchHeaderCell ? patchHeaderCell(cell, row.row) : null;
          const c = patch ? { ...cell, ...patch } : cell;
          return renderCell(c);
        });
        return `<tr class="miel-sheet__row miel-sheet__row--h${row.row}"${ht}>${cells.join("")}</tr>`;
      })
      .join("");

    let bodyHtml = "";
    if (typeof dataRows === "function") {
      const maxCol = layout.colWidths?.length || 19;
      const letters = [];
      for (let c = 1; c <= maxCol; c++) letters.push(numToCol(c));
      const styles = {};
      layout.dataCols?.forEach((d) => {
        styles[d.col] = d.style;
      });

      const rows = dataRows(layout) || [];
      bodyHtml = rows
        .map((rowData, idx) => {
          const cells = letters.map((col) => {
            const val = rowData[col] ?? "";
            const base = styles[col] || { fill: null, color: null, bold: false, sz: 11 };
            let cell = { text: val, ...base };
            if (typeof cellStyleFn === "function") {
              const extra = cellStyleFn(col, val, rowData);
              if (extra) cell = { ...cell, ...extra };
            }
            return renderCell(cell);
          });
          return `<tr class="miel-sheet__row miel-sheet__row--data" data-miel-row="${idx}">${cells.join("")}</tr>`;
        })
        .join("");
    }

    const gridClass = layout.showGridLines ? "miel-sheet__grid" : "miel-sheet__grid miel-sheet__grid--no-lines";
    return `<div class="miel-sheet" style="zoom:${zoom}"><div class="miel-sheet__scroll"><table class="${gridClass}">${renderColgroup(layout.colWidths)}<thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div></div>`;
  }

  window.__DK_mielSheetEngine = { renderSheet, esc, excelWidthPx, numToCol };
})();
