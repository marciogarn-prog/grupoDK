/**
 * Fase 1A — token de API no browser (não é secret de deploy).
 * Guardado após login; enviado em Authorization nas APIs protegidas.
 */
(function dkPortalApiAuth() {
  const KEY = "dk_portal_api_token_v1";

  function getToken() {
    try {
      return String(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function setToken(token) {
    const t = String(token || "").trim();
    try {
      if (t) {
        localStorage.setItem(KEY, t);
        sessionStorage.setItem(KEY, t);
      } else {
        localStorage.removeItem(KEY);
        sessionStorage.removeItem(KEY);
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
    return h;
  }

  async function loginEquipa(cpf, senha, role) {
    try {
      const res = await fetch("/api/dk-portal-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "equipa", cpf, senha, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.token) {
        setToken(data.token);
        return { ok: true, funcionario: data.funcionario };
      }
      return {
        ok: false,
        status: res.status,
        networkError: false,
        msg: data.reason === "invalid_credentials" ? "CPF ou senha inválidos." : "Não foi possível autenticar no servidor.",
        reason: data.reason,
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
    window.__DK_portalApiTokenGet = getToken;
    window.__DK_portalApiTokenSet = setToken;
    window.__DK_portalApiTokenClear = clearToken;
    window.__DK_portalApiHeaders = apiHeaders;
    window.__DK_portalApiLoginEquipa = loginEquipa;
    window.__DK_portalApiLoginCliente = loginCliente;
  } catch {
    /* ignore */
  }
})();
