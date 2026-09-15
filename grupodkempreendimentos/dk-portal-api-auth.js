/**
 * Fase 1A — token de API no browser (não é secret de deploy).
 * Guardado após login; enviado em Authorization nas APIs protegidas.
 */
(function dkPortalApiAuth() {
  const KEY = "dk_portal_api_token_v1";
  const DEVICE_KEY = "dk_portal_device_id_v1";
  const CLIENT_PROTOCOL = 20260913;
  const USER_ACTIVE_RECENT_MS = 90 * 1000;
  let lastUserActivityAt = Date.now();

  function getPortalDeviceId() {
    try {
      let id = String(localStorage.getItem(DEVICE_KEY) || "").trim();
      if (id.length >= 16) return id.slice(0, 80);
      const buf = new Uint8Array(16);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
      else for (let i = 0; i < 16; i += 1) buf[i] = Math.floor(Math.random() * 256);
      id = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(DEVICE_KEY, id);
      return id;
    } catch {
      return "";
    }
  }

  function formatCpfLogin(cpf) {
    const d = String(cpf || "").replace(/\D/g, "").slice(0, 11);
    if (d.length !== 11) return String(cpf || "").trim() || "—";
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function markUserActivity() {
    lastUserActivityAt = Date.now();
  }

  function userActiveRecently() {
    return Date.now() - lastUserActivityAt < USER_ACTIVE_RECENT_MS;
  }

  function getToken() {
    try {
      return String(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "").trim();
    } catch {
      return "";
    }
  }

  const REVOKED_KEY = "dk_session_revoked_v1";

  function isSessionRevoked() {
    try {
      return sessionStorage.getItem(REVOKED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markSessionRevoked() {
    try {
      sessionStorage.setItem(REVOKED_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function clearSessionRevoked() {
    try {
      sessionStorage.removeItem(REVOKED_KEY);
    } catch {
      /* ignore */
    }
  }

  function setToken(token) {
    const t = String(token || "").trim();
    try {
      if (t) {
        localStorage.setItem(KEY, t);
        sessionStorage.setItem(KEY, t);
        clearSessionRevoked();
        try {
          window.DK_CLOUD_AUTHENTICATED = true;
        } catch {
          /* ignore */
        }
        if (typeof window.__DK_resumeCloudSyncAfterRemoteLogin === "function") {
          window.__DK_resumeCloudSyncAfterRemoteLogin();
        }
      } else {
        localStorage.removeItem(KEY);
        sessionStorage.removeItem(KEY);
        try {
          window.DK_CLOUD_AUTHENTICATED = false;
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  function clearToken() {
    setToken("");
  }

  function apiHeaders(extra) {
    const h = extra && typeof extra === "object" ? { ...extra } : {};
    const t = getToken();
    if (t) {
      h.Authorization = `Bearer ${t}`;
      h["X-DK-Portal-Token"] = t;
    }
    h["X-DK-Client-Protocol"] = String(CLIENT_PROTOCOL);
    if (userActiveRecently()) h["X-DK-User-Active"] = "1";
    return h;
  }

  async function loginEquipa(cpf, senha, role, opts) {
    try {
      const deviceId = getPortalDeviceId();
      const confirmarUnico = Boolean(opts && opts.confirmarUnico);
      const res = await fetch("/api/dk-portal-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "equipa", cpf, senha, role, deviceId, confirmarUnico }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.token) {
        setToken(data.token);
        return { ok: true, funcionario: data.funcionario };
      }
      const reason = String(data.reason || "");
      if (reason === "session_em_uso") {
        return {
          ok: false,
          status: res.status,
          networkError: false,
          allowLocalFallback: false,
          needsKickConfirm: true,
          cpf: String(data.cpf || cpf || ""),
          ip: String(data.ip || "desconhecido"),
          msg:
            String(data.message || "").trim() ||
            `O usuário CPF ${formatCpfLogin(data.cpf || cpf)} será desconectado no IP ${data.ip || "desconhecido"} caso o login seja confirmado.`,
          reason,
        };
      }
      const allowLocalFallback =
        reason === "snapshot_unavailable" ||
        reason === "cloud_budget" ||
        reason === "rate_limited" ||
        reason === "auth_not_configured" ||
        res.status === 429 ||
        res.status >= 500;
      let msg = "Não foi possível autenticar no servidor.";
      if (reason === "invalid_credentials") msg = "CPF ou senha inválidos.";
      else if (reason === "rate_limited" || res.status === 429) {
        msg = "Muitas tentativas no servidor. Entrando com a cópia deste PC, se a senha estiver certa.";
      } else if (reason === "snapshot_unavailable" || reason === "cloud_budget" || res.status >= 500) {
        msg = "Cadastro na nuvem indisponível. Entrando com a cópia deste PC, se a senha estiver certa.";
      }
      return {
        ok: false,
        status: res.status,
        networkError: false,
        allowLocalFallback,
        msg,
        reason,
      };
    } catch {
      return { ok: false, networkError: true, msg: "Servidor de autenticação indisponível." };
    }
  }

  async function loginCliente(cpf, senha, protocolo) {
    try {
      const res = await fetch("/api/dk-portal-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "cliente", cpf, senha, protocolo }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.token) {
        setToken(data.token);
        return { ok: true, cliente: data.cliente };
      }
      return {
        ok: false,
        status: res.status,
        networkError: false,
        msg: "CPF, senha ou protocolo inválidos.",
        reason: data.reason,
      };
    } catch {
      return { ok: false, networkError: true, msg: "Servidor de autenticação indisponível." };
    }
  }

  try {
    window.DK_CLOUD_AUTHENTICATED = Boolean(getToken());
    window.__DK_portalApiTokenGet = getToken;
    window.__DK_portalApiTokenSet = setToken;
    window.__DK_portalApiTokenClear = clearToken;
    window.__DK_portalApiHeaders = apiHeaders;
    window.__DK_portalApiLoginEquipa = loginEquipa;
    window.__DK_portalApiLoginCliente = loginCliente;
    window.__DK_portalDeviceId = getPortalDeviceId;
    window.__DK_portalSessionIsRevoked = isSessionRevoked;
    window.__DK_portalSessionMarkRevoked = markSessionRevoked;
    window.__DK_portalSessionClearRevoked = clearSessionRevoked;
    window.__DK_CLIENT_PROTOCOL = CLIENT_PROTOCOL;
    window.__DK_portalMarkUserActivity = markUserActivity;
    window.__DK_portalUserActiveRecently = userActiveRecently;
    window.__DK_portalLastUserActivityAt = () => lastUserActivityAt;
  } catch {
    /* ignore */
  }

  try {
    ["pointerdown", "keydown", "click", "touchstart"].forEach((ev) => {
      document.addEventListener(ev, markUserActivity, { passive: true, capture: true });
    });
  } catch {
    /* ignore */
  }
})();
