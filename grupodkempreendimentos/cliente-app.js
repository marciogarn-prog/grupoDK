/**
 * DK Locadora — App do cliente (PWA).
 * Login por CPF; exibe só dados do cliente; partilha comprovante via sistema (Web Share).
 */
(function dkClienteApp() {
  const SESSAO_KEY = "dk_sessao_cliente_app";
  const CLIENTE_APP_GATE_KEY = "dk_cliente_app_gate";
  const GATE_PERSIST_KEY = "dk_cliente_gate_persist";
  const SHARE_CACHE_KEY = "dk-shared-comprovante";
  const COMPROVANTES_KEY = "dk_cliente_comprovantes_enviados";
  let pendingShareFocus = false;
  const CAD_CLIENTES_KEY = "dk_clientes_cadastro";
  const CAD_LOCACOES_KEY = "dk_locacoes_cadastro";

  const MOCK_CLIENTES = [
    { cpf: "11111111111", senha: "1234", nome: "Joao Silva" },
    { cpf: "22222222222", senha: "1234", nome: "Ana Souza" },
    { cpf: "00000000001", senha: "123456", nome: "TESTE-001" },
  ];

  const $ = (id) => document.getElementById(id);

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function formatCpf(digits) {
    const d = onlyDigits(digits).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function parseBrDate(s) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(s);
    const raw = String(s || "").trim();
    if (!raw) return null;
    if (raw.includes("/")) {
      const [day, month, year] = raw.split("/").map(Number);
      if (!day || !month || !year) return null;
      return new Date(year, month - 1, day);
    }
    const dig = onlyDigits(raw);
    if (dig.length === 8) {
      return new Date(Number(dig.slice(4)), Number(dig.slice(2, 4)) - 1, Number(dig.slice(0, 2)));
    }
    return null;
  }

  function currencyBRL(n) {
    if (typeof window.currencyBRL === "function") return window.currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parseCurrencyBR(v) {
    if (typeof window.parseCurrencyBR === "function") return window.parseCurrencyBR(v);
    const cleaned = String(v || "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function getSessao() {
    try {
      return JSON.parse(localStorage.getItem(SESSAO_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSessao(data) {
    localStorage.setItem(SESSAO_KEY, JSON.stringify(data));
  }

  function clearSessao() {
    localStorage.removeItem(SESSAO_KEY);
  }

  function loadCadastro(key) {
    return loadJson(key, []);
  }

  function findClienteLogin(cpfDigits, senha) {
    const mock = MOCK_CLIENTES.find((c) => c.cpf === cpfDigits && c.senha === senha);
    if (mock) return { cpf: cpfDigits, nome: mock.nome, origem: "mock" };

    const row = loadCadastro(CAD_CLIENTES_KEY).find((c) => onlyDigits(c.cpf) === cpfDigits);
    if (!row) return null;
    const pass = String(row.senha || "123456").trim();
    if (pass !== senha) return null;
    return {
      cpf: cpfDigits,
      nome: String(row.nome || "").trim() || "Cliente",
      origem: "cadastro",
      row,
    };
  }

  function normNc(nc) {
    return String(nc || "")
      .replace(/\D/g, "")
      .trim();
  }

  function getLancamentosFromLoc(loc) {
    const out = [];
    const push = (arr, tipo) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((x) => {
        if (!x || typeof x !== "object") return;
        const data = String(x.data || x.dataPagamento || "").trim();
        let valor = typeof x.valor === "number" ? x.valor : parseCurrencyBR(x.valor ?? x.valorPago);
        if (!Number.isFinite(valor) || valor <= 0) return;
        out.push({
          data,
          valor,
          tipo,
          protocolo: normNc(loc.numeroContrato),
          confirmadoViaAppCliente: Boolean(x.confirmadoViaAppCliente),
          origemComprovanteClienteId: String(x.origemComprovanteClienteId || "").trim(),
        });
      });
    };
    push(loc.lancamentosAluguel, "Aluguel");
    push(loc.portalLancamentosAluguel, "Aluguel");
    push(loc.lancamentos, "Aluguel");
    return out;
  }

  function loadDadosCliente(cpfDigits) {
    const clienteRow =
      loadCadastro(CAD_CLIENTES_KEY).find((c) => onlyDigits(c.cpf) === cpfDigits) || null;
    const locacoes = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === cpfDigits);
    const veiculos = loadCadastro("dk_veiculos_cadastro");
    const pagamentos = [];
    locacoes.forEach((loc) => {
      getLancamentosFromLoc(loc).forEach((p) => pagamentos.push({ ...p, placa: String(loc.placa || "").trim() }));
    });
    pagamentos.sort((a, b) => {
      const da = parseBrDate(a.data)?.getTime() || 0;
      const db = parseBrDate(b.data)?.getTime() || 0;
      return db - da;
    });
    return { clienteRow, locacoes, veiculos, pagamentos };
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function normStatusLoc(s) {
    return String(s || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isLocacaoFinalizada(loc) {
    if (!loc || typeof loc !== "object") return true;
    const st = normStatusLoc(loc.statusLocacao || loc.status || "");
    if (st === "FINALIZADO" || st === "INATIVO") return true;
    return Boolean(String(loc.fim || "").trim());
  }

  function filterLocacoesAtivas(locacoes) {
    return (locacoes || []).filter((l) => !isLocacaoFinalizada(l));
  }

  function clienteTemLocacaoAtiva(cpfDigits) {
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === cpfDigits);
    return filterLocacoesAtivas(locs).length > 0;
  }

  function isStandaloneDisplay() {
    try {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.navigator.standalone === true
      );
    } catch {
      return false;
    }
  }

  function restoreGateToSession() {
    try {
      if (sessionStorage.getItem(CLIENTE_APP_GATE_KEY)) return;
      const p = localStorage.getItem(GATE_PERSIST_KEY);
      if (p) sessionStorage.setItem(CLIENTE_APP_GATE_KEY, p);
    } catch {
      /* ignore */
    }
  }

  function persistGateFromSession() {
    try {
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY);
      if (raw) localStorage.setItem(GATE_PERSIST_KEY, raw);
    } catch {
      /* ignore */
    }
  }

  function canOpenAppWithoutPortalRedirect() {
    if (getSessao()?.cpf) return true;
    if (hasClienteAppDownloadGate()) return true;
    try {
      return Boolean(localStorage.getItem(GATE_PERSIST_KEY));
    } catch {
      return false;
    }
  }

  function showView(name) {
    $("view-login")?.classList.toggle("hidden", name !== "login");
    $("view-app")?.classList.toggle("hidden", name !== "app");
    $("view-propaganda")?.classList.toggle("hidden", name !== "propaganda");
  }

  function renderPropaganda(sessao) {
    $("propaganda-cliente-nome").textContent = sessao.nome || "Cliente";
  }

  function resolveAppViewAfterData(sessao) {
    if (!sessao?.cpf) {
      showView("login");
      return;
    }
    if (!clienteTemLocacaoAtiva(sessao.cpf)) {
      renderPropaganda(sessao);
      showView("propaganda");
      return;
    }
    showView("app");
    renderApp(sessao);
    if (pendingShareFocus) focusComprovanteSection();
  }

  function formatDateMask(value) {
    const digits = onlyDigits(String(value || "")).slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function formatCurrencyMask(value) {
    const digits = onlyDigits(String(value ?? "")).slice(0, 14);
    if (!digits) return "";
    return currencyBRL(Number(digits) / 100);
  }

  function bindCompMasks() {
    const d = $("comp-data");
    const v = $("comp-valor");
    if (d && d.dataset.dkDateMask !== "1") {
      d.dataset.dkDateMask = "1";
      const applyD = () => {
        d.value = formatDateMask(d.value);
      };
      d.addEventListener("input", applyD);
      d.addEventListener("blur", applyD);
    }
    if (v && v.dataset.dkCurrencyMask !== "1") {
      v.dataset.dkCurrencyMask = "1";
      v.addEventListener("input", () => {
        v.value = formatCurrencyMask(v.value);
      });
      v.addEventListener("blur", () => {
        const n = parseCurrencyBR(v.value);
        v.value = n > 0 ? currencyBRL(n) : "";
      });
    }
  }

  function fillProtocoloSelect(locacoes) {
    const sel = $("comp-protocolo");
    if (!sel) return;
    const ativas = filterLocacoesAtivas(locacoes);
    sel.replaceChildren();
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Selecione o protocolo";
    sel.appendChild(opt0);
    ativas.forEach((loc) => {
      const nc = normNc(loc.numeroContrato);
      if (!nc) return;
      const o = document.createElement("option");
      o.value = nc;
      o.textContent = `${nc} · ${String(loc.placa || "").trim() || "—"}`;
      sel.appendChild(o);
    });
  }

  function renderNotificacoes(cpf) {
    const wrap = $("cliente-notificacoes-wrap");
    const box = $("cliente-notificacoes");
    const listFn = typeof window.__DK_clienteNotificacoesList === "function" ? window.__DK_clienteNotificacoesList : null;
    if (!wrap || !box || !listFn) return;
    const rows = listFn(cpf, { incluirLidas: false });
    if (!rows.length) {
      wrap.classList.add("hidden");
      box.innerHTML = "";
      return;
    }
    wrap.classList.remove("hidden");
    box.innerHTML = rows
      .map(
        (n) =>
          `<div class="cliente-notificacao" role="status"><p class="cliente-notificacao__msg">${escapeHtml(n.mensagem)}</p><p class="cliente-notificacao__meta">Protocolo ${escapeHtml(n.protocolo || "—")} · ${escapeHtml(n.criadoEm ? new Date(n.criadoEm).toLocaleString("pt-BR") : "")}</p></div>`
      )
      .join("");
  }

  function renderLinhaPagamento(label, data, valor, extraClass) {
    return `<div class="cliente-pagamento-row${extraClass ? ` ${extraClass}` : ""}"><span>${escapeHtml(label)} · ${escapeHtml(data)}</span><span>${escapeHtml(currencyBRL(valor))}</span></div>`;
  }

  function renderContratoCard(loc, cpf, resumoFn) {
    const nc = normNc(loc.numeroContrato);
    const resumo = resumoFn ? resumoFn(loc) : null;
    const envios = listComprovantesCliente(cpf).filter((e) => normNc(e.protocolo) === nc);
    const lancs = resumo?.lancamentos || [];
    const pagosHtml = lancs.length
      ? lancs
          .map((p) => {
            const origem = p.confirmadoViaAppCliente
              ? "Confirmado (envio seu)"
              : p.registradoPorNome
                ? `DK — ${p.registradoPorNome}`
                : "Confirmado pela DK";
            return renderLinhaPagamento(origem, p.data, p.valor, p.confirmadoViaAppCliente ? "cliente-pagamento-row--envio" : "");
          })
          .join("")
      : "";
    const enviosHtml = envios
      .filter((e) => e.status !== "confirmado")
      .map((e) =>
        renderLinhaPagamento(statusComprovanteLabel(e.status), e.dataPagamento, e.valor, "cliente-pagamento-row--pendente")
      )
      .join("");
    const servicosHtml =
      resumo && Array.isArray(resumo.ultimaRevisaoServicos) && resumo.ultimaRevisaoServicos.length
        ? `<ul class="cliente-revisao-servicos">${resumo.ultimaRevisaoServicos.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
        : '<p class="subtext cliente-em-breve">Lista de serviços da última revisão — em breve</p>';

    const detalhes = resumo
      ? `<dl class="cliente-contrato-dl">
          <div><dt>Data de início</dt><dd>${escapeHtml(resumo.inicio || "—")}</dd></div>
          <div><dt>Placa</dt><dd>${escapeHtml(resumo.placa || "—")}</dd></div>
          <div><dt>Valor devido (estimado)</dt><dd>${escapeHtml(resumo.valorDevidoTexto)}</dd></div>
          <div><dt>Total pago</dt><dd>${escapeHtml(resumo.totalPago)}</dd></div>
          <div><dt>Tempo de locação</dt><dd>${escapeHtml(resumo.tempoLocacaoTexto)}</dd></div>
          <div><dt>Gasto com manutenção</dt><dd>${escapeHtml(resumo.gastoManutencao)}</dd></div>
          <div><dt>Multas registradas</dt><dd>${escapeHtml(resumo.multasRegistradas)}</dd></div>
          <div><dt>Multas pagas e validadas pela DK</dt><dd class="cliente-em-breve">${escapeHtml(resumo.multasPagasValidadas)}</dd></div>
          <div><dt>Tempo para concluir o plano</dt><dd>${escapeHtml(resumo.tempoRestantePlano)}</dd></div>
          <div><dt>Data da última revisão</dt><dd class="cliente-em-breve">${escapeHtml(resumo.ultimaRevisaoData)}</dd></div>
          <div><dt>Km da última revisão</dt><dd class="cliente-em-breve">${escapeHtml(resumo.ultimaRevisaoKm)}</dd></div>
        </dl>
        <h3 class="cliente-subsecao">Última revisão — serviços</h3>
        ${servicosHtml}`
      : `<p class="subtext">Resumo do contrato indisponível neste dispositivo.</p>`;

    const corpoPag =
      pagosHtml || enviosHtml
        ? `<h3 class="cliente-subsecao">Pagamentos</h3>${pagosHtml}${enviosHtml}`
        : '<p class="subtext">Sem pagamentos registados neste protocolo.</p>';

    return `<article class="cliente-protocolo">
      <div class="cliente-protocolo__head">Protocolo ${escapeHtml(nc)}${resumo?.ativo ? ' <span class="cliente-badge-ativo">Ativo</span>' : ""}</div>
      ${detalhes}
      ${corpoPag}
    </article>`;
  }

  function renderApp(sessao) {
    const cpf = sessao.cpf;
    const dados = loadDadosCliente(cpf);
    const locAtivas = filterLocacoesAtivas(dados.locacoes);
    $("cliente-nome").textContent = sessao.nome;
    $("cliente-cpf-label").textContent = formatCpf(cpf);

    const resumoFn =
      typeof window.__DK_clienteComputeResumoContrato === "function"
        ? window.__DK_clienteComputeResumoContrato
        : null;

    const resumo = $("cliente-resumo");
    if (resumo) {
      const pagAtivos = [];
      locAtivas.forEach((loc) => {
        getLancamentosFromLoc(loc).forEach((p) => pagAtivos.push(p));
      });
      const total = pagAtivos.reduce((s, p) => s + p.valor, 0);
      resumo.innerHTML = `<p><strong>${locAtivas.length}</strong> contrato(s) ativo(s) · <strong>${pagAtivos.length}</strong> pagamento(s) · total pago <strong>${currencyBRL(total)}</strong></p>`;
    }

    renderNotificacoes(cpf);

    const lista = $("cliente-contratos");
    if (lista) {
      if (!locAtivas.length) {
        lista.innerHTML =
          '<p class="subtext">Nenhum protocolo ativo. Se a locação acabou de ser finalizada, atualize da nuvem — verá apenas novidades DK.</p>';
      } else {
        lista.innerHTML = locAtivas.map((loc) => renderContratoCard(loc, cpf, resumoFn)).join("");
      }
    }

    fillProtocoloSelect(dados.locacoes);
    bindCompMasks();
  }

  function focusComprovanteSection() {
    const el = $("cliente-sec-comprovante");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    $("comp-valor")?.focus();
    pendingShareFocus = false;
  }

  async function applySharedFileToComprovante(file) {
    if (!file || !file.size) return;
    const sessao = getSessao();
    if (sessao?.cpf && !clienteTemLocacaoAtiva(sessao.cpf)) {
      const msg = $("sync-msg-prop");
      if (msg) {
        msg.textContent =
          "Locação finalizada — não é possível enviar comprovante. Consulte as novidades DK acima.";
      }
      return;
    }
    comprovanteFile = file;
    const input = $("comp-arquivo");
    if (input && typeof DataTransfer !== "undefined") {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch {
        /* preview only */
      }
    }
    const preview = $("comp-preview");
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.classList.add("is-visible");
    }
    const msg = $("comp-msg");
    if (msg) msg.textContent = "Comprovante recebido — confira protocolo, data, valor e toque em Enviar comprovante.";
    pendingShareFocus = true;
    const s2 = getSessao();
    if (s2 && clienteTemLocacaoAtiva(s2.cpf)) focusComprovanteSection();
  }

  async function consumeShareFromServiceWorkerCache() {
    if (!("caches" in window)) return false;
    const sessao = getSessao();
    if (!sessao?.cpf) return false;
    try {
      const cache = await caches.open("dk-cliente-share-v1");
      const res = await cache.match(SHARE_CACHE_KEY);
      if (!res) return false;
      const name = decodeURIComponent(res.headers.get("X-DK-Filename") || "comprovante");
      const blob = await res.blob();
      const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
      await applySharedFileToComprovante(file);
      await cache.delete(SHARE_CACHE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function wireLaunchQueueShare() {
    if (!("launchQueue" in window)) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      const files = launchParams.files;
      if (files?.length) await applySharedFileToComprovante(files[0]);
    });
  }

  function parseShareFromUrl() {
    const q = new URLSearchParams(location.search);
    if (q.get("dkShare") === "file") return { type: "file" };
    const text = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join(" ");
    if (text.trim()) return { type: "text", text };
    return null;
  }

  function openRelatorioPagamentos() {
    const sessao = getSessao();
    if (!sessao?.cpf) return;
    const build = window.__DK_clienteBuildRelatorioPagamentosHtml;
    if (typeof build !== "function") {
      window.alert("Relatório indisponível neste dispositivo.");
      return;
    }
    const html = build(sessao.cpf, sessao.nome);
    const modal = $("cliente-modal-relatorio");
    const frame = $("cliente-relatorio-frame");
    if (modal && frame) {
      frame.srcdoc = html;
      modal.classList.remove("hidden");
      frame.onload = () => {
        try {
          const doc = frame.contentDocument;
          if (!doc) return;
          doc.querySelectorAll("a[href^='data:']").forEach((a) => {
            a.addEventListener("click", (ev) => {
              ev.preventDefault();
              const href = a.getAttribute("href");
              if (href) window.open(href, "_blank", "noopener");
            });
          });
        } catch {
          /* ignore */
        }
      };
      return;
    }
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  }

  async function checkAtualizacaoPrograma() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    } catch {
      /* ignore */
    }
  }

  async function atualizarProgramaEDados(sessao, opts) {
    const msg = $("sync-msg");
    const silent = Boolean(opts?.silent);
    if (msg && !silent) msg.textContent = "A atualizar programa e dados da nuvem…";
    await checkAtualizacaoPrograma();
    try {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
        if (msg) msg.textContent = "Programa e dados atualizados.";
      } else if (msg && !silent) {
        msg.textContent = "Nuvem indisponível — dados só neste dispositivo.";
      }
    } catch (e) {
      if (msg) msg.textContent = String(e?.message || "Falha ao atualizar da nuvem.");
    }
    if (sessao) resolveAppViewAfterData(sessao);
  }

  async function pullNuvem() {
    const sessao = getSessao();
    await atualizarProgramaEDados(sessao, { silent: false });
  }

  let comprovanteFile = null;

  function onComprovanteFileChange() {
    const input = $("comp-arquivo");
    const preview = $("comp-preview");
    const file = input?.files?.[0];
    comprovanteFile = file || null;
    if (!preview) return;
    if (!file) {
      preview.classList.remove("is-visible");
      preview.removeAttribute("src");
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.classList.add("is-visible");
  }

  function statusComprovanteLabel(st) {
    if (st === "confirmado") return "Pagamento confirmado pela DK";
    if (st === "ia_validado") return "Conferido — aguarda confirmação final";
    if (st === "rejeitado") return "Não aceite — contacte a locadora";
    return "Enviado — aguarda conferência do operador";
  }

  function listComprovantesCliente(cpf) {
    if (typeof window.__DK_comprovantesClienteListByCpf === "function") {
      return window.__DK_comprovantesClienteListByCpf(cpf);
    }
    try {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const all = raw ? JSON.parse(raw) : [];
      return Array.isArray(all) ? all.filter((r) => onlyDigits(r.cpf) === cpf) : [];
    } catch {
      return [];
    }
  }

  async function enviarComprovanteParaNuvem() {
    const sessao = getSessao();
    if (!sessao) return;
    const proto = normNc($("comp-protocolo")?.value);
    const data = String($("comp-data")?.value || "").trim();
    const valor = parseCurrencyBR($("comp-valor")?.value);
    const msg = $("comp-msg");
    const btn = $("btn-enviar-comprovante");
    if (!proto) {
      if (msg) msg.textContent = "Selecione o protocolo.";
      return;
    }
    if (!data || !parseBrDate(data)) {
      if (msg) msg.textContent = "Informe a data do pagamento (DD/MM/AAAA).";
      return;
    }
    if (valor <= 0) {
      if (msg) msg.textContent = "Informe o valor pago.";
      return;
    }
    if (!comprovanteFile) {
      if (msg) msg.textContent = "Anexe a imagem ou PDF do comprovante.";
      return;
    }

    if (btn) btn.disabled = true;
    if (msg) msg.textContent = "A enviar comprovante para a nuvem…";

    const addFn = typeof window.__DK_comprovantesClienteAdd === "function" ? window.__DK_comprovantesClienteAdd : null;
    let res = { ok: false, msg: "Módulo de comprovantes indisponível." };
    if (addFn) {
      try {
        res = await addFn({
          cpf: sessao.cpf,
          nomeCliente: sessao.nome,
          protocolo: proto,
          dataPagamento: data,
          valor,
          file: comprovanteFile,
          nomeArquivo: comprovanteFile.name,
          mimeType: comprovanteFile.type,
        });
      } catch (err) {
        res = { ok: false, msg: err?.message || "Falha ao enviar." };
      }
    }

    if (!res.ok) {
      if (msg) msg.textContent = res.msg || "Não foi possível enviar.";
      if (btn) btn.disabled = false;
      return;
    }

    const hist = loadJson(COMPROVANTES_KEY, []);
    hist.unshift({
      id: res.id || Date.now(),
      cpf: sessao.cpf,
      protocolo: proto,
      data,
      valor,
      nomeArquivo: comprovanteFile.name,
      enviadoEm: new Date().toISOString(),
    });
    saveJson(COMPROVANTES_KEY, hist.slice(0, 50));

    if (msg) {
      msg.textContent =
        "Comprovante enviado para a DK. Um operador irá conferir e confirmar; ao abrir o app verá o aviso de pagamento confirmado.";
    }
    if (btn) btn.disabled = false;
    await atualizarProgramaEDados(sessao, { silent: true });

    const texto = `Comprovante DK Locadora\nCliente: ${sessao.nome}\nCPF: ${formatCpf(sessao.cpf)}\nProtocolo: ${proto}\nData: ${data}\nValor: ${currencyBRL(valor)}`;
    try {
      if (navigator.share) {
        const payload = { title: "Comprovante DK Locadora", text: texto };
        if (navigator.canShare && navigator.canShare({ files: [comprovanteFile] })) {
          payload.files = [comprovanteFile];
        }
        await navigator.share(payload);
      }
    } catch {
      /* partilha opcional */
    }
  }

  function wireInstall() {
    const btn = $("btn-install-cliente");
    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e;
      btn?.classList.remove("hidden");
    });
    btn?.addEventListener("click", async () => {
      if (!deferred) {
        window.alert("No telemóvel: menu do browser → «Adicionar ao ecrã inicial» / «Instalar app».");
        return;
      }
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      btn?.classList.add("hidden");
    });
  }

  function hasClienteAppDownloadGate() {
    try {
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY);
      if (!raw) return false;
      const g = JSON.parse(raw);
      const cpf = onlyDigits(String(g?.cpf || "")).slice(0, 11);
      const proto = String(g?.proto || "").trim();
      return cpf.length === 11 && Boolean(proto);
    } catch {
      return false;
    }
  }

  async function afterLogin(sess) {
    persistGateFromSession();
    if (isStandaloneDisplay()) {
      try {
        localStorage.setItem("dk_cliente_pwa_installed", "1");
      } catch {
        /* ignore */
      }
    }
    await atualizarProgramaEDados(sess, { silent: false });
    await consumeShareFromServiceWorkerCache();
  }

  function init() {
    restoreGateToSession();
    persistGateFromSession();

    if (!canOpenAppWithoutPortalRedirect()) {
      window.location.replace("/#locadora/cliente");
      return;
    }

    wireLaunchQueueShare();

    $("form-login")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const cpf = onlyDigits($("login-cpf")?.value).slice(0, 11);
      const senha = String($("login-senha")?.value || "").trim();
      const fb = $("login-feedback");
      if (cpf.length !== 11) {
        if (fb) fb.textContent = "Informe um CPF válido.";
        return;
      }
      const hit = findClienteLogin(cpf, senha);
      if (!hit) {
        if (fb) fb.textContent = "CPF ou senha inválidos.";
        return;
      }
      const sess = { cpf, nome: hit.nome, loginEm: new Date().toISOString() };
      setSessao(sess);
      if (fb) fb.textContent = "";
      afterLogin(sess);
    });

    const doLogout = () => {
      clearSessao();
      showView("login");
    };
    $("btn-logout")?.addEventListener("click", doLogout);
    $("btn-logout-prop")?.addEventListener("click", doLogout);
    $("btn-sync")?.addEventListener("click", () => pullNuvem());
    $("btn-sync-prop")?.addEventListener("click", async () => {
      const sessao = getSessao();
      const msg = $("sync-msg-prop");
      if (msg) msg.textContent = "A atualizar…";
      await atualizarProgramaEDados(sessao, { silent: true });
      if (msg) msg.textContent = "Dados atualizados.";
      if (sessao) resolveAppViewAfterData(sessao);
    });
    $("btn-notif-lidas")?.addEventListener("click", () => {
      const sessao = getSessao();
      if (!sessao) return;
      if (typeof window.__DK_clienteNotificacoesMarcarLidas === "function") {
        window.__DK_clienteNotificacoesMarcarLidas(sessao.cpf);
      }
      renderNotificacoes(sessao.cpf);
    });
    $("comp-arquivo")?.addEventListener("change", onComprovanteFileChange);
    $("btn-enviar-comprovante")?.addEventListener("click", () => enviarComprovanteParaNuvem());
    $("btn-relatorio-pagamentos")?.addEventListener("click", () => openRelatorioPagamentos());
    $("btn-relatorio-fechar")?.addEventListener("click", () => $("cliente-modal-relatorio")?.classList.add("hidden"));
    $("btn-relatorio-imprimir")?.addEventListener("click", () => {
      const frame = $("cliente-relatorio-frame");
      try {
        frame?.contentWindow?.print();
      } catch {
        window.print();
      }
    });

    const cpfIn = $("login-cpf");
    cpfIn?.addEventListener("input", () => {
      const d = onlyDigits(cpfIn.value).slice(0, 11);
      cpfIn.value = formatCpf(d);
    });

    const gateRaw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY) || localStorage.getItem(GATE_PERSIST_KEY);
    let gateCpf = "";
    try {
      const g = gateRaw ? JSON.parse(gateRaw) : null;
      gateCpf = onlyDigits(g?.cpf || "").slice(0, 11);
      if (gateCpf && cpfIn && !cpfIn.value) cpfIn.value = formatCpf(gateCpf);
    } catch {
      /* ignore */
    }

    const sessao = getSessao();
    if (sessao?.cpf) {
      afterLogin(sessao);
    } else {
      showView("login");
      if (parseShareFromUrl()?.type === "file") pendingShareFocus = true;
      consumeShareFromServiceWorkerCache();
    }

    wireInstall();
    bindCompMasks();

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./service-worker-cliente.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
