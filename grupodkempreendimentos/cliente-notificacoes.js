/**
 * Notificações para o App Cliente (sincronizam na nuvem com dk_cliente_notificacoes).
 */
(function clienteNotificacoes() {
  const STORAGE_KEY = "dk_cliente_notificacoes";

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function currencyBRL(n) {
    if (typeof window.currencyBRL === "function") return window.currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveAll(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 300)));
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow().catch(() => {});
    } else if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
    }
  }

  function mensagemPagamentoConfirmado(valor, dataPagamento) {
    const data = String(dataPagamento || "").trim() || "—";
    return `Pagamento de ${currencyBRL(valor)} realizado em ${data} confirmado.`;
  }

  function mensagemPagamentoInvalidado(valor, dataPagamento) {
    const data = String(dataPagamento || "").trim() || "—";
    return `Pagamento de ${currencyBRL(valor)} (${data}) foi invalidado pela DK e não conta nos totais.`;
  }

  function adicionarNotificacaoComprovanteRejeitado(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    if (cpf.length !== 11) return { ok: false, msg: "CPF inválido." };
    const mensagem = String(payload.mensagem || "").trim();
    if (!mensagem) return { ok: false, msg: "Mensagem obrigatória." };
    const rec = {
      id: `cn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: "comprovante_rejeitado",
      cpf,
      protocolo: String(payload.protocolo || "").trim(),
      valor: Number(payload.valor) || 0,
      dataPagamento: String(payload.dataPagamento || "").trim(),
      mensagem,
      comprovanteId: String(payload.comprovanteId || "").trim(),
      criadoEm: new Date().toISOString(),
      lido: false,
    };
    const all = loadAll();
    all.unshift(rec);
    saveAll(all);
    return { ok: true, rec };
  }

  function adicionarNotificacaoPagamentoInvalidado(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    if (cpf.length !== 11) return { ok: false, msg: "CPF inválido." };
    const valor = Number(payload.valor);
    const dataPagamento = String(payload.dataPagamento || "").trim();
    if (!Number.isFinite(valor) || valor <= 0) {
      return { ok: false, msg: "Dados da notificação inválidos." };
    }
    const rec = {
      id: `cn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: "pagamento_invalidado",
      cpf,
      protocolo: String(payload.protocolo || "").trim(),
      valor,
      dataPagamento,
      mensagem: mensagemPagamentoInvalidado(valor, dataPagamento),
      comprovanteId: String(payload.comprovanteId || "").trim(),
      criadoEm: new Date().toISOString(),
      lido: false,
    };
    const all = loadAll();
    all.unshift(rec);
    saveAll(all);
    return { ok: true, rec };
  }

  function adicionarNotificacaoPagamentoConfirmado(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    if (cpf.length !== 11) return { ok: false, msg: "CPF inválido." };
    const valor = Number(payload.valor);
    const dataPagamento = String(payload.dataPagamento || "").trim();
    if (!Number.isFinite(valor) || valor <= 0 || !dataPagamento) {
      return { ok: false, msg: "Dados da notificação inválidos." };
    }
    const rec = {
      id: `cn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: "pagamento_confirmado",
      cpf,
      protocolo: String(payload.protocolo || "").trim(),
      valor,
      dataPagamento,
      mensagem: mensagemPagamentoConfirmado(valor, dataPagamento),
      comprovanteId: String(payload.comprovanteId || "").trim(),
      criadoEm: new Date().toISOString(),
      lido: false,
    };
    const all = loadAll();
    all.unshift(rec);
    saveAll(all);
    return { ok: true, rec };
  }

  function listarPorCpf(cpfDigits, opts) {
    const cpf = onlyDigits(cpfDigits).slice(0, 11);
    let rows = loadAll().filter((r) => onlyDigits(r.cpf) === cpf);
    if (!opts?.incluirLidas) rows = rows.filter((r) => !r.lido);
    return rows.sort((a, b) => Date.parse(b.criadoEm || 0) - Date.parse(a.criadoEm || 0));
  }

  function marcarLidasPorCpf(cpfDigits, ids) {
    const cpf = onlyDigits(cpfDigits).slice(0, 11);
    const idSet = ids ? new Set(ids) : null;
    const all = loadAll();
    let n = 0;
    all.forEach((r) => {
      if (onlyDigits(r.cpf) !== cpf) return;
      if (idSet && !idSet.has(r.id)) return;
      if (!r.lido) {
        r.lido = true;
        n += 1;
      }
    });
    if (n) saveAll(all);
    return n;
  }

  window.__DK_clienteNotificacaoPagamentoConfirmado = adicionarNotificacaoPagamentoConfirmado;
  window.__DK_clienteNotificacaoPagamentoInvalidado = adicionarNotificacaoPagamentoInvalidado;
  window.__DK_clienteNotificacaoComprovanteRejeitado = adicionarNotificacaoComprovanteRejeitado;
  window.__DK_clienteNotificacoesList = listarPorCpf;
  window.__DK_clienteNotificacoesMarcarLidas = marcarLidasPorCpf;
  window.__DK_clienteMensagemPagamentoConfirmado = mensagemPagamentoConfirmado;
})();
