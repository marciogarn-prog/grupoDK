/**
 * Documentos vinculados ao protocolo de locação (cadastro operação).
 */
(function portalLocacaoDocumentos() {
  const STORAGE_KEY = "dk_locacao_documentos_v1";
  const MAX_BYTES = 4 * 1024 * 1024;

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normNc(v) {
    return String(v ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const p = raw ? JSON.parse(raw) : [];
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }

  function saveAllLocal(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function pushDocumentosNuvem() {
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => {});
    } else if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
    }
  }

  function saveAll(arr) {
    saveAllLocal(arr);
  }

  function isDocEnviadoCliente(d) {
    if (d?.enviadoCliente === false) return false;
    if (d?.enviadoCliente === true) return true;
    return Boolean(String(d?.arquivoBase64 || "").trim());
  }

  function getProtocoloAtual() {
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const nc = normNc(hid?.value);
    return nc || "";
  }

  function getCpfAtual() {
    const inp = document.getElementById("operacaoLocacaoCpf");
    return onlyDigits(inp?.value).slice(0, 11);
  }

  function podeGerirDocumentosLocacao() {
    if (typeof window.__DK_getPortalSessaoAdminRole !== "function") return false;
    const role = window.__DK_getPortalSessaoAdminRole();
    if (!role) return false;
    if (role === "owner") return true;
    const fn =
      typeof window.__DK_getPortalSessaoEquipaFuncionario === "function"
        ? window.__DK_getPortalSessaoEquipaFuncionario
        : null;
    const acessosFn =
      typeof window.__DK_getPortalOperacaoAcessosEfetivos === "function"
        ? window.__DK_getPortalOperacaoAcessosEfetivos
        : null;
    if (!fn || !acessosFn) return false;
    const f = fn();
    const acessos = acessosFn(f);
    return Boolean(acessos?.locacao);
  }

  function getRegistroOperador() {
    if (typeof window.__DK_getPortalSessaoParaRegistroLancamento === "function") {
      const r = window.__DK_getPortalSessaoParaRegistroLancamento();
      if (r) return r;
    }
    return { cpf: "", nome: "" };
  }

  function docsDoProtocolo(nc, cpf) {
    const n = normNc(nc);
    const dig = onlyDigits(cpf).slice(0, 11);
    return loadAll().filter((d) => normNc(d.numeroContrato) === n && (!dig || onlyDigits(d.cpf).slice(0, 11) === dig));
  }

  function inferDocTipo(d) {
    const t = String(d?.tipo || "").trim().toLowerCase();
    if (t === "contrato" || t === "crlv" || t === "multa") return t;
    const cat = String(d?.origemDepositoCategoria || "").trim().toLowerCase();
    if (cat === "contrato" || cat === "crlv" || cat === "multa") return cat;
    const nome = String(d?.nome || "");
    if (/^contrato\b|contrato\s*—/i.test(nome)) return "contrato";
    if (/crlv/i.test(nome)) return "crlv";
    if (/multa/i.test(nome)) return "multa";
    return "";
  }

  function docsDoProtocoloPorTipo(nc, cpf, tipo) {
    const want = String(tipo || "").trim().toLowerCase();
    return docsDoProtocolo(nc, cpf).filter((d) => inferDocTipo(d) === want);
  }

  function locacaoDoProtocolo(nc) {
    const n = normNc(nc);
    if (!n) return null;
    try {
      const raw = localStorage.getItem("dk_locacoes_cadastro");
      const locs = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(locs)) return null;
      return locs.find((l) => normNc(l?.numeroContrato) === n) || null;
    } catch {
      return null;
    }
  }

  function protocoloLocacaoAtivo(nc) {
    const loc = locacaoDoProtocolo(nc);
    if (!loc) return true;
    const fim = String(loc.fim || loc.dataFim || loc.data_fim || "").trim();
    if (fim) return false;
    if (typeof window.__DK_isPortalLocacaoAtiva === "function") {
      return Boolean(window.__DK_isPortalLocacaoAtiva(loc));
    }
    return true;
  }

  function getPlacaAtual() {
    const inp = document.getElementById("operacaoLocacaoPlaca");
    const raw = String(inp?.value || "").trim();
    if (typeof window.__DK_documentosNormPlaca === "function") {
      return window.__DK_documentosNormPlaca(raw);
    }
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(fr.error || new Error("leitura"));
      fr.readAsDataURL(blob);
    });
  }

  function docDepositoJaImportado(all, nc, cpf, depositId, categoria) {
    const n = normNc(nc);
    const dig = onlyDigits(cpf).slice(0, 11);
    return all.some(
      (d) =>
        normNc(d.numeroContrato) === n &&
        onlyDigits(d.cpf).slice(0, 11) === dig &&
        String(d.origemDepositoId || "") === String(depositId || "") &&
        String(d.origemDepositoCategoria || "") === String(categoria || "")
    );
  }

  function nomeImportadoDeposito(categoria, nc, placa, depositEntry) {
    const base = String(depositEntry?.nomeArquivo || "").trim();
    if (categoria === "contrato") {
      return base && base.toLowerCase().includes("contrato") ? base : `Contrato — protocolo ${nc}${base ? ` (${base})` : ""}`;
    }
    if (categoria === "crlv") {
      return base && /crlv/i.test(base) ? base : `CRLV — ${placa || "veículo"}${base ? ` (${base})` : ""}`;
    }
    if (categoria === "multa") {
      const chave = String(depositEntry?.chave || "").trim();
      return base && /multa/i.test(base) ? base : `Multa — ${chave || placa || "protocolo"}${base ? ` (${base})` : ""}`;
    }
    return base || "Documento";
  }

  async function importarDocDepositoParaProtocolo(depositEntry, categoria, nc, cpf, placa, reg) {
    const obterFn = typeof window.__DK_documentosObterBlobDoc === "function" ? window.__DK_documentosObterBlobDoc : null;
    if (!obterFn || !depositEntry?.id) return { ok: false, reason: "no_fn" };
    const all = loadAll();
    if (docDepositoJaImportado(all, nc, cpf, depositEntry.id, categoria)) {
      return { ok: true, skipped: true };
    }
    const row = await obterFn(categoria, depositEntry.id);
    if (!row?.blob) return { ok: false, reason: "no_blob", categoria };
    if (row.blob.size > MAX_BYTES) {
      return { ok: false, reason: "too_big", categoria, nome: depositEntry.nomeArquivo };
    }
    const dataUrl = await blobToDataUrl(row.blob);
    if (!dataUrl) return { ok: false, reason: "read_fail", categoria };
    all.push({
      id: `ld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      numeroContrato: normNc(nc),
      cpf: onlyDigits(cpf).slice(0, 11),
      nome: nomeImportadoDeposito(categoria, nc, placa, depositEntry),
      mimeType:
        depositEntry.mimeType ||
        row.mimeType ||
        row.blob.type ||
        (String(depositEntry.nomeArquivo || "").toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
      tamanho: row.blob.size,
      createdAt: Date.now(),
      registradoPorCpf: onlyDigits(reg.cpf).slice(0, 11),
      registradoPorNome: String(reg.nome || "").trim() || "Importação do depósito",
      arquivoBase64: dataUrl,
      tipo: categoria,
      origemDepositoId: depositEntry.id,
      origemDepositoCategoria: categoria,
      origemDepositoChave: String(depositEntry.chave || "").trim(),
      importadoAutomaticamente: true,
      enviadoCliente: false,
    });
    saveAll(all);
    return { ok: true, added: true, categoria, nome: depositEntry.nomeArquivo };
  }

  let importDepositoBusy = false;

  async function importarTipoDoDeposito(categoria) {
    const msgEl = document.getElementById("operacaoLocacaoDocumentosMsg");
    const cat = String(categoria || "").trim().toLowerCase();
    if (cat !== "contrato" && cat !== "crlv") return { ok: false, msg: "Tipo de documento inválido." };
    if (importDepositoBusy) return { ok: false, msg: "Aguarde a importação em curso." };

    const nc = getProtocoloAtual();
    const cpf = getCpfAtual();
    const placa = getPlacaAtual();
    const label = cat === "contrato" ? "Contrato" : "CRLV";

    if (!podeGerirDocumentosLocacao()) {
      return { ok: false, msg: "Sem permissão de cadastro de locação." };
    }
    if (!nc) {
      return { ok: false, msg: "Escolha o protocolo (ou informe data de início para NOVO) antes de importar." };
    }
    if (cpf.length !== 11) {
      return { ok: false, msg: "Informe o CPF do cliente antes de importar documentos." };
    }
    if (!protocoloLocacaoAtivo(nc)) {
      return { ok: false, msg: `Protocolo ${nc} finalizado — não é possível importar novos documentos.` };
    }
    if (cat === "crlv" && placa.length < 6) {
      return { ok: false, msg: "Informe a placa do veículo antes de importar o CRLV." };
    }

    const listarFn =
      typeof window.__DK_documentosListarPorChave === "function" ? window.__DK_documentosListarPorChave : null;
    if (!listarFn) {
      return {
        ok: false,
        msg: "Depósito Documentos indisponível — abra o menu Documentos neste computador.",
      };
    }

    const chave = cat === "contrato" ? nc : placa;
    const rows = listarFn(cat, chave);
    if (!rows.length) {
      const hint =
        cat === "contrato"
          ? `Nenhum contrato no depósito para o protocolo ${nc}. Deposite em Documentos (nome = protocolo).`
          : `Nenhum CRLV no depósito para a placa ${placa}. Deposite em Documentos (nome = placa).`;
      return { ok: false, msg: hint };
    }

    importDepositoBusy = true;
    try {
      const reg = getRegistroOperador();
      const r = await importarDocDepositoParaProtocolo(rows[0], cat, nc, cpf, placa, reg);
      if (r.added) {
        return { ok: true, msg: `${label} importado do depósito Documentos.` };
      }
      if (r.skipped) {
        return { ok: true, already: true, msg: `${label} já está neste protocolo.` };
      }
      if (r.reason === "no_blob") {
        return {
          ok: false,
          msg: `${label} encontrado no depósito, mas o ficheiro não está neste computador — deposite de novo em Documentos.`,
        };
      }
      if (r.reason === "too_big") {
        return { ok: false, msg: `${label} no depósito excede 4 MB — reduza o ficheiro em Documentos.` };
      }
      return { ok: false, msg: `Não foi possível importar o ${label.toLowerCase()}.` };
    } finally {
      importDepositoBusy = false;
    }
  }

  function mergeLocacaoDocumentos(localArr, cloudArr) {
    const byId = new Map();
    const pick = (rec) => {
      if (!rec?.id) return;
      const prev = byId.get(rec.id);
      if (!prev) {
        byId.set(rec.id, rec);
        return;
      }
      const prevHas = Boolean(String(prev.arquivoBase64 || "").trim());
      const recHas = Boolean(String(rec.arquivoBase64 || "").trim());
      const prevTs = Number(prev.enviadoClienteEm || prev.createdAt) || 0;
      const recTs = Number(rec.enviadoClienteEm || rec.createdAt) || 0;
      if (recHas && !prevHas) {
        byId.set(rec.id, rec);
        return;
      }
      if (prevHas && !recHas) return;
      if (rec.enviadoCliente === true && prev.enviadoCliente !== true) {
        byId.set(rec.id, rec);
        return;
      }
      if (prev.enviadoCliente === true && rec.enviadoCliente !== true) return;
      if (recTs >= prevTs) byId.set(rec.id, rec);
    };
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(pick);
    (Array.isArray(localArr) ? localArr : []).forEach(pick);
    return Array.from(byId.values());
  }

  function abrirDocumento(d) {
    const url = String(d?.arquivoBase64 || "").trim();
    if (!url) return false;
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }

  function enviarDocumentoParaCliente(id) {
    if (!podeGerirDocumentosLocacao()) {
      return { ok: false, msg: "Sem permissão de cadastro de locação." };
    }
    const all = loadAll();
    const idx = all.findIndex((d) => String(d.id) === String(id));
    if (idx === -1) return { ok: false, msg: "Documento não encontrado." };
    const doc = all[idx];
    if (!String(doc.arquivoBase64 || "").trim()) {
      return { ok: false, msg: "Ficheiro indisponível neste computador — importe de novo a partir de Documentos." };
    }
    if (doc.enviadoCliente === true) {
      return { ok: true, already: true, msg: "Este documento já foi enviado ao cliente." };
    }
    const reg = getRegistroOperador();
    all[idx] = {
      ...doc,
      enviadoCliente: true,
      enviadoClienteEm: Date.now(),
      enviadoPorCpf: onlyDigits(reg.cpf).slice(0, 11),
      enviadoPorNome: String(reg.nome || "").trim(),
    };
    saveAllLocal(all);
    pushDocumentosNuvem();
    return { ok: true, msg: "Documento enviado — o cliente vê no app (Ver contrato / CRLV / multas)." };
  }

  function removerDocumento(id) {
    if (!podeGerirDocumentosLocacao()) return false;
    const all = loadAll();
    const idx = all.findIndex((d) => String(d.id) === String(id));
    if (idx === -1) return false;
    const podeApagar =
      typeof window.__DK_isPortalTitularAdministrador === "function" &&
      window.__DK_isPortalTitularAdministrador();
    if (!podeApagar) {
      const reg = getRegistroOperador();
      const dig = onlyDigits(reg.cpf).slice(0, 11);
      if (onlyDigits(all[idx].registradoPorCpf).slice(0, 11) !== dig) return false;
    }
    const doc = all[idx];
    all.splice(idx, 1);
    saveAllLocal(all);
    if (doc?.enviadoCliente === true) pushDocumentosNuvem();
    return true;
  }

  function renderLista(nc, cpf) {
    const ul = document.getElementById("operacaoLocacaoDocumentosLista");
    if (!ul) return;
    const docs = docsDoProtocolo(nc, cpf).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    if (!docs.length) {
      ul.innerHTML = '<li class="subtext">Nenhum documento neste protocolo.</li>';
      return;
    }
    ul.innerHTML = docs
      .map((d) => {
        const dt = new Date(Number(d.createdAt) || 0);
        const quando = Number.isFinite(dt.getTime())
          ? dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
          : "—";
        const quem = String(d.registradoPorNome || d.registradoPorCpf || "—").trim();
        const enviado = isDocEnviadoCliente(d);
        const enviadoEm = d.enviadoClienteEm
          ? new Date(Number(d.enviadoClienteEm)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
          : "";
        const statusEnvio = enviado
          ? `<span class="portal-loc-docs-item__enviado">Enviado ao cliente${enviadoEm ? ` · ${escapeHtml(enviadoEm)}` : ""}</span>`
          : `<span class="portal-loc-docs-item__pendente">Aguarda envio ao cliente</span>`;
        return `<li class="portal-loc-docs-item">
          <span class="portal-loc-docs-item__nome">${escapeHtml(d.nome)}</span>
          <span class="portal-loc-docs-item__meta">${escapeHtml(quando)} · ${escapeHtml(quem)} · ${statusEnvio}</span>
          <span class="portal-loc-docs-item__acoes">
            <button type="button" class="btn-primary btn-secondary-outline portal-loc-docs-item__abrir" data-loc-doc-abrir="${escapeHtml(d.id)}" title="Abrir PDF para conferir">Abrir</button>
            <button type="button" class="btn-primary portal-loc-docs-item__enviar${enviado ? " portal-loc-docs-item__enviar--ok" : ""}" data-loc-doc-enviar="${escapeHtml(d.id)}" ${enviado ? "disabled" : ""} title="Publicar na nuvem para o app do cliente">${enviado ? "Enviado" : "Enviar para o cliente"}</button>
          </span>
        </li>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function refreshUi() {
    const wrap = document.getElementById("operacaoLocacaoDocumentosWrap");
    const btnContrato = document.getElementById("operacaoLocacaoDocContratoBtn");
    const btnCrlv = document.getElementById("operacaoLocacaoDocCrlvBtn");
    const msg = document.getElementById("operacaoLocacaoDocumentosMsg");
    if (!wrap || !btnContrato || !btnCrlv) return;

    const permitido = podeGerirDocumentosLocacao();
    const nc = getProtocoloAtual();
    const cpf = getCpfAtual();
    const placa = getPlacaAtual();
    const temProtocolo = Boolean(nc);
    const ativo = temProtocolo ? protocoloLocacaoAtivo(nc) : false;
    const cpfOk = cpf.length === 11;
    const placaOk = placa.length >= 6;
    const baseOk = permitido && temProtocolo && ativo && cpfOk;

    wrap.classList.toggle("hidden", !permitido);
    btnContrato.disabled = !baseOk;
    btnCrlv.disabled = !baseOk || !placaOk;

    if (!permitido) {
      if (msg) msg.textContent = "";
      return;
    }
    if (!temProtocolo) {
      if (msg) {
        msg.textContent =
          "Escolha o protocolo (ou informe data de início para NOVO). Deposite ficheiros em Documentos e importe com Contrato ou CRLV.";
      }
      renderLista("", cpf);
      return;
    }
    if (!cpfOk) {
      if (msg) msg.textContent = "Informe o CPF do cliente para importar documentos do depósito.";
      renderLista(nc, cpf);
      return;
    }
    if (!ativo) {
      if (msg) {
        msg.textContent = `Protocolo ${nc} finalizado — não é possível importar novos documentos. O cliente só acede à documentação em protocolos ativos.`;
      }
      renderLista(nc, cpf);
      return;
    }
    if (msg) {
      const n = docsDoProtocolo(nc, cpf).length;
      msg.textContent = `${n} documento(s) no protocolo ${nc} — importe com Contrato/CRLV; Abrir para conferir; Enviar para o cliente para publicar no app.`;
    }
    renderLista(nc, cpf);
  }

  function normPlacaGenerica(raw) {
    if (typeof window.__DK_documentosNormPlaca === "function") return window.__DK_documentosNormPlaca(raw);
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
  }

  function chaveMultaDeposito(placa, cpf) {
    const p = normPlacaGenerica(placa);
    const dig = onlyDigits(cpf).slice(0, 11);
    if (p.length < 6 || dig.length !== 11) return "";
    return `${p}-${dig}`;
  }

  function getLancMultasContexto() {
    const cpf = onlyDigits(document.getElementById("operacaoLancMultasCpf")?.value).slice(0, 11);
    const nc = normNc(document.getElementById("operacaoLancMultasProtocoloSelect")?.value);
    const placa = normPlacaGenerica(document.getElementById("operacaoLancMultasPlaca")?.value);
    return { cpf, nc, placa };
  }

  function multaDepositoJaNoProtocolo(ctx, depositId) {
    return docsDoProtocoloPorTipo(ctx.nc, ctx.cpf, "multa").some(
      (d) => String(d.origemDepositoId || "") === String(depositId || "")
    );
  }

  function renderMultasDepositoLista(rows, ctx) {
    const lista = document.getElementById("operacaoLancMultasDepositoLista");
    if (!lista) return;
    if (!rows.length) {
      lista.innerHTML = '<p class="subtext">Nenhuma multa encontrada no depósito para esta placa e CPF.</p>';
      return;
    }
    lista.innerHTML = rows
      .map((e) => {
        const ja = multaDepositoJaNoProtocolo(ctx, e.id);
        const quando = e.criadoEm ? new Date(e.criadoEm).toLocaleString("pt-BR") : "—";
        return `<article class="documentos-resultado portal-lanc-multas-deposito-item">
          <div class="documentos-resultado__info">
            <strong class="documentos-resultado__nome">${escapeHtml(e.nomeArquivo || e.chave)}</strong>
            <span class="subtext">${escapeHtml(String(e.chave || ""))} · ${escapeHtml(quando)}</span>
          </div>
          <div class="documentos-resultado__acoes">
            <button type="button" class="btn-primary btn-secondary-outline" data-multa-dep-import="${escapeHtml(e.id)}" ${ja ? "disabled" : ""}>${ja ? "Já no protocolo" : "Importar para protocolo"}</button>
          </div>
        </article>`;
      })
      .join("");
  }

  async function consultarMultasDepositoLancamento() {
    const ctx = getLancMultasContexto();
    const msg = document.getElementById("operacaoLancMultasDepositoMsg");
    if (ctx.cpf.length !== 11 || !ctx.nc) {
      if (msg) msg.textContent = "Confirme a pesquisa e selecione um protocolo.";
      renderMultasDepositoLista([], ctx);
      return { ok: false };
    }
    if (ctx.placa.length < 6) {
      if (msg) msg.textContent = "Placa do protocolo indisponível.";
      renderMultasDepositoLista([], ctx);
      return { ok: false };
    }
    const listarFn =
      typeof window.__DK_documentosListarPorChave === "function" ? window.__DK_documentosListarPorChave : null;
    if (!listarFn) {
      if (msg) msg.textContent = "Módulo Documentos indisponível.";
      return { ok: false };
    }
    const chave = chaveMultaDeposito(ctx.placa, ctx.cpf);
    const rows = listarFn("multa", chave);
    renderMultasDepositoLista(rows, ctx);
    if (msg) {
      msg.textContent = rows.length
        ? `${rows.length} multa(s) no depósito (${chave}). Importe para o protocolo — o cliente vê no app.`
        : `Nenhuma multa no depósito para ${chave}. Deposite em Documentos com nome PLACA-CPF.`;
    }
    return { ok: true, rows: rows.length, chave };
  }

  async function importarMultaDepositoParaLancamento(depositId) {
    const ctx = getLancMultasContexto();
    const msg = document.getElementById("operacaoLancMultasDepositoMsg");
    if (ctx.cpf.length !== 11 || !ctx.nc || ctx.placa.length < 6) {
      if (msg) msg.textContent = "Selecione um protocolo válido antes de importar.";
      return { ok: false };
    }
    const listarFn =
      typeof window.__DK_documentosListarPorChave === "function" ? window.__DK_documentosListarPorChave : null;
    if (!listarFn) return { ok: false };
    const chave = chaveMultaDeposito(ctx.placa, ctx.cpf);
    const entry = listarFn("multa", chave).find((e) => String(e.id) === String(depositId));
    if (!entry) {
      if (msg) msg.textContent = "Multa não encontrada no depósito.";
      return { ok: false };
    }
    const reg = getRegistroOperador();
    const r = await importarDocDepositoParaProtocolo(entry, "multa", ctx.nc, ctx.cpf, ctx.placa, reg);
    if (r.added) {
      if (msg) msg.textContent = `Multa importada para o protocolo ${ctx.nc}. Visível no app do cliente.`;
      await consultarMultasDepositoLancamento();
      return { ok: true };
    }
    if (r.skipped) {
      if (msg) msg.textContent = "Esta multa já está no protocolo.";
      await consultarMultasDepositoLancamento();
      return { ok: true, skipped: true };
    }
    if (r.reason === "no_blob") {
      if (msg) msg.textContent = "Ficheiro não está neste computador — carregue a multa de novo em Documentos.";
    } else if (r.reason === "too_big") {
      if (msg) msg.textContent = "Multa no depósito excede 4 MB — reduza o ficheiro.";
    } else if (msg) msg.textContent = "Não foi possível importar a multa.";
    return { ok: false };
  }

  function refreshLancMultasDocumentosDeposito() {
    const sec = document.getElementById("operacaoLancMultasDocumentosDeposito");
    if (!sec) return;
    const ctx = getLancMultasContexto();
    const visivel = ctx.cpf.length === 11 && Boolean(ctx.nc);
    sec.classList.toggle("hidden", !visivel);
    if (!visivel) {
      sec.setAttribute("hidden", "");
      const lista = document.getElementById("operacaoLancMultasDepositoLista");
      if (lista) lista.innerHTML = "";
      const msg = document.getElementById("operacaoLancMultasDepositoMsg");
      if (msg) msg.textContent = "";
      return;
    }
    sec.removeAttribute("hidden");
    void consultarMultasDepositoLancamento();
  }

  function bindMultasDepositoUi() {
    document.getElementById("operacaoLancMultasBuscarDepositoBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      void consultarMultasDepositoLancamento();
    });
    document.getElementById("operacaoLancMultasDepositoLista")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-multa-dep-import]");
      if (!btn || btn.disabled) return;
      const id = btn.getAttribute("data-multa-dep-import");
      if (!id) return;
      void importarMultaDepositoParaLancamento(id);
    });
  }

  function bindUi() {
    const btnContrato = document.getElementById("operacaoLocacaoDocContratoBtn");
    const btnCrlv = document.getElementById("operacaoLocacaoDocCrlvBtn");
    const lista = document.getElementById("operacaoLocacaoDocumentosLista");
    const msg = document.getElementById("operacaoLocacaoDocumentosMsg");

    async function onImportClick(categoria) {
      const res = await importarTipoDoDeposito(categoria);
      refreshUi();
      if (msg && res.msg) msg.textContent = res.msg;
    }

    btnContrato?.addEventListener("click", () => {
      if (btnContrato.disabled) return;
      void onImportClick("contrato");
    });

    btnCrlv?.addEventListener("click", () => {
      if (btnCrlv.disabled) return;
      void onImportClick("crlv");
    });

    lista?.addEventListener("click", (e) => {
      const abrir = e.target.closest?.("[data-loc-doc-abrir]");
      if (abrir) {
        const id = abrir.getAttribute("data-loc-doc-abrir");
        const doc = loadAll().find((d) => String(d.id) === String(id));
        if (!doc || !abrirDocumento(doc)) {
          if (msg) msg.textContent = "Não foi possível abrir — ficheiro indisponível neste computador.";
        }
        return;
      }
      const enviar = e.target.closest?.("[data-loc-doc-enviar]");
      if (enviar && !enviar.disabled) {
        const id = enviar.getAttribute("data-loc-doc-enviar");
        if (!id) return;
        const res = enviarDocumentoParaCliente(id);
        if (msg) msg.textContent = res.msg || "";
        refreshUi();
      }
    });

    document.getElementById("operacaoLocacaoProtocoloSelect")?.addEventListener("change", refreshUi);
    document.getElementById("operacaoLocacaoProtocolo")?.addEventListener("change", refreshUi);
    document.getElementById("operacaoLocacaoCpf")?.addEventListener("input", refreshUi);
    document.getElementById("operacaoLocacaoPlaca")?.addEventListener("input", refreshUi);
    document.getElementById("operacaoLocacaoPlaca")?.addEventListener("change", refreshUi);
    document.getElementById("operacaoLocacaoDataInicio")?.addEventListener("input", refreshUi);
    document.getElementById("operacaoLocacaoProtocoloAdminCarregarBtn")?.addEventListener("click", () => {
      window.setTimeout(refreshUi, 50);
    });
  }

  window.__DK_refreshOperacaoLocacaoDocumentosUi = refreshUi;
  window.__DK_docsLocacaoDoProtocolo = docsDoProtocolo;
  window.__DK_docsLocacaoDoProtocoloPorTipo = docsDoProtocoloPorTipo;
  window.__DK_docsLocacaoIsEnviadoCliente = isDocEnviadoCliente;
  window.__DK_docsLocacaoInferTipo = inferDocTipo;
  window.__DK_docsLocacaoLoadAll = loadAll;
  window.__DK_docsLocacaoMerge = mergeLocacaoDocumentos;
  window.__DK_importarLocacaoDocDoDeposito = importarTipoDoDeposito;
  window.__DK_refreshLancMultasDocumentosDeposito = refreshLancMultasDocumentosDeposito;
  window.__DK_importarMultaDepositoParaProtocolo = importarMultaDepositoParaLancamento;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindUi();
      bindMultasDepositoUi();
      refreshUi();
    });
  } else {
    bindUi();
    bindMultasDepositoUi();
    refreshUi();
  }
})();
