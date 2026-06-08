/**
 * App Grupo DK — entrada: Visitante | Cliente | Funcionário.
 */
(function dkAppEntry() {
  const GATE_KEY = "dk_cliente_app_gate_v1";
  const GATE_PERSIST = "dk_cliente_gate_persist";

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
      const q = new URLSearchParams({ gate: "1", cpf, protocolo: String(protoRaw || "").trim() });
      const isDemo =
        window.__DK_IS_DEMO_DEPLOY__ === true || String(window.__DK_DEPLOY_CHANNEL__ || "") === "demo";
      if (isDemo) q.set("channel", "demo");
      const res = await fetch(`/api/cadastro-clientes?${q.toString()}`, {
        headers: isDemo ? { "X-DK-Deploy-Channel": "demo" } : {},
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
      localStorage.setItem(GATE_PERSIST, payload);
    } catch {
      /* ignore */
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
      if (status) status.textContent = "Toque em «Instalar app Grupo DK».";
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
        await deferred.userChoice.catch(() => {});
        deferred = null;
        return;
      }
      if (manual) manual.open = true;
      if (status) {
        status.textContent =
          "Se o botão automático não aparecer, use a instalação manual abaixo (Chrome ⋮ ou Safari partilhar).";
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
