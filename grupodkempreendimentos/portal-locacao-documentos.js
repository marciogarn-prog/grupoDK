/**
 * Documentos vinculados ao protocolo de locação (cadastro operação).
 */
(function portalLocacaoDocumentos() {
  const STORAGE_KEY = "dk_locacao_documentos_v1";
  const MAX_BYTES = 4 * 1024 * 1024;
  const DOC_DESTINO_APP = {
    contrato: { rotulo: "Contrato", botaoApp: "Ver contrato" },
    crlv: { rotulo: "CRLV", botaoApp: "Ver CRLV" },
    multa: { rotulo: "Multa", botaoApp: "Ver multas" },
  };
  const LOC_CADASTRO_TIPOS = ["contrato", "crlv"];
  const LISTA_TIPO_IDS = {
    contrato: "operacaoLocacaoDocumentosListaContrato",
    crlv: "operacaoLocacaoDocumentosListaCrlv",
    multa: "operacaoLancMultasDocumentosLista",
  };
  const docsEnviando = new Set();
  const BUSCA_UI = {
    contrato: {
      inputId: "operacaoLocacaoDocBuscaContrato",
      btnId: "operacaoLocacaoDocBuscarContratoBtn",
      sugestoesId: "operacaoLocacaoDocSugestoesContrato",
      msgId: "operacaoLocacaoDocBuscaContratoMsg",
      trazerLabel: "Importar contrato",
    },
    crlv: {
      inputId: "operacaoLocacaoDocBuscaCrlv",
      btnId: "operacaoLocacaoDocBuscarCrlvBtn",
      sugestoesId: "operacaoLocacaoDocSugestoesCrlv",
      msgId: "operacaoLocacaoDocBuscaCrlvMsg",
      trazerLabel: "Importar CRLV",
    },
  };
  const buscaLocacaoState = { contrato: { selectedId: "" }, crlv: { selectedId: "" } };
  const MAX_SUGESTOES = 25;

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
      return window.__DK_pushCloudSnapshotNow({ force: true });
    }
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
      return Promise.resolve({ ok: true, skipped: true });
    }
    return Promise.resolve({ ok: false, error: "sync_unavailable" });
  }

  function documentoCorrespondeNaNuvem(found, doc) {
    if (!found || !doc) return false;
    if (String(found.id) === String(doc.id)) return true;
    const tipo = inferDocTipo(doc);
    if (!tipo) return false;
    return (
      normNc(found.numeroContrato) === normNc(doc.numeroContrato) &&
      onlyDigits(found.cpf).slice(0, 11) === onlyDigits(doc.cpf).slice(0, 11) &&
      inferDocTipo(found) === tipo &&
      found.enviadoCliente === true
    );
  }

  async function fetchDocumentosLocacaoNaNuvem() {
    const mergeFn =
      typeof window.__DK_docsLocacaoMerge === "function" ? window.__DK_docsLocacaoMerge : null;
    let redisArr = null;
    let cloudArr = null;
    const fetchOne = async (fn) => {
      try {
        return await Promise.race([
          fn(),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error("docs_cloud_timeout")), 12000);
          }),
        ]);
      } catch {
        return null;
      }
    };
    if (typeof window.__DK_fetchRedundantSnapshotPayload === "function") {
      const redis = await fetchOne(() => window.__DK_fetchRedundantSnapshotPayload());
      if (Array.isArray(redis?.payload?.dk_locacao_documentos_v1)) {
        redisArr = redis.payload.dk_locacao_documentos_v1;
      }
    }
    const fetchFn =
      typeof window.__DK_fetchCloudSnapshotPayload === "function"
        ? window.__DK_fetchCloudSnapshotPayload
        : null;
    if (fetchFn) {
      const data = await fetchOne(() => fetchFn());
      if (Array.isArray(data?.payload?.dk_locacao_documentos_v1)) {
        cloudArr = data.payload.dk_locacao_documentos_v1;
      }
    }
    if (mergeFn) {
      const merged = mergeFn(redisArr || [], cloudArr || []);
      return merged.length ? merged : null;
    }
    if (Array.isArray(cloudArr)) return cloudArr;
    if (Array.isArray(redisArr)) return redisArr;
    return null;
  }

  async function verificarDocumentoEnviadoNaNuvem(doc, tentativa, opts) {
    const maxTentativas = opts?.maxTentativas ?? 3;
    if (!doc?.id) {
      return {
        ok: false,
        msg: "Verificação indisponível — recarregue a página e tente enviar de novo.",
      };
    }
    if (tentativa > 0) {
      await new Promise((r) => window.setTimeout(r, tentativa === 1 ? 800 : 1500));
    }
    const cpfDig = onlyDigits(doc.cpf).slice(0, 11);
    const nc = normNc(doc.numeroContrato);
    if (!nc || cpfDig.length !== 11) {
      return { ok: false, msg: "Protocolo ou CPF do cliente inválido — confira o cadastro da locação." };
    }
    const arr = await fetchDocumentosLocacaoNaNuvem();
    if (!Array.isArray(arr)) {
      if (tentativa < maxTentativas) {
        return verificarDocumentoEnviadoNaNuvem(doc, tentativa + 1, opts);
      }
      return { ok: false, msg: "Nuvem ainda sem registo do documento — tente enviar de novo." };
    }
    const pool = arr.filter(
      (d) => d?.enviadoCliente === true && onlyDigits(d.cpf).slice(0, 11) === cpfDig
    );
    const found = pool.find((d) => documentoCorrespondeNaNuvem(d, doc));
    if (!found) {
      if (tentativa < maxTentativas) {
        return verificarDocumentoEnviadoNaNuvem(doc, tentativa + 1, opts);
      }
      return {
        ok: false,
        msg: `O PDF não chegou à nuvem para o protocolo ${nc} — verifique a ligação e clique «Enviar para o cliente» de novo.`,
      };
    }
    if (!String(found.arquivoBase64 || "").trim()) {
      return {
        ok: false,
        msg: "Metadados na nuvem, mas o PDF não chegou — reduza o ficheiro ou tente de novo.",
      };
    }
    const tipo = inferDocTipo(doc);
    const dest = DOC_DESTINO_APP[tipo]?.botaoApp || "Ver CRLV";
    return {
      ok: true,
      msg: `Confirmado na nuvem — o cliente já acede em «${dest}» (peça para actualizar o app).`,
    };
  }

  async function reconciliarDocumentosEnvioProtocolo(nc, cpf) {
    const n = normNc(nc);
    const dig = onlyDigits(cpf).slice(0, 11);
    if (!n || dig.length !== 11) return;
    const key = `${n}|${dig}`;
    if (reconciliarDocumentosEnvioProtocolo._busy?.has(key)) return;
    if (!reconciliarDocumentosEnvioProtocolo._busy) reconciliarDocumentosEnvioProtocolo._busy = new Set();
    reconciliarDocumentosEnvioProtocolo._busy.add(key);
    try {
      const marcados = docsDoProtocolo(n, dig).filter((d) => d.enviadoCliente === true);
      if (!marcados.length) return;
      const all = loadAll();
      let changed = false;
      for (const d of marcados) {
        const ver = await verificarDocumentoEnviadoNaNuvem(d, 0);
        if (ver.ok) continue;
        const idx = all.findIndex((x) => String(x.id) === String(d.id));
        if (idx < 0) continue;
        all[idx] = {
          ...all[idx],
          enviadoCliente: false,
          enviadoClienteEm: null,
          enviadoPorCpf: "",
          enviadoPorNome: "",
        };
        changed = true;
      }
      if (changed) {
        saveAllLocal(all);
        renderListasPorTipo(n, dig);
        const msgEl = document.getElementById("operacaoLocacaoDocumentosMsg");
        if (msgEl) {
          msgEl.textContent =
            "Documento marcado como enviado, mas o PDF não está na nuvem — clique «Enviar para o cliente» de novo.";
        }
      }
    } finally {
      reconciliarDocumentosEnvioProtocolo._busy.delete(key);
    }
  }

  function saveAll(arr) {
    saveAllLocal(arr);
  }

  function isDocEnviadoCliente(d) {
    return d?.enviadoCliente === true;
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

  function podeGerirDocumentosMultas() {
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
    return Boolean(acessos?.lancamentoMultas || acessos?.locacao);
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

  function docCanonicoPorTipo(nc, cpf, categoria) {
    const docs = docsDoProtocoloPorTipo(nc, cpf, categoria);
    if (!docs.length) return null;
    if (docs.length === 1) return docs[0];
    const enviados = docs.filter((d) => d.enviadoCliente === true);
    const pool = enviados.length ? enviados : docs;
    return pool.slice().sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0];
  }

  function limparDuplicadosNaoEnviados(nc, cpf) {
    const n = normNc(nc);
    const dig = onlyDigits(cpf).slice(0, 11);
    if (!n || dig.length !== 11) return;
    const all = loadAll();
    const removeIds = new Set();
    LOC_CADASTRO_TIPOS.forEach((tipo) => {
      const docs = docsDoProtocoloPorTipo(n, dig, tipo);
      if (docs.length <= 1) return;
      const canon = docCanonicoPorTipo(n, dig, tipo);
      if (!canon) return;
      docs.forEach((d) => {
        if (String(d.id) !== String(canon.id) && d.enviadoCliente !== true) {
          removeIds.add(String(d.id));
        }
      });
    });
    if (!removeIds.size) return;
    saveAll(all.filter((d) => !removeIds.has(String(d.id))));
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
      conferidoOperador: false,
    });
    saveAll(all);
    return { ok: true, added: true, categoria, nome: depositEntry.nomeArquivo };
  }

  function filtrarDeposito(categoria, termo) {
    const fn =
      typeof window.__DK_documentosFiltrarDeposito === "function" ? window.__DK_documentosFiltrarDeposito : null;
    if (!fn) return [];
    return fn(categoria, termo);
  }

  function obterEntradaDeposito(categoria, id) {
    const fn = typeof window.__DK_documentosObterEntrada === "function" ? window.__DK_documentosObterEntrada : null;
    if (!fn || !id) return null;
    return fn(categoria, id);
  }

  function contarDeposito(categoria) {
    const fn = typeof window.__DK_documentosContarDeposito === "function" ? window.__DK_documentosContarDeposito : null;
    if (!fn) return 0;
    return fn(categoria);
  }

  function docTipoJaEnviadoCliente(nc, cpf, categoria) {
    const doc = docCanonicoPorTipo(nc, cpf, categoria);
    return doc?.enviadoCliente === true;
  }

  function removerDocsTipoDoProtocolo(nc, cpf, categoria, exceptId) {
    const n = normNc(nc);
    const dig = onlyDigits(cpf).slice(0, 11);
    const all = loadAll();
    const next = all.filter((d) => {
      if (normNc(d.numeroContrato) !== n || onlyDigits(d.cpf).slice(0, 11) !== dig) return true;
      if (inferDocTipo(d) !== categoria) return true;
      if (exceptId && String(d.id) === String(exceptId)) return true;
      return false;
    });
    if (next.length !== all.length) saveAll(next);
  }

  function renderSugestoesDeposito(categoria, rows) {
    const cfg = BUSCA_UI[categoria];
    if (!cfg) return;
    const ul = document.getElementById(cfg.sugestoesId);
    if (!ul) return;
    const list = (Array.isArray(rows) ? rows : []).slice(0, MAX_SUGESTOES);
    if (!list.length) {
      ul.innerHTML = "";
      ul.classList.add("hidden");
      return;
    }
    ul.innerHTML = list
      .map(
        (e) =>
          `<li class="portal-loc-docs-sugestoes__item" role="option" data-dep-doc-id="${escapeHtml(e.id)}" data-dep-nome="${escapeHtml(e.nomeArquivo || e.chave || "")}" tabindex="0">
            <span class="portal-loc-docs-sugestoes__nome">${escapeHtml(e.nomeArquivo || e.chave || "—")}</span>
            <span class="portal-loc-docs-sugestoes__chave subtext">${escapeHtml(String(e.chave || ""))}</span>
          </li>`
      )
      .join("");
    ul.classList.remove("hidden");
  }

  function fecharSugestoesDeposito(categoria) {
    const cfg = BUSCA_UI[categoria];
    const ul = cfg ? document.getElementById(cfg.sugestoesId) : null;
    if (ul) ul.classList.add("hidden");
  }

  function fecharTodasSugestoesDeposito() {
    LOC_CADASTRO_TIPOS.forEach(fecharSugestoesDeposito);
  }

  function onBuscaDepositoInput(categoria) {
    const cfg = BUSCA_UI[categoria];
    if (!cfg) return;
    const input = document.getElementById(cfg.inputId);
    const msg = document.getElementById(cfg.msgId);
    if (!input) return;
    buscaLocacaoState[categoria].selectedId = "";
    const termo = input.value.trim();
    const rows = filtrarDeposito(categoria, termo);
    renderSugestoesDeposito(categoria, rows);
    if (msg) {
      const total = contarDeposito(categoria);
      if (!termo) {
        msg.textContent = total ? `${total} ficheiro(s) no depósito — digite para filtrar.` : "Nenhum ficheiro no depósito Documentos.";
      } else if (!rows.length) {
        msg.textContent = "Nenhum ficheiro corresponde à pesquisa.";
      } else {
        const trazer = BUSCA_UI[categoria]?.trazerLabel || "Importar";
        msg.textContent =
          rows.length === 1
            ? `1 ficheiro encontrado — escolha na lista ou clique «${trazer}».`
            : `${rows.length} ficheiro(s) — escolha na lista ou refine a pesquisa.`;
      }
    }
  }

  function selecionarSugestaoDeposito(categoria, depositId, nome) {
    const cfg = BUSCA_UI[categoria];
    if (!cfg) return;
    buscaLocacaoState[categoria].selectedId = String(depositId || "");
    const input = document.getElementById(cfg.inputId);
    if (input && nome) input.value = nome;
    fecharSugestoesDeposito(categoria);
  }

  function resolverEntradaBusca(categoria, termo) {
    const selectedId = buscaLocacaoState[categoria]?.selectedId;
    if (selectedId) {
      const entry = obterEntradaDeposito(categoria, selectedId);
      if (entry) return entry;
    }
    const rows = filtrarDeposito(categoria, termo);
    if (!rows.length) return null;
    if (rows.length === 1) return rows[0];
    const t = termo.toLowerCase();
    const exact = rows.filter((r) => String(r.nomeArquivo || "").toLowerCase() === t);
    if (exact.length === 1) return exact[0];
    const byNome = rows.filter((r) => String(r.nomeArquivo || "").toLowerCase().includes(t) && t.length >= 3);
    if (byNome.length === 1) return byNome[0];
    return null;
  }

  let importDepositoBusy = false;

  async function importarDocDepositoPorId(categoria, depositId, opts = {}) {
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

    const entry = obterEntradaDeposito(cat, depositId);
    if (!entry) {
      return { ok: false, msg: "Ficheiro não encontrado no depósito Documentos." };
    }

    const existente = docCanonicoPorTipo(nc, cpf, cat);
    if (existente && String(existente.origemDepositoId || "") === String(depositId)) {
      return { ok: true, already: true, msg: `${label} já está neste protocolo.` };
    }

    if (existente && !opts.substituirConfirmado) {
      if (existente.enviadoCliente === true) {
        const isAdmin =
          typeof window.__DK_isPortalTitularAdministrador === "function" &&
          window.__DK_isPortalTitularAdministrador();
        if (!isAdmin) {
          return { ok: false, msg: `${label} já enviado ao cliente — não é possível substituir.` };
        }
        if (
          !window.confirm(
            `${label} já enviado ao cliente («${existente.nome || "documento"}»). Excluir e trazer outro?`
          )
        ) {
          return { ok: false, msg: "Substituição cancelada." };
        }
      } else if (
        !window.confirm(
          `Já existe ${label} neste protocolo («${existente.nome || "documento"}»). Excluir e trazer o novo ficheiro?`
        )
      ) {
        return { ok: false, msg: "Importação cancelada — exclua o documento actual ou confirme a substituição." };
      }
    }

    importDepositoBusy = true;
    try {
      if (existente) {
        const wasSent = existente.enviadoCliente === true;
        removerDocsTipoDoProtocolo(nc, cpf, cat);
        if (wasSent) pushDocumentosNuvem();
      }
      const reg = getRegistroOperador();
      const r = await importarDocDepositoParaProtocolo(entry, cat, nc, cpf, placa, reg);
      if (r.added) {
        limparDuplicadosNaoEnviados(nc, cpf);
        return { ok: true, added: true, msg: `${label} importado do depósito Documentos.` };
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

  async function buscarEImportarDoDeposito(categoria) {
    const cat = String(categoria || "").trim().toLowerCase();
    const cfg = BUSCA_UI[cat];
    if (!cfg) return { ok: false, msg: "Tipo inválido." };
    const input = document.getElementById(cfg.inputId);
    const msgEl = document.getElementById(cfg.msgId);
    const termo = String(input?.value || "").trim();
    if (!termo) {
      const hint = "Digite parte do nome do ficheiro para filtrar o depósito.";
      if (msgEl) msgEl.textContent = hint;
      return { ok: false, msg: hint };
    }
    const entry = resolverEntradaBusca(cat, termo);
    if (!entry) {
      const rows = filtrarDeposito(cat, termo);
      renderSugestoesDeposito(cat, rows);
      const hint =
        rows.length > 1
          ? "Vários ficheiros — escolha um na lista suspensa."
          : "Nenhum ficheiro corresponde — verifique o nome ou deposite em Documentos.";
      if (msgEl) msgEl.textContent = hint;
      return { ok: false, msg: hint };
    }
    const res = await importarDocDepositoPorId(cat, entry.id);
    if (res.ok && (res.added || res.already)) {
      buscaLocacaoState[cat].selectedId = "";
      if (input) input.value = "";
      fecharSugestoesDeposito(cat);
    }
    if (msgEl && res.msg) msgEl.textContent = res.msg;
    return res;
  }

  async function importarTipoDoDeposito(categoria) {
    return buscarEImportarDoDeposito(categoria);
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

  async function resolveDocBlob(doc) {
    const b64 = String(doc?.arquivoBase64 || "").trim();
    if (b64) {
      try {
        const res = await fetch(b64);
        const blob = await res.blob();
        if (blob?.size) {
          return { blob, mimeType: doc.mimeType || blob.type || "application/pdf" };
        }
      } catch {
        /* tentar depósito */
      }
    }
    const depId = doc?.origemDepositoId;
    const depCat = doc?.origemDepositoCategoria || inferDocTipo(doc);
    if (depId && depCat) {
      const fn = typeof window.__DK_documentosObterBlobDoc === "function" ? window.__DK_documentosObterBlobDoc : null;
      if (fn) {
        const row = await fn(depCat, depId);
        if (row?.blob) {
          return {
            blob: row.blob,
            mimeType: row.mimeType || row.blob.type || doc.mimeType || "application/pdf",
          };
        }
      }
    }
    return null;
  }

  async function visualizarDocumento(d) {
    const row = await resolveDocBlob(d);
    if (!row?.blob) return false;
    const abrirFn =
      typeof window.__DK_documentosAbrirViewerBlob === "function" ? window.__DK_documentosAbrirViewerBlob : null;
    if (abrirFn) {
      return abrirFn(row.blob, d?.nome || "Documento", row.mimeType);
    }
    const url = URL.createObjectURL(row.blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }

  function abrirDocumento(d) {
    void visualizarDocumento(d);
    return Boolean(String(d?.arquivoBase64 || "").trim() || d?.origemDepositoId);
  }

  function podeGerirEnvioDocumento(doc) {
    const t = inferDocTipo(doc);
    if (t === "multa") return podeGerirDocumentosMultas();
    return podeGerirDocumentosLocacao();
  }

  function mostrarFeedbackEnvioDoc(msgEl, texto, ok) {
    if (msgEl) {
      msgEl.textContent = texto || "";
      msgEl.classList.toggle("portal-loc-docs__msg--erro", ok === false);
      msgEl.classList.toggle("portal-loc-docs__msg--ok", ok === true);
      try {
        msgEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch {
        /* ignore */
      }
    }
    if (ok === false && texto) {
      window.alert(texto);
    }
  }

  async function prepararDocumentoParaEnvio(doc) {
    const nc = normNc(doc?.numeroContrato) || getProtocoloAtual();
    const cpf = onlyDigits(doc?.cpf).slice(0, 11) || getCpfAtual();
    if (!nc || cpf.length !== 11) {
      return { ok: false, msg: "Preencha protocolo e CPF do cliente no cadastro da locação antes de enviar." };
    }
    let out = { ...doc, numeroContrato: nc, cpf };
    if (!String(out.arquivoBase64 || "").trim()) {
      const row = await resolveDocBlob(out);
      if (!row?.blob) {
        return {
          ok: false,
          msg: "Ficheiro indisponível neste computador — importe de novo a partir de Documentos.",
        };
      }
      const dataUrl = await blobToDataUrl(row.blob);
      if (!dataUrl) {
        return { ok: false, msg: "Não foi possível ler o PDF — importe de novo a partir de Documentos." };
      }
      out = {
        ...out,
        arquivoBase64: dataUrl,
        mimeType: row.mimeType || out.mimeType || "application/pdf",
        tamanho: row.blob.size || out.tamanho,
      };
      const all = loadAll();
      const idx = all.findIndex((d) => String(d.id) === String(out.id));
      if (idx >= 0) {
        all[idx] = { ...all[idx], ...out };
        saveAllLocal(all);
      }
    }
    return { ok: true, doc: out };
  }

  async function enviarDocumentoParaCliente(id) {
    let all = loadAll();
    let idx = all.findIndex((d) => String(d.id) === String(id));
    if (idx === -1) return { ok: false, msg: "Documento não encontrado." };
    let doc = all[idx];
    if (!podeGerirEnvioDocumento(doc)) {
      return { ok: false, msg: "Sem permissão para enviar este documento ao cliente." };
    }
    const prep = await prepararDocumentoParaEnvio(doc);
    if (!prep.ok) return prep;
    doc = prep.doc;
    if (doc.conferidoOperador !== true) {
      return { ok: false, msg: "Visualize o PDF e clique Confirmar antes de enviar ao cliente." };
    }
    const tipo = inferDocTipo(doc);
    const dest = DOC_DESTINO_APP[tipo]?.botaoApp || "app do cliente";
    const rotulo = DOC_DESTINO_APP[tipo]?.rotulo || "Documento";

    if (doc.enviadoCliente === true) {
      const verPrev = await verificarDocumentoEnviadoNaNuvem(doc, 0);
      if (verPrev.ok) {
        return {
          ok: true,
          already: true,
          msg: `${rotulo} já confirmado na nuvem — o cliente acede em «${dest}».`,
        };
      }
      all[idx] = {
        ...doc,
        enviadoCliente: false,
        enviadoClienteEm: null,
        enviadoPorCpf: "",
        enviadoPorNome: "",
      };
      saveAllLocal(all);
      doc = all[idx];
    }

    const reg = getRegistroOperador();
    const pendingDoc = {
      ...doc,
      enviadoCliente: true,
      enviadoClienteEm: Date.now(),
      enviadoPorCpf: onlyDigits(reg.cpf).slice(0, 11),
      enviadoPorNome: String(reg.nome || "").trim(),
    };

    const directFn =
      typeof window.__DK_pushLocacaoDocumentoNuvem === "function"
        ? window.__DK_pushLocacaoDocumentoNuvem
        : null;
    let pushOk = false;
    let pushDetail = null;
    if (directFn) {
      pushDetail = await directFn(pendingDoc);
      pushOk = pushDetail?.ok === true;
    }
    if (!pushOk) {
      return {
        ok: false,
        msg:
          pushDetail?.error === "doc_sem_pdf"
            ? "PDF indisponível — importe de novo a partir de Documentos."
            : "Falha ao enviar à nuvem — verifique a ligação à internet e tente de novo.",
      };
    }

    const ver = await verificarDocumentoEnviadoNaNuvem(pendingDoc, 0, {
      maxTentativas: pushDetail?.redisOk ? 2 : 3,
    });
    if (!ver.ok) {
      if (pushDetail?.redisOk && String(pendingDoc.arquivoBase64 || "").trim()) {
        all = loadAll();
        idx = all.findIndex((d) => String(d.id) === String(id));
        if (idx >= 0) {
          all[idx] = pendingDoc;
          saveAllLocal(all);
        }
        return {
          ok: true,
          msg: `${rotulo} enviado à cópia Redis — o cliente acede em «${dest}» (actualize o app).`,
          cloudOk: true,
        };
      }
      return {
        ok: false,
        msg:
          ver.msg ||
          "Nuvem não confirmou o envio — o cliente ainda não acede ao PDF. O botão «Enviado» não foi activado.",
      };
    }

    all = loadAll();
    idx = all.findIndex((d) => String(d.id) === String(id));
    if (idx === -1) return { ok: false, msg: "Documento não encontrado após envio." };
    all[idx] = pendingDoc;
    saveAllLocal(all);
    void pushDocumentosNuvem();

    return {
      ok: true,
      msg: ver.msg || `${rotulo} enviado com sucesso — o cliente já acede em «${dest}».`,
      cloudOk: true,
    };
  }

  function confirmarDocumentoOperador(id) {
    const all = loadAll();
    const idx = all.findIndex((d) => String(d.id) === String(id));
    if (idx === -1) return { ok: false, msg: "Documento não encontrado." };
    const doc = all[idx];
    if (!podeGerirEnvioDocumento(doc)) {
      return { ok: false, msg: "Sem permissão para confirmar este documento." };
    }
    if (doc.enviadoCliente === true) {
      return { ok: true, already: true, msg: "Documento já enviado ao cliente." };
    }
    if (doc.conferidoOperador === true) {
      return { ok: true, already: true, msg: "Documento já confirmado — pode enviar ao cliente." };
    }
    const reg = getRegistroOperador();
    all[idx] = {
      ...doc,
      conferidoOperador: true,
      conferidoEm: Date.now(),
      conferidoPorCpf: onlyDigits(reg.cpf).slice(0, 11),
      conferidoPorNome: String(reg.nome || "").trim(),
    };
    saveAllLocal(all);
    return { ok: true, msg: "Documento confirmado — pode enviar ao cliente." };
  }

  function excluirDocumentoOperador(id) {
    const all = loadAll();
    const idx = all.findIndex((d) => String(d.id) === String(id));
    if (idx === -1) return { ok: false, msg: "Documento não encontrado." };
    const doc = all[idx];
    if (!podeGerirEnvioDocumento(doc)) {
      return { ok: false, msg: "Sem permissão para excluir este documento." };
    }
    const isAdmin =
      typeof window.__DK_isPortalTitularAdministrador === "function" &&
      window.__DK_isPortalTitularAdministrador();
    if (!isAdmin) {
      const reg = getRegistroOperador();
      const dig = onlyDigits(reg.cpf).slice(0, 11);
      if (onlyDigits(doc.registradoPorCpf).slice(0, 11) !== dig) {
        return { ok: false, msg: "Só quem importou ou o administrador pode excluir." };
      }
    }
    if (doc.enviadoCliente === true && !isAdmin) {
      return { ok: false, msg: "Já enviado ao cliente — só o administrador pode excluir." };
    }
    all.splice(idx, 1);
    saveAllLocal(all);
    if (doc.enviadoCliente === true) pushDocumentosNuvem();
    return { ok: true, msg: "Documento excluído — pode trazer outro do depósito." };
  }

  function removerDocumento(id) {
    return excluirDocumentoOperador(id).ok;
  }

  function buildDocListItemHtml(d) {
    const dt = new Date(Number(d.createdAt) || 0);
    const quando = Number.isFinite(dt.getTime())
      ? dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "—";
    const quem = String(d.registradoPorNome || d.registradoPorCpf || "—").trim();
    const tipo = inferDocTipo(d);
    const dest = DOC_DESTINO_APP[tipo] || { rotulo: "Documento", botaoApp: "app" };
    const enviado = isDocEnviadoCliente(d);
    const conferido = d.conferidoOperador === true;
    const isEnviando = docsEnviando.has(String(d.id));
    const enviadoEm = d.enviadoClienteEm
      ? new Date(Number(d.enviadoClienteEm)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "";
    let statusEnvio;
    if (enviado) {
      statusEnvio = `<span class="portal-loc-docs-item__enviado">Enviado e confirmado na nuvem · «${escapeHtml(dest.botaoApp)}»${enviadoEm ? ` · ${escapeHtml(enviadoEm)}` : ""}</span>`;
    } else if (conferido) {
      statusEnvio = `<span class="portal-loc-docs-item__conferido">Confirmado — pronto para enviar a «${escapeHtml(dest.botaoApp)}»</span>`;
    } else {
      statusEnvio = `<span class="portal-loc-docs-item__pendente">Visualize e confirme antes de enviar</span>`;
    }
    const podeEnviar = enviado || conferido;
    const enviarLabel = isEnviando ? "A enviar…" : enviado ? "Enviado" : "Enviar para o cliente";
    return `<li class="portal-loc-docs-item" data-loc-doc-tipo="${escapeHtml(tipo)}">
          <span class="portal-loc-docs-item__nome"><span class="portal-loc-docs-item__tipo">${escapeHtml(dest.rotulo)}</span> ${escapeHtml(d.nome)}</span>
          <span class="portal-loc-docs-item__meta">${escapeHtml(quando)} · ${escapeHtml(quem)} · ${statusEnvio}</span>
          <span class="portal-loc-docs-item__acoes">
            <button type="button" class="btn-primary btn-secondary-outline portal-loc-docs-item__visualizar" data-loc-doc-visualizar="${escapeHtml(d.id)}" title="Visualizar PDF">Visualizar</button>
            <button type="button" class="btn-primary btn-secondary-outline portal-loc-docs-item__confirmar${conferido ? " portal-loc-docs-item__confirmar--ok" : ""}" data-loc-doc-confirmar="${escapeHtml(d.id)}" ${conferido || enviado || isEnviando ? "disabled" : ""} title="Confirmar que o ficheiro está correto">${conferido ? "Confirmado" : "Confirmar"}</button>
            <button type="button" class="btn-primary portal-loc-docs-item__enviar${enviado ? " portal-loc-docs-item__enviar--ok" : ""}${isEnviando ? " portal-loc-docs-item__enviar--busy" : ""}" data-loc-doc-enviar="${escapeHtml(d.id)}" ${enviado || !podeEnviar || isEnviando ? "disabled" : ""} title="Publicar no app (${escapeHtml(dest.botaoApp)})">${escapeHtml(enviarLabel)}</button>
            <button type="button" class="btn-primary btn-secondary-outline portal-loc-docs-item__excluir" data-loc-doc-excluir="${escapeHtml(d.id)}" ${isEnviando ? "disabled" : ""} title="Remover documento errado deste protocolo">Excluir</button>
          </span>
        </li>`;
  }

  function renderDocsListaUl(ul, docs, emptyText) {
    if (!ul) return;
    const sorted = (Array.isArray(docs) ? docs : []).slice().sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    if (!sorted.length) {
      ul.innerHTML = `<li class="subtext">${escapeHtml(emptyText || "Nenhum documento.")}</li>`;
      return;
    }
    ul.innerHTML = sorted.map(buildDocListItemHtml).join("");
  }

  function renderListasPorTipo(nc, cpf) {
    limparDuplicadosNaoEnviados(nc, cpf);
    LOC_CADASTRO_TIPOS.forEach((tipo) => {
      const ul = document.getElementById(LISTA_TIPO_IDS[tipo]);
      const doc = docCanonicoPorTipo(nc, cpf, tipo);
      const vaga = document.getElementById(
        tipo === "contrato" ? "operacaoLocacaoDocVagaContrato" : "operacaoLocacaoDocVagaCrlv"
      );
      if (vaga) vaga.classList.toggle("portal-loc-docs-vaga--ocupada", Boolean(doc));
      renderDocsListaUl(ul, doc ? [doc] : [], `Vaga livre — pesquise no depósito Documentos e traga para o protocolo.`);
    });
  }

  function renderLista(nc, cpf) {
    renderListasPorTipo(nc, cpf);
    if (normNc(nc) && onlyDigits(cpf).length === 11) {
      void reconciliarDocumentosEnvioProtocolo(nc, cpf);
    }
  }

  function handleDocListaClick(e, msgEl, onRefresh) {
    const visualizar = e.target.closest?.("[data-loc-doc-visualizar]");
    if (visualizar) {
      const id = visualizar.getAttribute("data-loc-doc-visualizar");
      const doc = loadAll().find((d) => String(d.id) === String(id));
      if (!doc) {
        if (msgEl) msgEl.textContent = "Documento não encontrado.";
        return;
      }
      void (async () => {
        const ok = await visualizarDocumento(doc);
        if (!ok && msgEl) {
          msgEl.textContent = "Não foi possível visualizar — ficheiro indisponível neste computador.";
        }
      })();
      return;
    }
    const confirmar = e.target.closest?.("[data-loc-doc-confirmar]");
    if (confirmar && !confirmar.disabled) {
      const id = confirmar.getAttribute("data-loc-doc-confirmar");
      if (!id) return;
      const res = confirmarDocumentoOperador(id);
      if (msgEl) msgEl.textContent = res.msg || "";
      if (typeof onRefresh === "function") onRefresh();
      return;
    }
    const enviar = e.target.closest?.("[data-loc-doc-enviar]");
    if (enviar && !enviar.disabled) {
      const id = enviar.getAttribute("data-loc-doc-enviar");
      if (!id) return;
      docsEnviando.add(String(id));
      if (typeof onRefresh === "function") onRefresh();
      mostrarFeedbackEnvioDoc(msgEl, "A enviar PDF à nuvem e a confirmar no app do cliente…", null);
      void (async () => {
        try {
          const res = await enviarDocumentoParaCliente(id);
          mostrarFeedbackEnvioDoc(msgEl, res.msg || "", res.ok === true);
        } catch (err) {
          const det = String(err?.message || err || "erro desconhecido");
          mostrarFeedbackEnvioDoc(
            msgEl,
            `Erro ao enviar — ${det}. Recarregue a página e tente de novo.`,
            false
          );
        } finally {
          docsEnviando.delete(String(id));
          if (typeof onRefresh === "function") onRefresh();
        }
      })();
      return;
    }
    const excluir = e.target.closest?.("[data-loc-doc-excluir]");
    if (excluir) {
      const id = excluir.getAttribute("data-loc-doc-excluir");
      if (!id) return;
      const doc = loadAll().find((d) => String(d.id) === String(id));
      const nome = String(doc?.nome || "documento").trim();
      const aviso = doc?.enviadoCliente
        ? `«${nome}» já foi enviado ao cliente. Excluir mesmo assim?`
        : `Excluir «${nome}» deste protocolo?`;
      if (!window.confirm(aviso)) return;
      const res = excluirDocumentoOperador(id);
      if (msgEl) msgEl.textContent = res.msg || "";
      if (typeof onRefresh === "function") onRefresh();
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function atualizarBuscaLocacaoUi(baseOk) {
    LOC_CADASTRO_TIPOS.forEach((tipo) => {
      const cfg = BUSCA_UI[tipo];
      const input = document.getElementById(cfg.inputId);
      const btn = document.getElementById(cfg.btnId);
      if (input) input.disabled = !baseOk;
      if (btn) btn.disabled = !baseOk;
      if (!baseOk) {
        fecharSugestoesDeposito(tipo);
        return;
      }
      const msg = document.getElementById(cfg.msgId);
      const total = contarDeposito(tipo);
      if (msg && !String(input?.value || "").trim()) {
        msg.textContent = total
          ? `${total} ficheiro(s) no depósito — digite para filtrar.`
          : "Nenhum ficheiro no depósito Documentos.";
      }
    });
  }

  function refreshUi() {
    const wrap = document.getElementById("operacaoLocacaoDocumentosWrap");
    const msg = document.getElementById("operacaoLocacaoDocumentosMsg");
    if (!wrap) return;

    const permitido = podeGerirDocumentosLocacao();
    const nc = getProtocoloAtual();
    const cpf = getCpfAtual();
    const temProtocolo = Boolean(nc);
    const ativo = temProtocolo ? protocoloLocacaoAtivo(nc) : false;
    const cpfOk = cpf.length === 11;
    const baseOk = permitido && temProtocolo && ativo && cpfOk;

    wrap.classList.toggle("hidden", !permitido);
    atualizarBuscaLocacaoUi(baseOk);

    if (!permitido) {
      if (msg) msg.textContent = "";
      return;
    }
    if (!temProtocolo) {
      if (msg) {
        msg.textContent =
          "Escolha o protocolo (ou informe data de início para NOVO). Deposite ficheiros em Documentos e pesquise abaixo.";
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
      const n = LOC_CADASTRO_TIPOS.filter((t) => docCanonicoPorTipo(nc, cpf, t)).length;
      msg.textContent = `${n}/2 documento(s) no protocolo ${nc} — 1 contrato e 1 CRLV; traga, Visualize, Confirme e Envie.`;
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

  function locacaoDoProtocoloCpf(nc, cpf) {
    const n = normNc(nc);
    const dig = onlyDigits(cpf).slice(0, 11);
    if (!n || dig.length !== 11) return null;
    try {
      const raw = localStorage.getItem("dk_locacoes_cadastro");
      const locs = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(locs)) return null;
      return locs.find((l) => normNc(l?.numeroContrato) === n && onlyDigits(l?.cpf).slice(0, 11) === dig) || null;
    } catch {
      return null;
    }
  }

  function getMultasDocIdsVinculadosARegistros(nc, cpf) {
    const loc = locacaoDoProtocoloCpf(nc, cpf);
    const ids = new Set();
    (loc?.portalMultasTransito || []).forEach((m) => {
      if (m?.locacaoDocumentoId) ids.add(String(m.locacaoDocumentoId));
      if (m?.origemDepositoId) ids.add(String(m.origemDepositoId));
    });
    return ids;
  }

  function getMultaDocPendenteVinculo(nc, cpf) {
    const vinc = getMultasDocIdsVinculadosARegistros(nc, cpf);
    return (
      docsDoProtocoloPorTipo(nc, cpf, "multa").find((d) => !vinc.has(String(d.id))) || null
    );
  }

  function renderMultasLancDocsLista(nc, cpf) {
    const ul = document.getElementById("operacaoLancMultasDocumentosLista");
    const docs = docsDoProtocoloPorTipo(nc, cpf, "multa");
    renderDocsListaUl(ul, docs, "Nenhuma multa importada neste protocolo — clique Multa após depositar em Documentos.");
  }

  async function importarProximaMultaDoDeposito() {
    const ctx = getLancMultasContexto();
    const { cpf, nc, placa } = ctx;
    const label = "Multa";

    if (!podeGerirDocumentosMultas()) {
      return { ok: false, msg: "Sem permissão de lançamento de multas." };
    }
    if (!nc) {
      return { ok: false, msg: "Confirme a pesquisa e selecione um protocolo." };
    }
    if (cpf.length !== 11) {
      return { ok: false, msg: "Informe o CPF do cliente." };
    }
    if (placa.length < 6) {
      return { ok: false, msg: "Placa do protocolo indisponível." };
    }

    const listarFn =
      typeof window.__DK_documentosListarPorChave === "function" ? window.__DK_documentosListarPorChave : null;
    if (!listarFn) {
      return { ok: false, msg: "Depósito Documentos indisponível — abra o menu Documentos neste computador." };
    }

    const chave = chaveMultaDeposito(placa, cpf);
    const rows = listarFn("multa", chave);
    if (!rows.length) {
      return {
        ok: false,
        msg: `Nenhuma multa no depósito para ${chave}. Deposite em Documentos (nome = PLACA-CPF).`,
      };
    }

    const all = loadAll();
    const entry = rows.find((r) => !docDepositoJaImportado(all, nc, cpf, r.id, "multa"));
    if (!entry) {
      const pend = getMultaDocPendenteVinculo(nc, cpf);
      if (pend) {
        return { ok: true, already: true, msg: "Multa já importada — cadastre os dados ou importe outro PDF em Documentos." };
      }
      return {
        ok: false,
        msg: `Todas as multas do depósito (${chave}) já foram importadas. Deposite outro PDF em Documentos se necessário.`,
      };
    }

    const reg = getRegistroOperador();
    const r = await importarDocDepositoParaProtocolo(entry, "multa", nc, cpf, placa, reg);
    if (r.added) {
      return { ok: true, added: true, msg: `${label} importada do depósito Documentos.` };
    }
    if (r.skipped) {
      return { ok: true, already: true, msg: "Esta multa já está neste protocolo." };
    }
    if (r.reason === "no_blob") {
      return {
        ok: false,
        msg: "Multa encontrada no depósito, mas o ficheiro não está neste computador — deposite de novo em Documentos.",
      };
    }
    if (r.reason === "too_big") {
      return { ok: false, msg: "Multa no depósito excede 4 MB — reduza o ficheiro em Documentos." };
    }
    return { ok: false, msg: "Não foi possível importar a multa." };
  }

  async function garantirDocMultaParaCadastro(cpfDigits, nc) {
    const cpf = onlyDigits(cpfDigits).slice(0, 11);
    const protocolo = normNc(nc);
    if (cpf.length !== 11 || !protocolo) {
      return { ok: false, msg: "Informe CPF e protocolo." };
    }

    let doc = getMultaDocPendenteVinculo(protocolo, cpf);
    if (doc) return { ok: true, doc };

    const imp = await importarProximaMultaDoDeposito();
    if (!imp.ok) return imp;

    doc = getMultaDocPendenteVinculo(protocolo, cpf);
    if (doc) return { ok: true, doc };

    return {
      ok: false,
      msg:
        imp.msg ||
        "Deposite o PDF da multa em Documentos (PLACA-CPF) e clique Multa antes de cadastrar.",
    };
  }

  function refreshLancMultasDocumentosDeposito() {
    const sec = document.getElementById("operacaoLancMultasDocumentosDeposito");
    const btn = document.getElementById("operacaoLancMultasDocImportBtn");
    const msg = document.getElementById("operacaoLancMultasDepositoMsg");
    if (!sec) return;

    const ctx = getLancMultasContexto();
    const permitido = podeGerirDocumentosMultas();
    const visivel = permitido && ctx.cpf.length === 11 && Boolean(ctx.nc);
    const placaOk = ctx.placa.length >= 6;

    sec.classList.toggle("hidden", !visivel);
    if (!visivel) {
      sec.setAttribute("hidden", "");
      const ul = document.getElementById("operacaoLancMultasDocumentosLista");
      if (ul) ul.innerHTML = "";
      if (msg) msg.textContent = "";
      if (btn) btn.disabled = true;
      return;
    }

    sec.removeAttribute("hidden");
    if (btn) btn.disabled = !placaOk;

    const pend = getMultaDocPendenteVinculo(ctx.nc, ctx.cpf);
    const nMultas = docsDoProtocoloPorTipo(ctx.nc, ctx.cpf, "multa").length;
    if (msg) {
      const chave = placaOk ? chaveMultaDeposito(ctx.placa, ctx.cpf) : "";
      msg.textContent = pend
        ? `Documento pronto para cadastrar (${chave}). ${nMultas} multa(s) importada(s) neste protocolo.`
        : placaOk
          ? `${nMultas} multa(s) importada(s). Clique Multa para importar do depósito (${chave}) antes de cadastrar.`
          : "Placa indisponível — confirme o protocolo.";
    }
    renderMultasLancDocsLista(ctx.nc, ctx.cpf);
  }

  function bindMultasDepositoUi() {
    const btn = document.getElementById("operacaoLancMultasDocImportBtn");
    const lista = document.getElementById("operacaoLancMultasDocumentosLista");
    const msg = document.getElementById("operacaoLancMultasDepositoMsg");

    btn?.addEventListener("click", async () => {
      if (btn.disabled) return;
      const res = await importarProximaMultaDoDeposito();
      refreshLancMultasDocumentosDeposito();
      if (msg && res.msg) msg.textContent = res.msg;
    });

    lista?.addEventListener("click", (e) => {
      handleDocListaClick(e, msg, refreshLancMultasDocumentosDeposito);
    });
  }

  function bindBuscaLocacaoUi(categoria) {
    const cfg = BUSCA_UI[categoria];
    if (!cfg) return;
    const input = document.getElementById(cfg.inputId);
    const btn = document.getElementById(cfg.btnId);
    const sugestoes = document.getElementById(cfg.sugestoesId);
    const msg = document.getElementById("operacaoLocacaoDocumentosMsg");

    input?.addEventListener("input", () => onBuscaDepositoInput(categoria));
    input?.addEventListener("focus", () => {
      if (!input.disabled && input.value.trim()) onBuscaDepositoInput(categoria);
    });
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void (async () => {
          const res = await buscarEImportarDoDeposito(categoria);
          refreshUi();
          if (msg && res.msg) msg.textContent = res.msg;
        })();
      }
    });

    btn?.addEventListener("click", async () => {
      if (btn.disabled) return;
      const res = await buscarEImportarDoDeposito(categoria);
      refreshUi();
      if (msg && res.msg) msg.textContent = res.msg;
    });

    sugestoes?.addEventListener("click", (e) => {
      const item = e.target.closest?.("[data-dep-doc-id]");
      if (!item) return;
      selecionarSugestaoDeposito(
        categoria,
        item.getAttribute("data-dep-doc-id"),
        item.getAttribute("data-dep-nome")
      );
      const cfgMsg = document.getElementById(cfg.msgId);
      if (cfgMsg) cfgMsg.textContent = "Ficheiro selecionado — clique em trazer documento.";
    });
  }

  function bindUi() {
    const wrap = document.getElementById("operacaoLocacaoDocumentosWrap");
    const msg = document.getElementById("operacaoLocacaoDocumentosMsg");

    LOC_CADASTRO_TIPOS.forEach(bindBuscaLocacaoUi);

    document.addEventListener("click", (e) => {
      if (e.target.closest?.(".portal-loc-docs-busca") || e.target.closest?.(".portal-loc-docs-sugestoes")) return;
      fecharTodasSugestoesDeposito();
    });

    wrap?.addEventListener("click", (e) => {
      if (!e.target.closest?.("[data-loc-doc-visualizar],[data-loc-doc-confirmar],[data-loc-doc-enviar],[data-loc-doc-excluir]")) return;
      handleDocListaClick(e, msg, refreshUi);
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
  window.__DK_buscarImportarLocacaoDoc = buscarEImportarDoDeposito;
  window.__DK_verificarDocLocacaoNaNuvem = verificarDocumentoEnviadoNaNuvem;
  window.__DK_refreshLancMultasDocumentosDeposito = refreshLancMultasDocumentosDeposito;
  window.__DK_garantirDocMultaParaCadastro = garantirDocMultaParaCadastro;
  window.__DK_importarMultaDocDoDeposito = importarProximaMultaDoDeposito;

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
