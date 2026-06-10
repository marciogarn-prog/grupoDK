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

  function dispararPushAvisoCliente(cpf, mensagem) {
    const cpfDig = onlyDigits(cpf).slice(0, 11);
    if (cpfDig.length !== 11) return;
    const body = String(mensagem || "").trim().slice(0, 180) || "Você tem um novo aviso da DK";
    const headers = { "Content-Type": "application/json" };
    if (window.__DK_DEPLOY_CHANNEL__ === "demo") headers["X-DK-Deploy-Channel"] = "demo";
    void fetch("/api/dk-cliente-geo?push=1", {
      method: "POST",
      headers,
      keepalive: true,
      body: JSON.stringify({
        action: "notify",
        cpf: cpfDig,
        title: "DK Locadora",
        body,
        channel: window.__DK_DEPLOY_CHANNEL__ === "demo" ? "demo" : "default",
      }),
    }).catch(() => null);
  }

  function saveAll(arr, opts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 300)));
    if (opts?.skipCloud) return Promise.resolve({ ok: true, skipped: true });
    if (typeof window.__DK_markLocalDataAuthority === "function") {
      window.__DK_markLocalDataAuthority(5 * 60 * 1000);
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      return window.__DK_pushCloudSnapshotNow(opts?.force ? { force: true } : undefined).catch(() => ({
        ok: false,
        error: "push_failed",
      }));
    }
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
      return Promise.resolve({ ok: true, skipped: true });
    }
    return Promise.resolve({ ok: false, error: "sync_unavailable" });
  }

  function pushNotificacoesNuvem() {
    return saveAll(loadAll(), { force: true });
  }

  async function verificarNotificacaoClienteNaNuvem(rec, tentativa) {
    const fetchFn =
      typeof window.__DK_fetchCloudSnapshotPayload === "function"
        ? window.__DK_fetchCloudSnapshotPayload
        : null;
    if (!fetchFn || !rec?.id) {
      return { ok: true, skipped: true };
    }
    if (tentativa > 0) {
      await new Promise((r) => window.setTimeout(r, 1200));
    }
    let data;
    try {
      data = await fetchFn();
    } catch {
      data = null;
    }
    const arr = data?.payload?.dk_cliente_notificacoes;
    if (!Array.isArray(arr)) {
      if (tentativa < 2) return verificarNotificacaoClienteNaNuvem(rec, tentativa + 1);
      return { ok: false, msg: "Nuvem ainda sem o aviso — tente enviar de novo." };
    }
    const found = arr.find((d) => String(d?.id) === String(rec.id));
    if (!found || !String(found.mensagem || "").trim()) {
      if (tentativa < 2) return verificarNotificacaoClienteNaNuvem(rec, tentativa + 1);
      return { ok: false, msg: "Aviso não confirmado na nuvem — o cliente ainda não recebe a notificação." };
    }
    return { ok: true };
  }

  async function confirmarNotificacaoClienteNaNuvem(rec, successMsg) {
    const pushRes = await pushNotificacoesNuvem();
    if (!pushRes?.ok) {
      return {
        ok: false,
        msg: "Falha ao enviar aviso à nuvem — verifique a ligação à internet e tente de novo.",
      };
    }
    const ver = await verificarNotificacaoClienteNaNuvem(rec, 0);
    if (!ver.ok) {
      return {
        ok: false,
        msg: ver.msg || "Nuvem não confirmou o aviso — o cliente ainda não recebe a informação.",
      };
    }
    return { ok: true, cloudOk: true, msg: successMsg };
  }

  function primeiroNomeCliente(nome) {
    const n = String(nome || "")
      .trim()
      .split(/\s+/)[0];
    return n || "Cliente";
  }

  function tratamentoSenhorSenhora(nome) {
    const first = primeiroNomeCliente(nome).toLowerCase();
    const masc = new Set(["luca", "joshua", "nikita", "andrea"]);
    if (masc.has(first)) return "senhor";
    if (first.endsWith("a")) return "senhora";
    return "senhor";
  }

  function mensagemBoasVindas(nome, protocolo) {
    const prenome = primeiroNomeCliente(nome);
    const trat = tratamentoSenhorSenhora(nome);
    const proto = String(protocolo || "").trim() || "—";
    return `Bem-vindo(a) à DK Locadora, ${prenome}. O seu contrato é o de número ${proto}. É um prazer ter o ${trat} como cliente.`;
  }

  function mensagemPagamentoConfirmado(valor, dataPagamento) {
    const data = String(dataPagamento || "").trim() || "—";
    return `Pagamento de ${currencyBRL(valor)} realizado em ${data} confirmado.`;
  }

  function mensagemPagamentoInvalidado(valor, dataPagamento) {
    const data = String(dataPagamento || "").trim() || "—";
    return `Pagamento de ${currencyBRL(valor)} (${data}) foi invalidado pela DK e não conta nos totais.`;
  }

  function mensagemPagamentoLancado(valor, dataPagamento, protocolo, placa) {
    const data = String(dataPagamento || "").trim() || "—";
    const proto = String(protocolo || "").trim() || "—";
    const placaTxt = String(placa || "").trim();
    const veiculo = placaTxt ? ` · veículo ${placaTxt}` : "";
    return `Pagamento de ${currencyBRL(valor)} em ${data} registado no protocolo ${proto}${veiculo}.`;
  }

  function mensagemMultaLancada(payload) {
    const cod = String(payload.cod || "").trim() || "—";
    const desc = String(payload.descricao || "").trim() || "—";
    const valor = Number(payload.valor);
    const valorTxt = Number.isFinite(valor) && valor > 0 ? currencyBRL(valor) : "—";
    const data = String(payload.dataMulta || payload.data || "").trim() || "—";
    const proto = String(payload.protocolo || "").trim() || "—";
    const qtd = Math.max(1, Number(payload.quantidadeParcelas) || 1);
    const parcelasTxt = qtd > 1 ? ` em ${qtd} parcelas` : "";
    return `Multa ${cod} (${desc}): ${valorTxt} · data ${data}${parcelasTxt} · protocolo ${proto}.`;
  }

  function mensagemManutencaoLancada(payload) {
    const cod = String(payload.cod || "").trim() || "—";
    const desc = String(payload.descricao || "").trim() || "—";
    const valor = Number(payload.valor);
    const valorTxt = Number.isFinite(valor) && valor > 0 ? currencyBRL(valor) : "—";
    const data = String(payload.dataManutencao || payload.data || "").trim() || "—";
    const proto = String(payload.protocolo || "").trim() || "—";
    const qtd = Math.max(1, Number(payload.quantidadeParcelas) || 1);
    const parcelasTxt = qtd > 1 ? ` em ${qtd} parcelas` : "";
    return `Manutenção ${cod} (${desc}): ${valorTxt} · data ${data}${parcelasTxt} · protocolo ${proto}.`;
  }

  function adicionarNotificacaoGenerica(payload, tipo, mensagem) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    if (cpf.length !== 11) return { ok: false, msg: "CPF inválido." };
    const msg = String(mensagem || "").trim();
    if (!msg) return { ok: false, msg: "Mensagem obrigatória." };
    const rec = {
      id: `cn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo,
      cpf,
      protocolo: String(payload.protocolo || "").trim(),
      placa: String(payload.placa || "").trim(),
      valor: Number(payload.valor) || 0,
      dataPagamento: String(payload.dataPagamento || payload.data || payload.dataMulta || payload.dataManutencao || "").trim(),
      cod: String(payload.cod || "").trim(),
      descricao: String(payload.descricao || "").trim(),
      quantidadeParcelas: Number(payload.quantidadeParcelas) || 0,
      mensagem: msg,
      criadoEm: new Date().toISOString(),
      lido: false,
    };
    const all = loadAll();
    all.unshift(rec);
    saveAll(all);
    dispararPushAvisoCliente(cpf, msg);
    return { ok: true, rec };
  }

  function adicionarNotificacaoPagamentoLancado(payload) {
    const valor = Number(payload.valor);
    const dataPagamento = String(payload.dataPagamento || "").trim();
    if (!Number.isFinite(valor) || valor <= 0 || !dataPagamento) {
      return { ok: false, msg: "Dados da notificação inválidos." };
    }
    return adicionarNotificacaoGenerica(
      payload,
      "pagamento_lancado",
      mensagemPagamentoLancado(valor, dataPagamento, payload.protocolo, payload.placa)
    );
  }

  async function adicionarNotificacaoPagamentoLancadoComNuvem(payload) {
    const add = adicionarNotificacaoPagamentoLancado(payload);
    if (!add.ok) return add;
    if (add.skipped) return { ok: true, skipped: true, msg: "Aviso já registado." };
    return confirmarNotificacaoClienteNaNuvem(
      add.rec,
      "Lançamento de aluguel realizado com sucesso. Informação já enviada para o cliente."
    );
  }

  function adicionarNotificacaoBoasVindas(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    if (cpf.length !== 11) return { ok: false, msg: "CPF inválido." };
    const protocolo = String(payload.protocolo || "").trim();
    if (!protocolo) return { ok: false, msg: "Protocolo obrigatório." };
    const all = loadAll();
    const ja = all.some((r) => onlyDigits(r.cpf) === cpf && r.tipo === "boas_vindas");
    if (ja) return { ok: true, already: true, msg: "Boas-vindas já enviadas." };
    return adicionarNotificacaoGenerica(
      { ...payload, protocolo },
      "boas_vindas",
      mensagemBoasVindas(payload.nome, protocolo)
    );
  }

  async function adicionarNotificacaoBoasVindasComNuvem(payload) {
    const add = adicionarNotificacaoBoasVindas(payload);
    if (!add.ok) return add;
    if (add.already) return { ok: true, already: true, msg: add.msg };
    return confirmarNotificacaoClienteNaNuvem(add.rec, "Boas-vindas registadas — o cliente vê nos Avisos DK.");
  }

  function adicionarNotificacaoMultaLancada(payload) {
    return adicionarNotificacaoGenerica(payload, "multa_lancada", mensagemMultaLancada(payload));
  }

  function adicionarNotificacaoManutencaoLancada(payload) {
    return adicionarNotificacaoGenerica(payload, "manutencao_lancada", mensagemManutencaoLancada(payload));
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

  function adicionarNotificacaoMensagemDk(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    if (cpf.length !== 11) return { ok: false, msg: "CPF inválido." };
    const setor = String(payload.setor || "vendas").trim().toLowerCase();
    const rec = {
      id: `cn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: "mensagem_dk",
      cpf,
      setor: setor === "manutencao" ? "manutencao" : "vendas",
      mensagem: "Você tem uma nova mensagem da DK",
      criadoEm: new Date().toISOString(),
      lido: false,
    };
    const all = loadAll();
    const dup = all.some(
      (r) =>
        r.tipo === "mensagem_dk" &&
        onlyDigits(r.cpf) === cpf &&
        r.setor === rec.setor &&
        !r.lido &&
        Date.now() - (Date.parse(r.criadoEm || 0) || 0) < 120000
    );
    if (dup) return { ok: true, skipped: true };
    all.unshift(rec);
    saveAll(all, { skipCloud: true });
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
    if (opts?.apenasLidas) rows = rows.filter((r) => r.lido);
    else if (!opts?.incluirLidas) rows = rows.filter((r) => !r.lido);
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
        r.lidaEm = new Date().toISOString();
        n += 1;
      }
    });
    if (n) saveAll(all);
    return n;
  }

  window.__DK_clienteNotificacaoPagamentoConfirmado = adicionarNotificacaoPagamentoConfirmado;
  window.__DK_clienteNotificacaoPagamentoInvalidado = adicionarNotificacaoPagamentoInvalidado;
  window.__DK_clienteNotificacaoComprovanteRejeitado = adicionarNotificacaoComprovanteRejeitado;
  window.__DK_clienteNotificacaoMensagemDk = adicionarNotificacaoMensagemDk;
  window.__DK_clienteNotificacaoPagamentoLancado = adicionarNotificacaoPagamentoLancado;
  window.__DK_clienteNotificacaoPagamentoLancadoComNuvem = adicionarNotificacaoPagamentoLancadoComNuvem;
  window.__DK_clienteNotificacaoBoasVindas = adicionarNotificacaoBoasVindas;
  window.__DK_clienteNotificacaoBoasVindasComNuvem = adicionarNotificacaoBoasVindasComNuvem;
  window.__DK_verificarNotificacaoClienteNaNuvem = verificarNotificacaoClienteNaNuvem;
  window.__DK_clienteNotificacaoMultaLancada = adicionarNotificacaoMultaLancada;
  window.__DK_clienteNotificacaoManutencaoLancada = adicionarNotificacaoManutencaoLancada;
  window.__DK_clienteNotificacoesList = listarPorCpf;
  window.__DK_clienteNotificacoesMarcarLidas = marcarLidasPorCpf;
  window.__DK_clienteMensagemPagamentoConfirmado = mensagemPagamentoConfirmado;
})();
