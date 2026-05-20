/**
 * Comprovantes enviados pelo App Cliente → nuvem → validação pelo operador (Lançamento de aluguel).
 */
(function portalComprovantesCliente() {
  const STORAGE_KEY = "dk_comprovantes_cliente_pendentes";
  const OPENAI_KEY_STORAGE = "dk_openai_api_key";

  const STATUS = {
    PENDENTE: "pendente",
    IA_OK: "ia_validado",
    CONFIRMADO: "confirmado",
    REJEITADO: "rejeitado",
  };

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normProto(x) {
    return typeof normalizeNumeroContratoKey === "function"
      ? normalizeNumeroContratoKey(x || "")
      : String(x || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function currencyBRL(n) {
    if (typeof window.currencyBRL === "function") return window.currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parseCurrencyBR(v) {
    if (typeof window.parseCurrencyBR === "function") return window.parseCurrencyBR(v);
    const cleaned = String(v || "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function parseBrDate(s) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(s);
    const raw = String(s || "").trim();
    if (!raw || !raw.includes("/")) return null;
    const [day, month, year] = raw.split("/").map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 200)));
    pushNuvem();
  }

  function pushNuvem() {
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow().catch(() => {});
    } else if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
    }
  }

  function newId() {
    return `cc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function getById(id) {
    return loadAll().find((r) => r.id === id) || null;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
      fr.readAsDataURL(file);
    });
  }

  function parseDataUrl(dataUrl) {
    const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return { mime: "application/octet-stream", base64: "" };
    return { mime: m[1], base64: m[2] };
  }

  async function adicionarComprovanteCliente(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    const proto = normProto(payload.protocolo);
    const valor = Number(payload.valor);
    const data = String(payload.dataPagamento || "").trim();
    if (cpf.length !== 11 || !proto || valor <= 0 || !parseBrDate(data)) {
      return { ok: false, msg: "Dados inválidos (CPF, protocolo, data ou valor)." };
    }
    let arquivoBase64 = "";
    let mimeType = String(payload.mimeType || "").trim();
    if (payload.arquivoBase64) {
      arquivoBase64 = String(payload.arquivoBase64);
    } else if (payload.file) {
      const dataUrl = await fileToBase64(payload.file);
      const p = parseDataUrl(dataUrl);
      arquivoBase64 = dataUrl;
      mimeType = p.mime || payload.file.type || mimeType;
    }
    if (!arquivoBase64) return { ok: false, msg: "Anexe o comprovante (imagem ou PDF)." };

    const rec = {
      id: newId(),
      status: STATUS.PENDENTE,
      cpf,
      nomeCliente: String(payload.nomeCliente || "").trim(),
      protocolo: proto,
      dataPagamento: data,
      valor,
      nomeArquivo: String(payload.nomeArquivo || "comprovante"),
      mimeType,
      arquivoBase64,
      enviadoEm: new Date().toISOString(),
      iaValidacao: null,
      confirmadoPorCpf: "",
      confirmadoPorNome: "",
      confirmadoEm: "",
      origem: "app_cliente",
    };
    const all = loadAll();
    all.unshift(rec);
    saveAll(all);
    return { ok: true, id: rec.id, rec };
  }

  function listarPorStatus(statusFilter) {
    const all = loadAll();
    if (!statusFilter) return all.filter((r) => r.status !== STATUS.REJEITADO);
    return all.filter((r) => r.status === statusFilter);
  }

  function listarPendentesOperador() {
    return loadAll().filter((r) => r.status === STATUS.PENDENTE || r.status === STATUS.IA_OK);
  }

  function listarPorCliente(cpfDigits) {
    const cpf = onlyDigits(cpfDigits).slice(0, 11);
    return loadAll().filter((r) => onlyDigits(r.cpf) === cpf);
  }

  function getStoredOpenAIKey() {
    return String(localStorage.getItem(OPENAI_KEY_STORAGE) || "").trim();
  }

  function valoresProximos(a, b, tol = 0.02) {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return Math.abs(x - y) <= Math.max(tol, y * 0.01);
  }

  async function validarComprovanteComIA(id) {
    const rec = getById(id);
    if (!rec) return { ok: false, msg: "Registo não encontrado." };
    const key = getStoredOpenAIKey();
    if (!key) {
      return {
        ok: false,
        msg: "Configure a chave OpenAI no painel DK (cadastro de lançamentos) ou em Operação → defina dk_openai_api_key no navegador.",
      };
    }

    const schema =
      '{"nomeClienteOuBeneficiario":string|null,"nomePagador":string|null,"cpf":string|null,"placaVeiculo":string|null,"dataPagamento":string|null,"valor":number|null,"pagamentoPorTerceiro":boolean}';
    const instr = `Leitor de comprovante PIX/TED/boleto em português. Responda APENAS JSON: ${schema}. CPF 11 dígitos. data dd/mm/aaaa. Compare com dados declarados pelo cliente: CPF ${rec.cpf}, protocolo ${rec.protocolo}, data ${rec.dataPagamento}, valor ${rec.valor}.`;

    const content = [{ type: "text", text: instr }];
    const { mime, base64 } = parseDataUrl(rec.arquivoBase64);
    if (mime.startsWith("image/") && base64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${base64}` },
      });
    } else {
      content.push({
        type: "text",
        text: `Comprovante em PDF (${rec.nomeArquivo}). Valide com os dados declarados: valor ${currencyBRL(rec.valor)}, data ${rec.dataPagamento}, cliente CPF ${rec.cpf}, protocolo ${rec.protocolo}.`,
      });
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
          max_tokens: 900,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 200) || String(res.status));
      }
      const data = await res.json();
      let raw = String(data.choices?.[0]?.message?.content || "").trim();
      const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
      if (fence) raw = fence[1].trim();
      const extr = JSON.parse(raw);
      const valorIa = parseCurrencyBR(extr.valor);
      const cpfIa = onlyDigits(extr.cpf).slice(0, 11);
      const ia = {
        validadoEm: new Date().toISOString(),
        nomeClienteOuBeneficiario: String(extr.nomeClienteOuBeneficiario || "").trim(),
        nomePagador: String(extr.nomePagador || "").trim(),
        cpf: cpfIa,
        placaVeiculo: String(extr.placaVeiculo || "").trim(),
        dataPagamento: String(extr.dataPagamento || "").trim(),
        valor: valorIa,
        pagamentoPorTerceiro: Boolean(extr.pagamentoPorTerceiro),
        confereValor: valoresProximos(valorIa, rec.valor),
        confereData:
          !extr.dataPagamento ||
          String(extr.dataPagamento).trim() === rec.dataPagamento ||
          parseBrDate(extr.dataPagamento)?.getTime() === parseBrDate(rec.dataPagamento)?.getTime(),
        confereCpf: !cpfIa || cpfIa === rec.cpf,
        observacoes: "",
      };
      if (!ia.confereValor) ia.observacoes += "Valor do comprovante difere do informado pelo cliente. ";
      if (!ia.confereData) ia.observacoes += "Data difere. ";
      if (!ia.confereCpf) ia.observacoes += "CPF no comprovante difere. ";
      if (!ia.observacoes.trim()) ia.observacoes = "IA: dados coerentes com o pedido do cliente.";

      const all = loadAll();
      const idx = all.findIndex((r) => r.id === id);
      if (idx === -1) return { ok: false, msg: "Registo removido." };
      all[idx].iaValidacao = ia;
      all[idx].status = STATUS.IA_OK;
      saveAll(all);
      return { ok: true, ia, rec: all[idx] };
    } catch (err) {
      return { ok: false, msg: err?.message || "Falha na validação com IA." };
    }
  }

  function persistirPagamentoNaLocacao(rec) {
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function") {
      return { ok: false, msg: "Cadastro indisponível." };
    }
    const CAD_LOC = typeof CAD_LOCACOES_KEY !== "undefined" ? CAD_LOCACOES_KEY : "dk_locacoes_cadastro";
    const cpf = onlyDigits(rec.cpf);
    const nc = normProto(rec.protocolo);
    const locs = loadCadastro(CAD_LOC);
    const idx = locs.findIndex((l) => onlyDigits(l.cpf) === cpf && normProto(l.numeroContrato) === nc);
    if (idx === -1) return { ok: false, msg: "Locação não encontrada para este CPF e protocolo." };

    const loc = locs[idx];
    if (!Array.isArray(loc.portalLancamentosAluguel)) {
      const virt =
        typeof window.__DK_getPortalLancamentosAluguelDoContrato === "function"
          ? window.__DK_getPortalLancamentosAluguelDoContrato(loc)
          : [];
      loc.portalLancamentosAluguel = virt.map((v) => ({ ...v }));
    }
    let regCpf = "";
    let regNome = "Operador";
    try {
      const s = JSON.parse(localStorage.getItem("dk_sessao_cliente") || "{}");
      if (s?.tipo === "admin") {
        regCpf = onlyDigits(s.cpf).slice(0, 11);
        regNome = String(s.nome || "Operador").trim();
      }
    } catch {
      /* ignore */
    }
    const entry = {
      data: rec.dataPagamento,
      valor: Number(rec.valor),
      createdAt: Date.now(),
      registradoPorCpf: regCpf,
      registradoPorNome: regNome,
      valorEspecie: 0,
      valorPix: Number(rec.valor),
      valorCartao: 0,
      origemComprovanteClienteId: rec.id,
      confirmadoViaAppCliente: true,
    };
    loc.portalLancamentosAluguel.push(entry);
    loc.updatedAt = Date.now();
    locs[idx] = loc;
    try {
      saveCadastro(CAD_LOC, locs);
    } catch (err) {
      return { ok: false, msg: err?.message || "Erro ao guardar locação." };
    }
    if (typeof window.__DK_pushToCloudAfterSave === "function") window.__DK_pushToCloudAfterSave();
    return { ok: true };
  }

  function confirmarComprovanteCliente(id) {
    const rec = getById(id);
    if (!rec) return { ok: false, msg: "Registo não encontrado." };
    if (rec.status === STATUS.CONFIRMADO) return { ok: false, msg: "Já confirmado." };
    if (rec.status !== STATUS.IA_OK) {
      return { ok: false, msg: "Valide o comprovante com IA antes de confirmar o pagamento." };
    }
    const saveLoc = persistirPagamentoNaLocacao(rec);
    if (!saveLoc.ok) return saveLoc;

    let regCpf = "";
    let regNome = "";
    try {
      const s = JSON.parse(localStorage.getItem("dk_sessao_cliente") || "{}");
      regCpf = onlyDigits(s.cpf).slice(0, 11);
      regNome = String(s.nome || "").trim();
    } catch {
      /* ignore */
    }
    const all = loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx >= 0) {
      all[idx].status = STATUS.CONFIRMADO;
      all[idx].confirmadoPorCpf = regCpf;
      all[idx].confirmadoPorNome = regNome;
      all[idx].confirmadoEm = new Date().toISOString();
      saveAll(all);
    }
    return { ok: true, rec: all[idx] };
  }

  function rejeitarComprovanteCliente(id, motivo) {
    const all = loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return { ok: false, msg: "Não encontrado." };
    all[idx].status = STATUS.REJEITADO;
    all[idx].rejeitadoMotivo = String(motivo || "").trim();
    saveAll(all);
    return { ok: true };
  }

  /** UI operador */
  let comprovanteClienteUiIdAtual = "";

  function statusLabel(st) {
    if (st === STATUS.CONFIRMADO) return "Confirmado";
    if (st === STATUS.IA_OK) return "IA validado — aguarda confirmação";
    if (st === STATUS.REJEITADO) return "Rejeitado";
    return "Pendente";
  }

  function renderListaOperador() {
    const wrap = document.getElementById("portalComprovanteClienteLista");
    if (!wrap) return;
    const rows = listarPendentesOperador();
    if (!rows.length) {
      wrap.innerHTML =
        '<p class="subtext">Nenhum comprovante enviado pelo app do cliente neste navegador. Peça ao cliente usar <strong>Enviar comprovante</strong> no telemóvel (os dados sincronizam pela nuvem).</p>';
      return;
    }
    wrap.innerHTML = `<table class="portal-lanc-hist portal-comprovante-cliente-table" aria-label="Comprovantes do cliente">
      <thead><tr><th>Data envio</th><th>Cliente</th><th>Protocolo</th><th>Valor</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows
        .map((r) => {
          const env = r.enviadoEm ? new Date(r.enviadoEm).toLocaleString("pt-BR") : "—";
          return `<tr>
            <td>${escapeHtml(env)}</td>
            <td>${escapeHtml(r.nomeCliente || r.cpf)}</td>
            <td>${escapeHtml(r.protocolo)}</td>
            <td>${escapeHtml(currencyBRL(r.valor))}</td>
            <td>${escapeHtml(statusLabel(r.status))}</td>
            <td><button type="button" class="btn-primary btn-secondary-outline" data-cc-abrir="${escapeHtml(r.id)}">Abrir</button></td>
          </tr>`;
        })
        .join("")}</tbody></table>`;
  }

  function fillDetalheModal(rec) {
    comprovanteClienteUiIdAtual = rec.id;
    const el = document.getElementById("portalComprovanteClienteDetalheCorpo");
    if (!el) return;
    const ia = rec.iaValidacao;
    const iaHtml = ia
      ? `<div class="portal-cc-ia-resumo">
          <p><strong>Validação IA</strong> (${escapeHtml(ia.validadoEm ? new Date(ia.validadoEm).toLocaleString("pt-BR") : "")})</p>
          <p>Valor IA: ${escapeHtml(currencyBRL(ia.valor))} ${ia.confereValor ? "✓" : "⚠"}</p>
          <p>Data IA: ${escapeHtml(ia.dataPagamento || "—")} ${ia.confereData ? "✓" : "⚠"}</p>
          <p>CPF IA: ${escapeHtml(ia.cpf || "—")} ${ia.confereCpf ? "✓" : "⚠"}</p>
          <p class="subtext">${escapeHtml(ia.observacoes || "")}</p>
        </div>`
      : '<p class="subtext">IA ainda não executada neste comprovante.</p>';

    el.innerHTML = `
      <p><strong>Cliente:</strong> ${escapeHtml(rec.nomeCliente)} · CPF ${escapeHtml(rec.cpf)}</p>
      <p><strong>Protocolo:</strong> ${escapeHtml(rec.protocolo)}</p>
      <p><strong>Data pagamento (cliente):</strong> ${escapeHtml(rec.dataPagamento)}</p>
      <p><strong>Valor (cliente):</strong> ${escapeHtml(currencyBRL(rec.valor))}</p>
      <p><strong>Ficheiro:</strong> ${escapeHtml(rec.nomeArquivo)}</p>
      <p><strong>Enviado em:</strong> ${escapeHtml(rec.enviadoEm ? new Date(rec.enviadoEm).toLocaleString("pt-BR") : "—")}</p>
      ${iaHtml}
    `;

    const btnIa = document.getElementById("portalComprovanteClienteBtnIA");
    const btnConf = document.getElementById("portalComprovanteClienteBtnConfirmar");
    const btnVer = document.getElementById("portalComprovanteClienteBtnVerArquivo");
    if (btnIa) btnIa.disabled = rec.status === STATUS.CONFIRMADO;
    if (btnConf) btnConf.disabled = rec.status !== STATUS.IA_OK;
    if (btnVer) btnVer.disabled = !rec.arquivoBase64;
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove("hidden");
      m.setAttribute("aria-hidden", "false");
    }
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add("hidden");
      m.setAttribute("aria-hidden", "true");
    }
  }

  function openDetalhe(id) {
    const rec = getById(id);
    if (!rec) return;
    fillDetalheModal(rec);
    openModal("portalComprovanteClienteDetalheModal");
  }

  function openViewer() {
    const rec = getById(comprovanteClienteUiIdAtual);
    const body = document.getElementById("portalComprovanteClienteViewerBody");
    if (!rec || !body) return;
    const url = rec.arquivoBase64;
    if (!url) {
      body.innerHTML = '<p class="subtext">Sem ficheiro.</p>';
    } else if (String(rec.mimeType || "").includes("pdf")) {
      body.innerHTML = `<iframe src="${url}" class="portal-cc-viewer-frame" title="Comprovante PDF"></iframe>`;
    } else {
      body.innerHTML = `<img src="${url}" alt="Comprovante" class="portal-cc-viewer-img">`;
    }
    openModal("portalComprovanteClienteViewerModal");
  }

  function bindOperadorUi() {
    document.getElementById("portalComprovanteClienteLista")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cc-abrir]");
      if (!btn) return;
      openDetalhe(btn.getAttribute("data-cc-abrir"));
    });

    document.getElementById("portalComprovanteClienteBtnVerArquivo")?.addEventListener("click", () => openViewer());

    document.getElementById("portalComprovanteClienteBtnIA")?.addEventListener("click", async () => {
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      if (fb) fb.textContent = "A validar com IA…";
      const res = await validarComprovanteComIA(comprovanteClienteUiIdAtual);
      if (fb) fb.textContent = res.ok ? "Validação IA concluída." : res.msg || "Falha.";
      if (res.ok) {
        fillDetalheModal(getById(comprovanteClienteUiIdAtual));
        renderListaOperador();
      }
    });

    document.getElementById("portalComprovanteClienteBtnConfirmar")?.addEventListener("click", () => {
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      const res = confirmarComprovanteCliente(comprovanteClienteUiIdAtual);
      if (fb) fb.textContent = res.ok ? "Pagamento confirmado e registado no protocolo." : res.msg || "Erro.";
      if (res.ok) {
        renderListaOperador();
        closeModal("portalComprovanteClienteDetalheModal");
        if (typeof window.__DK_refreshOperacaoLancAluguelFromComprovante === "function") {
          window.__DK_refreshOperacaoLancAluguelFromComprovante(res.rec);
        }
      }
    });

    document.getElementById("portalComprovanteClienteBtnRejeitar")?.addEventListener("click", () => {
      const motivo = window.prompt("Motivo da rejeição (opcional):") || "";
      const res = rejeitarComprovanteCliente(comprovanteClienteUiIdAtual, motivo);
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      if (fb) fb.textContent = res.ok ? "Comprovante rejeitado." : res.msg;
      if (res.ok) {
        renderListaOperador();
        closeModal("portalComprovanteClienteDetalheModal");
      }
    });

    document.querySelectorAll("[data-close-cc-detalhe]").forEach((el) => {
      el.addEventListener("click", () => closeModal("portalComprovanteClienteDetalheModal"));
    });
    document.querySelectorAll("[data-close-cc-viewer]").forEach((el) => {
      el.addEventListener("click", () => closeModal("portalComprovanteClienteViewerModal"));
    });
    document.getElementById("portalComprovanteClienteBtnAtualizarLista")?.addEventListener("click", async () => {
      const fb = document.getElementById("portalComprovanteClienteListaMsg");
      if (fb) fb.textContent = "A carregar da nuvem…";
      try {
        if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
          await window.__DK_pullCloudSnapshotSilentMerge();
        }
      } catch {
        /* ignore */
      }
      renderListaOperador();
      if (fb) fb.textContent = "Lista atualizada.";
    });
  }

  function initOperadorUi() {
    bindOperadorUi();
    renderListaOperador();
  }

  window.__DK_comprovantesClienteAdd = adicionarComprovanteCliente;
  window.__DK_comprovantesClienteListPendentes = listarPendentesOperador;
  window.__DK_comprovantesClienteListByCpf = listarPorCliente;
  window.__DK_comprovantesClienteGet = getById;
  window.__DK_comprovantesClienteValidateIA = validarComprovanteComIA;
  window.__DK_comprovantesClienteConfirmar = confirmarComprovanteCliente;
  window.__DK_refreshComprovantesClienteLista = renderListaOperador;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOperadorUi);
  } else {
    initOperadorUi();
  }
})();
