/**
 * DK Locadora — App do cliente (PWA).
 * Login por CPF; exibe só dados do cliente; partilha comprovante via sistema (Web Share).
 */
(function dkClienteApp() {
  const SESSAO_KEY = "dk_sessao_cliente_app";
  const CLIENTE_APP_GATE_KEY = "dk_cliente_app_gate";
  const COMPROVANTES_KEY = "dk_cliente_comprovantes_enviados";
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

  function showView(name) {
    $("view-login")?.classList.toggle("hidden", name !== "login");
    $("view-app")?.classList.toggle("hidden", name !== "app");
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
    sel.replaceChildren();
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Selecione o protocolo";
    sel.appendChild(opt0);
    locacoes.forEach((loc) => {
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
    $("cliente-nome").textContent = sessao.nome;
    $("cliente-cpf-label").textContent = formatCpf(cpf);

    const resumoFn =
      typeof window.__DK_clienteComputeResumoContrato === "function"
        ? window.__DK_clienteComputeResumoContrato
        : null;

    const resumo = $("cliente-resumo");
    if (resumo) {
      const nLoc = dados.locacoes.length;
      const nPag = dados.pagamentos.length;
      const total = dados.pagamentos.reduce((s, p) => s + p.valor, 0);
      resumo.innerHTML = `<p><strong>${nLoc}</strong> contrato(s) · <strong>${nPag}</strong> pagamento(s) · total pago <strong>${currencyBRL(total)}</strong></p>`;
    }

    renderNotificacoes(cpf);

    const lista = $("cliente-contratos");
    if (lista) {
      if (!dados.locacoes.length) {
        lista.innerHTML =
          '<p class="subtext">Nenhuma locação para este CPF. Ao abrir o app os dados são atualizados da nuvem; se acabou de contratar, aguarde alguns minutos e toque em <strong>Atualizar da nuvem</strong>.</p>';
      } else {
        lista.innerHTML = dados.locacoes.map((loc) => renderContratoCard(loc, cpf, resumoFn)).join("");
      }
    }

    fillProtocoloSelect(dados.locacoes);
    bindCompMasks();
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
    if (sessao) renderApp(sessao);
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
    const btn = $("btn-share-comprovante");
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

  function init() {
    if (!hasClienteAppDownloadGate()) {
      window.location.replace("index.html#locadora/cliente");
      return;
    }

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
      showView("app");
      atualizarProgramaEDados(sess, { silent: false });
    });

    $("btn-logout")?.addEventListener("click", () => {
      clearSessao();
      showView("login");
    });
    $("btn-sync")?.addEventListener("click", () => pullNuvem());
    $("btn-notif-lidas")?.addEventListener("click", () => {
      const sessao = getSessao();
      if (!sessao) return;
      if (typeof window.__DK_clienteNotificacoesMarcarLidas === "function") {
        window.__DK_clienteNotificacoesMarcarLidas(sessao.cpf);
      }
      renderNotificacoes(sessao.cpf);
    });
    $("comp-arquivo")?.addEventListener("change", onComprovanteFileChange);
    $("btn-share-comprovante")?.addEventListener("click", () => enviarComprovanteParaNuvem());

    const cpfIn = $("login-cpf");
    cpfIn?.addEventListener("input", () => {
      const d = onlyDigits(cpfIn.value).slice(0, 11);
      cpfIn.value = formatCpf(d);
    });

    const sessao = getSessao();
    if (sessao?.cpf) {
      showView("app");
      atualizarProgramaEDados(sessao, { silent: false });
    } else {
      showView("login");
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
