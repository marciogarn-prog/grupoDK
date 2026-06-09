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
      msg.textContent = `${docsDoProtocolo(nc, cpf).length} documento(s) no protocolo ${nc} — visíveis no app em «Documentação do contrato».`;
    }
    renderLista(nc, cpf);
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
    document.getElementById("operacaoLocacaoDataInicio")?.addEventListener("input", refreshUi);
    document.getElementById("operacaoLocacaoProtocoloAdminCarregarBtn")?.addEventListener("click", () => {
      window.setTimeout(refreshUi, 50);
    });
  }

  window.__DK_refreshOperacaoLocacaoDocumentosUi = refreshUi;
  window.__DK_docsLocacaoDoProtocolo = docsDoProtocolo;
  window.__DK_docsLocacaoLoadAll = loadAll;

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
