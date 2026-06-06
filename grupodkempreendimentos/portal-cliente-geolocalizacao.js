/**
 * Geolocalização obrigatória — app DK Cliente.
 * Pedido na instalação / abertura; envio contínuo enquanto logado.
 */
(function portalClienteGeolocalizacao() {
  const CONSENT_KEY = "dk_cliente_geo_consent_v1";
  const GEO_API = "/api/dk-cliente-geo";
  const PUSH_MIN_INTERVAL_MS = 25000;
  const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 15000, timeout: 25000 };

  let watchId = null;
  let lastPushAt = 0;
  let lastPos = null;
  let trackingMeta = null;
  let pushInFlight = false;

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function loadConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveConsent(granted) {
    try {
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ granted: Boolean(granted), at: Date.now() })
      );
    } catch {
      /* ignore */
    }
  }

  async function queryPermissionState() {
    if (!navigator.geolocation) return "unsupported";
    try {
      const r = await navigator.permissions.query({ name: "geolocation" });
      return String(r.state || "unknown");
    } catch {
      return "unknown";
    }
  }

  function requestPositionOnce() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ ok: false, reason: "unsupported", msg: "Geolocalização indisponível neste aparelho." });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ ok: true, pos }),
        (err) =>
          resolve({
            ok: false,
            reason: err.code === 1 ? "denied" : "error",
            code: err.code,
            msg: err.message || "Permissão negada ou indisponível.",
          }),
        { ...WATCH_OPTIONS, maximumAge: 0 }
      );
    });
  }

  async function pushPosition(pos, meta) {
    if (!pos || !meta?.cpf) return { ok: false };
    const cpf = onlyDigits(meta.cpf).slice(0, 11);
    if (cpf.length !== 11) return { ok: false };
    const now = Date.now();
    if (now - lastPushAt < PUSH_MIN_INTERVAL_MS) return { ok: true, skipped: true };
    if (pushInFlight) return { ok: true, skipped: true };

    pushInFlight = true;
    try {
      const body = {
        cpf,
        nome: String(meta.nome || "").trim(),
        placa: String(meta.placa || "").trim(),
        protocolo: String(meta.protocolo || "").trim(),
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
        ts: now,
      };
      const res = await fetch(GEO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) {
        lastPushAt = now;
        lastPos = body;
      }
      return { ok: res.ok, data };
    } catch {
      return { ok: false };
    } finally {
      pushInFlight = false;
    }
  }

  function onWatchPosition(pos) {
    if (!trackingMeta) return;
    void pushPosition(pos, trackingMeta);
  }

  function onWatchError(err) {
    window.dispatchEvent(
      new CustomEvent("dk-cliente-geo-error", {
        detail: { code: err?.code, message: err?.message },
      })
    );
  }

  function stopTracking() {
    if (watchId != null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* ignore */
      }
    }
    watchId = null;
    trackingMeta = null;
  }

  function startTracking(meta) {
    if (!navigator.geolocation || !meta?.cpf) return false;
    trackingMeta = {
      cpf: onlyDigits(meta.cpf).slice(0, 11),
      nome: String(meta.nome || "").trim(),
      placa: String(meta.placa || "").trim(),
      protocolo: String(meta.protocolo || "").trim(),
    };
    if (watchId != null) {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* ignore */
      }
    }
    watchId = navigator.geolocation.watchPosition(onWatchPosition, onWatchError, WATCH_OPTIONS);
    if (lastPos && trackingMeta.cpf === onlyDigits(lastPos.cpf).slice(0, 11)) {
      void pushPosition(
        {
          coords: {
            latitude: lastPos.lat,
            longitude: lastPos.lng,
            accuracy: lastPos.accuracy,
            heading: lastPos.heading,
            speed: lastPos.speed,
          },
        },
        trackingMeta
      );
    }
    return true;
  }

  /**
   * Garante permissão de localização. Se required e negada, ok=false.
   * @returns {Promise<{ok:boolean, state?:string, pos?:GeolocationPosition, msg?:string}>}
   */
  async function ensurePermission(opts) {
    const required = opts?.required !== false;
    const perm = await queryPermissionState();

    if (perm === "unsupported") {
      return {
        ok: !required,
        state: perm,
        msg: "Este aparelho não suporta geolocalização.",
      };
    }

    if (perm === "denied") {
      saveConsent(false);
      return {
        ok: false,
        state: perm,
        msg: "Localização bloqueada. Ative nas definições do browser ou do telemóvel.",
      };
    }

    const got = await requestPositionOnce();
    if (got.ok && got.pos) {
      saveConsent(true);
      lastPos = {
        cpf: "",
        lat: got.pos.coords.latitude,
        lng: got.pos.coords.longitude,
        accuracy: got.pos.coords.accuracy,
        heading: got.pos.coords.heading,
        speed: got.pos.coords.speed,
      };
      return { ok: true, state: "granted", pos: got.pos };
    }

    if (got.reason === "denied") {
      saveConsent(false);
      return {
        ok: false,
        state: "denied",
        msg: "Autorização negada. O app DK Cliente exige localização para continuar.",
      };
    }

    return {
      ok: !required,
      state: perm,
      msg: got.msg || "Não foi possível obter a localização.",
    };
  }

  async function refreshPermissionOnVisible(meta) {
    const perm = await queryPermissionState();
    if (perm === "denied") {
      stopTracking();
      return { ok: false, state: perm };
    }
    const got = await requestPositionOnce();
    if (got.ok && got.pos && meta) {
      await pushPosition(got.pos, meta);
      if (!watchId) startTracking(meta);
      return { ok: true, state: "granted", pos: got.pos };
    }
    return { ok: perm === "granted", state: perm };
  }

  window.__DK_clienteGeoEnsurePermission = ensurePermission;
  window.__DK_clienteGeoStartTracking = startTracking;
  window.__DK_clienteGeoStopTracking = stopTracking;
  window.__DK_clienteGeoPushPosition = pushPosition;
  window.__DK_clienteGeoRefreshOnVisible = refreshPermissionOnVisible;
  window.__DK_clienteGeoQueryState = queryPermissionState;
  window.__DK_clienteGeoHasConsent = () => {
    const c = loadConsent();
    return Boolean(c?.granted);
  };
})();
