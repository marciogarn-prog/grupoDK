/**
 * Lançamento de multas e manutenção (portal Operação).
 * Depende de app.js e portal-locadora-ui.js.
 */
(function portalLancamentosExtras() {
  const TIPOS = [
    {
      key: "lancamentoMultas",
      btnId: "btn-operacao-lancamento-multas",
      panelId: "operacaoInlineLancamentoMultas",
      prefix: "operacaoLancMultas",
      arrayField: "portalLancamentosMultas",
      tituloPagamento: "multa",
      devidoResumoKey: "valorDevidoMultas",
    },
    {
      key: "lancamentoManutencao",
      btnId: "btn-operacao-lancamento-manutencao",
      panelId: "operacaoInlineLancamentoManutencao",
      prefix: "operacaoLancManutencao",
      arrayField: "portalLancamentosManutencao",
      tituloPagamento: "manutenção",
      devidoResumoKey: "valorDevidoManutencao",
    },
  ];

  const state = new Map();

  function dig(s) {
    return typeof onlyDigits === "function" ? onlyDigits(s) : String(s ?? "").replace(/\D/g, "");
  }

  function normNc(raw) {
    const s = String(raw ?? "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^\d]/g, "");
    return s || "";
  }

  function parseVal(v) {
    if (typeof parseCurrencyBR === "function") return Number(parseCurrencyBR(String(v ?? "")));
    const cleaned = String(v ?? "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtBrl(n) {
    if (typeof currencyBRL === "function") return currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtBrlNum(n) {
    return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function normalizeEntry(x) {
    if (!x || typeof x !== "object") return null;
    const data = String(x.data || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return null;
    let valor = typeof x.valor === "number" && Number.isFinite(x.valor) ? x.valor : parseVal(x.valor);
    if (!Number.isFinite(valor) || valor <= 0) return null;
    const ve = parseVal(x.valorEspecie ?? 0);
    const vp = parseVal(x.valorPix ?? 0);
    const vc = parseVal(x.valorCartao ?? 0);
    const row = {
      data,
      valor,
      createdAt: Number(x.createdAt) || Date.now(),
      registradoPorCpf: dig(x.registradoPorCpf).slice(0, 11),
      registradoPorNome: String(x.registradoPorNome || "").trim(),
    };
    if (["valorEspecie", "valorPix", "valorCartao"].some((k) => Object.prototype.hasOwnProperty.call(x, k))) {
      row.valorEspecie = ve >= 0 ? ve : 0;
      row.valorPix = vp >= 0 ? vp : 0;
      row.valorCartao = vc >= 0 ? vc : 0;
      const sum = row.valorEspecie + row.valorPix + row.valorCartao;
      if (sum > 0) row.valor = sum;
    }
    return row;
  }

  function getLancamentos(loc, field) {
    const arr = Array.isArray(loc?.[field]) ? loc[field] : [];
    return arr.map(normalizeEntry).filter(Boolean);
  }

  function sumLancamentos(arr) {
    let s = 0;
    for (const x of arr || []) s += Number(x.valor || 0);
    return s;
  }

  function collectLocs() {
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    return loadCadastro(CAD_LOCACOES_KEY).filter((l) => normNc(l.numeroContrato));
  }

  function $(cfg, suffix) {
    return document.getElementById(`${cfg.prefix}${suffix}`);
  }

  function hideAllOperacaoPanels() {
    document.querySelectorAll("#operacaoPainelDireito > .operacao-inline-form").forEach((el) => {
      el.classList.add("hidden");
    });
    const ph = document.getElementById("operacaoFormPlaceholder");
    if (ph) {
      ph.classList.remove("hidden");
      ph.setAttribute("aria-hidden", "false");
    }
    document
      .querySelectorAll("#portalOperacaoSidebar .btn-operacao-cmd, .portal-operacao-layout__sidebar .btn-operacao-cmd")
      .forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-expanded", "false");
      });
  }

  function showPanel(cfg) {
    hideAllOperacaoPanels();
    const panel = document.getElementById(cfg.panelId);
    const ph = document.getElementById("operacaoFormPlaceholder");
    if (ph) {
      ph.classList.add("hidden");
      ph.setAttribute("aria-hidden", "true");
    }
    panel?.classList.remove("hidden");
    const btn = document.getElementById(cfg.btnId);
    btn?.classList.add("is-active");
    btn?.setAttribute("aria-expanded", "true");
    if (typeof window.__DK_syncOperacaoCadastroButtons === "function") {
      window.__DK_syncOperacaoCadastroButtons(cfg.btnId);
    }
  }

  function hideDetalhe(cfg) {
    $(cfg, "ReferenciaPanel")?.classList.add("hidden");
    $(cfg, "ReferenciaPanel")?.setAttribute("hidden", "");
    $(cfg, "PagamentoPanel")?.classList.add("hidden");
    $(cfg, "PagamentoPanel")?.setAttribute("hidden", "");
    const hist = $(cfg, "Historico");
    if (hist) {
      hist.classList.add("hidden");
      hist.replaceChildren();
    }
  }

  function showDetalhe(cfg) {
    $(cfg, "ReferenciaPanel")?.classList.remove("hidden");
    $(cfg, "ReferenciaPanel")?.removeAttribute("hidden");
    $(cfg, "PagamentoPanel")?.classList.remove("hidden");
    $(cfg, "PagamentoPanel")?.removeAttribute("hidden");
  }

  function syncValorPagoFromMeios(cfg) {
    const ve = parseVal($(cfg, "ValorEspecie")?.value);
    const vp = parseVal($(cfg, "ValorPix")?.value);
    const vc = parseVal($(cfg, "ValorCartao")?.value);
    const total = ve + vp + vc;
    const inp = $(cfg, "ValorPago");
    if (inp) inp.value = total > 0 ? fmtBrlNum(total) : "";
  }

  function fmtDateLoc(raw) {
    const s = String(raw || "").trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    if (typeof parseBrDate === "function") {
      const d = parseBrDate(s);
      if (d && !Number.isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      }
    }
    return s;
  }

  function applyLocToForm(cfg, loc) {
    const resumo =
      typeof window.__DK_computePortalProtocoloResumoFromLoc === "function"
        ? window.__DK_computePortalProtocoloResumoFromLoc(loc)
        : null;
    const placa =
      typeof normalizePlate === "function" ? normalizePlate(loc.placa) : String(loc.placa || "").trim();
    if ($(cfg, "Placa")) $(cfg, "Placa").value = placa || "—";
    if ($(cfg, "DataInicio")) $(cfg, "DataInicio").value = fmtDateLoc(loc.inicio);
    if ($(cfg, "DataFim")) $(cfg, "DataFim").value = fmtDateLoc(loc.fim);
    const lancs = getLancamentos(loc, cfg.arrayField);
    if ($(cfg, "ValorDevido") && resumo) {
      $(cfg, "ValorDevido").value = String(resumo[cfg.devidoResumoKey] || "").trim();
    }
    if ($(cfg, "TotalPago")) $(cfg, "TotalPago").value = fmtBrlNum(sumLancamentos(lancs));
    ["ValorEspecie", "ValorPix", "ValorCartao", "ValorPago", "DataPagamento"].forEach((s) => {
      const el = $(cfg, s);
      if (el) el.value = "";
    });
    syncValorPagoFromMeios(cfg);
    renderHistorico(cfg, loc);
  }

  function renderHistorico(cfg, loc) {
    const wrap = $(cfg, "Historico");
    if (!wrap) return;
    const arr = getLancamentos(loc, cfg.arrayField);
    const owner = typeof window.__DK_isPortalTitularAdministrador === "function" && window.__DK_isPortalTitularAdministrador();
    if (!arr.length) {
      wrap.classList.remove("hidden");
      wrap.innerHTML = "<p class=\"subtext\">Nenhum pagamento registado neste protocolo.</p>";
      return;
    }
    wrap.classList.remove("hidden");
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const thead = owner
      ? "<thead><tr><th>Data</th><th>Valor (R$)</th><th>Ações</th></tr></thead>"
      : "<thead><tr><th>Data</th><th>Valor (R$)</th></tr></thead>";
    const rows = arr
      .map((x, i) => {
        const v = fmtBrlNum(x.valor);
        const d = esc(x.data);
        if (owner) {
          return `<tr><td>${d}</td><td>${v}</td><td><button type="button" class="btn-primary btn-secondary-outline" data-lanc-extra-del="${cfg.key}" data-idx="${i}">Apagar</button></td></tr>`;
        }
        return `<tr><td>${d}</td><td>${v}</td></tr>`;
      })
      .join("");
    wrap.innerHTML = `<p class="subtext"><strong>Pagamentos registados</strong></p><table class="portal-lanc-hist">${thead}<tbody>${rows}</tbody></table>`;
  }

  function refreshProtocoloSelect(cfg, opts = {}) {
    const sel = $(cfg, "ProtocoloSelect");
    const cpfInp = $(cfg, "Cpf");
    if (!sel || !cpfInp) return;
    const digits = dig(cpfInp.value).slice(0, 11);
    if (digits.length !== 11) {
      sel.disabled = true;
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "Informe um CPF com locação";
      sel.appendChild(o);
      return;
    }
    const locs = collectLocs().filter((l) => dig(l.cpf) === digits);
    const byNc = new Map();
    locs.forEach((l) => {
      const nc = normNc(l.numeroContrato);
      if (nc) byNc.set(nc, l);
    });
    const sorted = [...byNc.keys()].sort();
    const preserve = normNc(opts.preserveNc || sel.value);
    sel.replaceChildren();
    sorted.forEach((nc) => {
      const l = byNc.get(nc);
      const opt = document.createElement("option");
      opt.value = nc;
      const pl = typeof normalizePlate === "function" ? normalizePlate(l.placa) : l.placa;
      opt.textContent = `${nc} · ${pl || "—"} · ${fmtDateLoc(l.inicio)}`;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    sel.value = preserve && sorted.includes(preserve) ? preserve : sorted[0] || "";
    const chosen = byNc.get(sel.value);
    if (chosen) applyLocToForm(cfg, chosen);
  }

  function resolvePesquisa(cfg) {
    const cpfDigits = dig($(cfg, "Cpf")?.value).slice(0, 11);
    const protoWant = normNc($(cfg, "ProtocoloBusca")?.value);
    const nomeQ = String($(cfg, "NomeBusca")?.value || "")
      .trim()
      .toLowerCase();
    const locs = collectLocs();
    if (protoWant) {
      const hit = locs.find((l) => normNc(l.numeroContrato) === protoWant);
      if (hit) return { loc: hit, cpfDigits: dig(hit.cpf), proto: protoWant };
    }
    if (cpfDigits.length === 11) {
      const matches = locs.filter((l) => dig(l.cpf) === cpfDigits);
      if (!matches.length) return null;
      const pick = protoWant
        ? matches.find((l) => normNc(l.numeroContrato) === protoWant) || matches[0]
        : matches[0];
      return { loc: pick, cpfDigits, proto: normNc(pick.numeroContrato) };
    }
    if (nomeQ) {
      const matches = locs.filter((l) => {
        let nome = String(l.nome || l.cliente || "").trim();
        if (!nome && typeof findClienteByCpfCadastro === "function") {
          nome = String(findClienteByCpfCadastro(dig(l.cpf))?.nome || "").trim();
        }
        return nome.toLowerCase().includes(nomeQ);
      });
      if (!matches.length) return null;
      const pick = matches[0];
      return { loc: pick, cpfDigits: dig(pick.cpf), proto: normNc(pick.numeroContrato) };
    }
    return null;
  }

  function persistLancamentos(cfg, locs, loc, cpfDigits, nc) {
    const normArr = getLancamentos(loc, cfg.arrayField);
    loc[cfg.arrayField] = normArr.map((x) => ({ ...x }));
    try {
      saveCadastro(CAD_LOCACOES_KEY, locs);
    } catch (e) {
      console.error(e);
      return false;
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow().catch(() => {});
    }
    return true;
  }

  function persistPagamento(cfg, cpfDigits, nc, valorNum, dataStr, meios) {
    if (typeof loadCadastro !== "function") return false;
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const idx = locs.findIndex((l) => dig(l.cpf) === cpfDigits && normNc(l.numeroContrato) === nc);
    if (idx < 0) return false;
    const loc = locs[idx];
    if (!Array.isArray(loc[cfg.arrayField])) loc[cfg.arrayField] = [];
    const reg =
      typeof window.__DK_getPortalSessaoParaRegistroLancamento === "function"
        ? window.__DK_getPortalSessaoParaRegistroLancamento()
        : { cpf: "", nome: "" };
    loc[cfg.arrayField].push({
      data: dataStr,
      valor: valorNum,
      createdAt: Date.now(),
      registradoPorCpf: reg.cpf || "",
      registradoPorNome: reg.nome || "",
      valorEspecie: meios.valorEspecie,
      valorPix: meios.valorPix,
      valorCartao: meios.valorCartao,
    });
    return persistLancamentos(cfg, locs, loc, cpfDigits, nc);
  }

  function refreshDatalists(cfg) {
    const locs = collectLocs();
    const dlCpf = document.getElementById(`${cfg.prefix}CpfSugestoes`);
    const dlNome = document.getElementById(`${cfg.prefix}NomeSugestoes`);
    const dlProto = document.getElementById(`${cfg.prefix}ProtocoloSugestoes`);
    if (dlCpf) {
      dlCpf.replaceChildren();
      const cpfs = new Set();
      locs.forEach((l) => {
        const c = dig(l.cpf);
        if (c.length === 11 && !cpfs.has(c)) {
          cpfs.add(c);
          const o = document.createElement("option");
          o.value = typeof formatCpf === "function" ? formatCpf(c) : c;
          dlCpf.appendChild(o);
        }
      });
    }
    if (dlProto) {
      dlProto.replaceChildren();
      locs.forEach((l) => {
        const nc = normNc(l.numeroContrato);
        if (!nc) return;
        const o = document.createElement("option");
        o.value = nc;
        dlProto.appendChild(o);
      });
    }
    if (dlNome) {
      dlNome.replaceChildren();
      const nomes = new Set();
      locs.forEach((l) => {
        let n = String(l.nome || l.cliente || "").trim();
        if (!n) {
          const c = dig(l.cpf);
          if (c.length === 11 && typeof findClienteByCpfCadastro === "function") {
            n = String(findClienteByCpfCadastro(c)?.nome || "").trim();
          }
        }
        if (n && !nomes.has(n)) {
          nomes.add(n);
          const o = document.createElement("option");
          o.value = n;
          dlNome.appendChild(o);
        }
      });
    }
  }

  function bindTipo(cfg) {
    if (state.get(cfg.key)) return;
    state.set(cfg.key, true);

    document.getElementById(cfg.btnId)?.addEventListener("click", async () => {
      if (typeof window.__DK_portalPullCadastroFromCloud === "function") {
        await window.__DK_portalPullCadastroFromCloud();
      }
      showPanel(cfg);
      hideDetalhe(cfg);
      refreshDatalists(cfg);
      const msg = $(cfg, "InlineMsg");
      if (msg) msg.textContent = "";
    });

    $(cfg, "ConfirmarPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      const msg = $(cfg, "InlineMsg");
      const hit = resolvePesquisa(cfg);
      if (!hit || hit.cpfDigits.length !== 11) {
        hideDetalhe(cfg);
        if (msg) msg.textContent = "Informe nome, CPF ou protocolo válido com locação cadastrada.";
        return;
      }
      if (typeof formatCpf === "function") $(cfg, "Cpf").value = formatCpf(hit.cpfDigits);
      if ($(cfg, "ProtocoloBusca")) $(cfg, "ProtocoloBusca").value = hit.proto;
      if (msg) msg.textContent = "";
      refreshProtocoloSelect(cfg, { preserveNc: hit.proto });
      showDetalhe(cfg);
    });

    $(cfg, "LimparPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      hideDetalhe(cfg);
      const formId =
        cfg.key === "lancamentoMultas"
          ? "formOperacaoLancamentoMultasInline"
          : "formOperacaoLancamentoManutencaoInline";
      document.getElementById(formId)?.querySelectorAll("input").forEach((inp) => {
        inp.value = "";
      });
      const sel = $(cfg, "ProtocoloSelect");
      if (sel) {
        sel.replaceChildren();
        const o = document.createElement("option");
        o.value = "";
        o.textContent = "—";
        sel.appendChild(o);
        sel.disabled = true;
      }
      const msg = $(cfg, "InlineMsg");
      if (msg) msg.textContent = "";
      refreshDatalists(cfg);
    });

    $(cfg, "ProtocoloSelect")?.addEventListener("change", () => {
      const sel = $(cfg, "ProtocoloSelect");
      const digits = dig($(cfg, "Cpf")?.value);
      const nc = normNc(sel?.value);
      const loc = collectLocs().find((l) => dig(l.cpf) === digits && normNc(l.numeroContrato) === nc);
      if (loc) applyLocToForm(cfg, loc);
    });

    ["ValorEspecie", "ValorPix", "ValorCartao"].forEach((s) => {
      $(cfg, s)?.addEventListener("input", () => syncValorPagoFromMeios(cfg));
      $(cfg, s)?.addEventListener("blur", () => syncValorPagoFromMeios(cfg));
    });

    $(cfg, "Cpf")?.addEventListener("blur", () => {
      const d = dig($(cfg, "Cpf")?.value).slice(0, 11);
      if (typeof formatCpf === "function" && d) $(cfg, "Cpf").value = formatCpf(d);
      refreshDatalists(cfg);
    });

    $(cfg, "ConfirmarPagamentoBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      const msg = $(cfg, "InlineMsg");
      const admin =
        typeof window.__DK_getPortalSessaoAdminRole === "function" && window.__DK_getPortalSessaoAdminRole();
      if (!admin) {
        if (msg) msg.textContent = "Inicie sessão como colaborador ou administrador.";
        return;
      }
      syncValorPagoFromMeios(cfg);
      const digits = dig($(cfg, "Cpf")?.value).slice(0, 11);
      const nc = normNc($(cfg, "ProtocoloSelect")?.value);
      const ve = parseVal($(cfg, "ValorEspecie")?.value);
      const vp = parseVal($(cfg, "ValorPix")?.value);
      const vc = parseVal($(cfg, "ValorCartao")?.value);
      const valorNum = ve + vp + vc;
      const dataStr = String($(cfg, "DataPagamento")?.value || "").trim();
      if (digits.length !== 11 || !nc) {
        if (msg) msg.textContent = "Informe CPF e protocolo.";
        return;
      }
      if (valorNum <= 0) {
        if (msg) msg.textContent = "Informe valor em espécie, Pix e/ou cartão.";
        return;
      }
      const dtp = typeof parseBrDate === "function" ? parseBrDate(dataStr) : null;
      if (!dtp || Number.isNaN(dtp.getTime())) {
        if (msg) msg.textContent = "Informe a data do pagamento (DD/MM/AAAA).";
        return;
      }
      const texto = `Confirmar pagamento de ${cfg.tituloPagamento} no valor de ${fmtBrlNum(valorNum)} em ${dataStr} (protocolo ${nc})?`;
      const go = () => {
        const ok = persistPagamento(cfg, digits, nc, valorNum, dataStr, {
          valorEspecie: ve,
          valorPix: vp,
          valorCartao: vc,
        });
        if (ok) {
          if (msg) msg.textContent = "Pagamento registado.";
          const loc = collectLocs().find((l) => dig(l.cpf) === digits && normNc(l.numeroContrato) === nc);
          if (loc) applyLocToForm(cfg, loc);
        } else if (msg) msg.textContent = "Não foi possível guardar.";
      };
      if (typeof window.__DK_openPortalLancConfirmModal === "function") {
        window.__DK_openPortalLancConfirmModal(texto, go);
      } else if (window.confirm(texto)) go();
    });

    $(cfg, "LimparBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      ["ValorEspecie", "ValorPix", "ValorCartao", "ValorPago", "DataPagamento"].forEach((s) => {
        const el = $(cfg, s);
        if (el) el.value = "";
      });
    });

    $(cfg, "VoltarBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof window.__DK_hideOperacaoInlineForms === "function") window.__DK_hideOperacaoInlineForms();
    });

    $(cfg, "Historico")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lanc-extra-del]");
      if (!btn || btn.getAttribute("data-lanc-extra-del") !== cfg.key) return;
      if (!(typeof window.__DK_isPortalTitularAdministrador === "function" && window.__DK_isPortalTitularAdministrador())) return;
      const idx = Number(btn.getAttribute("data-idx"));
      const digits = dig($(cfg, "Cpf")?.value);
      const nc = normNc($(cfg, "ProtocoloSelect")?.value);
      const locs = loadCadastro(CAD_LOCACOES_KEY);
      const li = locs.findIndex((l) => dig(l.cpf) === digits && normNc(l.numeroContrato) === nc);
      if (li < 0) return;
      const loc = locs[li];
      const arr = loc[cfg.arrayField];
      if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return;
      if (!window.confirm("Apagar este pagamento?")) return;
      arr.splice(idx, 1);
      if (persistLancamentos(cfg, locs, loc, digits, nc)) {
        applyLocToForm(cfg, loc);
        const msg = $(cfg, "InlineMsg");
        if (msg) msg.textContent = "Pagamento removido.";
      }
    });
  }

  function init() {
    TIPOS.forEach(bindTipo);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
