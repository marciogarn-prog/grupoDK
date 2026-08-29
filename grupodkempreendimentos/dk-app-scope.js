/**
 * Quatro apps no mesmo site (escopos separados para o Windows instalar os 4):
 *   / e /grupodk           → Grupo DK (central)
 *   /dklocadora            → DK Locadora
 *   /dkcentroautomotivo    → DK Centro Automotivo
 *   /dkconstrutora         → DK Construtora
 */
(function dkAppScope(w) {
  const MANIFEST = {
    grupodk: "/manifest-corporativo.webmanifest",
    locadora: "/manifest-locadora.webmanifest",
    centro: "/manifest-centro.webmanifest",
    construtora: "/manifest-construtora.webmanifest",
  };
  const TITLE = {
    grupodk: "Grupo DK",
    locadora: "DK Locadora",
    centro: "DK Centro Automotivo",
    construtora: "DK Construtora",
  };
  const PATH = {
    grupodk: "/grupodk",
    locadora: "/dklocadora",
    centro: "/dkcentroautomotivo",
    construtora: "/dkconstrutora",
  };
  const ICON = {
    grupodk: "/icons/icon-grupodk-192.png",
    locadora: "/icons/icon-locadora-192.png",
    centro: "/icons/icon-centro-192.png",
    construtora: "/icons/icon-construtora-192.png",
  };
  const THEME = {
    grupodk: "#ffffff",
    locadora: "#000000",
    centro: "#1565c0",
    construtora: "#6b7280",
  };

  function appScopeFromPath(pathname) {
    const parts = String(pathname || "/")
      .toLowerCase()
      .split("/")
      .filter(Boolean)
      .map((p) => p.replace(/\.html$/, ""));
    if (parts.includes("dklocadora")) return "locadora";
    if (parts.includes("dkcentroautomotivo")) return "centro";
    if (parts.includes("dkconstrutora")) return "construtora";
    if (parts.includes("grupodk")) return "grupodk";
    return "grupodk";
  }

  function appScope() {
    return appScopeFromPath(w.location && w.location.pathname);
  }

  function appScopeIsCentral() {
    return appScope() === "grupodk";
  }

  function appScopeAllowsUnit(unit) {
    const scope = appScope();
    if (scope === "grupodk") return true;
    return scope === unit;
  }

  function setLinkHref(rel, href) {
    let link = null;
    try {
      if (typeof document.getElementById === "function") link = document.getElementById(`dk-${rel}`);
      if (!link) link = document.querySelector(`link[rel="${rel}"]`);
    } catch {
      link = null;
    }
    if (link && href && link.getAttribute("href") !== href) link.setAttribute("href", href);
  }

  function syncAppManifest() {
    const scope = appScope();
    const href = MANIFEST[scope] || MANIFEST.grupodk;
    let link = null;
    try {
      link = document.querySelector('link[rel="manifest"]');
    } catch {
      link = null;
    }
    if (link && link.getAttribute("href") !== href) link.setAttribute("href", href);
    try {
      const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (apple) apple.setAttribute("content", TITLE[scope] || TITLE.grupodk);
    } catch {
      /* ignore */
    }
    const icon = ICON[scope] || ICON.grupodk;
    setLinkHref("icon", icon);
    setLinkHref("apple-touch-icon", icon);
    const theme = THEME[scope] || THEME.grupodk;
    try {
      const themeMeta =
        (typeof document.getElementById === "function" && document.getElementById("dk-theme-color")) ||
        document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", theme);
    } catch {
      /* ignore */
    }
    try {
      if (scope !== "grupodk") document.title = TITLE[scope];
    } catch {
      /* ignore */
    }
  }

  w.__DK_appScopeFromPath = appScopeFromPath;
  w.__DK_appScope = appScope;
  w.__DK_appScopeIsCentral = appScopeIsCentral;
  w.__DK_appScopeAllowsUnit = appScopeAllowsUnit;
  w.__DK_appScopePath = PATH;
  w.__DK_appScopeTitle = TITLE;
  w.__DK_appScopeIcon = ICON;
  w.__DK_appScopeTheme = THEME;
  w.__DK_syncAppManifest = syncAppManifest;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncAppManifest);
  } else {
    syncAppManifest();
  }
  syncAppManifest();
})(window);
