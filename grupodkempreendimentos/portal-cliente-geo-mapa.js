/**
 * Mapa admin — localização dos clientes (app DK Cliente).
 */
(function portalClienteGeoMapa() {
  const GEO_API = "/api/dk-cliente-geo";
  const REFRESH_MS = 15000;
  const PETROLINA = [-9.3891, -40.5028];
  const ONLINE_MS = 5 * 60 * 1000;

  let map = null;
  let layerGroup = null;
  let satLayer = null;
  let streetLayer = null;
  let refreshTimer = null;
  let lastRows = [];
  let mapReady = false;

  const $ = (id) => document.getElementById(id);

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function formatCpf(d) {
    const x = onlyDigits(d).slice(0, 11);
    if (x.length !== 11) return d || "—";
    return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`;
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
    const el = $("dkGeoMapCanvas");
    if (!el || map) return map;
    map = window.L.map(el, {
      center: PETROLINA,
      zoom: 13,
      zoomControl: false,
    });
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
    mapReady = true;
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
    return `<div class="dk-geo-popup">
      <strong>${escapeHtml(row.nome || "Cliente")}</strong>
      <div>CPF ${escapeHtml(formatCpf(row.cpf))}</div>
      <div>Placa ${escapeHtml(row.placa || "—")} · ${escapeHtml(row.protocolo || "—")}</div>
      <div>Precisão ±${Math.round(Number(row.accuracy) || 0)} m</div>
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
      const cpf = onlyDigits(r.cpf);
      const placa = String(r.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const nome = String(r.nome || "").toUpperCase();
      const proto = String(r.protocolo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return (
        cpf.includes(term) ||
        placa.includes(term) ||
        nome.includes(term.replace(/\d/g, "")) ||
        proto.includes(term)
      );
    });
  }

  function renderList(rows) {
    const box = $("dkGeoMapLista");
    const count = $("dkGeoMapContador");
    if (count) {
      const onlineN = rows.filter((r) => isOnline(r.ts)).length;
      count.textContent = `${rows.length} cliente(s) · ${onlineN} online (últimos 5 min)`;
    }
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = '<p class="subtext">Nenhuma localização recebida ainda.</p>';
      return;
    }
    box.innerHTML = rows
      .map((r) => {
        const online = isOnline(r.ts);
        return `<button type="button" class="dk-geo-lista-item" data-geo-cpf="${escapeHtml(r.cpf)}">
          <span class="dk-geo-lista-item__dot ${online ? "is-online" : ""}"></span>
          <span class="dk-geo-lista-item__body">
            <strong>${escapeHtml(r.nome || formatCpf(r.cpf))}</strong>
            <span>${escapeHtml(r.placa || "—")} · ${escapeHtml(fmtTs(r.ts))}</span>
          </span>
        </button>`;
      })
      .join("");
    box.querySelectorAll("[data-geo-cpf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpf = btn.getAttribute("data-geo-cpf");
        const row = lastRows.find((x) => onlyDigits(x.cpf) === onlyDigits(cpf));
        if (row && map) {
          map.setView([row.lat, row.lng], 16, { animate: true });
          layerGroup.eachLayer((layer) => {
            if (layer.__dkCpf === onlyDigits(cpf)) layer.openPopup();
          });
        }
      });
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
      const m = window.L.marker([lat, lng], { icon: markerIcon(isOnline(r.ts)) });
      m.__dkCpf = onlyDigits(r.cpf);
      m.bindPopup(popupHtml(r));
      m.addTo(layerGroup);
      bounds.push([lat, lng]);
    });
    if (preserveView) return;
    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }

  let fetchGeoInFlight = false;

  async function fetchGeo(opts) {
    const preserveView = Boolean(opts?.preserveView);
    const msg = $("dkGeoMapMsg");
    const btn = $("dkGeoMapRefresh");
    if (fetchGeoInFlight) return;
    fetchGeoInFlight = true;
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }
    if (msg && preserveView) msg.textContent = "A atualizar mapa…";
    try {
      const res = await fetch(GEO_API, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.msg || "Falha ao carregar");
      lastRows = Array.isArray(data.clientes) ? data.clientes : [];
      const q = $("dkGeoMapBusca")?.value || "";
      const filtered = filterRows(q);
      renderList(filtered);
      renderMarkers(filtered, { preserveView });
      if (msg) msg.textContent = `Mapa atualizado ${new Date().toLocaleTimeString("pt-BR")}`;
    } catch (e) {
      if (msg) msg.textContent = e?.message || "Erro ao carregar localizações.";
    } finally {
      fetchGeoInFlight = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
    }
  }

  let toolbarWired = false;

  function wireToolbar() {
    if (toolbarWired) return;
    toolbarWired = true;
    $("dkGeoMapZoomIn")?.addEventListener("click", () => map?.zoomIn());
    $("dkGeoMapZoomOut")?.addEventListener("click", () => map?.zoomOut());
    $("dkGeoMapFitAll")?.addEventListener("click", () => {
      const pts = lastRows
        .map((r) => [Number(r.lat), Number(r.lng)])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
      if (pts.length) map?.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
      else map?.setView(PETROLINA, 13);
    });
    $("dkGeoMapCenterPetrolina")?.addEventListener("click", () => map?.setView(PETROLINA, 13));
    $("dkGeoMapRefresh")?.addEventListener("click", () => fetchGeo({ preserveView: true }));
    $("dkGeoMapBusca")?.addEventListener("input", () => {
      const filtered = filterRows($("dkGeoMapBusca")?.value);
      renderList(filtered);
      renderMarkers(filtered, { preserveView: true });
    });
    let sat = false;
    $("dkGeoMapToggleSat")?.addEventListener("click", () => {
      if (!map || !streetLayer || !satLayer) return;
      sat = !sat;
      if (sat) {
        map.removeLayer(streetLayer);
        satLayer.addTo(map);
      } else {
        map.removeLayer(satLayer);
        streetLayer.addTo(map);
      }
      $("dkGeoMapToggleSat").textContent = sat ? "Mapa rua" : "Satélite";
    });
  }

  async function onShow() {
    const panel = $("panel-localizacao-locadora");
    if (!panel) return;
    try {
      await loadLeaflet();
      ensureMap();
      wireToolbar();
      await fetchGeo();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(() => fetchGeo({ preserveView: true }), REFRESH_MS);
      window.setTimeout(() => map?.invalidateSize(), 200);
    } catch (e) {
      const msg = $("dkGeoMapMsg");
      if (msg) msg.textContent = e?.message || "Mapa indisponível.";
    }
  }

  function onHide() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  window.__DK_clienteGeoMapaOnShow = onShow;
  window.__DK_clienteGeoMapaOnHide = onHide;
})();
