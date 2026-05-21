/**
 * Comprovantes enviados pelo App Cliente → nuvem → conferência pelo operador cadastrado (Lançamento de aluguel).
 * A validação com IA é executada pelo funcionário em sessão, não de forma automática.
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

  let openaiServerDisponivel = null;

  async function probeOpenAIServer() {
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true }),
      });
      const data = await res.json();
      openaiServerDisponivel = Boolean(data?.ok && data?.mode === "server");
      return openaiServerDisponivel;
    } catch {
      openaiServerDisponivel = false;
      return false;
    }
  }

  async function refreshOpenAIStatusUi() {
    const el = document.getElementById("portalComprovanteOpenAIStatus");
    if (!el) return;
    el.textContent = "A verificar configuração da IA…";
    const server = await probeOpenAIServer();
    const local = getStoredOpenAIKey();
    if (server) {
      el.innerHTML =
        "✓ <strong>IA automática</strong> — chave no servidor (Vercel). Pode usar <strong>Conferir comprovante (IA)</strong>.";
      return;
    }
    if (local) {
      el.textContent =
        "✓ Chave guardada neste navegador. Pode usar Conferir comprovante (IA). (Para todos os PCs: configure OPENAI_API_KEY na Vercel.)";
      return;
    }
    el.innerHTML =
      'IA ainda não configurada. Na <strong>Vercel</strong> → Environment Variables → <code>OPENAI_API_KEY</code> → <strong>Redeploy</strong>. Ou expanda «Chave OpenAI só neste navegador» abaixo.';
  }

  function bindOpenAIKeyUi() {
    const saveBtn = document.getElementById("portalComprovanteOpenAIKeySave");
    const clearBtn = document.getElementById("portalComprovanteOpenAIKeyClear");
    const input = document.getElementById("portalComprovanteOpenAIKey");
    if (!saveBtn || saveBtn.dataset.bound === "1") return;
    saveBtn.dataset.bound = "1";

    saveBtn.addEventListener("click", () => {
      const k = String(input?.value || "").trim();
      if (!k) {
        refreshOpenAIStatusUi();
        return;
      }
      localStorage.setItem(OPENAI_KEY_STORAGE, k);
      if (input) input.value = "";
      refreshOpenAIStatusUi();
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      if (fb) fb.textContent = "Chave OpenAI guardada neste navegador.";
    });

    clearBtn?.addEventListener("click", () => {
      localStorage.removeItem(OPENAI_KEY_STORAGE);
      if (input) input.value = "";
      refreshOpenAIStatusUi();
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      if (fb) fb.textContent = "Chave removida deste navegador.";
    });
  }

  async function chamarOpenAIComprovante(content) {
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.parsed) {
        return { ok: true, parsed: data.parsed, via: "server" };
      }
      if (data?.reason !== "openai_not_configured" && !res.ok) {
        const errMsg = String(data?.error || data?.reason || res.status);
        return { ok: false, msg: `Servidor IA: ${errMsg}` };
      }
    } catch (err) {
      /* tenta chave local */
    }

    const key = getStoredOpenAIKey();
    if (!key) {
      return {
        ok: false,
        msg: "IA não configurada. Defina OPENAI_API_KEY na Vercel (redeploy) ou guarde a chave no bloco «Chave OpenAI só neste navegador».",
      };
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
      return { ok: true, parsed: JSON.parse(raw), via: "browser" };
    } catch (err) {
      return { ok: false, msg: err?.message || "Falha na chamada OpenAI." };
    }
  }

  function exigirOperadorConferencia() {
    if (typeof window.__DK_portalOperadorPodeConferirComprovanteCliente === "function") {
      return window.__DK_portalOperadorPodeConferirComprovanteCliente();
    }
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) {
        return {
          ok: false,
          msg: "Inicie sessão na Área da Empresa com colaborador ou administrador cadastrado.",
        };
      }
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin") {
        return { ok: false, msg: "A conferência só pode ser feita por funcionário com sessão ativa." };
      }
      const cpf = onlyDigits(s.cpf).slice(0, 11);
      const nome = String(s.nome || "").trim();
      if (cpf.length !== 11 || !nome) {
        return { ok: false, msg: "Sessão do operador inválida. Entre novamente." };
      }
      return { ok: true, operador: { cpf, nome, role: String(s.role || "operacao").trim() } };
    } catch {
      return { ok: false, msg: "Sessão não encontrada." };
    }
  }

  function valoresProximos(a, b, tol = 0.02) {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return Math.abs(x - y) <= Math.max(tol, y * 0.01);
  }

  function valorInformadoDivergeDaIA(rec) {
    const ia = rec?.iaValidacao;
    return Boolean(ia && ia.confereValor === false);
  }

  function operadorEhAdministradorTitular() {
    return (
      typeof window.__DK_isPortalTitularAdministrador === "function" &&
      window.__DK_isPortalTitularAdministrador()
    );
  }

  function validarSenhaAdministradorPortal(senha) {
    if (typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess)) {
      return false;
    }
    const s = String(senha || "").trim();
    if (!s) return false;
    return funcionariosAccess.some(
      (f) => String(f.role || "").trim() === "owner" && String(f.senha || "").trim() === s
    );
  }

  function autorizarConfirmacaoComDivergencia(rec, adminSenha) {
    if (!valorInformadoDivergeDaIA(rec)) return { ok: true };
    if (operadorEhAdministradorTitular()) return { ok: true };
    if (validarSenhaAdministradorPortal(adminSenha)) return { ok: true };
    return {
      ok: false,
      msg: "Valor do cliente difere do comprovante (IA). Informe a senha do administrador para registar o pagamento com o valor lido na imagem.",
    };
  }

  /** Valor que entra no protocolo: se divergiu e foi autorizado, usa o lido pela IA. */
  function valorParaRegistoPagamento(rec) {
    const ia = rec?.iaValidacao;
    if (
      valorInformadoDivergeDaIA(rec) &&
      ia &&
      Number.isFinite(Number(ia.valor)) &&
      Number(ia.valor) > 0
    ) {
      return Number(ia.valor);
    }
    return Number(rec.valor);
  }

  function refreshAdminSenhaUi(rec) {
    const wrap = document.getElementById("portalComprovanteAdminSenhaWrap");
    const inp = document.getElementById("portalComprovanteAdminSenha");
    const diverge = valorInformadoDivergeDaIA(rec);
    if (wrap) wrap.classList.toggle("hidden", !diverge);
    if (inp) {
      if (!diverge) inp.value = "";
      inp.required = diverge && !operadorEhAdministradorTitular();
    }
  }

  async function validarComprovanteComIA(id) {
    const gate = exigirOperadorConferencia();
    if (!gate.ok) return { ok: false, msg: gate.msg };
    const operador = gate.operador;

    const rec = getById(id);
    if (!rec) return { ok: false, msg: "Registo não encontrado." };
    if (rec.status === STATUS.CONFIRMADO) {
      return { ok: false, msg: "Pagamento já confirmado." };
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
      const oai = await chamarOpenAIComprovante(content);
      if (!oai.ok) return { ok: false, msg: oai.msg };
      const extr = oai.parsed;
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
      if (!ia.observacoes.trim()) ia.observacoes = "Conferência IA: dados coerentes com o pedido do cliente.";

      ia.conferidoPorCpf = operador.cpf;
      ia.conferidoPorNome = operador.nome;
      ia.conferidoPorRole = operador.role;

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

  function persistirPagamentoNaLocacao(rec, valorRegisto) {
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
    const valorNum = Number(valorRegisto ?? valorParaRegistoPagamento(rec));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return { ok: false, msg: "Valor do pagamento inválido." };
    }
    const entry = {
      data: rec.dataPagamento,
      valor: valorNum,
      createdAt: Date.now(),
      registradoPorCpf: regCpf,
      registradoPorNome: regNome,
      valorEspecie: 0,
      valorPix: valorNum,
      valorCartao: 0,
      origemComprovanteClienteId: rec.id,
      confirmadoViaAppCliente: true,
      valorInformadoCliente: Number(rec.valor),
      valorLidoIA: rec.iaValidacao ? Number(rec.iaValidacao.valor) : undefined,
      registroComValorComprovanteIA: valorInformadoDivergeDaIA(rec),
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

  function confirmarComprovanteCliente(id, opts) {
    const gate = exigirOperadorConferencia();
    if (!gate.ok) return { ok: false, msg: gate.msg };

    const rec = getById(id);
    if (!rec) return { ok: false, msg: "Registo não encontrado." };
    if (rec.status === STATUS.CONFIRMADO) return { ok: false, msg: "Já confirmado." };
    if (rec.status !== STATUS.IA_OK) {
      return {
        ok: false,
        msg: "Faça a conferência do comprovante (IA) antes de confirmar o pagamento no protocolo.",
      };
    }

    const adminSenha =
      opts?.adminSenha ??
      String(document.getElementById("portalComprovanteAdminSenha")?.value || "").trim();
    const authDiv = autorizarConfirmacaoComDivergencia(rec, adminSenha);
    if (!authDiv.ok) return authDiv;

    const valorRegisto = valorParaRegistoPagamento(rec);
    const saveLoc = persistirPagamentoNaLocacao(rec, valorRegisto);
    if (!saveLoc.ok) return saveLoc;

    const regCpf = gate.operador.cpf;
    const regNome = gate.operador.nome;
    const all = loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx >= 0) {
      all[idx].status = STATUS.CONFIRMADO;
      all[idx].confirmadoPorCpf = regCpf;
      all[idx].confirmadoPorNome = regNome;
      all[idx].confirmadoEm = new Date().toISOString();
      all[idx].valorRegistadoProtocolo = valorRegisto;
      saveAll(all);
      if (typeof window.__DK_clienteNotificacaoPagamentoConfirmado === "function") {
        window.__DK_clienteNotificacaoPagamentoConfirmado({
          cpf: all[idx].cpf,
          protocolo: all[idx].protocolo,
          valor: valorRegisto,
          dataPagamento: all[idx].dataPagamento,
          comprovanteId: all[idx].id,
        });
      }
    }
    return { ok: true, rec: all[idx], valorRegistado: valorRegisto };
  }

  function rejeitarComprovanteCliente(id, motivo) {
    const gate = exigirOperadorConferencia();
    if (!gate.ok) return { ok: false, msg: gate.msg };

    const all = loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return { ok: false, msg: "Não encontrado." };
    all[idx].status = STATUS.REJEITADO;
    all[idx].rejeitadoMotivo = String(motivo || "").trim();
    all[idx].rejeitadoPorCpf = gate.operador.cpf;
    all[idx].rejeitadoPorNome = gate.operador.nome;
    all[idx].rejeitadoEm = new Date().toISOString();
    saveAll(all);
    return { ok: true };
  }

  /** UI operador */
  let comprovanteClienteUiIdAtual = "";

  function statusLabel(st) {
    if (st === STATUS.CONFIRMADO) return "Confirmado pelo operador";
    if (st === STATUS.IA_OK) return "Conferido (IA) — aguarda confirmação";
    if (st === STATUS.REJEITADO) return "Rejeitado pelo operador";
    return "Aguarda conferência do operador";
  }

  function refreshOperadorConferenciaHint() {
    const el = document.getElementById("portalComprovanteClienteOperadorHint");
    if (!el) return;
    const gate = exigirOperadorConferencia();
    if (!gate.ok) {
      el.textContent =
        "Conferência e validação com IA: só com sessão de colaborador ou administrador cadastrado, com permissão de lançamento de aluguel.";
      return;
    }
    el.textContent = `Operador em conferência: ${gate.operador.nome} (CPF ${gate.operador.cpf}). A IA é executada por este funcionário ao conferir o comprovante.`;
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
    const conferidoPor =
      ia && ia.conferidoPorNome
        ? `<p><strong>Conferido por:</strong> ${escapeHtml(ia.conferidoPorNome)}${ia.conferidoPorCpf ? ` · CPF ${escapeHtml(ia.conferidoPorCpf)}` : ""}</p>`
        : "";
    const iaHtml = ia
      ? `<div class="portal-cc-ia-resumo">
          <p><strong>Conferência com IA</strong> (${escapeHtml(ia.validadoEm ? new Date(ia.validadoEm).toLocaleString("pt-BR") : "")})</p>
          ${conferidoPor}
          <p>Valor lido: ${escapeHtml(currencyBRL(ia.valor))} ${ia.confereValor ? "✓" : "⚠"}</p>
          <p>Data lida: ${escapeHtml(ia.dataPagamento || "—")} ${ia.confereData ? "✓" : "⚠"}</p>
          <p>CPF lido: ${escapeHtml(ia.cpf || "—")} ${ia.confereCpf ? "✓" : "⚠"}</p>
          <p class="subtext">${escapeHtml(ia.observacoes || "")}</p>
        </div>`
      : '<p class="subtext">Ainda não conferido. O operador cadastrado deve executar a conferência com IA.</p>';

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
    const btnRej = document.getElementById("portalComprovanteClienteBtnRejeitar");
    const btnVer = document.getElementById("portalComprovanteClienteBtnVerArquivo");
    const podeConferir = exigirOperadorConferencia().ok;
    if (btnIa) btnIa.disabled = rec.status === STATUS.CONFIRMADO || !podeConferir;
    if (btnConf) btnConf.disabled = rec.status !== STATUS.IA_OK || !podeConferir;
    if (btnRej) btnRej.disabled = rec.status === STATUS.CONFIRMADO || !podeConferir;
    if (btnVer) btnVer.disabled = !rec.arquivoBase64;
    refreshAdminSenhaUi(rec);
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
    refreshOpenAIStatusUi();
    openModal("portalComprovanteClienteDetalheModal");
  }

  const CC_VIEWER_ZOOM_MIN = 0.5;
  const CC_VIEWER_ZOOM_MAX = 5;
  const CC_VIEWER_ZOOM_STEP = 0.25;
  const CC_VIEWER_FRAME_BASE_W = 900;
  let ccViewerZoom = 1;

  function getViewerStage() {
    return document.getElementById("portalComprovanteClienteViewerStage");
  }

  function getViewerScroll() {
    return document.getElementById("portalComprovanteClienteViewerScroll");
  }

  function getViewerCard() {
    return document.querySelector("#portalComprovanteClienteViewerModal .portal-modal__card--cc-viewer");
  }

  function applyViewerZoom() {
    const stage = getViewerStage();
    const lbl = document.getElementById("portalComprovanteClienteViewerZoomLbl");
    if (!stage) return;
    stage.style.transform = "";
    const img = stage.querySelector("img");
    const frameWrap = stage.querySelector(".portal-cc-viewer-frame-wrap");
    if (img && img.naturalWidth > 0) {
      img.style.width = `${Math.round(img.naturalWidth * ccViewerZoom)}px`;
      img.style.height = "auto";
    } else if (frameWrap) {
      const w = Math.round(CC_VIEWER_FRAME_BASE_W * ccViewerZoom);
      frameWrap.style.width = `${w}px`;
      const frame = frameWrap.querySelector("iframe");
      if (frame) {
        frame.style.width = "100%";
        frame.style.height = `${Math.round(640 * ccViewerZoom)}px`;
      }
    }
    if (lbl) lbl.textContent = `${Math.round(ccViewerZoom * 100)}%`;
  }

  function setViewerZoom(z) {
    ccViewerZoom = Math.min(CC_VIEWER_ZOOM_MAX, Math.max(CC_VIEWER_ZOOM_MIN, z));
    applyViewerZoom();
  }

  function fitViewerToScrollWidth() {
    const scroll = getViewerScroll();
    const stage = getViewerStage();
    if (!scroll || !stage) return;
    const img = stage.querySelector("img");
    const pad = 24;
    const avail = Math.max(240, scroll.clientWidth - pad);
    if (img && img.naturalWidth > 0) {
      setViewerZoom(Math.min(CC_VIEWER_ZOOM_MAX, Math.max(CC_VIEWER_ZOOM_MIN, avail / img.naturalWidth)));
      return;
    }
    setViewerZoom(Math.min(CC_VIEWER_ZOOM_MAX, Math.max(1, avail / CC_VIEWER_FRAME_BASE_W)));
  }

  /** Abertura legível: preenche altura em capturas verticais (telemóvel) ou largura em paisagem. */
  function fitViewerReadable() {
    const scroll = getViewerScroll();
    const stage = getViewerStage();
    if (!scroll || !stage) return;
    const img = stage.querySelector("img");
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      fitViewerToScrollWidth();
      return;
    }
    const pad = 24;
    const availW = Math.max(240, scroll.clientWidth - pad);
    const availH = Math.max(320, scroll.clientHeight - pad);
    const byW = availW / img.naturalWidth;
    const byH = availH / img.naturalHeight;
    const portrait = img.naturalHeight > img.naturalWidth * 1.15;
    let z = portrait ? Math.max(byH, byW) : Math.max(byW, byH);
    z = Math.min(CC_VIEWER_ZOOM_MAX, Math.max(1, z));
    setViewerZoom(z);
  }

  function toggleViewerFullscreen() {
    const card = getViewerCard();
    if (!card) return;
    const on = !card.classList.contains("is-cc-viewer-fullscreen");
    card.classList.toggle("is-cc-viewer-fullscreen", on);
    window.setTimeout(() => {
      if (on) fitViewerReadable();
      else fitViewerToScrollWidth();
    }, 80);
  }

  function bindViewerZoomUi() {
    const modal = document.getElementById("portalComprovanteClienteViewerModal");
    if (!modal || modal.dataset.ccZoomBound === "1") return;
    modal.dataset.ccZoomBound = "1";

    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cc-zoom]");
      if (!btn) return;
      const act = btn.getAttribute("data-cc-zoom");
      if (act === "in") setViewerZoom(ccViewerZoom + CC_VIEWER_ZOOM_STEP);
      else if (act === "out") setViewerZoom(ccViewerZoom - CC_VIEWER_ZOOM_STEP);
      else if (act === "reset") setViewerZoom(1);
      else if (act === "fit") fitViewerToScrollWidth();
      else if (act === "readable") fitViewerReadable();
      else if (act === "fullscreen") toggleViewerFullscreen();
    });

    const scroll = getViewerScroll();
    scroll?.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        setViewerZoom(ccViewerZoom + (e.deltaY < 0 ? CC_VIEWER_ZOOM_STEP : -CC_VIEWER_ZOOM_STEP));
      },
      { passive: false }
    );

    scroll?.addEventListener("dblclick", (e) => {
      const img = e.target.closest(".portal-cc-viewer-img");
      if (!img) return;
      if (ccViewerZoom < 1.75) fitViewerReadable();
      else setViewerZoom(1);
    });
  }

  function openViewer() {
    const rec = getById(comprovanteClienteUiIdAtual);
    const stage = getViewerStage();
    const linkAbrir = document.getElementById("portalComprovanteClienteViewerAbrir");
    if (!rec || !stage) return;
    const url = rec.arquivoBase64;
    getViewerCard()?.classList.remove("is-cc-viewer-fullscreen");
    ccViewerZoom = 1;
    applyViewerZoom();

    if (!url) {
      stage.innerHTML = '<p class="subtext">Sem ficheiro.</p>';
      if (linkAbrir) {
        linkAbrir.href = "#";
        linkAbrir.classList.add("hidden");
      }
    } else if (String(rec.mimeType || "").includes("pdf")) {
      stage.innerHTML = `<div class="portal-cc-viewer-frame-wrap"><iframe src="${url}" class="portal-cc-viewer-frame" title="Comprovante PDF"></iframe></div>`;
      if (linkAbrir) {
        linkAbrir.href = url;
        linkAbrir.classList.remove("hidden");
      }
      window.setTimeout(() => fitViewerReadable(), 120);
    } else {
      stage.innerHTML = `<img src="${url}" alt="Comprovante" class="portal-cc-viewer-img">`;
      if (linkAbrir) {
        linkAbrir.href = url;
        linkAbrir.classList.remove("hidden");
      }
      const img = stage.querySelector("img");
      const onReady = () => {
        fitViewerReadable();
        scrollComprovanteAoCentro();
      };
      if (img) {
        if (img.complete && img.naturalWidth) onReady();
        else img.addEventListener("load", onReady, { once: true });
      }
    }
    openModal("portalComprovanteClienteViewerModal");
    window.setTimeout(() => fitViewerReadable(), 200);
  }

  function scrollComprovanteAoCentro() {
    const scroll = getViewerScroll();
    if (!scroll) return;
    scroll.scrollTop = Math.max(0, (scroll.scrollHeight - scroll.clientHeight) / 2);
    scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
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
      if (fb) fb.textContent = "A conferir comprovante com IA…";
      const res = await validarComprovanteComIA(comprovanteClienteUiIdAtual);
      if (fb) fb.textContent = res.ok ? "Conferência com IA registada pelo operador." : res.msg || "Falha.";
      if (res.ok) {
        fillDetalheModal(getById(comprovanteClienteUiIdAtual));
        renderListaOperador();
      }
    });

    document.getElementById("portalComprovanteClienteBtnConfirmar")?.addEventListener("click", () => {
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      const adminSenha = String(document.getElementById("portalComprovanteAdminSenha")?.value || "").trim();
      const res = confirmarComprovanteCliente(comprovanteClienteUiIdAtual, { adminSenha });
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
    bindViewerZoomUi();
    bindOpenAIKeyUi();
    refreshOperadorConferenciaHint();
    renderListaOperador();
    probeOpenAIServer();
  }

  window.__DK_comprovantesClienteAdd = adicionarComprovanteCliente;
  window.__DK_comprovantesClienteListPendentes = listarPendentesOperador;
  window.__DK_comprovantesClienteListByCpf = listarPorCliente;
  window.__DK_comprovantesClienteGet = getById;
  window.__DK_comprovantesClienteValidateIA = validarComprovanteComIA;
  window.__DK_comprovantesClienteConfirmar = confirmarComprovanteCliente;
  window.__DK_refreshComprovantesClienteLista = function refreshComprovantesClienteLista() {
    refreshOperadorConferenciaHint();
    renderListaOperador();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOperadorUi);
  } else {
    initOperadorUi();
  }
})();
