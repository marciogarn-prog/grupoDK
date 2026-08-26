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
    multa: {
      inputId: "operacaoLancMultasDocBusca",
      btnId: "operacaoLancMultasDocImportBtn",
      sugestoesId: "operacaoLancMultasDocSugestoes",
      msgId: "operacaoLancMultasDepositoMsg",
      trazerLabel: "Importar multa",
    },
  };
  const buscaLocacaoState = { contrato: { selectedId: "" }, crlv: { selectedId: "" }, multa: { selectedId: "" } };
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

  function loadAllRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const p = raw ? JSON.parse(raw) : [];
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }

  function loadAll() {
    return repararMetadadosDocumentosLocacao(loadAllRaw());
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

  const PORTAL_PROTO_NOVO = "__PORTAL_PROTO_NOVO__";

  function getProtocoloAtual() {
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    let nc = normNc(hid?.value);
    if (nc) return nc;
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const sv = String(sel?.value || "").trim();
    if (sv && sv !== PORTAL_PROTO_NOVO) {
      nc = normNc(sv);
      if (nc && hid) hid.value = nc;
      return nc;
    }
    return "";
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

  /** Exclusão lógica: o registo fica como marcador para a nuvem não o ressuscitar. */
  function tombstoneDoc(d) {
    return {
      ...d,
      excluido: true,
      excluidoEm: Date.now(),
      enviadoCliente: false,
      conferidoOperador: false,
      arquivoBase64: "",
    };
  }

  function docsDoProtocolo(nc, cpf) {
    const n = normNc(nc);
    const dig = onlyDigits(cpf).slice(0, 11);
    return loadAll().filter(
      (d) =>
        d?.excluido !== true &&
        normNc(d.numeroContrato) === n &&
        (!dig || onlyDigits(d.cpf).slice(0, 11) === dig)
    );
  }

  function inferDocTipo(d) {
    const t = String(d?.tipo || "").trim().toLowerCase();
    if (t === "contrato" || t === "crlv" || t === "multa") return t;
    const cat = String(d?.origemDepositoCategoria || "").trim().toLowerCase();
    if (cat === "contrato" || cat === "crlv" || cat === "multa") return cat;
    const nome = String(d?.nome || "").trim();
    if (/^contrato\b|contrato\s*—/i.test(nome)) return "contrato";
    if (/crlv/i.test(nome)) return "crlv";
    if (/multa/i.test(nome)) return "multa";
    const basePdf = nome.replace(/\.pdf$/i, "").trim();
    if (/^\d{8,12}$/.test(basePdf)) return "contrato";
    return "";
  }

  function repararMetadadosDocumentosLocacao(arr) {
    if (!Array.isArray(arr)) return [];
    let changed = false;
    const next = arr.map((d) => {
      if (!d || d.excluido === true) return d;
      const tipoAtual = String(d.tipo || "").trim().toLowerCase();
      if (tipoAtual === "contrato" || tipoAtual === "crlv" || tipoAtual === "multa") return d;
      const inferido = inferDocTipo(d);
      if (!inferido) return d;
      changed = true;
      return {
        ...d,
        tipo: inferido,
        origemDepositoCategoria: d.origemDepositoCategoria || inferido,
      };
    });
    if (changed) saveAllLocal(next);
    return next;
  }

  function docsDoProtocoloPorTipo(nc, cpf, tipo) {
    const want = String(tipo || "").trim().toLowerCase();
    return docsDoProtocolo(nc, cpf).filter((d) => inferDocTipo(d) === want);
  }

  function docCanonicoPorTipo(nc, cpf, categoria) {
    const docs = docsDoProtocoloPorTipo(nc, cpf, categoria);
    if (!docs.length) return null;
    if (docs.length === 1) return docs[0];
    const byNewest = (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    const enviados = docs.filter((d) => d.enviadoCliente === true);
    if (!enviados.length) return docs.slice().sort(byNewest)[0];
    const enviadoTop = enviados.slice().sort(byNewest)[0];
    /* importação mais recente que o enviado = substituição em curso — mostrá-la */
    const maisNovo = docs.slice().sort(byNewest)[0];
    if ((Number(maisNovo.createdAt) || 0) > (Number(enviadoTop.createdAt) || 0)) return maisNovo;
    return enviadoTop;
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
        if (String(d.id) === String(canon.id) || d.enviadoCliente === true) return;
        /* nunca apagar importação mais recente que o canónico — é uma substituição em curso */
        if ((Number(d.createdAt) || 0) > (Number(canon.createdAt) || 0)) return;
        removeIds.add(String(d.id));
      });
    });
    if (!removeIds.size) return;
    saveAll(all.map((d) => (removeIds.has(String(d.id)) ? tombstoneDoc(d) : d)));
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
    const cat = String(categoria || "").trim().toLowerCase();
    return all.some(
      (d) =>
        d?.excluido !== true &&
        normNc(d.numeroContrato) === n &&
        onlyDigits(d.cpf).slice(0, 11) === dig &&
        String(d.origemDepositoId || "") === String(depositId || "") &&
        inferDocTipo(d) === cat
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

  async function garantirBlobDepositoParaImport(categoria, depositEntry) {
    const obterFn = typeof window.__DK_documentosObterBlobDoc === "function" ? window.__DK_documentosObterBlobDoc : null;
    if (!obterFn || !depositEntry?.id) return null;
    let row = await obterFn(categoria, depositEntry.id);
    if (row?.blob?.size) return row;
    const garantirFn =
      typeof window.__DK_documentosGarantirBlobNaNuvem === "function"
        ? window.__DK_documentosGarantirBlobNaNuvem
        : null;
    if (garantirFn) await garantirFn(depositEntry).catch(() => null);
    row = await obterFn(categoria, depositEntry.id);
    if (row?.blob?.size) return row;
    const syncFn =
      typeof window.__DK_documentosSyncBidireccional === "function" ? window.__DK_documentosSyncBidireccional : null;
    if (syncFn) await syncFn().catch(() => null);
    row = await obterFn(categoria, depositEntry.id);
    return row?.blob?.size ? row : null;
  }

  async function importarDocDepositoParaProtocolo(depositEntry, categoria, nc, cpf, placa, reg) {
    if (!depositEntry?.id) return { ok: false, reason: "no_fn" };
    const all = loadAll();
    if (docDepositoJaImportado(all, nc, cpf, depositEntry.id, categoria)) {
      return { ok: true, skipped: true };
    }
    const row = await garantirBlobDepositoParaImport(categoria, depositEntry);
    let dataUrl = "";
    let tamanho = Number(depositEntry.tamanho || depositEntry.size || 0) || 0;
    let mimeType = String(depositEntry.mimeType || "").trim();
    let semBlobLocal = false;
    if (row?.blob) {
      if (row.blob.size > MAX_BYTES) {
        return { ok: false, reason: "too_big", categoria, nome: depositEntry.nomeArquivo };
      }
      dataUrl = await blobToDataUrl(row.blob);
      if (!dataUrl) return { ok: false, reason: "read_fail", categoria };
      tamanho = row.blob.size;
      mimeType = row.mimeType || row.blob.type || mimeType;
    } else {
      semBlobLocal = true;
    }
    if (!mimeType) {
      mimeType = String(depositEntry.nomeArquivo || "").toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/jpeg";
    }
    all.push({
      id: `ld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      numeroContrato: normNc(nc),
      cpf: onlyDigits(cpf).slice(0, 11),
      nome: nomeImportadoDeposito(categoria, nc, placa, depositEntry),
      mimeType,
      tamanho,
      createdAt: Date.now(),
      ...(typeof window.__DK_portalStampRegistradoPor === "function"
        ? window.__DK_portalStampRegistradoPor(reg)
        : {
            registradoPorCpf: onlyDigits(reg.cpf).slice(0, 11),
            registradoPorNome: String(reg.nome || "").trim() || "Importação do depósito",
          }),
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
    return { ok: true, added: true, categoria, nome: depositEntry.nomeArquivo, semBlobLocal };
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
    let changed = false;
    const next = all.map((d) => {
      if (d?.excluido === true) return d;
      if (normNc(d.numeroContrato) !== n || onlyDigits(d.cpf).slice(0, 11) !== dig) return d;
      if (inferDocTipo(d) !== categoria) return d;
      if (exceptId && String(d.id) === String(exceptId)) return d;
      changed = true;
      return tombstoneDoc(d);
    });
    if (changed) saveAll(next);
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
    Object.keys(BUSCA_UI).forEach(fecharSugestoesDeposito);
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
    if (categoria === "contrato") {
      const protoFn =
        typeof window.__DK_documentosObterContratoPorProtocolo === "function"
          ? window.__DK_documentosObterContratoPorProtocolo
          : null;
      const proto = normNc(String(termo || "").replace(/\.pdf$/i, ""));
      if (protoFn && proto) {
        const byProto = protoFn(proto);
        if (byProto) return byProto;
      }
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
    if (cat !== "contrato" && cat !== "crlv" && cat !== "multa") {
      return { ok: false, msg: "Tipo de documento inválido." };
    }
    if (importDepositoBusy) return { ok: false, msg: "Aguarde a importação em curso." };

    const isMulta = cat === "multa";
    const ctxMulta = isMulta ? getLancMultasContexto() : null;
    const nc = isMulta ? ctxMulta.nc : getProtocoloAtual();
    const cpf = isMulta ? ctxMulta.cpf : getCpfAtual();
    const placa = isMulta ? ctxMulta.placa : getPlacaAtual();
    const label = cat === "contrato" ? "Contrato" : cat === "crlv" ? "CRLV" : "Multa";

    if (isMulta ? !podeGerirDocumentosMultas() : !podeGerirDocumentosLocacao()) {
      return {
        ok: false,
        msg: isMulta ? "Sem permissão de lançamento de multas." : "Sem permissão de cadastro de locação.",
      };
    }
    if (!nc) {
      return {
        ok: false,
        msg: isMulta
          ? "Confirme a pesquisa do contrato antes de importar a multa."
          : "Escolha o protocolo (ou informe data de início para NOVO) antes de importar.",
      };
    }
    if (cpf.length !== 11) {
      return { ok: false, msg: "Informe o CPF do cliente antes de importar documentos." };
    }
    /* multas podem chegar depois do fim do contrato — sem bloqueio por protocolo finalizado */
    if (!isMulta && !protocoloLocacaoAtivo(nc)) {
      return { ok: false, msg: `Protocolo ${nc} finalizado — não é possível importar novos documentos.` };
    }

    const entry = obterEntradaDeposito(cat, depositId);
    if (!entry) {
      return { ok: false, msg: "Ficheiro não encontrado no depósito Documentos." };
    }

    if (isMulta) {
      if (docDepositoJaImportado(loadAll(), nc, cpf, depositId, "multa")) {
        return { ok: true, already: true, msg: "Esta multa já está neste protocolo." };
      }
      importDepositoBusy = true;
      try {
        const reg = getRegistroOperador();
        const r = await importarDocDepositoParaProtocolo(entry, "multa", nc, cpf, placa, reg);
        if (r.added) {
          const extra = r.semBlobLocal
            ? " O PDF será sincronizado ao visualizar."
            : "";
          return { ok: true, added: true, msg: `Multa importada do depósito Documentos.${extra}` };
        }
        if (r.skipped) return { ok: true, already: true, msg: "Esta multa já está neste protocolo." };
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
      } finally {
        importDepositoBusy = false;
      }
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
        const extra = r.semBlobLocal
          ? " O PDF será sincronizado deste computador ou da nuvem ao visualizar."
          : "";
        return { ok: true, added: true, msg: `${label} importado do depósito Documentos.${extra}` };
      }
      if (r.skipped) {
        const visivel = docCanonicoPorTipo(nc, cpf, cat);
        if (visivel) return { ok: true, already: true, msg: `${label} já está neste protocolo.` };
        return { ok: false, msg: `${label} constava importado mas não aparece — tente de novo.` };
      }
      if (r.reason === "no_blob") {
        return {
          ok: false,
          msg: `${label} encontrado no depósito, mas o ficheiro não está neste computador — abra Documentos e use «Carregar da nuvem».`,
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
      if (cat === "multa") {
        /* sem pesquisa: tenta a convenção antiga PLACA-CPF do depósito */
        return importarProximaMultaDoDeposito();
      }
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
    if (!isMultaImportMsg(cat)) {
      const globalMsg = document.getElementById("operacaoLocacaoDocumentosMsg");
      if (globalMsg && res.msg) {
        globalMsg.textContent = res.msg;
        globalMsg.classList.toggle("portal-loc-docs__msg--erro", res.ok === false);
        globalMsg.classList.toggle("portal-loc-docs__msg--ok", res.ok === true);
      }
    }
    renderListasPorTipo(getProtocoloAtual(), getCpfAtual());
    return res;
  }

  function isMultaImportMsg(cat) {
    return String(cat || "").trim().toLowerCase() === "multa";
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
    all[idx] = tombstoneDoc(doc);
    saveAllLocal(all);
    void pushDocumentosNuvem();
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
    const quemRaw =
      String(d.registradoPorLabel || "").trim() ||
      (typeof window.__DK_portalFormatOperadorNomeXxx === "function"
        ? window.__DK_portalFormatOperadorNomeXxx(d.registradoPorNome, d.registradoPorCpf)
        : "") ||
      String(d.registradoPorNome || d.registradoPorCpf || "—").trim();
    const quem = quemRaw;
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
    renderDocsListaUl(ul, docs, "Nenhuma multa neste protocolo — pesquise no depósito Documentos e traga para o protocolo.");
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
    const input = document.getElementById("operacaoLancMultasDocBusca");
    const msg = document.getElementById("operacaoLancMultasDepositoMsg");
    if (!sec) return;

    const ctx = getLancMultasContexto();
    const permitido = podeGerirDocumentosMultas();
    const visivel = permitido && ctx.cpf.length === 11 && Boolean(ctx.nc);

    sec.classList.toggle("hidden", !visivel);
    if (!visivel) {
      sec.setAttribute("hidden", "");
      const ul = document.getElementById("operacaoLancMultasDocumentosLista");
      if (ul) ul.innerHTML = "";
      if (msg) msg.textContent = "";
      if (btn) btn.disabled = true;
      if (input) input.disabled = true;
      fecharSugestoesDeposito("multa");
      return;
    }

    sec.removeAttribute("hidden");
    if (btn) btn.disabled = false;
    if (input) input.disabled = false;

    const pend = getMultaDocPendenteVinculo(ctx.nc, ctx.cpf);
    const nMultas = docsDoProtocoloPorTipo(ctx.nc, ctx.cpf, "multa").length;
    if (msg && !String(input?.value || "").trim()) {
      const total = contarDeposito("multa");
      const deposito = total
        ? `${total} ficheiro(s) no depósito — digite para filtrar.`
        : "Nenhum ficheiro de multa no depósito Documentos.";
      msg.textContent = pend
        ? `${nMultas} multa(s) neste protocolo — documento pronto para cadastrar. ${deposito}`
        : `${nMultas} multa(s) neste protocolo. ${deposito}`;
    }
    renderMultasLancDocsLista(ctx.nc, ctx.cpf);
  }

  function bindMultasDepositoUi() {
    const lista = document.getElementById("operacaoLancMultasDocumentosLista");
    const msg = document.getElementById("operacaoLancMultasDepositoMsg");

    bindBuscaLocacaoUi("multa");

    lista?.addEventListener("click", (e) => {
      handleDocListaClick(e, msg, refreshLancMultasDocumentosDeposito);
    });
  }

  function aplicarFeedbackImportDeposito(categoria, res) {
    const cfg = BUSCA_UI[categoria];
    if (!cfg || !res) return;
    const isMulta = categoria === "multa";
    const msgGlobal = document.getElementById(isMulta ? cfg.msgId : "operacaoLocacaoDocumentosMsg");
    const msgLocal = document.getElementById(cfg.msgId);
    const txt = res.msg || "";
    [msgGlobal, msgLocal].forEach((el) => {
      if (!el || !txt) return;
      el.textContent = txt;
      el.classList.toggle("portal-loc-docs__msg--erro", res.ok === false);
      el.classList.toggle("portal-loc-docs__msg--ok", res.ok === true);
    });
    if (res.ok === false && txt) window.alert(txt);
  }

  async function executarImportacaoBusca(categoria) {
    const cfg = BUSCA_UI[categoria];
    if (!cfg) return { ok: false, msg: "Tipo inválido." };
    const isMulta = categoria === "multa";
    const btn = document.getElementById(cfg.btnId);
    const refreshFn = isMulta ? refreshLancMultasDocumentosDeposito : refreshUi;
    if (btn?.dataset.dkImportBusy === "1") return { ok: false, msg: "Aguarde a importação em curso." };
    if (btn) {
      btn.dataset.dkImportBusy = "1";
      btn.disabled = true;
    }
    try {
      const res = await buscarEImportarDoDeposito(categoria);
      refreshFn();
      aplicarFeedbackImportDeposito(categoria, res);
      return res;
    } catch (err) {
      const fail = { ok: false, msg: `Erro ao importar: ${String(err?.message || err || "erro")}` };
      refreshFn();
      aplicarFeedbackImportDeposito(categoria, fail);
      return fail;
    } finally {
      if (btn) delete btn.dataset.dkImportBusy;
      refreshFn();
    }
  }

  function bindBuscaLocacaoUi(categoria) {
    const cfg = BUSCA_UI[categoria];
    if (!cfg) return;
    const isMulta = categoria === "multa";
    const input = document.getElementById(cfg.inputId);
    const btn = document.getElementById(cfg.btnId);
    const sugestoes = document.getElementById(cfg.sugestoesId);
    const msg = document.getElementById(isMulta ? cfg.msgId : "operacaoLocacaoDocumentosMsg");
    const refreshFn = isMulta ? refreshLancMultasDocumentosDeposito : refreshUi;

    input?.addEventListener("input", () => onBuscaDepositoInput(categoria));
    input?.addEventListener("focus", () => {
      if (!input.disabled && input.value.trim()) onBuscaDepositoInput(categoria);
    });
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void executarImportacaoBusca(categoria);
      }
    });

    btn?.addEventListener("click", () => {
      if (btn.disabled || btn.dataset.dkImportBusy === "1") return;
      void executarImportacaoBusca(categoria);
    });

    sugestoes?.addEventListener("click", (e) => {
      const item = e.target.closest?.("[data-dep-doc-id]");
      if (!item) return;
      const depId = item.getAttribute("data-dep-doc-id");
      const nome = item.getAttribute("data-dep-nome");
      selecionarSugestaoDeposito(categoria, depId, nome);
      if (isMulta) {
        const cfgMsg = document.getElementById(cfg.msgId);
        if (cfgMsg) cfgMsg.textContent = "Ficheiro selecionado — clique em Importar multa.";
        return;
      }
      void (async () => {
        const res = await importarDocDepositoPorId(categoria, depId);
        refreshFn();
        const cfgMsg = document.getElementById(cfg.msgId);
        const trazer = cfg.trazerLabel || "Importar";
        const txt = res.msg || (res.ok ? `${trazer} concluído.` : "Não foi possível importar.");
        if (cfgMsg) cfgMsg.textContent = txt;
        if (msg && txt) {
          msg.textContent = txt;
          msg.classList.toggle("portal-loc-docs__msg--erro", res.ok === false);
          msg.classList.toggle("portal-loc-docs__msg--ok", res.ok === true);
        }
        if (res.ok && (res.added || res.already)) {
          buscaLocacaoState[categoria].selectedId = "";
          if (input) input.value = "";
          fecharSugestoesDeposito(categoria);
        }
      })();
    });
  }

  function bindListaDocumentosLocacao(listaId, msgEl, refreshFn) {
    const ul = document.getElementById(listaId);
    if (!ul || ul.dataset.dkLocDocsBound === "1") return;
    ul.dataset.dkLocDocsBound = "1";
    ul.addEventListener("click", (e) => {
      handleDocListaClick(e, msgEl, refreshFn);
    });
  }

  function bindUi() {
    const wrap = document.getElementById("operacaoLocacaoDocumentosWrap");
    const msg = document.getElementById("operacaoLocacaoDocumentosMsg");

    LOC_CADASTRO_TIPOS.forEach(bindBuscaLocacaoUi);
    bindListaDocumentosLocacao(LISTA_TIPO_IDS.contrato, msg, refreshUi);
    bindListaDocumentosLocacao(LISTA_TIPO_IDS.crlv, msg, refreshUi);

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
  window.__DK_docsLocacaoCanonicoPorTipo = docCanonicoPorTipo;
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
