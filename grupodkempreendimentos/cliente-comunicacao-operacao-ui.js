/**
 * App cliente: botões vendas (verde) / manutenção (amarelo) + chat texto.
 */
(function clienteComunicacaoOperacaoUi() {
  "use strict";

  let chatSetor = "";
  let sessaoCpf = "";
  let sessaoNome = "";

  function $(id) {
    return document.getElementById(id);
  }

  function fmtHora(iso) {
    const d = Date.parse(iso || "");
    if (!Number.isFinite(d)) return "";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function resolveSessao() {
    if (typeof window.__DK_getClienteSessaoCpf === "function") {
      const cpf = String(window.__DK_getClienteSessaoCpf() || "").replace(/\D/g, "").slice(0, 11);
      if (cpf.length === 11) {
        sessaoCpf = cpf;
        sessaoNome = String($("cliente-nome")?.textContent || "Cliente").trim();
        return;
      }
    }
    sessaoCpf = String($("cliente-cpf-label")?.textContent || "").replace(/\D/g, "").slice(0, 11);
    sessaoNome = String($("cliente-nome")?.textContent || "Cliente").trim();
  }

  function atualizarBadges() {
    if (!sessaoCpf || typeof window.__DK_comunicacaoContarNaoLidasCliente !== "function") return;
    const nv = window.__DK_comunicacaoContarNaoLidasCliente(sessaoCpf, "vendas");
    const nm = window.__DK_comunicacaoContarNaoLidasCliente(sessaoCpf, "manutencao");
    const bv = $("clienteComunicacaoBadgeVendas");
    const bm = $("clienteComunicacaoBadgeManutencao");
    if (bv) {
      bv.textContent = nv > 0 ? String(nv) : "";
      bv.classList.toggle("hidden", nv <= 0);
    }
    if (bm) {
      bm.textContent = nm > 0 ? String(nm) : "";
      bm.classList.toggle("hidden", nm <= 0);
    }
  }

  function renderChat() {
    const corpo = $("clienteComunicacaoChatCorpo");
    if (!corpo || !chatSetor) return;
    const tid = window.__DK_comunicacaoThreadId?.(sessaoCpf, chatSetor);
    if (tid && typeof window.__DK_comunicacaoMarcarThreadLida === "function") {
      window.__DK_comunicacaoMarcarThreadLida(tid, "cliente");
    }
    const hist = tid && window.__DK_comunicacaoHistorico ? window.__DK_comunicacaoHistorico(tid) : [];
    const vistaFn = window.__DK_comunicacaoMensagemVista;
    corpo.innerHTML = hist.length
      ? hist
          .map((m) => {
            const out = m.autor === "cliente";
            const quem = out ? "Você" : String(m.operadorNome || "DK").trim();
            const vista = typeof vistaFn === "function" ? vistaFn(m, "cliente") : false;
            const vistaCls = vista ? " dk-chat-bubble--vista" : "";
            const setorCls =
              vista && !out && chatSetor === "manutencao" ? " cliente-chat-bubble--manutencao" : "";
            return `<div class="dk-chat-bubble ${out ? "dk-chat-bubble--out" : "dk-chat-bubble--in"}${vistaCls}${setorCls}">
            <span class="dk-chat-bubble__meta">${quem} · ${fmtHora(m.criadoEm)}</span>
            <p class="dk-chat-bubble__texto">${String(m.texto || "").replace(/</g, "&lt;")}</p>
          </div>`;
          })
          .join("")
      : '<p class="subtext dk-chat-vazio">Nenhuma mensagem ainda. Escreva abaixo.</p>';
    corpo.scrollTop = corpo.scrollHeight;
    atualizarBadges();
  }

  function abrirChat(setor) {
    resolveSessao();
    if (sessaoCpf.length !== 11) return;
    chatSetor = setor;
    const modal = $("clienteComunicacaoChatModal");
    const titulo = $("clienteComunicacaoChatTitulo");
    const inp = $("clienteComunicacaoChatInput");
    const msg = $("clienteComunicacaoChatMsg");
    if (!modal) return;
    titulo.textContent =
      setor === "manutencao" ? "Manutenção DK" : "Vendas DK";
    if (inp) inp.value = "";
    if (msg) msg.textContent = "";
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    const openedSetor = setor;
    renderChat();
    void (async () => {
      if (typeof window.__DK_pullComunicacaoOperacaoFromCloudMerge === "function") {
        await window.__DK_pullComunicacaoOperacaoFromCloudMerge().catch(() => null);
      }
      if (chatSetor === openedSetor) {
        renderChat();
        checarNovasMensagensOperacao();
      }
    })();
    inp?.focus();
  }

  function fecharChat() {
    const modal = $("clienteComunicacaoChatModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    chatSetor = "";
  }

  function enviarMensagem() {
    void enviarMensagemAsync();
  }

  async function enviarMensagemAsync() {
    resolveSessao();
    if (!chatSetor || sessaoCpf.length !== 11) return;
    const inp = $("clienteComunicacaoChatInput");
    const msg = $("clienteComunicacaoChatMsg");
    let placa = "";
    try {
      const locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
      const loc = Array.isArray(locs)
        ? locs.find((l) => String(l?.cpf || "").replace(/\D/g, "").slice(0, 11) === sessaoCpf)
        : null;
      placa = String(loc?.placa || "").trim();
    } catch {
      /* ignore */
    }
    if (msg) msg.textContent = "A enviar para DK…";
    const r = (await window.__DK_comunicacaoClienteEnviarNuvem?.({
      cpf: sessaoCpf,
      nome: sessaoNome,
      placa,
      setor: chatSetor,
      texto: inp?.value || "",
    })) ||
      window.__DK_comunicacaoClienteEnviar?.({
        cpf: sessaoCpf,
        nome: sessaoNome,
        placa,
        setor: chatSetor,
        texto: inp?.value || "",
      });
    if (!r?.ok) {
      if (msg) msg.textContent = r?.msg || "Não foi possível enviar.";
      return;
    }
    if (inp) inp.value = "";
    renderChat();
    const push = r.push;
    if (push?.ok) {
      if (msg) msg.textContent = "Mensagem enviada para DK.";
    } else if (push) {
      if (msg) {
        msg.textContent =
          "Guardada neste telemóvel — nuvem indisponível. Verifique internet e toque Enviar de novo.";
      }
    } else if (typeof window.__DK_pushComunicacaoMensagemNow === "function" && r.rec) {
      const retry = await window.__DK_pushComunicacaoMensagemNow(r.rec).catch(() => ({ ok: false }));
      if (msg) {
        msg.textContent = retry?.ok
          ? "Mensagem enviada para DK."
          : "Guardada neste telemóvel — nuvem indisponível. Verifique internet e toque Enviar de novo.";
      }
    } else if (msg) {
      msg.textContent = "Mensagem guardada neste telemóvel.";
    }
  }

  function bindUi() {
    $("clienteComunicacaoVendasBtn")?.addEventListener("click", () => abrirChat("vendas"));
    $("clienteComunicacaoManutencaoBtn")?.addEventListener("click", () => abrirChat("manutencao"));
    $("clienteComunicacaoChatFecharBtn")?.addEventListener("click", fecharChat);
    $("clienteComunicacaoChatEnviarBtn")?.addEventListener("click", enviarMensagem);
    $("clienteComunicacaoChatInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        enviarMensagem();
      }
    });
    window.addEventListener("dk-comunicacao-operacao-changed", () => {
      if (chatSetor) renderChat();
      atualizarBadges();
    });
    window.addEventListener("dk-comprovantes-synced", atualizarBadges);
  }

  window.__DK_clienteComunicacaoRefresh = function () {
    resolveSessao();
    atualizarBadges();
    if (chatSetor) renderChat();
    if (typeof window.__DK_pushComunicacaoSnapshotNow === "function") {
      void window.__DK_pushComunicacaoSnapshotNow().catch(() => null);
    }
  };

  window.__DK_clienteAbrirChatComunicacao = function (setor) {
    const st = window.__DK_comunicacaoNormSetor?.(setor) || setor;
    if (st === "vendas" || st === "manutencao") abrirChat(st);
  };

  let ultimoContagemNaoLidas = { vendas: 0, manutencao: 0 };

  function checarNovasMensagensOperacao() {
    if (!sessaoCpf || typeof window.__DK_comunicacaoContarNaoLidasCliente !== "function") return;
    for (const st of ["vendas", "manutencao"]) {
      const n = window.__DK_comunicacaoContarNaoLidasCliente(sessaoCpf, st);
      if (n > ultimoContagemNaoLidas[st]) {
        if (typeof window.__DK_clientePushForegroundNotify === "function") {
          window.__DK_clientePushForegroundNotify(st);
        }
        if (typeof window.__DK_clienteNotificacaoMensagemDk === "function") {
          window.__DK_clienteNotificacaoMensagemDk({ cpf: sessaoCpf, setor: st });
        }
      }
      ultimoContagemNaoLidas[st] = n;
    }
    atualizarBadges();
  }

  function initContagemBaseline() {
    resolveSessao();
    if (!sessaoCpf || typeof window.__DK_comunicacaoContarNaoLidasCliente !== "function") return;
    for (const st of ["vendas", "manutencao"]) {
      ultimoContagemNaoLidas[st] = window.__DK_comunicacaoContarNaoLidasCliente(sessaoCpf, st);
    }
  }

  window.__DK_clienteComunicacaoInitBaseline = initContagemBaseline;

  window.__DK_clienteComunicacaoChecarNovas = checarNovasMensagensOperacao;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindUi();
      resolveSessao();
      initContagemBaseline();
      atualizarBadges();
    });
  } else {
    bindUi();
    resolveSessao();
    initContagemBaseline();
    atualizarBadges();
  }
})();
