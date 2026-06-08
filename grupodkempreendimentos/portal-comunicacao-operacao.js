/**
 * Comunicação texto cliente ↔ operação (vendas / manutenção). Sem anexos.
 * Sincroniza em dk_comunicacao_operacao_v1.
 */
(function portalComunicacaoOperacao() {
  "use strict";

  const STORAGE_KEY = "dk_comunicacao_operacao_v1";
  const MAX_MSG = 3000;
  const MAX_TEXTO = 2000;
  const SETORES = ["vendas", "manutencao"];

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normSetor(s) {
    const v = String(s || "")
      .trim()
      .toLowerCase();
    return v === "manutencao" || v === "manutenção" ? "manutencao" : v === "vendas" ? "vendas" : "";
  }

  function threadId(cpf, setor) {
    const dig = onlyDigits(cpf).slice(0, 11);
    const st = normSetor(setor);
    if (dig.length !== 11 || !st) return "";
    return `${dig}|${st}`;
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

  function saveAll(arr, opts) {
    const next = (Array.isArray(arr) ? arr : []).slice(0, MAX_MSG);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (opts?.skipCloud) return;
    const pushNuvem = () => {
      if (typeof window.__DK_pushComunicacaoSnapshotNow === "function") {
        return window.__DK_pushComunicacaoSnapshotNow();
      }
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        return window.__DK_pushCloudSnapshotNow({ force: true });
      }
      if (typeof window.__DK_pushToCloudAfterSave === "function") {
        window.__DK_pushToCloudAfterSave();
      }
      return Promise.resolve({ ok: false, skipped: true });
    };
    if (opts?.awaitCloud) {
      return pushNuvem();
    }
    if (typeof window.__DK_markLocalDataAuthority === "function" && !opts?.fromCliente) {
      window.__DK_markLocalDataAuthority(3 * 60 * 1000);
    }
    pushNuvem().catch((e) => console.warn("[DK comunicacao] push", e));
  }

  function sanitizeTexto(raw) {
    return String(raw || "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .trim()
      .slice(0, MAX_TEXTO);
  }

  function resolvePlacaCliente(cpf) {
    const dig = onlyDigits(cpf).slice(0, 11);
    if (dig.length !== 11) return "";
    try {
      const raw = localStorage.getItem("dk_locacoes_cadastro");
      const locs = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(locs)) return "";
      const ativos = locs.filter((l) => {
        if (onlyDigits(l?.cpf).slice(0, 11) !== dig) return false;
        const fim = String(l?.fim || l?.dataFim || "").trim();
        return !fim || fim === "...";
      });
      const pick = ativos[0] || locs.find((l) => onlyDigits(l?.cpf).slice(0, 11) === dig);
      return String(pick?.placa || "").trim();
    } catch {
      return "";
    }
  }

  function mensagensThread(tid) {
    return loadAll()
      .filter((m) => m && m.threadId === tid)
      .sort((a, b) => (Date.parse(a.criadoEm || 0) || 0) - (Date.parse(b.criadoEm || 0) || 0));
  }

  function ultimaMensagemThread(tid) {
    const msgs = mensagensThread(tid);
    return msgs.length ? msgs[msgs.length - 1] : null;
  }

  function threadPendenteOperacao(tid) {
    const msgs = mensagensThread(tid);
    if (!msgs.length) return false;
    const last = msgs[msgs.length - 1];
    if (last.autor === "cliente") return true;
    return msgs.some((m) => m.autor === "cliente" && !m.lidaOperacaoEm);
  }

  function marcarClienteMsgsLidasInThread(tid) {
    if (!tid) return false;
    const now = new Date().toISOString();
    const all = loadAll();
    let changed = false;
    for (let i = 0; i < all.length; i += 1) {
      const m = all[i];
      if (!m || m.threadId !== tid || m.autor !== "cliente" || m.lidaOperacaoEm) continue;
      all[i] = { ...m, lidaOperacaoEm: now };
      changed = true;
    }
    if (!changed) return false;
    saveAll(all);
    return true;
  }

  function listarPendentesOperacao(setor) {
    const st = normSetor(setor);
    if (!st) return [];
    const seen = new Set();
    const out = [];
    for (const m of loadAll()) {
      if (!m || normSetor(m.setor) !== st) continue;
      const tid = m.threadId || threadId(m.cpf, m.setor);
      if (!tid || seen.has(tid)) continue;
      if (!threadPendenteOperacao(tid)) continue;
      seen.add(tid);
      const last = ultimaMensagemThread(tid);
      out.push({
        threadId: tid,
        setor: st,
        cpf: onlyDigits(m.cpf).slice(0, 11),
        nome: String(m.nome || "").trim() || "Cliente",
        placa: String(m.placa || "").trim() || resolvePlacaCliente(m.cpf),
        ultimaMensagem: String(last?.texto || "").trim(),
        criadoEm: last?.criadoEm || "",
      });
    }
    return out.sort((a, b) => (Date.parse(b.criadoEm || 0) || 0) - (Date.parse(a.criadoEm || 0) || 0));
  }

  function novaMensagem(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    const setor = normSetor(payload.setor);
    const texto = sanitizeTexto(payload.texto);
    const autor = payload.autor === "operacao" ? "operacao" : "cliente";
    if (cpf.length !== 11 || !setor || !texto) {
      return { ok: false, msg: "CPF, setor e mensagem são obrigatórios." };
    }
    const tid = threadId(cpf, setor);
    const rec = {
      id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      threadId: tid,
      setor,
      cpf,
      nome: String(payload.nome || "").trim() || "Cliente",
      placa: String(payload.placa || "").trim() || resolvePlacaCliente(cpf),
      texto,
      autor,
      operadorNome: autor === "operacao" ? String(payload.operadorNome || "").trim() : "",
      operadorCpf: autor === "operacao" ? onlyDigits(payload.operadorCpf).slice(0, 11) : "",
      criadoEm: new Date().toISOString(),
    };
    const all = loadAll();
    all.push(rec);
    const fromCliente =
      autor === "cliente" &&
      typeof window.__DK_getClienteSessaoCpf === "function" &&
      String(window.__DK_getClienteSessaoCpf() || "").replace(/\D/g, "").slice(0, 11) === cpf;
    saveAll(all, { fromCliente });
    try {
      window.dispatchEvent(new CustomEvent("dk-comunicacao-operacao-changed", { detail: { threadId: tid, setor } }));
    } catch {
      /* ignore */
    }
    return { ok: true, rec };
  }

  function enviarClienteParaSetor(payload) {
    return novaMensagem({ ...payload, autor: "cliente" });
  }

  function responderOperacao(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    const setor = normSetor(payload.setor);
    const tid = threadId(cpf, setor);
    if (tid) marcarClienteMsgsLidasInThread(tid);
    return novaMensagem({ ...payload, autor: "operacao" });
  }

  function listarClientesCadastro() {
    try {
      const raw = localStorage.getItem("dk_clientes_cadastro");
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const out = [];
      const seen = new Set();
      for (const c of arr) {
        const cpf = onlyDigits(c?.cpf).slice(0, 11);
        if (cpf.length !== 11 || seen.has(cpf)) continue;
        seen.add(cpf);
        out.push({
          cpf,
          nome: String(c?.nome || "").trim() || "Cliente",
          placa: resolvePlacaCliente(cpf),
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  function enviarOperacaoParaTodos(payload) {
    const setor = normSetor(payload.setor) || "vendas";
    const texto = sanitizeTexto(payload.texto);
    if (!texto) return { ok: false, msg: "Escreva a mensagem." };
    const clientes = listarClientesCadastro();
    if (!clientes.length) return { ok: false, msg: "Nenhum cliente cadastrado." };
    let n = 0;
    for (const c of clientes) {
      const r = novaMensagem({
        cpf: c.cpf,
        nome: c.nome,
        placa: c.placa,
        setor,
        texto,
        autor: "operacao",
        operadorNome: payload.operadorNome,
        operadorCpf: payload.operadorCpf,
      });
      if (r.ok) n += 1;
    }
    return { ok: true, n, msg: `Mensagem enviada para ${n} cliente(s).` };
  }

  function mergeComunicacaoOperacaoRecord(prev, next) {
    if (!prev) return next;
    if (!next) return prev;
    const pick =
      (Date.parse(next.criadoEm || 0) || 0) >= (Date.parse(prev.criadoEm || 0) || 0) ? next : prev;
    const other = pick === next ? prev : next;
    const maxIso = (a, b) => {
      const ta = Date.parse(a || "") || 0;
      const tb = Date.parse(b || "") || 0;
      if (ta >= tb) return a || b || "";
      return b || a || "";
    };
    return {
      ...other,
      ...pick,
      id: prev.id || next.id,
      threadId: pick.threadId || other.threadId,
      cpf: pick.cpf || other.cpf,
      texto: pick.texto || other.texto,
      criadoEm: prev.criadoEm || next.criadoEm,
      lidaClienteEm: maxIso(prev.lidaClienteEm, next.lidaClienteEm),
      lidaOperacaoEm: maxIso(prev.lidaOperacaoEm, next.lidaOperacaoEm),
    };
  }

  function mergeComunicacaoOperacao(localArr, cloudArr) {
    const byId = new Map();
    const push = (m) => {
      if (!m || typeof m !== "object" || !m.id) return;
      byId.set(m.id, mergeComunicacaoOperacaoRecord(byId.get(m.id), m));
    };
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(push);
    (Array.isArray(localArr) ? localArr : []).forEach(push);
    return Array.from(byId.values())
      .sort((a, b) => (Date.parse(a.criadoEm || 0) || 0) - (Date.parse(b.criadoEm || 0) || 0))
      .slice(0, MAX_MSG);
  }

  function contarNaoLidasCliente(cpf, setor) {
    const tid = threadId(cpf, setor);
    if (!tid) return 0;
    return mensagensThread(tid).filter((m) => m.autor === "operacao" && !m.lidaClienteEm).length;
  }

  function marcarThreadLida(tid, leitor) {
    const st = leitor === "operacao" ? "operacao" : "cliente";
    if (!tid) return false;
    const now = new Date().toISOString();
    const all = loadAll();
    let changed = false;
    for (let i = 0; i < all.length; i += 1) {
      const m = all[i];
      if (!m || m.threadId !== tid) continue;
      if (st === "cliente" && m.autor === "operacao" && !m.lidaClienteEm) {
        all[i] = { ...m, lidaClienteEm: now };
        changed = true;
      } else if (st === "operacao" && m.autor === "cliente" && !m.lidaOperacaoEm) {
        all[i] = { ...m, lidaOperacaoEm: now };
        changed = true;
      }
    }
    if (!changed) return false;
    saveAll(all);
    try {
      window.dispatchEvent(new CustomEvent("dk-comunicacao-operacao-changed", { detail: { threadId: tid } }));
    } catch {
      /* ignore */
    }
    return true;
  }

  function mensagemVistaPorReceptor(m, lado) {
    if (!m) return false;
    if (lado === "cliente") {
      return m.autor === "operacao" ? Boolean(m.lidaClienteEm) : Boolean(m.lidaOperacaoEm);
    }
    return m.autor === "cliente" ? Boolean(m.lidaOperacaoEm) : Boolean(m.lidaClienteEm);
  }

  window.__DK_comunicacaoOperacaoStorageKey = STORAGE_KEY;
  window.__DK_comunicacaoOperacaoMerge = mergeComunicacaoOperacao;
  window.__DK_comunicacaoThreadId = threadId;
  window.__DK_comunicacaoListarPendentes = listarPendentesOperacao;
  window.__DK_comunicacaoHistorico = mensagensThread;
  window.__DK_comunicacaoClienteEnviar = enviarClienteParaSetor;
  window.__DK_comunicacaoOperacaoResponder = responderOperacao;
  window.__DK_comunicacaoOperacaoParaTodos = enviarOperacaoParaTodos;
  window.__DK_comunicacaoContarNaoLidasCliente = contarNaoLidasCliente;
  window.__DK_comunicacaoMarcarThreadLida = marcarThreadLida;
  window.__DK_comunicacaoMensagemVista = mensagemVistaPorReceptor;
  window.__DK_comunicacaoNormSetor = normSetor;
})();
