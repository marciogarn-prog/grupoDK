/**
 * UI portal: caixas vendas (verde) / manutenção (amarelo) + chat estilo WhatsApp.
 */
(function portalComunicacaoOperacaoUi() {
  "use strict";

  let chatCtx = null;
  let modalTodosSetor = "vendas";

  function $(id) {
    return document.getElementById(id);
  }

  function operadorAtual() {
    try {
      const raw =
        sessionStorage.getItem("dk_portal_sessao") ||
        localStorage.getItem("dk_portal_sessao") ||
        localStorage.getItem("dk_sessao_cliente");
      const s = raw ? JSON.parse(raw) : null;
      return {
        nome: String(s?.nome || s?.funcionarioNome || "Operação DK").trim(),
        cpf: String(s?.cpf || "").replace(/\D/g, "").slice(0, 11),
      };
    } catch {
      return { nome: "Operação DK", cpf: "" };
    }
  }

  function fmtHora(iso) {
    const d = Date.parse(iso || "");
    if (!Number.isFinite(d)) return "";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function resolveNomePorCpf(cpf) {
    if (typeof findClienteByCpfCadastro === "function") {
      const n = String(findClienteByCpfCadastro(cpf)?.nome || "").trim();
      if (n) return n;
    }
    if (typeof window.__DK_resolveLancNomePorCpf === "function") {
      return String(window.__DK_resolveLancNomePorCpf(cpf) || "").trim();
    }
    return "";
  }

  function renderLista(el, setor) {
    if (!el || typeof window.__DK_comunicacaoListarPendentes !== "function") return;
    const pendentes = window.__DK_comunicacaoListarPendentes(setor);
    if (!pendentes.length) {
      el.innerHTML = '<p class="portal-comunicacao-inbox__vazio">Nenhuma mensagem pendente.</p>';
      return;
    }
    el.innerHTML = pendentes
      .map(
        (p) =>
          `<button type="button" class="portal-comunicacao-inbox__item" data-chat-thread="${p.threadId}" data-chat-setor="${p.setor}" data-chat-cpf="${p.cpf}" data-chat-nome="${String(p.nome).replace(/"/g, "&quot;")}" data-chat-placa="${String(p.placa || "").replace(/"/g, "&quot;")}">
            <span class="portal-comunicacao-inbox__nome">${p.nome}</span>
            <span class="portal-comunicacao-inbox__placa">${p.placa || "—"}</span>
          </button>`
      )
      .join("");
  }

  function refreshInboxes() {
    renderLista($("portalComunicacaoVendasLista"), "vendas");
    renderLista($("portalComunicacaoManutencaoLista"), "manutencao");
    if (typeof window.__DK_portalSyncComunicacaoBarLayout === "function") {
      requestAnimationFrame(() => window.__DK_portalSyncComunicacaoBarLayout());
    }
  }

  function renderChatHistorico() {
    const corpo = $("portalComunicacaoChatCorpo");
    if (!corpo || !chatCtx) return;
    const hist =
      typeof window.__DK_comunicacaoHistorico === "function"
        ? window.__DK_comunicacaoHistorico(chatCtx.threadId)
        : [];
    corpo.innerHTML = hist
      .map((m) => {
        const out = m.autor === "operacao";
        const quem = out
          ? String(m.operadorNome || "DK").trim()
          : String(m.nome || "Cliente").trim();
        return `<div class="dk-chat-bubble ${out ? "dk-chat-bubble--out" : "dk-chat-bubble--in"}">
          <span class="dk-chat-bubble__meta">${quem} · ${fmtHora(m.criadoEm)}</span>
          <p class="dk-chat-bubble__texto">${String(m.texto || "").replace(/</g, "&lt;")}</p>
        </div>`;
      })
      .join("");
    corpo.scrollTop = corpo.scrollHeight;
  }

  function abrirChat(ctx) {
    chatCtx = ctx;
    const modal = $("portalComunicacaoChatModal");
    const titulo = $("portalComunicacaoChatTitulo");
    const inp = $("portalComunicacaoChatInput");
    const msg = $("portalComunicacaoChatMsg");
    if (!modal || !titulo) return;
    const setorLbl = ctx.setor === "manutencao" ? "Manutenção" : "Vendas";
    titulo.textContent = `${ctx.nome} · ${ctx.placa || "—"} — ${setorLbl}`;
    if (inp) inp.value = "";
    if (msg) msg.textContent = "";
    renderChatHistorico();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    inp?.focus();
  }

  function fecharChat() {
    const modal = $("portalComunicacaoChatModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    chatCtx = null;
  }

  function enviarResposta() {
    if (!chatCtx || typeof window.__DK_comunicacaoOperacaoResponder !== "function") return;
    const inp = $("portalComunicacaoChatInput");
    const msg = $("portalComunicacaoChatMsg");
    const op = operadorAtual();
    const r = window.__DK_comunicacaoOperacaoResponder({
      threadId: chatCtx.threadId,
      cpf: chatCtx.cpf,
      nome: chatCtx.nome,
      placa: chatCtx.placa,
      setor: chatCtx.setor,
      texto: inp?.value || "",
      operadorNome: op.nome,
      operadorCpf: op.cpf,
    });
    if (!r.ok) {
      if (msg) msg.textContent = r.msg || "Não foi possível enviar.";
      return;
    }
    if (inp) inp.value = "";
    if (msg) msg.textContent = "Mensagem enviada.";
    renderChatHistorico();
    refreshInboxes();
    window.setTimeout(fecharChat, 400);
  }

  function resolvePlacaCadastro(cpf) {
    try {
      const locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
      const loc = Array.isArray(locs)
        ? locs.find((l) => String(l?.cpf || "").replace(/\D/g, "").slice(0, 11) === cpf)
        : null;
      return String(loc?.placa || "").trim();
    } catch {
      return "";
    }
  }

  function abrirChatClienteCadastro() {
    const cpf = String($("operacaoClienteCpf")?.value || "").replace(/\D/g, "").slice(0, 11);
    const nome = String($("operacaoClienteNome")?.value || "").trim();
    const setor = "vendas";
    if (cpf.length !== 11 || !nome) return;
    const tid = window.__DK_comunicacaoThreadId?.(cpf, setor);
    if (!tid) return;
    abrirChat({ threadId: tid, cpf, nome, placa: resolvePlacaCadastro(cpf), setor });
  }

  function resolveCtxManutencao() {
    const cpf = String($("operacaoLancManutencaoCpf")?.value || "").replace(/\D/g, "").slice(0, 11);
    if (cpf.length !== 11) return null;
    let nome = String($("operacaoLancManutencaoNomeBusca")?.value || "").trim();
    if (!nome) nome = resolveNomePorCpf(cpf);
    if (!nome) return null;
    let placa = String($("operacaoLancManutencaoPlaca")?.value || "").trim();
    if (!placa) placa = String($("operacaoLancManutencaoPlacaBusca")?.value || "").trim();
    return { cpf, nome, placa, setor: "manutencao" };
  }

  function abrirChatManutencao() {
    const ctx = resolveCtxManutencao();
    if (!ctx) return;
    const tid = window.__DK_comunicacaoThreadId?.(ctx.cpf, ctx.setor);
    if (!tid) return;
    abrirChat({ threadId: tid, ...ctx });
  }

  function abrirModalTodos(setorFixo) {
    const modal = $("portalComunicacaoTodosModal");
    if (!modal) return;
    modalTodosSetor = window.__DK_comunicacaoNormSetor?.(setorFixo) || "vendas";
    const sel = $("portalComunicacaoTodosSetor");
    if (sel) sel.value = modalTodosSetor;
    const titulo = $("portalComunicacaoTodosTitulo");
    const hint = $("portalComunicacaoTodosSetorHint");
    if (titulo) {
      titulo.textContent =
        modalTodosSetor === "manutencao"
          ? "Circular de manutenção para todos os clientes"
          : "Mensagem de vendas para todos os clientes";
    }
    if (hint) {
      hint.textContent =
        modalTodosSetor === "manutencao"
          ? "A mensagem aparece no app do cliente na caixa amarela (manutenção)."
          : "A mensagem aparece no app do cliente na caixa verde (vendas).";
      hint.hidden = false;
    }
    $("portalComunicacaoTodosTexto") && ($("portalComunicacaoTodosTexto").value = "");
    $("portalComunicacaoTodosMsg") && ($("portalComunicacaoTodosMsg").textContent = "");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function fecharModalTodos() {
    const modal = $("portalComunicacaoTodosModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    const hint = $("portalComunicacaoTodosSetorHint");
    if (hint) hint.hidden = true;
  }

  function enviarParaTodos() {
    const msg = $("portalComunicacaoTodosMsg");
    const op = operadorAtual();
    const r = window.__DK_comunicacaoOperacaoParaTodos?.({
      setor: modalTodosSetor,
      texto: $("portalComunicacaoTodosTexto")?.value || "",
      operadorNome: op.nome,
      operadorCpf: op.cpf,
    });
    if (!r?.ok) {
      if (msg) msg.textContent = r?.msg || "Falha ao enviar.";
      return;
    }
    if (msg) msg.textContent = r.msg || "Enviado.";
    fecharModalTodos();
  }

  function syncBtnClienteCadastro() {
    const btn = $("operacaoClienteMsgClienteBtn");
    if (!btn) return;
    const cpf = String($("operacaoClienteCpf")?.value || "").replace(/\D/g, "").slice(0, 11);
    const nome = String($("operacaoClienteNome")?.value || "").trim();
    btn.disabled = cpf.length !== 11 || !nome;
  }

  function syncBtnManutencao() {
    const btn = $("operacaoLancManutencaoMsgClienteBtn");
    if (!btn) return;
    btn.disabled = !resolveCtxManutencao();
  }

  function bindUi() {
    $("portalComunicacaoVendasLista")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-chat-thread]");
      if (!btn) return;
      abrirChat({
        threadId: btn.getAttribute("data-chat-thread"),
        setor: btn.getAttribute("data-chat-setor"),
        cpf: btn.getAttribute("data-chat-cpf"),
        nome: btn.getAttribute("data-chat-nome"),
        placa: btn.getAttribute("data-chat-placa"),
      });
    });
    $("portalComunicacaoManutencaoLista")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-chat-thread]");
      if (!btn) return;
      abrirChat({
        threadId: btn.getAttribute("data-chat-thread"),
        setor: btn.getAttribute("data-chat-setor"),
        cpf: btn.getAttribute("data-chat-cpf"),
        nome: btn.getAttribute("data-chat-nome"),
        placa: btn.getAttribute("data-chat-placa"),
      });
    });
    $("portalComunicacaoChatFecharBtnTop")?.addEventListener("click", fecharChat);
    $("portalComunicacaoChatModal")?.addEventListener("click", (e) => {
      if (e.target?.matches?.("[data-close-comunicacao-chat]")) fecharChat();
    });
    $("portalComunicacaoChatEnviarBtn")?.addEventListener("click", enviarResposta);
    $("portalComunicacaoChatInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        enviarResposta();
      }
    });
    $("operacaoClienteMsgClienteBtn")?.addEventListener("click", abrirChatClienteCadastro);
    $("operacaoClienteMsgTodosBtn")?.addEventListener("click", () => abrirModalTodos("vendas"));
    $("operacaoLancManutencaoMsgClienteBtn")?.addEventListener("click", abrirChatManutencao);
    $("operacaoLancManutencaoMsgTodosBtn")?.addEventListener("click", () => abrirModalTodos("manutencao"));
    $("portalComunicacaoTodosFecharBtn")?.addEventListener("click", fecharModalTodos);
    $("portalComunicacaoTodosFecharBtn2")?.addEventListener("click", fecharModalTodos);
    $("portalComunicacaoTodosEnviarBtn")?.addEventListener("click", enviarParaTodos);
    $("operacaoClienteCpf")?.addEventListener("input", syncBtnClienteCadastro);
    $("operacaoClienteNome")?.addEventListener("input", syncBtnClienteCadastro);
    [
      "operacaoLancManutencaoCpf",
      "operacaoLancManutencaoNomeBusca",
      "operacaoLancManutencaoPlaca",
      "operacaoLancManutencaoPlacaBusca",
      "operacaoLancManutencaoProtocoloSelect",
    ].forEach((id) => {
      $(id)?.addEventListener("input", syncBtnManutencao);
      $(id)?.addEventListener("change", syncBtnManutencao);
    });
    window.addEventListener("dk-comunicacao-operacao-changed", refreshInboxes);
    window.addEventListener("dk-comprovantes-synced", refreshInboxes);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshInboxes();
    });
  }

  window.__DK_portalComunicacaoRefresh = refreshInboxes;
  window.__DK_portalComunicacaoSyncCadastroBtn = syncBtnClienteCadastro;
  window.__DK_portalComunicacaoSyncManutencaoBtn = syncBtnManutencao;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindUi();
      refreshInboxes();
      syncBtnClienteCadastro();
      syncBtnManutencao();
    });
  } else {
    bindUi();
    refreshInboxes();
    syncBtnClienteCadastro();
    syncBtnManutencao();
  }
})();
