/**
 * Identidade HTML de cada um dos 4 apps.
 * O Chrome decide qual PWA instalar pelo <link rel="manifest"> do HTML.
 * Se todas as rotas servirem o manifesto do Grupo DK, os outros 3 apps
 * nunca viram ícone separado.
 */
const APPS = {
  grupodk: {
    manifest: "/manifest-corporativo.webmanifest",
    title: "Grupo DK Empreendimentos",
    apple: "Grupo DK",
    icon: "/icons/icon-grupodk-192.png",
    theme: "#ffffff",
  },
  locadora: {
    manifest: "/manifest-locadora.webmanifest",
    title: "DK Locadora",
    apple: "DK Locadora",
    icon: "/icons/icon-locadora-192.png",
    theme: "#000000",
  },
  centro: {
    manifest: "/manifest-centro.webmanifest",
    title: "DK Centro Automotivo",
    apple: "DK Centro Automotivo",
    icon: "/icons/icon-centro-192.png",
    theme: "#1565c0",
  },
  construtora: {
    manifest: "/manifest-construtora.webmanifest",
    title: "DK Construtora",
    apple: "DK Construtora",
    icon: "/icons/icon-construtora-192.png",
    theme: "#6b7280",
  },
};

function appKeyFromPath(pathname) {
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

function applyAppHtmlIdentity(html, key) {
  const app = APPS[key] || APPS.grupodk;
  let out = String(html || "");
  out = out.replace(
    /<link\s+rel="manifest"\s+href="[^"]*"/gi,
    `<link rel="manifest" href="${app.manifest}"`
  );
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${app.title}</title>`);
  out = out.replace(
    /<meta\s+name="apple-mobile-web-app-title"\s+content="[^"]*"/i,
    `<meta name="apple-mobile-web-app-title" content="${app.apple}"`
  );
  out = out.replace(
    /(<meta\s+name="theme-color"[^>]*content=")[^"]*(")/i,
    `$1${app.theme}$2`
  );
  out = out.replace(
    /(<link\s+rel="apple-touch-icon"[^>]*href=")[^"]*(")/i,
    `$1${app.icon}$2`
  );
  out = out.replace(/(<link\s+rel="icon"[^>]*href=")[^"]*(")/i, `$1${app.icon}$2`);
  return out;
}

module.exports = {
  APPS,
  appKeyFromPath,
  applyAppHtmlIdentity,
};
