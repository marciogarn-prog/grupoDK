/**
 * App Grupo DK — entrada: Visitante | Cliente | Funcionário.
 */
(function dkAppEntry() {
  const GATE_KEY = "dk_cliente_app_gate";
  const GATE_KEY_LEGACY = "dk_cliente_app_gate_v1";
  const GATE_PERSIST = "dk_cliente_gate_persist";
  const CLIENTE_SESSAO_KEY = "dk_sessao_cliente_app";

  function $(id) {
    return document.getElementById(id);
  }

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normProto(s) {
    return String(s ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function isDemoDeploy() {
    if (window.__DK_IS_DEMO_DEPLOY__ === true) return true;
    if (String(window.__DK_DEPLOY_CHANNEL__ || "") === "demo") return true;
    const h = String(window.location.hostname || "").toLowerCase();
    if (h === "demo.grupodkempreendimentos.com.br") return true;
    if (/^demo\./.test(h)) return true;
    return false;
  }

  function demoFetchHeaders() {
    return isDemoDeploy() ? { "X-DK-Deploy-Channel": "demo" } : {};
  }

  function formatCpfMask(d) {
    const d11 = onlyDigits(d).slice(0, 11);
    if (d11.length <= 3) return d11;
    if (d11.length <= 6) return `${d11.slice(0, 3)}.${d11.slice(3)}`;
    if (d11.length <= 9) return `${d11.slice(0, 3)}.${d11.slice(3, 6)}.${d11.slice(6)}`;
    return `${d11.slice(0, 3)}.${d11.slice(3, 6)}.${d11.slice(6, 9)}-${d11.slice(9)}`;
  }

  function showView(id) {
    document.querySelectorAll(".dk-app-entry.view").forEach((v) => {
      const on = v.id === id;
      v.classList.toggle("hidden", !on);
      v.classList.toggle("view--active", on);
      v.setAttribute("aria-hidden", on ? "false" : "true");
    });
  }

  async function validateClienteRemote(cpf, protoRaw) {
    const proto = normProto(protoRaw);
    try {
      const q = new URLSearchParams({ cpf, protocolo: String(protoRaw || "").trim() });
      if (isDemoDeploy()) q.set("channel", "demo");
      const res = await fetch(`/api/cliente-app-gate?${q.toString()}`, {
        headers: demoFetchHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        return {
          ok: true,
          nome: String(data.nome || "").trim(),
          proto: String(data.proto || proto),
        };
      }
      if (data.msg) return { ok: false, msg: data.msg };
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      msg: "Não foi possível validar. Verifique CPF, protocolo e ligação à internet.",
    };
  }

  function saveClienteGate(cpf, v) {
    const payload = JSON.stringify({
      cpf,
      proto: v.proto,
      nome: v.nome || "",
      at: Date.now(),
    });
    try {
      sessionStorage.setItem(GATE_KEY, payload);
      sessionStorage.setItem(GATE_KEY_LEGACY, payload);
      localStorage.setItem(GATE_PERSIST, payload);
    } catch {
      /* ignore */
    }
  }

  /** PWA Grupo DK abre em app.html — se o cliente já entrou, ir directo para /cliente. */
  function tryResumeClienteApp() {
    try {
      if (sessionStorage.getItem("dk_portal_area_ativa")) return false;
      const sessRaw = localStorage.getItem(CLIENTE_SESSAO_KEY);
      if (sessRaw) {
        const s = JSON.parse(sessRaw);
        if (onlyDigits(s?.cpf).length === 11) {
          window.location.replace("/cliente?source=pwa");
          return true;
        }
      }
      const gateRaw =
        localStorage.getItem(GATE_PERSIST) ||
        sessionStorage.getItem(GATE_KEY) ||
        sessionStorage.getItem(GATE_KEY_LEGACY);
      if (!gateRaw) return false;
      const g = JSON.parse(gateRaw);
      const cpf = onlyDigits(g?.cpf).slice(0, 11);
      const proto = normProto(g?.proto);
      if (cpf.length !== 11 || !proto) return false;
      const q = new URLSearchParams({ source: "pwa", cpf, proto });
      window.location.replace(`/cliente?${q.toString()}`);
      return true;
    } catch {
      return false;
    }
  }

  function wireInstall() {
    const panel = $("dkAppInstallPanel");
    const btn = $("dkAppInstallBtn");
    const status = $("dkAppInstallStatus");
    const manual = $("dkAppInstallManual");
    if (!panel || !btn) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (/[?&]instalar=1/.test(location.search) && !isStandalone) {
      panel.classList.remove("hidden");
    }

    if (typeof window.__DK_ensureLatestPwa === "function") {
      void window.__DK_ensureLatestPwa({ force: true });
    }

    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e;
      panel.classList.remove("hidden");
      if (status) status.textContent = "Clique em «Instalar app Grupo DK» ou use a instalação manual abaixo.";
    });

    window.addEventListener("appinstalled", () => {
      deferred = null;
      if (status) status.textContent = "App instalado. Use o ícone DK no ecrã inicial.";
      panel.classList.add("hidden");
    });

    btn.addEventListener("click", async () => {
      if (typeof window.__DK_ensureLatestPwa === "function") {
        await window.__DK_ensureLatestPwa({ force: true }).catch(() => {});
      }
      if (deferred) {
        deferred.prompt();
        const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
        deferred = null;
        if (choice.outcome === "accepted") return;
      }
      if (manual) manual.open = true;
      if (status) {
        status.textContent =
          "Se o botão automático não aparecer, use a instalação manual abaixo (Windows: ícone ⊕ na barra; Android/iPhone: instruções no painel).";
      }
    });
  }

  $("dkAppBtnVisitante")?.addEventListener("click", () => showView("view-app-visitante"));
  $("dkAppVoltarVisitante")?.addEventListener("click", () => showView("view-app-entry"));

  $("dkAppBtnCliente")?.addEventListener("click", () => showView("view-app-cliente"));
  $("dkAppVoltarCliente")?.addEventListener("click", () => showView("view-app-entry"));

  $("dkAppBtnFuncionario")?.addEventListener("click", () => {
    try {
      sessionStorage.setItem("dk_from_pwa_app", "1");
    } catch {
      /* ignore */
    }
    window.location.replace("/#locadora/empresa/colaborador");
  });

  if (tryResumeClienteApp()) return;

  /** PWA reiniciou em app.html mas sessão do portal ainda está activa — voltar ao portal. */
  (function restaurarPortalSeSessaoAtiva() {
    try {
      const area = sessionStorage.getItem("dk_portal_area_ativa");
      if (!area) return;
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin") return;
      const sub = s.role === "owner" ? "administrador" : "colaborador";
      window.location.replace(`/#locadora/empresa/${sub}`);
    } catch {
      /* ignore */
    }
  })();

  $("dkAppClienteCpf")?.addEventListener("input", (e) => {
    const el = e.target;
    if (!el) return;
    el.value = formatCpfMask(el.value);
  });

  $("dkAppFormCliente")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("dkAppClienteMsg");
    const cpf = onlyDigits($("dkAppClienteCpf")?.value || "").slice(0, 11);
    const protoRaw = $("dkAppClienteProto")?.value || "";
    if (msg) {
      msg.textContent = "";
      msg.classList.remove("portal-feedback--erro");
    }
    if (cpf.length !== 11) {
      if (msg) {
        msg.textContent = "Informe um CPF válido (11 dígitos).";
        msg.classList.add("portal-feedback--erro");
      }
      return;
    }
    if (!String(protoRaw).trim()) {
      if (msg) {
        msg.textContent = "Informe o protocolo da locação.";
        msg.classList.add("portal-feedback--erro");
      }
      return;
    }
    if (msg) msg.textContent = "A validar…";
    const v = await validateClienteRemote(cpf, protoRaw);
    if (!v.ok) {
      if (msg) {
        msg.textContent = v.msg;
        msg.classList.add("portal-feedback--erro");
      }
      return;
    }
    saveClienteGate(cpf, v);
    const q = new URLSearchParams({ instalar: "1", cpf, proto: v.proto });
    window.location.href = `/cliente?${q.toString()}`;
  });

  wireInstall();
})();
