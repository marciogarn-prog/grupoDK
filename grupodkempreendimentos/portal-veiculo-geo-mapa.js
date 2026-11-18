/**
 * Mapa + comandos EC33 — Localização dos veículos.
 */
(function portalVeiculoGeoMapa() {
  const GEO_API = "/api/dk-veiculo-geo";
  const USB_AGENT = "http://127.0.0.1:8787";
  const PETROLINA = [-9.3891, -40.5028];
  const ONLINE_MS = 5 * 60 * 1000;

  let map = null;
  let layerGroup = null;
  let cercaLayer = null;
  let satLayer = null;
  let streetLayer = null;
  let refreshTimer = null;
  let lastRows = [];
  let lastCercas = {};
  let selected = null;

  const $ = (id) => document.getElementById(id);

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function fmtTs(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return new Date(n).toLocaleString("pt-BR");
  }

  function isOnline(ts) {
    return Date.now() - Number(ts || 0) < ONLINE_MS;
  }

  function apiHeaders() {
    return typeof window.__DK_portalApiHeaders === "function" ? window.__DK_portalApiHeaders() : {};
  }

  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) {
        resolve(window.L);
        return;
      }
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error("Leaflet indisponível"));
      document.head.appendChild(s);
    });
  }

  function ensureMap() {
    const el = $("dkVeiculoGeoMapCanvas");
    if (!el || map) return map;
    map = window.L.map(el, { center: PETROLINA, zoom: 13, zoomControl: false });
    streetLayer = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    });
    satLayer = window.L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "&copy; Esri", maxZoom: 19 }
    );
    streetLayer.addTo(map);
    layerGroup = window.L.layerGroup().addTo(map);
    cercaLayer = window.L.layerGroup().addTo(map);
    window.setTimeout(() => map.invalidateSize(), 120);
    return map;
  }

  function markerIcon(online) {
    const color = online ? "#22c55e" : "#94a3b8";
    return window.L.divIcon({
      className: "dk-geo-marker-wrap",
      html: `<span class="dk-geo-marker ${online ? "dk-geo-marker--online" : "dk-geo-marker--offline"}" style="background:${color}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  function popupHtml(row) {
    const online = isOnline(row.ts);
    const ign = row.acc || row.ignicao ? "ACC ON" : "ACC OFF";
    return `<div class="dk-geo-popup">
      <strong>${escapeHtml(row.placa || row.nome || "Veículo")}</strong>
      <div>${escapeHtml(row.nome || "EC33")} · IMEI ${escapeHtml(row.imei || "—")}</div>
      <div>${escapeHtml(ign)} · ${Math.round(Number(row.speed) || 0)} km/h</div>
      <div>${online ? "● Online" : "○ Offline"} · ${escapeHtml(fmtTs(row.ts))}</div>
    </div>`;
  }

  function filterRows(q) {
    const term = String(q || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!term) return lastRows;
    return lastRows.filter((r) => {
      const imei = onlyDigits(r.imei);
      const placa = String(r.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const nome = String(r.nome || "").toUpperCase();
      return imei.includes(term) || placa.includes(term) || nome.includes(term.replace(/\d/g, ""));
    });
  }

  function setSelected(row) {
    selected = row || null;
    const el = $("dkVeiculoGeoPlacaSel");
    if (!el) return;
    if (!selected) {
      el.textContent = "Nenhuma placa selecionada.";
      return;
    }
    el.textContent = `Selecionado: ${selected.placa || "—"} · IMEI ${selected.imei || "—"}`;
    if ($("dkVeiculoGeoImei")) $("dkVeiculoGeoImei").value = selected.imei || "";
    if ($("dkVeiculoGeoPlaca")) $("dkVeiculoGeoPlaca").value = selected.placa || "";
    if ($("dkVeiculoGeoNome") && selected.nome) $("dkVeiculoGeoNome").value = selected.nome;
  }

  function renderList(rows) {
    const box = $("dkVeiculoGeoMapLista");
    const count = $("dkVeiculoGeoMapContador");
    if (count) {
      const onlineN = rows.filter((r) => isOnline(r.ts) && !(Number(r.lat) === 0 && Number(r.lng) === 0)).length;
      count.textContent = `${rows.length} veículo(s) · ${onlineN} online (últimos 5 min)`;
    }
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = '<p class="subtext">Nenhum rastreador cadastrado. Use o formulário abaixo.</p>';
      return;
    }
    box.innerHTML = rows
      .map((r) => {
        const online = isOnline(r.ts) && !(Number(r.lat) === 0 && Number(r.lng) === 0);
        const titulo = r.placa || r.nome || r.imei || "Veículo";
        const sel = selected && onlyDigits(selected.imei) === onlyDigits(r.imei) ? " is-selected" : "";
        return `<button type="button" class="dk-geo-lista-item${sel}" data-geo-imei="${escapeHtml(r.imei)}">
          <span class="dk-geo-lista-item__dot ${online ? "is-online" : ""}"></span>
          <span class="dk-geo-lista-item__body">
            <strong>${escapeHtml(titulo)}</strong>
            <span>${escapeHtml(r.imei || "—")} · ${escapeHtml(fmtTs(r.ts))}</span>
          </span>
        </button>`;
      })
      .join("");
    box.querySelectorAll("[data-geo-imei]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const imei = btn.getAttribute("data-geo-imei");
        const row = lastRows.find((x) => onlyDigits(x.imei) === onlyDigits(imei));
        setSelected(row);
        renderList(filterRows($("dkVeiculoGeoMapBusca")?.value));
        if (row && map && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) && !(row.lat === 0 && row.lng === 0)) {
          map.setView([row.lat, row.lng], 16, { animate: true });
          layerGroup.eachLayer((layer) => {
            if (layer.__dkImei === onlyDigits(imei)) layer.openPopup();
          });
        }
      });
    });
  }

  function renderCercas() {
    if (!cercaLayer || !window.L) return;
    cercaLayer.clearLayers();
    Object.values(lastCercas || {}).forEach((c) => {
      if (!c || !c.ativa) return;
      const lat = Number(c.lat);
      const lng = Number(c.lng);
      const raio = Number(c.raioM) || 500;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      window.L.circle([lat, lng], {
        radius: raio,
        color: "#dc2626",
        weight: 2,
        fillOpacity: 0.08,
      }).addTo(cercaLayer);
    });
  }

  function renderMarkers(rows, opts) {
    if (!map || !layerGroup) return;
    const preserveView = Boolean(opts?.preserveView);
    layerGroup.clearLayers();
    const bounds = [];
    rows.forEach((r) => {
      const lat = Number(r.lat);
      const lng = Number(r.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (lat === 0 && lng === 0) return;
      const m = window.L.marker([lat, lng], { icon: markerIcon(isOnline(r.ts)) });
      m.__dkImei = onlyDigits(r.imei);
      m.bindPopup(popupHtml(r));
      m.on("click", () => setSelected(r));
      m.addTo(layerGroup);
      bounds.push([lat, lng]);
    });
    renderCercas();
    if (preserveView) return;
    if (bounds.length === 1) map.setView(bounds[0], 15);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  function logCmd(text) {
    const el = $("dkVeiculoCmdLog");
    if (el) el.textContent = text;
  }

  function seedFromVinculos() {
    const lista = window.__DK_EC33_VINCULOS && Array.isArray(window.__DK_EC33_VINCULOS.vinculos)
      ? window.__DK_EC33_VINCULOS.vinculos
      : [];
    return lista.map((v) => ({
      imei: onlyDigits(v.imei),
      placa: String(v.placa || "").toUpperCase(),
      nome: v.nome || "EC33",
      modelo: "EC33",
      lat: 0,
      lng: 0,
      ts: Date.now(),
    }));
  }

  let fetchGeoInFlight = false;

  async function fetchGeo(opts) {
    const preserveView = Boolean(opts?.preserveView);
    const msg = $("dkVeiculoGeoMapMsg");
    const btn = $("dkVeiculoGeoMapRefresh");
    if (fetchGeoInFlight) return;
    fetchGeoInFlight = true;
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }
    try {
      const res = await fetch(GEO_API, { cache: "no-store", headers: apiHeaders() });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { ok: false };
      }
      if (!res.ok || !data.ok) {
        lastRows = seedFromVinculos();
        lastCercas = {};
        if (msg) msg.textContent = data.msg || "API de veículos indisponível — a mostrar vínculos locais EC33.";
      } else {
        lastRows = Array.isArray(data.veiculos) ? data.veiculos : [];
        if (!lastRows.length) lastRows = seedFromVinculos();
        lastCercas = data.cercas && typeof data.cercas === "object" ? data.cercas : {};
        if (msg) {
          msg.textContent =
            lastRows.length > 0
              ? `Mapa atualizado ${new Date().toLocaleTimeString("pt-BR")} · ${lastRows.length} veículo(s)`
              : `Mapa atualizado · nenhum veículo ainda`;
        }
      }
      if (selected) {
        const again = lastRows.find((r) => onlyDigits(r.imei) === onlyDigits(selected.imei));
        if (again) selected = again;
      } else if (lastRows.length === 1) {
        setSelected(lastRows[0]);
      }
      const filtered = filterRows($("dkVeiculoGeoMapBusca")?.value);
      renderList(filtered);
      renderMarkers(filtered, { preserveView });
    } catch (e) {
      lastRows = seedFromVinculos();
      renderList(lastRows);
      if (msg) msg.textContent = e?.message || "Erro ao carregar.";
    } finally {
      fetchGeoInFlight = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
    }
  }

  async function postApi(body) {
    const res = await fetch(GEO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders() },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function enviarUsbLocal(cmd, imei) {
    try {
      const res = await fetch(`${USB_AGENT}/comando`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, imei }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data.ok !== false, data };
    } catch {
      return { ok: false, data: { msg: "Agente USB local (8787) indisponível" } };
    }
  }

  async function enviarComando(tipo, params) {
    if (!selected || !selected.imei) {
      logCmd("Selecione uma placa/IMEI na lista.");
      return;
    }
    logCmd(`A enviar ${tipo}…`);
    const { res, data } = await postApi({
      acao: "comando",
      imei: selected.imei,
      placa: selected.placa,
      tipo,
      params: params || {},
    });
    const cmd = data?.comando?.cmd || "";
    if (!res.ok || !data.ok) {
      logCmd(data.msg || "Falha ao enfileirar comando.");
      return;
    }
    const usb = cmd ? await enviarUsbLocal(cmd, selected.imei) : { ok: false };
    if (usb.ok) {
      logCmd(`USB OK · ${cmd} · ${String(usb.data?.resposta || "").slice(0, 200)}`);
      if (data.comando?.id) {
        await postApi({
          acao: "comando_resultado",
          id: data.comando.id,
          ok: true,
          resposta: usb.data?.resposta || "ok",
          via: "usb",
        });
      }
    } else {
      logCmd(
        `Comando enfileirado: ${cmd}. O bridge GT06 envia por GPRS (pacote 0x80) quando o rastreador estiver online no servidor. USB local (${USB_AGENT}) é opcional.`
      );
    }
  }

  async function vincularImei() {
    const imei = onlyDigits($("dkVeiculoGeoImei")?.value).slice(0, 15);
    const placa = String($("dkVeiculoGeoPlaca")?.value || "").trim().toUpperCase();
    const nome = String($("dkVeiculoGeoNome")?.value || "").trim();
    if (imei.length < 14) {
      logCmd("Informe o IMEI (15 dígitos).");
      return;
    }
    if (!placa) {
      logCmd("Informe a placa.");
      return;
    }
    const { res, data } = await postApi({ acao: "vincular", imei, placa, nome, modelo: "EC33" });
    if (!res.ok && !data.ok) {
      logCmd(data.msg || "Falha ao vincular.");
      return;
    }
    if (window.__DK_EC33_VINCULOS && Array.isArray(window.__DK_EC33_VINCULOS.vinculos)) {
      const i = window.__DK_EC33_VINCULOS.vinculos.findIndex((v) => onlyDigits(v.imei) === imei);
      const row = { imei, placa, nome: nome || "EC33", modeloRastreador: "EC33" };
      if (i >= 0) window.__DK_EC33_VINCULOS.vinculos[i] = row;
      else window.__DK_EC33_VINCULOS.vinculos.push(row);
    }
    if (typeof window.__DK_upsertPortalVeiculoByPlaca === "function") {
      const atual = typeof window.__DK_findPortalVeiculoByPlaca === "function"
        ? window.__DK_findPortalVeiculoByPlaca(placa)
        : null;
      window.__DK_upsertPortalVeiculoByPlaca({ ...(atual || {}), placa, imei, modelo: nome || atual?.modelo });
    }
    logCmd(`Vinculado IMEI ${imei} → ${placa}.`);
    await fetchGeo({ preserveView: true });
  }

  async function ativarCerca(ativa) {
    if (!selected?.imei) {
      logCmd("Selecione uma placa.");
      return;
    }
    const raioM = Number($("dkVeiculoCercaRaio")?.value) || 500;
    let lat = Number($("dkVeiculoCercaLat")?.value);
    let lng = Number($("dkVeiculoCercaLng")?.value);
    if (ativa && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      lat = Number(selected.lat);
      lng = Number(selected.lng);
    }
    if (ativa && (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0))) {
      logCmd("Sem posição GPS ainda. Informe lat/lng do centro da cerca.");
      return;
    }
    const { res, data } = await postApi({
      acao: "cerca",
      imei: selected.imei,
      placa: selected.placa,
      ativa,
      lat,
      lng,
      raioM,
    });
    if (!res.ok || !data.ok) {
      logCmd(data.msg || "Falha na cerca.");
      return;
    }
    const cmd = data.comando?.cmd;
    if (cmd) {
      const usb = await enviarUsbLocal(cmd, selected.imei);
      logCmd(
        ativa
          ? `Cerca ${raioM} m · ${cmd} · ${usb.ok ? "USB OK" : "fila GPRS/USB"}`
          : `Cerca desativada · ${cmd} · ${usb.ok ? "USB OK" : "fila GPRS/USB"}`
      );
    } else {
      logCmd(ativa ? "Cerca ativada no mapa DK." : "Cerca desativada.");
    }
    await fetchGeo({ preserveView: true });
  }

  let toolbarWired = false;

  function wireToolbar() {
    if (toolbarWired) return;
    toolbarWired = true;
    $("dkVeiculoGeoMapZoomIn")?.addEventListener("click", () => map?.zoomIn());
    $("dkVeiculoGeoMapZoomOut")?.addEventListener("click", () => map?.zoomOut());
    $("dkVeiculoGeoMapFitAll")?.addEventListener("click", () => {
      const pts = lastRows
        .map((r) => [Number(r.lat), Number(r.lng)])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && !(a === 0 && b === 0));
      if (pts.length) map?.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
      else map?.setView(PETROLINA, 13);
    });
    $("dkVeiculoGeoMapCenterPetrolina")?.addEventListener("click", () => map?.setView(PETROLINA, 13));
    $("dkVeiculoGeoMapRefresh")?.addEventListener("click", () => fetchGeo({ preserveView: true }));
    $("dkVeiculoGeoMapBusca")?.addEventListener("input", () => {
      const filtered = filterRows($("dkVeiculoGeoMapBusca")?.value);
      renderList(filtered);
      renderMarkers(filtered, { preserveView: true });
    });
    $("dkVeiculoGeoVincularBtn")?.addEventListener("click", () => void vincularImei());
    $("dkVeiculoCmdStatus")?.addEventListener("click", () => void enviarComando("status"));
    $("dkVeiculoCmdWhere")?.addEventListener("click", () => void enviarComando("where"));
    $("dkVeiculoCmdParam")?.addEventListener("click", () => void enviarComando("param"));
    $("dkVeiculoCmdRelayOn")?.addEventListener("click", () => void enviarComando("relay_on"));
    $("dkVeiculoCmdRelayOff")?.addEventListener("click", () => void enviarComando("relay_off"));
    $("dkVeiculoCmdTimer")?.addEventListener("click", () => {
      void enviarComando("timer", {
        t1: Number($("dkVeiculoTimerOn")?.value) || 30,
        t2: Number($("dkVeiculoTimerOff")?.value) || 1800,
      });
    });
    $("dkVeiculoCmdCercaOn")?.addEventListener("click", () => void ativarCerca(true));
    $("dkVeiculoCmdCercaOff")?.addEventListener("click", () => void ativarCerca(false));
    let sat = false;
    $("dkVeiculoGeoMapToggleSat")?.addEventListener("click", () => {
      if (!map || !streetLayer || !satLayer) return;
      sat = !sat;
      if (sat) {
        map.removeLayer(streetLayer);
        satLayer.addTo(map);
      } else {
        map.removeLayer(satLayer);
        streetLayer.addTo(map);
      }
      $("dkVeiculoGeoMapToggleSat").textContent = sat ? "Mapa rua" : "Satélite";
    });
  }

  async function onShow() {
    const panel = $("panel-localizacao-veiculos-locadora");
    if (!panel) return;
    try {
      await loadLeaflet();
      ensureMap();
      wireToolbar();
      await fetchGeo();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = window.setInterval(() => fetchGeo({ preserveView: true }), 15000);
      window.setTimeout(() => map?.invalidateSize(), 200);
    } catch (e) {
      const msg = $("dkVeiculoGeoMapMsg");
      if (msg) msg.textContent = e?.message || "Mapa indisponível.";
    }
  }

  function onHide() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  window.__DK_veiculoGeoMapaOnShow = onShow;
  window.__DK_veiculoGeoMapaOnHide = onHide;
})();
