/**
 * UI portal: caixas vendas (verde) / manutenção (amarelo) + chat estilo WhatsApp.
 */
(function portalComunicacaoOperacaoUi() {
  "use strict";

  let chatCtx = null;

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

  function abrirChatClienteCadastro() {
    const cpf = String($("operacaoClienteCpf")?.value || "").replace(/\D/g, "").slice(0, 11);
    const nome = String($("operacaoClienteNome")?.value || "").trim();
    const setorSel = $("operacaoClienteMsgSetor");
    const setor = window.__DK_comunicacaoNormSetor?.(setorSel?.value) || "vendas";
    if (cpf.length !== 11 || !nome) return;
    const tid = window.__DK_comunicacaoThreadId?.(cpf, setor);
    if (!tid) return;
    let placa = "";
    try {
      const locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
      const loc = Array.isArray(locs)
        ? locs.find((l) => String(l?.cpf || "").replace(/\D/g, "").slice(0, 11) === cpf)
        : null;
      placa = String(loc?.placa || "").trim();
    } catch {
      /* ignore */
    }
    abrirChat({ threadId: tid, cpf, nome, placa, setor });
  }

  function abrirModalTodos() {
    const modal = $("portalComunicacaoTodosModal");
    if (!modal) return;
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
  }

  function enviarParaTodos() {
    const msg = $("portalComunicacaoTodosMsg");
    const op = operadorAtual();
    const r = window.__DK_comunicacaoOperacaoParaTodos?.({
      setor: $("portalComunicacaoTodosSetor")?.value || "vendas",
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
    $("operacaoClienteMsgTodosBtn")?.addEventListener("click", abrirModalTodos);
    $("portalComunicacaoTodosFecharBtn")?.addEventListener("click", fecharModalTodos);
    $("portalComunicacaoTodosFecharBtn2")?.addEventListener("click", fecharModalTodos);
    $("portalComunicacaoTodosEnviarBtn")?.addEventListener("click", enviarParaTodos);
    $("operacaoClienteCpf")?.addEventListener("input", syncBtnClienteCadastro);
    $("operacaoClienteNome")?.addEventListener("input", syncBtnClienteCadastro);
    window.addEventListener("dk-comunicacao-operacao-changed", refreshInboxes);
    window.addEventListener("dk-comprovantes-synced", refreshInboxes);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshInboxes();
    });
  }

  window.__DK_portalComunicacaoRefresh = refreshInboxes;
  window.__DK_portalComunicacaoSyncCadastroBtn = syncBtnClienteCadastro;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindUi();
      refreshInboxes();
      syncBtnClienteCadastro();
    });
  } else {
    bindUi();
    refreshInboxes();
    syncBtnClienteCadastro();
  }
})();
