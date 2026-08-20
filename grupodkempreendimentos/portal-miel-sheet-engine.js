/**
 * Motor de renderização MIEL — grelha Excel célula-a-célula (layout exportado da planilha).
 */
(function mielSheetEngine() {
  const EMU_PER_PX = 9525;

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

  function excelWidthPx(w, hidden) {
    if (hidden) return 0;
    if (!w || w <= 0) return 8;
    return Math.max(8, Math.round(w * 7 + 5));
  }

  function colPxList(layout) {
    const hidden = layout.colHidden || [];
    return (layout.colWidths || []).map((w, i) => excelWidthPx(w, hidden[i]));
  }

  function totalWidthPx(layout) {
    return colPxList(layout).reduce((sum, w) => sum + w, 0);
  }

  function rowHeightPx(row) {
    const ht = row?.height || 15;
    return Math.round((ht * 96) / 72);
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
    let cs = cellStyleCss(cell) + (extraStyle ? `;${extraStyle}` : "");
    if (String(cell.text || "").includes("\n") && !/white-space/.test(cs)) {
      cs = (cs ? cs + ";" : "") + "white-space:pre-line";
    }
    const attrs = [];
    if (cell.colspan > 1) attrs.push(`colspan="${cell.colspan}"`);
    if (cell.rowspan > 1) attrs.push(`rowspan="${cell.rowspan}"`);
    if (cell.ref) attrs.push(`data-ref="${cell.ref}"`);
    if (cs) attrs.push(`style="${cs}"`);
    let inner = esc(cell.text);
    if (cell.href) {
      const action = cell.linkDisplay || cell.text || "";
      inner = `<button type="button" class="miel-sheet__link" data-miel-xl-link="${esc(cell.href)}" data-miel-admin-action="${esc(action)}">${inner}</button>`;
    }
    return `<td ${attrs.join(" ")}>${inner}</td>`;
  }

  function renderColgroup(layout) {
    return `<colgroup>${colPxList(layout)
      .map((px) => `<col style="width:${px}px" />`)
      .join("")}</colgroup>`;
  }

  function renderDrawings(layout) {
    const drawings = layout.drawings || [];
    if (!drawings.length) return "";
    const colPx = colPxList(layout);
    const rowPx = (layout.rows || []).map((row) => rowHeightPx(row));
    function xAt(col, off) {
      let x = 0;
      for (let i = 0; i < col && i < colPx.length; i++) x += colPx[i];
      return x + off / EMU_PER_PX;
    }
    function yAt(row, off) {
      let y = 0;
      for (let i = 0; i < row && i < rowPx.length; i++) y += rowPx[i];
      return y + off / EMU_PER_PX;
    }
    return drawings
      .map((d, idx) => {
        const left = Math.round(xAt(d.fromCol, d.fromColOff || 0));
        const top = Math.round(yAt(d.fromRow, d.fromRowOff || 0));
        const right = Math.round(xAt(d.toCol, d.toColOff || 0));
        const bottom = Math.round(yAt(d.toRow, d.toRowOff || 0));
        const w = Math.max(18, right - left);
        const h = Math.max(18, bottom - top);
        const img = d.image ? `<img src="data/miel/media/${esc(d.image)}" alt="${esc(d.name || "comando")}" />` : esc(d.name || "");
        return `<button type="button" class="miel-sheet__shape" data-miel-xl-link="${esc(d.href || "")}" data-miel-shape="${esc(d.name || String(idx))}" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px" title="${esc(d.href || d.name || "")}">${img}</button>`;
      })
      .join("");
  }

  function renderSheet(layout, opts = {}) {
    const { dataRows, patchHeaderCell, cellStyleFn } = opts;
    const zoom = layout.zoom ? layout.zoom / 100 : 1;
    const tableW = totalWidthPx(layout);

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
    const scaledW = Math.round(tableW * zoom);
    return `<div class="miel-sheet-wrap" style="width:${scaledW}px;max-width:100%">
      <div class="miel-sheet" style="transform:scale(${zoom});transform-origin:top left;width:${tableW}px">
        <div class="miel-sheet__scroll">
          <table class="${gridClass}" style="width:${tableW}px">${renderColgroup(layout)}<thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>
          ${renderDrawings(layout)}
        </div>
      </div>
    </div>`;
  }

  window.__DK_mielSheetEngine = { renderSheet, esc, excelWidthPx, numToCol, totalWidthPx, colPxList };
})();
