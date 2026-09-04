/**
 * Lê o texto de uma autuação de trânsito (portal municipal / DETRAN / RENAINF)
 * e devolve os campos usados no Lançamento de multas.
 */
(function dkParseAutuacaoTransito(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.__DK_parseAutuacaoTransito = api.parseAutuacaoTransito;
    root.__DK_parseValorNumeroAutuacao = api.parseValorNumero;
    root.__DK_normalizaAutoAutuacao = api.normalizaAuto;
    root.__DK_limparSimboloInicioDescricao = api.limparSimboloInicioDescricao;
    root.__DK_escolherPlacaAutuacao = api.escolherMelhorPlaca;
    root.__DK_ehPlacaMercosulAtual = api.ehPlacaMercosulAtual;
  }
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

  function extraiPlacaToken(raw) {
    const s = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const m = s.match(/([A-Z]{3}[0-9][A-Z0-9][0-9]{2})/);
    return m ? m[1] : "";
  }

  function extraiTodasPlacas(raw) {
    const s = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, " ");
    const out = [];
    const re = /([A-Z]{3}[0-9][A-Z0-9][0-9]{2})/g;
    let m;
    while ((m = re.exec(s))) {
      if (!out.includes(m[1])) out.push(m[1]);
    }
    return out;
  }

  function ehPlacaMercosulAtual(p) {
    return /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(String(p || ""));
  }

  function escolherMelhorPlaca(cands) {
    const list = (Array.isArray(cands) ? cands : []).map((p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
    return list.find(ehPlacaMercosulAtual) || list[0] || "";
  }

  function parsePlaca(text) {
    const src = norm(text);
    const labeled = afterLabel(text, [
      "Placa [àa] [ée]poca da infra[cç][aã]o",
      "Placa do ve[ií]culo",
    ]);
    const fromLabel = escolherMelhorPlaca(extraiTodasPlacas(labeled).concat(extraiPlacaToken(labeled) ? [extraiPlacaToken(labeled)] : []));
    if (fromLabel) return fromLabel;

    const lines = src.split("\n");
    const epocaHits = [];
    const otherHits = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (!/placa/i.test(lines[i])) continue;
      const bloco = `${lines[i]}\n${lines[i + 1] || ""}`;
      const epoca = /[ée]poca\s+da\s+infra/i.test(bloco);
      const cands = extraiTodasPlacas(bloco);
      if (!cands.length) continue;
      (epoca ? epocaHits : otherHits).push(...cands);
    }
    const picked = escolherMelhorPlaca(epocaHits) || escolherMelhorPlaca(otherHits);
    if (picked) return picked;

    const upper = src.toUpperCase();
    const spaced = upper.match(/\b([A-Z]{3})\s*([0-9])\s*([A-Z])\s*([0-9]{2})\b/);
    if (spaced) return `${spaced[1]}${spaced[2]}${spaced[3]}${spaced[4]}`;
    return escolherMelhorPlaca(extraiTodasPlacas(upper));
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

  function parseValorNumero(raw) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
    const s = String(raw ?? "")
      .replace(/[\u0000-\u001F\u007F-\u00A0\u20AC\u00A2-\u00A5\u25A0-\u25FF$€£¥]/g, " ")
      .replace(/R\s*\$/gi, " ")
      .replace(/\bR\s*S\b/gi, " ")
      .replace(/[^\d.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const m = s.match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+[.,][0-9]{2})/);
    if (!m) return 0;
    const token = m[1];
    if (/\d+,\d{2}$/.test(token)) {
      const n = Number(token.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }
    if (/^\d+\.\d{1,2}$/.test(token)) {
      const n = Number(token);
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(token.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function blocoAposValorOriginal(text) {
    const lines = norm(text).split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (/valor\s+original|valor\s+da\s+infra|valor\s+da\s+multa/i.test(lines[i])) {
        return [lines[i], lines[i + 1], lines[i + 2], lines[i + 3]]
          .filter((l) => String(l || "").trim())
          .join(" ");
      }
    }
    return "";
  }

  function parseValor(text) {
    const fromLabel = parseValorNumero(blocoAposValorOriginal(text));
    if (fromLabel > 0) return fromLabel;
    const src = norm(text);
    const any = src.match(
      /(?:R\s*\$|R\s*S|\$)\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+[.,][0-9]{2})/i
    );
    if (any) {
      const n = parseValorNumero(any[1]);
      if (n > 0) return n;
    }
    return parseValorNumero(src);
  }

  function parseCodigo(text) {
    const labeled = afterLabel(text, [
      "C[oó]digo da Infra[cç][aã]o",
      "C[oó]digo de Infra[cç][aã]o",
      "C[oó]digo da Autua[cç][aã]o",
    ]);
    const pick = (raw) => {
      const m = String(raw || "").match(/([0-9]{3,5}\s*[-–]?\s*[0-9])/);
      return m ? String(m[1]).replace(/\s+/g, "").replace("–", "-") : "";
    };
    const fromLabel = pick(labeled);
    if (fromLabel) return fromLabel;
    const src = norm(text);
    const inline = src.match(
      /c[oó]digo\s+d[ae]\s+infra[cç][aã]o\s*[:\-–]?\s*([0-9]{3,5}\s*[-–]?\s*[0-9])/i
    );
    if (inline) return pick(inline[1]);
    const loose = src.match(/\b([0-9]{4}\s*[-–]\s*[0-9])\b/);
    return loose ? pick(loose[1]) : "";
  }

  function parecePlacaMercosul(s) {
    return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(String(s || ""));
  }

  function normalizaAuto(raw) {
    const t = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (t.length < 7 || t.length > 16) return "";
    if (parecePlacaMercosul(t)) return "";
    if (!/[A-Z]/.test(t) || !/[0-9]/.test(t)) return "";
    return t;
  }

  function parseAuto(text) {
    const labeled = afterLabel(text, [
      "N[uú]mero do Auto de Infra[cç][aã]o",
      "Auto de Infra[cç][aã]o",
    ]);
    const fromLabel = normalizaAuto(labeled);
    if (fromLabel) return fromLabel;
    const src = norm(text).toUpperCase();
    const inline = src.match(/AUTO\s+DE\s+INFRA[CÇ][AÃ]O[^\nA-Z0-9]{0,24}([A-Z0-9]{7,16})/);
    if (inline) {
      const t = normalizaAuto(inline[1]);
      if (t) return t;
    }
    const loose = src.match(/\b([A-Z][A-Z0-9]{6,15})\b/g) || [];
    for (const cand of loose) {
      const t = normalizaAuto(cand);
      if (t) return t;
    }
    return "";
  }

  function parseRenainf(text) {
    const src = norm(text);
    const labeled = src.match(/renainf\s*[:\\-]?\s*([0-9]{8,14})/i);
    return labeled ? labeled[1] : "";
  }

  function limparSimboloInicioDescricao(raw) {
    let s = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    s = s.replace(/^[\u0000-\u001F\u007F-\u00A0\u25A0-\u25FF\u2B1B-\u2B1C■□▪▫●•◆◇]+/g, "").trim();
    s = s.replace(/^[A-ZÁÉÍÓÚÃÕÂÊÔ]\s+(?=[A-ZÁÉÍÓÚÃÕ]{4,})/i, "").trim();
    return s;
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
      if (/[A-ZÁÉÍÓÚÃÕÇ]{8,}/.test(line)) {
        return limparSimboloInicioDescricao(line).slice(0, 200);
      }
    }
    return limparSimboloInicioDescricao(afterLabel(src, ["Infra[cç][aã]o", "Descri[cç][aã]o"])).slice(0, 200);
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

  return {
    parseAutuacaoTransito,
    parseValorNumero,
    normalizaAuto,
    limparSimboloInicioDescricao,
    escolherMelhorPlaca,
    ehPlacaMercosulAtual,
  };
});
