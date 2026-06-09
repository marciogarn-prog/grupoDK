/**
 * Documentos vinculados ao protocolo de locação (cadastro operação).
 */
(function portalLocacaoDocumentos() {
  const STORAGE_KEY = "dk_locacao_documentos_v1";
  const MAX_BYTES = 4 * 1024 * 1024;
  const MIME_OK = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/jpg"]);

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

  function saveAll(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
    } else if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => {});
    }
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

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(fr.error || new Error("leitura"));
      fr.readAsDataURL(file);
    });
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
      registradoPorNome: String(reg.nome || "").trim() || "Importação automática",
      arquivoBase64: dataUrl,
      origemDepositoId: depositEntry.id,
      origemDepositoCategoria: categoria,
      origemDepositoChave: String(depositEntry.chave || "").trim(),
      importadoAutomaticamente: true,
    });
    saveAll(all);
    return { ok: true, added: true, categoria, nome: depositEntry.nomeArquivo };
  }

  async function autoImportarDocumentosDeposito() {
    const nc = getProtocoloAtual();
    const cpf = getCpfAtual();
    const placa = getPlacaAtual();
    if (!nc || cpf.length !== 11 || placa.length < 6) return { ok: false, reason: "incomplete" };
    if (!podeGerirDocumentosLocacao()) return { ok: false, reason: "sem_perm" };
    if (!protocoloLocacaoAtivo(nc)) return { ok: false, reason: "inativo" };
    const listarFn = typeof window.__DK_documentosListarPorChave === "function" ? window.__DK_documentosListarPorChave : null;
    if (!listarFn) return { ok: false, reason: "no_deposit" };

    const reg = getRegistroOperador();
    const msgs = [];
    let added = 0;

    const contratos = listarFn("contrato", nc);
    if (contratos.length) {
      const r = await importarDocDepositoParaProtocolo(contratos[0], "contrato", nc, cpf, placa, reg);
      if (r.added) {
        added += 1;
        msgs.push("Contrato importado do depósito.");
      } else if (r.reason === "no_blob") {
        msgs.push("Contrato encontrado no depósito, mas o ficheiro não está neste computador.");
      } else if (r.reason === "too_big") {
        msgs.push("Contrato no depósito excede 4 MB — reduza o ficheiro.");
      }
    }

    const crlvs = listarFn("crlv", placa);
    if (crlvs.length) {
      const r = await importarDocDepositoParaProtocolo(crlvs[0], "crlv", nc, cpf, placa, reg);
      if (r.added) {
        added += 1;
        msgs.push("CRLV importado do depósito.");
      } else if (r.reason === "no_blob") {
        msgs.push("CRLV encontrado no depósito, mas o ficheiro não está neste computador.");
      } else if (r.reason === "too_big") {
        msgs.push("CRLV no depósito excede 4 MB — reduza o ficheiro.");
      }
    }

    return { ok: true, added, msgs };
  }

  let autoImportTimer = 0;
  let autoImportBusy = false;

  function scheduleAutoImportDeposito() {
    if (autoImportTimer) window.clearTimeout(autoImportTimer);
    autoImportTimer = window.setTimeout(async () => {
      autoImportTimer = 0;
      if (autoImportBusy) return;
      const nc = getProtocoloAtual();
      const cpf = getCpfAtual();
      const placa = getPlacaAtual();
      if (!nc || cpf.length !== 11 || placa.length < 6) return;
      autoImportBusy = true;
      try {
        const res = await autoImportarDocumentosDeposito();
        const msg = document.getElementById("operacaoLocacaoDocumentosMsg");
        if (res.added > 0) {
          refreshUi();
          if (msg) {
            const base = `${docsDoProtocolo(nc, cpf).length} documento(s) no protocolo ${nc}.`;
            msg.textContent = res.msgs?.length ? `${res.msgs.join(" ")} ${base}` : base;
          }
        } else if (msg && res.msgs?.length && !String(msg.textContent || "").includes("documento(s) no protocolo")) {
          msg.textContent = res.msgs.join(" ");
        }
      } finally {
        autoImportBusy = false;
      }
    }, 450);
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
      const prevTs = Number(prev.createdAt) || 0;
      const recTs = Number(rec.createdAt) || 0;
      if (recHas && !prevHas) {
        byId.set(rec.id, rec);
        return;
      }
      if (prevHas && !recHas) return;
      if (recTs >= prevTs) byId.set(rec.id, rec);
    };
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(pick);
    (Array.isArray(localArr) ? localArr : []).forEach(pick);
    return Array.from(byId.values());
  }

  async function adicionarDocumentos(files, nc, cpf) {
    const protocolo = normNc(nc);
    const cpfDig = onlyDigits(cpf).slice(0, 11);
    if (!protocolo) return { ok: false, msg: "Escolha um protocolo antes de carregar documentos." };
    if (!podeGerirDocumentosLocacao()) {
      return { ok: false, msg: "Sem permissão de cadastro de locação para anexar documentos." };
    }
    if (!protocoloLocacaoAtivo(normNc(nc))) {
      return { ok: false, msg: "Só é possível anexar documentos a protocolos ativos (sem data fim)." };
    }
    const lista = Array.from(files || []).filter(Boolean);
    if (!lista.length) return { ok: false, msg: "Nenhum ficheiro selecionado." };

    const reg = getRegistroOperador();
    const all = loadAll();
    let added = 0;

    for (const file of lista) {
      const mime = String(file.type || "").toLowerCase();
      const nome = String(file.name || "documento").trim();
      const extOk = /\.(pdf|jpe?g|png|webp)$/i.test(nome);
      if (!MIME_OK.has(mime) && !extOk) continue;
      if (file.size > MAX_BYTES) {
        return { ok: false, msg: `«${nome}» excede 4 MB. Reduza o ficheiro e tente de novo.` };
      }
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) continue;
      const id = `ld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      all.push({
        id,
        numeroContrato: protocolo,
        cpf: cpfDig,
        nome,
        mimeType: mime || (nome.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
        tamanho: file.size,
        createdAt: Date.now(),
        registradoPorCpf: onlyDigits(reg.cpf).slice(0, 11),
        registradoPorNome: String(reg.nome || "").trim(),
        arquivoBase64: dataUrl,
      });
      added += 1;
    }

    if (!added) return { ok: false, msg: "Formato não suportado. Use PDF, JPG ou PNG." };
    saveAll(all);
    return { ok: true, msg: `${added} documento(s) guardado(s) no protocolo ${protocolo}.` };
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
    all.splice(idx, 1);
    saveAll(all);
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
        return `<li class="portal-loc-docs-item">
          <span class="portal-loc-docs-item__nome">${escapeHtml(d.nome)}</span>
          <span class="portal-loc-docs-item__meta">${escapeHtml(quando)} · ${escapeHtml(quem)}</span>
          <span class="portal-loc-docs-item__acoes">
            <a class="btn-primary btn-secondary-outline portal-loc-docs-item__ver" href="${String(d.arquivoBase64 || "#").replace(/"/g, "&quot;")}" target="_blank" rel="noopener" download="${escapeHtml(d.nome)}">Baixar</a>
            <button type="button" class="btn-primary btn-secondary-outline portal-loc-docs-item__del" data-loc-doc-del="${escapeHtml(d.id)}" title="Remover">Remover</button>
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
    const btn = document.getElementById("operacaoLocacaoDocumentosBtn");
    const msg = document.getElementById("operacaoLocacaoDocumentosMsg");
    if (!wrap || !btn) return;

    const permitido = podeGerirDocumentosLocacao();
    const nc = getProtocoloAtual();
    const cpf = getCpfAtual();
    const temProtocolo = Boolean(nc);
    const ativo = temProtocolo ? protocoloLocacaoAtivo(nc) : false;

    wrap.classList.toggle("hidden", !permitido);
    btn.disabled = !permitido || !temProtocolo || !ativo;
    if (!permitido) {
      if (msg) msg.textContent = "";
      return;
    }
    if (!temProtocolo) {
      if (msg) msg.textContent = "Escolha o protocolo (ou informe data de início para NOVO) para carregar documentos.";
      renderLista("", cpf);
      return;
    }
    if (!ativo) {
      if (msg) {
        msg.textContent = `Protocolo ${nc} finalizado — não é possível anexar novos documentos. O cliente só acede à documentação em protocolos ativos.`;
      }
      renderLista(nc, cpf);
      return;
    }
    if (msg) {
      const n = docsDoProtocolo(nc, cpf).length;
      msg.textContent = `${n} documento(s) no protocolo ${nc} — visíveis no app em «Documentação do contrato».`;
    }
    renderLista(nc, cpf);
    scheduleAutoImportDeposito();
  }

  function bindUi() {
    const btn = document.getElementById("operacaoLocacaoDocumentosBtn");
    const input = document.getElementById("operacaoLocacaoDocumentosInput");
    const lista = document.getElementById("operacaoLocacaoDocumentosLista");
    const msg = document.getElementById("operacaoLocacaoDocumentosMsg");

    btn?.addEventListener("click", () => {
      if (btn.disabled) return;
      input?.click();
    });

    input?.addEventListener("change", async () => {
      const nc = getProtocoloAtual();
      const cpf = getCpfAtual();
      const res = await adicionarDocumentos(input.files, nc, cpf);
      if (msg) msg.textContent = res.msg || "";
      input.value = "";
      refreshUi();
    });

    lista?.addEventListener("click", (e) => {
      const del = e.target.closest?.("[data-loc-doc-del]");
      if (!del) return;
      const id = del.getAttribute("data-loc-doc-del");
      if (!id) return;
      if (!window.confirm("Remover este documento do protocolo?")) return;
      if (removerDocumento(id)) refreshUi();
      else if (msg) msg.textContent = "Não foi possível remover (sem permissão).";
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
  window.__DK_docsLocacaoLoadAll = loadAll;
  window.__DK_docsLocacaoMerge = mergeLocacaoDocumentos;
  window.__DK_autoImportLocacaoDocumentosDeposito = autoImportarDocumentosDeposito;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindUi();
      refreshUi();
    });
  } else {
    bindUi();
    refreshUi();
  }
})();
