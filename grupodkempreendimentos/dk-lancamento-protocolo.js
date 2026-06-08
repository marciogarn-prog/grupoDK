/**
 * Protocolo de rastreabilidade por lançamento: AAAAMMDDHHMMSS-NNN
 * NNN = três primeiros dígitos do CPF de quem registou.
 * Fonte canónica: loc.portalLancamentosAluguel (consolida legados ao gravar/ler).
 */
(function dkLancamentoProtocolo() {
  const PROTO_RE = /^\d{14}-\d{3}$/;
  const GLOBAL_KEYS = [
    "dk_lancamentos_aluguel",
    "dk_lancamento_aluguel",
    "dk_lancamentos_aluguel_cadastro",
    "dk_lancamento_aluguel_cadastro",
  ];

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normNc(v) {
    return String(v ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function normPlate(p) {
    return String(p ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function parseValorRaw(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "").trim();
    if (!s) return 0;
    if (s.includes(",")) {
      const cleaned = s.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    const plain = s.replace(/[R$\s]/g, "");
    if (/^\d+(\.\d{1,2})?$/.test(plain)) {
      const n = Number(plain);
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof window.parseCurrencyBR === "function") {
      const n = Number(window.parseCurrencyBR(s));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(plain.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function gerarProtocoloLancamento(cpfOperador, when) {
    const d = when instanceof Date ? when : new Date(when || Date.now());
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const cpf3 = onlyDigits(cpfOperador).slice(0, 3);
    if (cpf3.length < 3) return "";
    return (
      String(d.getFullYear()) +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds()) +
      "-" +
      cpf3
    );
  }

  function isProtocoloLancamentoValid(s) {
    return PROTO_RE.test(String(s || "").trim());
  }

  function normalizeRow(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.pagamentoInvalidado) return null;
    const data = String(raw.data || raw.dataPagamento || raw.semanaInicio || "").trim();
    if (!data) return null;
    const MEIOS = ["valorEspecie", "valorPix", "valorCartao"];
    const hasMeios = MEIOS.some((k) => Object.prototype.hasOwnProperty.call(raw, k));
    let valor;
    let valorEspecie;
    let valorPix;
    let valorCartao;
    if (hasMeios) {
      valorEspecie = parseValorRaw(raw.valorEspecie ?? 0);
      valorPix = parseValorRaw(raw.valorPix ?? 0);
      valorCartao = parseValorRaw(raw.valorCartao ?? 0);
      valor = valorEspecie + valorPix + valorCartao;
    } else {
      valor =
        typeof raw.valor === "number" && Number.isFinite(raw.valor) && raw.valor > 0
          ? raw.valor
          : parseValorRaw(raw.valor ?? raw.valorPago ?? 0);
    }
    if (!Number.isFinite(valor) || valor <= 0) return null;
    const createdAt =
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Number(raw.id || 0) || Date.now();
    const registradoPorCpf = onlyDigits(String(raw.registradoPorCpf || raw.registradoPor || "")).slice(0, 11);
    const registradoPorNome = String(raw.registradoPorNome || raw.comprovanteValidadoPorNome || "").trim();
    const row = {
      data,
      valor,
      createdAt,
      registradoPorCpf,
      registradoPorNome,
      protocoloLancamento: String(raw.protocoloLancamento || raw.protocolo || "").trim(),
      origemComprovanteClienteId: String(raw.origemComprovanteClienteId || "").trim(),
      comprovanteFp: String(raw.comprovanteFp || "").trim(),
      confirmadoViaAppCliente: Boolean(raw.confirmadoViaAppCliente),
      ficticio: Boolean(raw.ficticio),
    };
    if (hasMeios) {
      row.valorEspecie = valorEspecie;
      row.valorPix = valorPix;
      row.valorCartao = valorCartao;
    }
    if (!isProtocoloLancamentoValid(row.protocoloLancamento)) {
      const proto = gerarProtocoloLancamento(registradoPorCpf, new Date(createdAt));
      if (proto) row.protocoloLancamento = proto;
    }
    return row;
  }

  function readGlobalRowsForLoc(loc) {
    const cpf = onlyDigits(loc?.cpf).slice(0, 11);
    const nc = normNc(loc?.numeroContrato);
    const placa = normPlate(loc?.placa);
    if (cpf.length !== 11 || !nc || !placa) return [];
    const out = [];
    for (const key of GLOBAL_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        const global = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(global)) continue;
        for (const item of global) {
          if (!item || typeof item !== "object") continue;
          if (onlyDigits(item.cpf).slice(0, 11) !== cpf) continue;
          if (normNc(item.numeroContrato) !== nc && normPlate(item.placa) !== placa) continue;
          const n = normalizeRow({
            data: item.dataPagamento || item.semanaInicio || item.data,
            valor: item.valorPago ?? item.valor,
            createdAt: item.createdAt || item.id,
            registradoPorCpf: item.registradoPorCpf,
            registradoPorNome: item.registradoPorNome,
            protocoloLancamento: item.protocoloLancamento,
          });
          if (n) out.push(n);
        }
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  function collectLegacySources(loc) {
    const chunks = [];
    const push = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return;
      const n = arr.map(normalizeRow).filter(Boolean);
      if (n.length) chunks.push(n);
    };
    push(loc?.portalLancamentosAluguel);
    push(loc?.lancamentosAluguel);
    push(loc?.lancamentos);
    const global = readGlobalRowsForLoc(loc);
    if (global.length) chunks.push(global);
    const legado = parseValorRaw(loc?.totalPagoAno2025 ?? "0");
    if (legado > 0 && !chunks.length) {
      const n = normalizeRow({
        data: String(loc?.ultimoLancamentoAluguelData || "").trim() || "01/01/2025",
        valor: legado,
        createdAt: Number(loc?.createdAt || loc?.id || 0) || Date.now(),
        registradoPorNome: "Legado (migração)",
      });
      if (n) chunks.push([n]);
    }
    return chunks;
  }

  function mergeRows(chunks) {
    if (typeof window.__DK_mergePortalLancamentosAluguelEmbutidos === "function") {
      return window.__DK_mergePortalLancamentosAluguelEmbutidos(chunks);
    }
    const byProto = new Map();
    const byLegacy = new Map();
    for (const arr of chunks || []) {
      if (!Array.isArray(arr)) continue;
      for (const raw of arr) {
        const row = normalizeRow(raw);
        if (!row) continue;
        const proto = String(row.protocoloLancamento || "").trim();
        if (isProtocoloLancamentoValid(proto)) {
          if (!byProto.has(proto)) byProto.set(proto, row);
          continue;
        }
        const legacyKey = `${row.data}|${Number(row.valor).toFixed(2)}|${row.createdAt}|${row.registradoPorCpf}`;
        if (!byLegacy.has(legacyKey)) byLegacy.set(legacyKey, row);
      }
    }
    const out = [...byProto.values(), ...byLegacy.values()];
    out.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return out;
  }

  function ensureUniqueProtocols(rows) {
    const seen = new Set();
    return (rows || []).map((raw) => {
      const row = normalizeRow(raw);
      if (!row) return null;
      let proto = String(row.protocoloLancamento || "").trim();
      if (!isProtocoloLancamentoValid(proto)) {
        proto = gerarProtocoloLancamento(row.registradoPorCpf, new Date(row.createdAt || Date.now()));
      }
      let attempt = 0;
      while (proto && seen.has(proto) && attempt < 5) {
        attempt += 1;
        proto = gerarProtocoloLancamento(row.registradoPorCpf, new Date((row.createdAt || Date.now()) + attempt));
      }
      if (proto) {
        row.protocoloLancamento = proto;
        seen.add(proto);
      }
      return row;
    }).filter(Boolean);
  }

  function consolidarLancamentosAluguelLoc(loc, opts) {
    if (!loc || typeof loc !== "object") return [];
    const mutate = Boolean(opts && opts.mutate);
    const merged = ensureUniqueProtocols(mergeRows(collectLegacySources(loc)));
    if (mutate) {
      loc.portalLancamentosAluguel = merged.map((x) => ({ ...x }));
      if (Object.prototype.hasOwnProperty.call(loc, "lancamentosAluguel")) delete loc.lancamentosAluguel;
      if (Object.prototype.hasOwnProperty.call(loc, "lancamentos")) delete loc.lancamentos;
    }
    return merged;
  }

  function getLancamentosAluguelCanonico(loc) {
    const embedded = Array.isArray(loc?.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
    const hasLegacy =
      (Array.isArray(loc?.lancamentosAluguel) && loc.lancamentosAluguel.length) ||
      (Array.isArray(loc?.lancamentos) && loc.lancamentos.length) ||
      readGlobalRowsForLoc(loc).length > 0;
    if (hasLegacy || embedded.some((x) => !isProtocoloLancamentoValid(x?.protocoloLancamento))) {
      return consolidarLancamentosAluguelLoc(loc, { mutate: false });
    }
    return embedded.map(normalizeRow).filter(Boolean);
  }

  function formatHoraMs(ms) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "—";
    try {
      return new Date(ms).toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderHistoricoLancamentosHtml(lancs, opts) {
    const owner = Boolean(opts && opts.adminActions);
    const arr = (lancs || []).slice().sort((a, b) => {
      const ta = Number(a.createdAt || 0);
      const tb = Number(b.createdAt || 0);
      return tb - ta;
    });
    if (!arr.length) {
      return '<p class="subtext">Nenhum pagamento registado neste protocolo.</p>';
    }
    const esc = escapeHtml;
    const thead = owner
      ? `<thead><tr><th>Protocolo</th><th>Data pag.</th><th>Valor</th><th>Registado por</th><th>Instante</th><th>Ações</th></tr></thead>`
      : `<thead><tr><th>Protocolo</th><th>Data pag.</th><th>Valor</th><th>Registado por</th><th>Instante</th></tr></thead>`;
    const fmtBrl =
      typeof window.currencyBRL === "function"
        ? (n) => window.currencyBRL(Number(n || 0))
        : (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const rows = arr
      .map((x) => {
        const proto = esc(String(x.protocoloLancamento || "—"));
        const protoAttr = esc(String(x.protocoloLancamento || ""));
        const quem = esc(x.registradoPorNome || x.registradoPorCpf || "—");
        const fict = x.ficticio ? ' <span class="portal-lanc-ficticio-tag">(teste)</span>' : "";
        const actions = owner
          ? `<td class="portal-lanc-hist__actions"><button type="button" class="btn-primary btn-secondary-outline" data-lanc-aluguel-edit="${protoAttr}">Editar</button> <button type="button" class="btn-primary btn-secondary-outline" data-lanc-aluguel-del="${protoAttr}">Apagar</button></td>`
          : "";
        return `<tr${x.ficticio ? ' class="portal-registro-teste"' : ""}><td>${proto}</td><td>${esc(x.data)}</td><td>${esc(fmtBrl(x.valor))}${fict}</td><td>${quem}</td><td>${esc(formatHoraMs(x.createdAt))}</td>${actions}</tr>`;
      })
      .join("");
    return `<p class="subtext"><strong>Pagamentos registados (${arr.length})</strong></p><table class="portal-lanc-hist">${thead}<tbody>${rows}</tbody></table>`;
  }

  window.__DK_gerarProtocoloLancamento = gerarProtocoloLancamento;
  window.__DK_isProtocoloLancamentoValid = isProtocoloLancamentoValid;
  window.__DK_ensureProtocoloLancamento = (entry, cpfFallback) => {
    const row = normalizeRow(entry);
    if (!row) return entry;
    if (!isProtocoloLancamentoValid(row.protocoloLancamento)) {
      const proto = gerarProtocoloLancamento(row.registradoPorCpf || cpfFallback, new Date(row.createdAt || Date.now()));
      if (proto) row.protocoloLancamento = proto;
    }
    return row;
  };
  window.__DK_consolidarLancamentosAluguelLoc = consolidarLancamentosAluguelLoc;
  window.__DK_getLancamentosAluguelCanonico = getLancamentosAluguelCanonico;
  window.__DK_renderHistoricoLancamentosHtml = renderHistoricoLancamentosHtml;
})();
