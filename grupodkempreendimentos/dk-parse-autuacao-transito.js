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
    const lines = src.split("\n");
    for (const label of labels) {
      const re = new RegExp(`^\\s*${label}\\s*[:\\-]?\\s*(.*)$`, "i");
      for (let i = 0; i < lines.length; i += 1) {
        const m = lines[i].match(re);
        if (!m) continue;
        const same = String(m[1] || "").trim();
        if (same) return same;
        const next = String(lines[i + 1] || "").trim();
        if (next) return next;
      }
    }
    return "";
  }

  function formatDataBr(raw) {
    const p = String(raw || "").split("/");
    if (p.length !== 3) return "";
    return `${p[0].padStart(2, "0")}/${p[1].padStart(2, "0")}/${p[2]}`;
  }

  function parseDateAfter(text, labels) {
    const src = norm(text);
    for (const label of labels) {
      const re = new RegExp(`${label}[^\\n]{0,90}?(\\d{1,2}\\/\\d{1,2}\\/\\d{4})`, "i");
      const m = src.match(re);
      if (m) return formatDataBr(m[1]);
      const block = src.split("\n");
      for (let i = 0; i < block.length; i += 1) {
        if (new RegExp(label, "i").test(block[i])) {
          const same = block[i].match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (same) return formatDataBr(same[1]);
          const next = String(block[i + 1] || "").match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (next) return formatDataBr(next[1]);
        }
      }
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
    const data = formatDataBr(hit[1]);
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

  function parseOrgaoAutuador(text) {
    return afterLabel(text, ["[ÓO]rg[aã]o Autuador"]).slice(0, 160);
  }

  function parseOrgaoCompetente(text) {
    return afterLabel(text, ["[ÓO]rg[aã]o Competente(?:/Respons[aá]vel)?"]).slice(0, 160);
  }

  function parseLocal(text) {
    return afterLabel(text, ["Local da Infra[cç][aã]o"]).slice(0, 200);
  }

  function parseAutuacaoTransito(text) {
    const src = norm(text);
    const dh = parseDataHora(src);
    const orgaoAutuador = parseOrgaoAutuador(src);
    const orgaoCompetente = parseOrgaoCompetente(src);
    return {
      placa: parsePlaca(src),
      data: dh.data,
      hora: dh.hora,
      dataHora: [dh.data, dh.hora].filter(Boolean).join(" "),
      codigo: parseCodigo(src),
      descricao: parseDescricao(src),
      valor: parseValor(src),
      auto: parseAuto(src),
      renainf: parseRenainf(src),
      orgao: orgaoAutuador,
      orgaoAutuador,
      orgaoCompetente,
      local: parseLocal(src),
      dataNotificacao: parseDateAfter(src, ["Notifica[cç][aã]o de Autua[cç][aã]o"]),
      dataLimiteDefesa: parseDateAfter(src, ["Defesa Pr[eé]via"]),
      dataLimiteCondutor: parseDateAfter(src, ["Identifica[cç][aã]o do Condutor"]),
    };
  }

  return { parseAutuacaoTransito };
});
