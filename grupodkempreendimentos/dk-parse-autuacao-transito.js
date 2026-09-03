/**
 * Lê o texto de uma autuação de trânsito (portal municipal / DETRAN / RENAINF)
 * e devolve os campos usados no Lançamento de multas.
 */
(function dkParseAutuacaoTransito(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.__DK_parseAutuacaoTransito = api.parseAutuacaoTransito;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  function norm(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\r/g, "");
  }

  function afterLabel(text, labels) {
    const src = norm(text);
    for (const label of labels) {
      const re = new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n]+)`, "i");
      const m = src.match(re);
      if (m && String(m[1] || "").trim()) return String(m[1]).trim();
    }
    return "";
  }

  function parsePlaca(text) {
    const src = norm(text).toUpperCase();
    const labeled = src.match(/PLACA[^\nA-Z0-9]{0,40}([A-Z]{3}\s?[0-9][A-Z0-9][0-9]{2})/);
    const raw = labeled ? labeled[1] : (src.match(/\b([A-Z]{3}\s?[0-9][A-Z0-9][0-9]{2})\b/) || [])[1];
    return String(raw || "").replace(/\s+/g, "");
  }

  function parseDataHora(text) {
    const src = norm(text);
    const labeled = src.match(
      /(?:data\s*\/?\s*hora|cometimento|infra[cç][aã]o)[^\n]{0,80}?(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(\d{1,2}:\d{2}))?/i
    );
    const loose = src.match(/(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(\d{1,2}:\d{2}))?/);
    const hit = labeled || loose;
    if (!hit) return { data: "", hora: "" };
    const p = String(hit[1]).split("/");
    const data = `${p[0].padStart(2, "0")}/${p[1].padStart(2, "0")}/${p[2]}`;
    const hora = hit[2] ? String(hit[2]).padStart(5, "0") : "";
    return { data, hora };
  }

  function parseValor(text) {
    const src = norm(text);
    const labeled = src.match(/valor(?:\s+original)?[^\n]{0,40}?R\$\s*([0-9.]{1,12},[0-9]{2})/i);
    const any = src.match(/R\$\s*([0-9.]{1,12},[0-9]{2})/);
    const raw = (labeled || any) ? (labeled || any)[1] : "";
    if (!raw) return 0;
    const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function parseCodigo(text) {
    const src = norm(text);
    const labeled = src.match(/c[oó]digo\s+da\s+infra[cç][aã]o\s*[:\\-]?\s*([0-9]{3,5}\s*[-–]?\s*[0-9])/i);
    const loose = src.match(/\b([0-9]{4}\s*[-–]\s*[0-9])\b/);
    const raw = labeled ? labeled[1] : loose ? loose[1] : "";
    return String(raw || "").replace(/\s+/g, "").replace("–", "-");
  }

  function parseAuto(text) {
    const src = norm(text).toUpperCase();
    const labeled = src.match(/AUTO\s+DE\s+INFRA[CÇ][AÃ]O\s*[:\\-]?\s*([A-Z]{1,3}[0-9]{6,12})/);
    const loose = src.match(/\b([A-Z]{2}[0-9]{7,10})\b/);
    return labeled ? labeled[1] : loose ? loose[1] : "";
  }

  function parseRenainf(text) {
    const src = norm(text);
    const labeled = src.match(/renainf\s*[:\\-]?\s*([0-9]{8,14})/i);
    return labeled ? labeled[1] : "";
  }

  function parseDescricao(text) {
    const src = norm(text);
    const lines = src
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const skip = /placa|órgão|orgao|autuador|competente|local|data|hora|número|numero|código|codigo|renainf|valor|notifica|limite|defesa|condutor/i;
    for (const line of lines) {
      if (line.length < 18) continue;
      if (skip.test(line) && line.length < 50) continue;
      if (/[A-ZÁÉÍÓÚÃÕÇ]{8,}/.test(line)) return line.replace(/\s+/g, " ").slice(0, 200);
    }
    return afterLabel(src, ["Infra[cç][aã]o", "Descri[cç][aã]o"]).slice(0, 200);
  }

  function parseOrgao(text) {
    return afterLabel(text, ["[ÓO]rg[aã]o Autuador", "[ÓO]rg[aã]o Competente"]).slice(0, 120);
  }

  function parseLocal(text) {
    return afterLabel(text, ["Local da Infra[cç][aã]o"]).slice(0, 160);
  }

  function parseAutuacaoTransito(text) {
    const src = norm(text);
    const dh = parseDataHora(src);
    return {
      placa: parsePlaca(src),
      data: dh.data,
      hora: dh.hora,
      codigo: parseCodigo(src),
      descricao: parseDescricao(src),
      valor: parseValor(src),
      auto: parseAuto(src),
      renainf: parseRenainf(src),
      orgao: parseOrgao(src),
      local: parseLocal(src),
    };
  }

  return { parseAutuacaoTransito };
});
