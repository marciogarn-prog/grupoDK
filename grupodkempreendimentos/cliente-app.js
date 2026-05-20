/**
 * DK Locadora — App do cliente (PWA).
 * Login por CPF; exibe só dados do cliente; partilha comprovante via sistema (Web Share).
 */
(function dkClienteApp() {
  const SESSAO_KEY = "dk_sessao_cliente_app";
  const CLIENTE_APP_GATE_KEY = "dk_cliente_app_gate";
  const COMPROVANTES_KEY = "dk_cliente_comprovantes_enviados";
  const CAD_CLIENTES_KEY = "dk_clientes_cadastro";
  const CAD_LOCACOES_KEY = "dk_locacoes_cadastro";

  const MOCK_CLIENTES = [
    { cpf: "11111111111", senha: "1234", nome: "Joao Silva" },
    { cpf: "22222222222", senha: "1234", nome: "Ana Souza" },
    { cpf: "00000000001", senha: "123456", nome: "TESTE-001" },
  ];

  const $ = (id) => document.getElementById(id);

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function formatCpf(digits) {
    const d = onlyDigits(digits).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function parseBrDate(s) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(s);
    const raw = String(s || "").trim();
    if (!raw) return null;
    if (raw.includes("/")) {
      const [day, month, year] = raw.split("/").map(Number);
      if (!day || !month || !year) return null;
      return new Date(year, month - 1, day);
    }
    const dig = onlyDigits(raw);
    if (dig.length === 8) {
      return new Date(Number(dig.slice(4)), Number(dig.slice(2, 4)) - 1, Number(dig.slice(0, 2)));
    }
    return null;
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
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function getSessao() {
    try {
      return JSON.parse(localStorage.getItem(SESSAO_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSessao(data) {
    localStorage.setItem(SESSAO_KEY, JSON.stringify(data));
  }

  function clearSessao() {
    localStorage.removeItem(SESSAO_KEY);
  }

  function loadCadastro(key) {
    return loadJson(key, []);
  }

  function findClienteLogin(cpfDigits, senha) {
    const mock = MOCK_CLIENTES.find((c) => c.cpf === cpfDigits && c.senha === senha);
    if (mock) return { cpf: cpfDigits, nome: mock.nome, origem: "mock" };

    const row = loadCadastro(CAD_CLIENTES_KEY).find((c) => onlyDigits(c.cpf) === cpfDigits);
    if (!row) return null;
    const pass = String(row.senha || "123456").trim();
    if (pass !== senha) return null;
    return {
      cpf: cpfDigits,
      nome: String(row.nome || "").trim() || "Cliente",
      origem: "cadastro",
      row,
    };
  }

  function normNc(nc) {
    return String(nc || "")
      .replace(/\D/g, "")
      .trim();
  }

  function getLancamentosFromLoc(loc) {
    const out = [];
    const push = (arr, tipo) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((x) => {
        if (!x || typeof x !== "object") return;
        const data = String(x.data || x.dataPagamento || "").trim();
        let valor = typeof x.valor === "number" ? x.valor : parseCurrencyBR(x.valor ?? x.valorPago);
        if (!Number.isFinite(valor) || valor <= 0) return;
        out.push({ data, valor, tipo, protocolo: normNc(loc.numeroContrato) });
      });
    };
    push(loc.lancamentosAluguel, "Aluguel");
    push(loc.portalLancamentosAluguel, "Aluguel");
    push(loc.lancamentos, "Aluguel");
    return out;
  }

  function loadDadosCliente(cpfDigits) {
    const clienteRow =
      loadCadastro(CAD_CLIENTES_KEY).find((c) => onlyDigits(c.cpf) === cpfDigits) || null;
    const locacoes = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === cpfDigits);
    const veiculos = loadCadastro("dk_veiculos_cadastro");
    const pagamentos = [];
    locacoes.forEach((loc) => {
      getLancamentosFromLoc(loc).forEach((p) => pagamentos.push({ ...p, placa: String(loc.placa || "").trim() }));
    });
    pagamentos.sort((a, b) => {
      const da = parseBrDate(a.data)?.getTime() || 0;
      const db = parseBrDate(b.data)?.getTime() || 0;
      return db - da;
    });
    return { clienteRow, locacoes, veiculos, pagamentos };
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function showView(name) {
    $("view-login")?.classList.toggle("hidden", name !== "login");
    $("view-app")?.classList.toggle("hidden", name !== "app");
  }

  function formatDateMask(value) {
    const digits = onlyDigits(String(value || "")).slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function formatCurrencyMask(value) {
    const digits = onlyDigits(String(value ?? "")).slice(0, 14);
    if (!digits) return "";
    return currencyBRL(Number(digits) / 100);
  }

  function bindCompMasks() {
    const d = $("comp-data");
    const v = $("comp-valor");
    if (d && d.dataset.dkDateMask !== "1") {
      d.dataset.dkDateMask = "1";
      const applyD = () => {
        d.value = formatDateMask(d.value);
      };
      d.addEventListener("input", applyD);
      d.addEventListener("blur", applyD);
    }
    if (v && v.dataset.dkCurrencyMask !== "1") {
      v.dataset.dkCurrencyMask = "1";
      v.addEventListener("input", () => {
        v.value = formatCurrencyMask(v.value);
      });
      v.addEventListener("blur", () => {
        const n = parseCurrencyBR(v.value);
        v.value = n > 0 ? currencyBRL(n) : "";
      });
    }
  }

  function fillProtocoloSelect(locacoes) {
    const sel = $("comp-protocolo");
    if (!sel) return;
    sel.replaceChildren();
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Selecione o protocolo";
    sel.appendChild(opt0);
    locacoes.forEach((loc) => {
      const nc = normNc(loc.numeroContrato);
      if (!nc) return;
      const o = document.createElement("option");
      o.value = nc;
      o.textContent = `${nc} · ${String(loc.placa || "").trim() || "—"}`;
      sel.appendChild(o);
    });
  }

  function renderApp(sessao) {
    const cpf = sessao.cpf;
    const dados = loadDadosCliente(cpf);
    $("cliente-nome").textContent = sessao.nome;
    $("cliente-cpf-label").textContent = formatCpf(cpf);

    const resumo = $("cliente-resumo");
    if (resumo) {
      const nLoc = dados.locacoes.length;
      const nPag = dados.pagamentos.length;
      const total = dados.pagamentos.reduce((s, p) => s + p.valor, 0);
      resumo.innerHTML = `<p><strong>${nLoc}</strong> contrato(s) · <strong>${nPag}</strong> pagamento(s) registado(s) · total <strong>${currencyBRL(total)}</strong></p>`;
    }

    const lista = $("cliente-contratos");
    if (lista) {
      if (!dados.locacoes.length) {
        lista.innerHTML =
          '<p class="subtext">Nenhuma locação encontrada para este CPF neste dispositivo. Use <strong>Atualizar da nuvem</strong> se acabou de pagar.</p>';
      } else {
        lista.innerHTML = dados.locacoes
          .map((loc) => {
            const nc = normNc(loc.numeroContrato);
            const pagos = dados.pagamentos.filter((p) => p.protocolo === nc);
            const pagosHtml = pagos.length
              ? pagos
                  .map(
                    (p) =>
                      `<div class="cliente-pagamento-row"><span>${escapeHtml(p.data)}</span><span>${currencyBRL(p.valor)}</span></div>`
                  )
                  .join("")
              : '<p class="subtext">Sem pagamentos registados neste protocolo.</p>';
            return `<article class="cliente-protocolo">
              <div class="cliente-protocolo__head">Protocolo ${escapeHtml(nc)}</div>
              <p class="cliente-protocolo__meta">Placa ${escapeHtml(loc.placa || "—")} · Início ${escapeHtml(String(loc.inicio || "—"))}${loc.fim ? ` · Fim ${escapeHtml(String(loc.fim))}` : " · Em curso"}</p>
              ${pagosHtml}
            </article>`;
          })
          .join("");
      }
    }

    fillProtocoloSelect(dados.locacoes);
    bindCompMasks();
  }

  async function pullNuvem() {
    const msg = $("sync-msg");
    if (msg) msg.textContent = "A sincronizar…";
    try {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
        if (msg) msg.textContent = "Dados atualizados da nuvem.";
      } else {
        if (msg) msg.textContent = "Nuvem indisponível neste dispositivo.";
      }
    } catch (e) {
      if (msg) msg.textContent = String(e?.message || "Falha ao carregar da nuvem.");
    }
    const sessao = getSessao();
    if (sessao) renderApp(sessao);
  }

  let comprovanteFile = null;

  function onComprovanteFileChange() {
    const input = $("comp-arquivo");
    const preview = $("comp-preview");
    const file = input?.files?.[0];
    comprovanteFile = file || null;
    if (!preview) return;
    if (!file) {
      preview.classList.remove("is-visible");
      preview.removeAttribute("src");
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.classList.add("is-visible");
  }

  async function shareComprovante() {
    const sessao = getSessao();
    if (!sessao) return;
    const proto = normNc($("comp-protocolo")?.value);
    const data = String($("comp-data")?.value || "").trim();
    const valor = parseCurrencyBR($("comp-valor")?.value);
    const msg = $("comp-msg");
    if (!proto) {
      if (msg) msg.textContent = "Selecione o protocolo.";
      return;
    }
    if (!data || !parseBrDate(data)) {
      if (msg) msg.textContent = "Informe a data do pagamento (DD/MM/AAAA).";
      return;
    }
    if (valor <= 0) {
      if (msg) msg.textContent = "Informe o valor pago.";
      return;
    }
    if (!comprovanteFile) {
      if (msg) msg.textContent = "Anexe a imagem ou PDF do comprovante.";
      return;
    }

    const texto = `Comprovante DK Locadora\nCliente: ${sessao.nome}\nCPF: ${formatCpf(sessao.cpf)}\nProtocolo: ${proto}\nData pagamento: ${data}\nValor: ${currencyBRL(valor)}`;

    const hist = loadJson(COMPROVANTES_KEY, []);
    hist.unshift({
      id: Date.now(),
      cpf: sessao.cpf,
      protocolo: proto,
      data,
      valor,
      nomeArquivo: comprovanteFile.name,
      enviadoEm: new Date().toISOString(),
    });
    saveJson(COMPROVANTES_KEY, hist.slice(0, 50));

    try {
      if (navigator.share) {
        const payload = { title: "Comprovante DK Locadora", text: texto };
        if (navigator.canShare && navigator.canShare({ files: [comprovanteFile] })) {
          payload.files = [comprovanteFile];
        }
        await navigator.share(payload);
        if (msg) msg.textContent = "Comprovante partilhado. Escolha WhatsApp, e-mail ou outro app.";
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        if (msg) msg.textContent = "Partilha cancelada.";
        return;
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        if (msg) msg.textContent = "Texto copiado. Envie o ficheiro do comprovante manualmente.";
        return;
      }
    } catch {
      /* ignore */
    }
    window.prompt("Copie e envie o comprovante:", texto);
  }

  function wireInstall() {
    const btn = $("btn-install-cliente");
    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e;
      btn?.classList.remove("hidden");
    });
    btn?.addEventListener("click", async () => {
      if (!deferred) {
        window.alert("No telemóvel: menu do browser → «Adicionar ao ecrã inicial» / «Instalar app».");
        return;
      }
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      btn?.classList.add("hidden");
    });
  }

  function hasClienteAppDownloadGate() {
    try {
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY);
      if (!raw) return false;
      const g = JSON.parse(raw);
      const cpf = onlyDigits(String(g?.cpf || "")).slice(0, 11);
      const proto = String(g?.proto || "").trim();
      return cpf.length === 11 && Boolean(proto);
    } catch {
      return false;
    }
  }

  function init() {
    if (!hasClienteAppDownloadGate()) {
      window.location.replace("index.html#locadora/cliente");
      return;
    }

    $("form-login")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const cpf = onlyDigits($("login-cpf")?.value).slice(0, 11);
      const senha = String($("login-senha")?.value || "").trim();
      const fb = $("login-feedback");
      if (cpf.length !== 11) {
        if (fb) fb.textContent = "Informe um CPF válido.";
        return;
      }
      const hit = findClienteLogin(cpf, senha);
      if (!hit) {
        if (fb) fb.textContent = "CPF ou senha inválidos.";
        return;
      }
      setSessao({ cpf, nome: hit.nome, loginEm: new Date().toISOString() });
      if (fb) fb.textContent = "";
      showView("app");
      renderApp({ cpf, nome: hit.nome });
    });

    $("btn-logout")?.addEventListener("click", () => {
      clearSessao();
      showView("login");
    });
    $("btn-sync")?.addEventListener("click", () => pullNuvem());
    $("comp-arquivo")?.addEventListener("change", onComprovanteFileChange);
    $("btn-share-comprovante")?.addEventListener("click", () => shareComprovante());

    const cpfIn = $("login-cpf");
    cpfIn?.addEventListener("input", () => {
      const d = onlyDigits(cpfIn.value).slice(0, 11);
      cpfIn.value = formatCpf(d);
    });

    const sessao = getSessao();
    if (sessao?.cpf) {
      showView("app");
      renderApp(sessao);
    } else {
      showView("login");
    }

    wireInstall();
    bindCompMasks();

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./service-worker-cliente.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
