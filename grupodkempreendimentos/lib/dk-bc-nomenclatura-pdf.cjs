/**
 * PDF de nomenclatura BC (lista verificável, sem PII).
 * Formato de linha: NOMENCLATURA | BC_ID | ORIGEM | ESTADO | BC_NO
 * Enquanto A–J não estão ativos: prefixo CENTRAL + bc_no zero-pad.
 */
function padBcNo(n) {
  const x = Number(n) || 0;
  return String(x).padStart(12, "0");
}

function nomenclaturaCentral(bcNo) {
  return `CENTRAL-${padBcNo(bcNo)}`;
}

function escapePdfText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildLinesFromRows(rows, meta = {}) {
  const generatedAt = meta.generatedAt || new Date().toISOString();
  const lines = [];
  const estados = {};
  for (const r of rows) {
    const k = r.estado || "-";
    estados[k] = (estados[k] || 0) + 1;
  }
  lines.push("SISTEMA DK — NOMENCLATURA BC (LISTA OFICIAL)");
  lines.push(`Gerado em: ${generatedAt}`);
  lines.push(`Total linhas: ${rows.length}`);
  lines.push(`Totais por estado: ${Object.entries(estados).map(([k, n]) => `${k}=${n}`).join(", ") || "-"}`);
  lines.push("Formato: NOMENCLATURA | BC_ID | ORIGEM | ESTADO | BC_NO");
  lines.push("Prefixos A-J: nao inventados para BC anteriores as VMs (somente CENTRAL).");
  lines.push("---");
  for (const r of rows) {
    const nome = r.nomenclatura || nomenclaturaCentral(r.bc_no);
    lines.push(
      `${nome} | ${r.bc_id} | ${r.origem || "-"} | ${r.estado || "-"} | ${r.bc_no}`
    );
  }
  if (rows.length) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    lines.push("---");
    lines.push(
      `INTERVALO: ${first.nomenclatura || nomenclaturaCentral(first.bc_no)} ate ${last.nomenclatura || nomenclaturaCentral(last.bc_no)}`
    );
  }
  return lines;
}

/** Gera PDF texto multi-página (Helvetica), sem dependências. */
function buildPdfFromLines(lines) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const fontSize = 8;
  const lineHeight = 10;
  const usable = pageHeight - margin * 2;
  const linesPerPage = Math.max(1, Math.floor(usable / lineHeight));
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push(["(lista vazia)"]);

  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  const kids = [];
  const contentIds = [];
  for (const pageLines of pages) {
    const content = [
      "BT",
      `/F1 ${fontSize} Tf`,
      `${margin} ${pageHeight - margin - fontSize} Td`,
      `${lineHeight} TL`,
    ];
    pageLines.forEach((line, idx) => {
      const t = escapePdfText(line);
      if (idx === 0) content.push(`(${t}) Tj`);
      else content.push(`T* (${t}) Tj`);
    });
    content.push("ET");
    const stream = content.join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
  }

  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (let i = 0; i < pages.length; i++) {
    const pageId = add(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    );
    kids.push(pageId);
  }
  const pagesId = add(`<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${kids.length} >>`);
  // patch Parent refs
  for (const kid of kids) {
    objects[kid - 1] = objects[kid - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
  pdf += `startxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function extractPdfTextProbe(buffer) {
  const text = Buffer.from(buffer || []).toString("latin1");
  const streams = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(text))) streams.push(m[1]);
  const joined = streams.join("\n");
  const tj = [...joined.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)].map((x) =>
    x[0]
      .replace(/\s*Tj$/, "")
      .replace(/^\(/, "")
      .replace(/\)$/, "")
      .replace(/\\([\\()])/g, "$1")
  );
  const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return { pageCount, extractedLines: tj, bytes: Buffer.byteLength(buffer || []) };
}

function validateBcNomenclaturaPdf(buffer, expectedRows) {
  const probe = extractPdfTextProbe(buffer);
  const issues = [];
  if (!probe.pageCount || probe.pageCount < 1) issues.push("paginas_ausentes");
  if (!probe.extractedLines.length) issues.push("texto_nao_extraido");
  if (expectedRows != null && probe.extractedLines.length < Number(expectedRows)) {
    issues.push("linhas_insuficientes");
  }
  const hasHeader = probe.extractedLines.some((l) => /NOMENCLATURA BC/i.test(l));
  if (!hasHeader) issues.push("cabecalho_ausente");
  const hasFirst = probe.extractedLines.some((l) => /CENTRAL-000000000001|BC000000000001/.test(l));
  if (expectedRows > 0 && !hasFirst) issues.push("primeira_linha_ausente");
  return {
    ok: issues.length === 0,
    issues,
    pageCount: probe.pageCount,
    extractedLines: probe.extractedLines.length,
    bytes: probe.bytes,
  };
}

function buildBcNomenclaturaPdf(rows, meta = {}) {
  const normalized = (rows || [])
    .map((r) => ({
      bc_id: r.bc_id,
      bc_no: Number(r.bc_no),
      origem: r.origem,
      estado: r.estado,
      nomenclatura: r.nomenclatura || nomenclaturaCentral(r.bc_no),
    }))
    .filter((r) => r.bc_id && Number.isFinite(r.bc_no))
    .sort((a, b) => a.bc_no - b.bc_no);
  // Nunca inventar prefixo A–J para BC anteriores às VMs.
  const lines = buildLinesFromRows(normalized, meta);
  const pdf = buildPdfFromLines(lines);
  const validation = validateBcNomenclaturaPdf(pdf, normalized.length);
  return {
    ok: validation.ok,
    reason: validation.ok ? null : validation.issues.join(","),
    validation,
    lines: lines.length,
    rows: normalized.length,
    buffer: pdf,
    filename: meta.filename || `dk-bc-nomenclatura-${new Date().toISOString().slice(0, 10)}.pdf`,
    first: normalized[0] || null,
    last: normalized[normalized.length - 1] || null,
  };
}

/**
 * Busca vigentes via REST (service role). Sem PII.
 */
async function fetchBcRowsForPdf(opts = {}) {
  const base =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://ppxtwqvzgujllfzarpuz.supabase.co";
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) return { ok: false, reason: "service_role_missing", rows: [] };

  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const url = `${base.replace(/\/$/, "")}/rest/v1/dk_bc_registro?select=bc_id,bc_no,origem,estado&vigente=eq.true&order=bc_no.asc&offset=${from}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `http_${res.status}`, detail: text.slice(0, 200), rows };
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    for (const r of batch) {
      rows.push({
        bc_id: r.bc_id,
        bc_no: r.bc_no,
        origem: r.origem,
        estado: r.estado,
        nomenclatura: nomenclaturaCentral(r.bc_no),
      });
    }
    if (batch.length < pageSize) break;
    from += pageSize;
    if (opts.maxRows && rows.length >= opts.maxRows) break;
  }
  return { ok: true, rows };
}

async function buildBcNomenclaturaPdfFromCloud(meta = {}) {
  const fetched = await fetchBcRowsForPdf(meta);
  if (!fetched.ok) return { ok: false, reason: fetched.reason, detail: fetched.detail };
  return buildBcNomenclaturaPdf(fetched.rows, meta);
}

module.exports = {
  nomenclaturaCentral,
  buildBcNomenclaturaPdf,
  buildBcNomenclaturaPdfFromCloud,
  fetchBcRowsForPdf,
  buildLinesFromRows,
  buildPdfFromLines,
  validateBcNomenclaturaPdf,
  extractPdfTextProbe,
};
