/**
 * Registo Web Push no app cliente (notificações mesmo com app fechado).
 */
(function clientePushNotificacoes() {
  "use strict";

  const SUB_KEY = "dk_cliente_push_subscribed_cpf";

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function pushChannelQuery() {
    return window.__DK_DEPLOY_CHANNEL__ === "demo" ? "?channel=demo" : "";
  }

  function pushFetchHeaders() {
    const h = { "Content-Type": "application/json" };
    if (window.__DK_DEPLOY_CHANNEL__ === "demo") h["X-DK-Deploy-Channel"] = "demo";
    return h;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
  }

  function isSupported() {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      typeof Notification !== "undefined"
    );
  }

  function isAdminPreview() {
    try {
      return sessionStorage.getItem("dk_admin_preview_cliente") === "1";
    } catch {
      return false;
    }
  }

  const PUSH_API = "/api/dk-cliente-geo?push=1";

  async function fetchVapidPublicKey() {
    const res = await fetch(`${PUSH_API}&action=vapid${pushChannelQuery().replace("?", "&")}`, {
      headers: pushFetchHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.publicKey) return null;
    return String(data.publicKey);
  }

  async function ensureClientePushSubscription(cpfDigits) {
    const cpf = onlyDigits(cpfDigits).slice(0, 11);
    if (cpf.length !== 11 || isAdminPreview()) {
      return { ok: false, reason: "skip" };
    }
    if (!isSupported()) return { ok: false, reason: "unsupported" };
    try {
      if (localStorage.getItem(SUB_KEY) === cpf && Notification.permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return { ok: true, reused: true };
      }
    } catch {
      /* re-subscribe */
    }

    if (Notification.permission === "denied") {
      return { ok: false, reason: "denied" };
    }
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { ok: false, reason: "not_granted" };
    }

    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) return { ok: false, reason: "no_vapid" };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const res = await fetch(`${PUSH_API}${pushChannelQuery().replace("?", "&")}`, {
      method: "POST",
      headers: pushFetchHeaders(),
      body: JSON.stringify({
        action: "subscribe",
        cpf,
        channel: window.__DK_DEPLOY_CHANNEL__ === "demo" ? "demo" : "default",
        subscription: sub.toJSON(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.ok) {
      try {
        localStorage.setItem(SUB_KEY, cpf);
      } catch {
        /* ignore */
      }
    }
    return data?.ok ? { ok: true } : { ok: false, reason: data?.msg || "subscribe_failed" };
  }

  function maybeShowForegroundNotification() {
    if (!isSupported() || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") {
      try {
        const n = new Notification("DK Locadora", {
          body: "Você tem um novo aviso da DK",
          icon: "/icons/icon-cliente-192.png",
          tag: "dk-aviso-fg",
        });
        n.onclick = () => {
          window.focus();
          if (typeof window.__DK_clienteScrollToAvisos === "function") {
            window.__DK_clienteScrollToAvisos();
          }
          n.close();
        };
      } catch {
        /* ignore */
      }
    }
  }

  function wireServiceWorkerMessages() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("message", (event) => {
      const d = event.data;
      if (!d || d.type !== "dk-open-chat") return;
      if (typeof window.__DK_clienteScrollToAvisos === "function") {
        window.__DK_clienteScrollToAvisos();
      }
    });
  }

  function parseDkAvisosFromUrl() {
    try {
      const p = new URLSearchParams(window.location.search);
      const aviso = String(p.get("dkAviso") || p.get("dkChat") || "").trim();
      if (aviso === "1" || aviso.toLowerCase() === "true") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function openAvisosFromUrlWhenReady() {
    if (!parseDkAvisosFromUrl()) return;
    const tryOpen = () => {
      if (typeof window.__DK_clienteScrollToAvisos === "function") {
        window.__DK_clienteScrollToAvisos();
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete("dkAviso");
          u.searchParams.delete("dkChat");
          window.history.replaceState({}, "", u.pathname + u.search + u.hash);
        } catch {
          /* ignore */
        }
        return true;
      }
      return false;
    };
    if (tryOpen()) return;
    window.setTimeout(tryOpen, 800);
    window.setTimeout(tryOpen, 2500);
  }

  window.__DK_clienteEnsurePushSubscription = ensureClientePushSubscription;
  window.__DK_clientePushForegroundNotify = maybeShowForegroundNotification;
  window.__DK_clientePushOpenAvisosFromUrl = openAvisosFromUrlWhenReady;

  wireServiceWorkerMessages();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", openAvisosFromUrlWhenReady);
  } else {
    openAvisosFromUrlWhenReady();
  }
})();
