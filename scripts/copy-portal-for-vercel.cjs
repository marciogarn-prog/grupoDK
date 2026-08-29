/**
 * Build step para Vercel: o ÚNICO site público deste projeto é o portal DK Locadora
 * em `grupodkempreendimentos/` (Operação, cadastros, relatórios). Esse diretório é
 * copiado integralmente para outputDirectory; o restante do repositório não vira HTML/CSS/JS
 * no deploy (há outros ficheiros na raiz só para desenvolvimento ou ferramentas locais).
 *
 * Rotas serverless `/api/*` na Vercel vêm de `grupodkempreendimentos/api/` (Root Directory do projeto).
 * Removemos `api/` da cópia estática para não duplicar ficheiros no output.
 */
const fs = require("fs");
const path = require("path");

function escHtmlAttrValue(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

const repoRoot = path.resolve(__dirname, "..");
const portalDir = path.join(repoRoot, "grupodkempreendimentos");
const outDir = path.join(repoRoot, ".vercel-portal-dist");

if (!fs.existsSync(portalDir)) {
  console.error("copy-portal-for-vercel: pasta não encontrada:", portalDir);
  process.exit(1);
}

/* Garante que novas rotas /api/* na raiz do repo também existem no portal (Root Directory Vercel). */
const repoApiDir = path.join(repoRoot, "api");
const portalApiDir = path.join(portalDir, "api");
if (fs.existsSync(repoApiDir) && fs.existsSync(portalApiDir)) {
  fs.mkdirSync(portalApiDir, { recursive: true });
  fs.mkdirSync(repoApiDir, { recursive: true });
  const repoApiNames = new Set(
    fs.readdirSync(repoApiDir).filter((n) => n.endsWith(".js"))
  );
  const portalApiNames = new Set(
    fs.readdirSync(portalApiDir).filter((n) => n.endsWith(".js"))
  );
  /* Portal é fonte de verdade: espelha portal → raiz; só copia raiz → portal se rota existir só na raiz. */
  for (const name of portalApiNames) {
    fs.copyFileSync(path.join(portalApiDir, name), path.join(repoApiDir, name));
    repoApiNames.delete(name);
  }
  for (const name of repoApiNames) {
    fs.copyFileSync(path.join(repoApiDir, name), path.join(portalApiDir, name));
  }
} else if (fs.existsSync(repoApiDir)) {
  fs.mkdirSync(portalApiDir, { recursive: true });
  for (const name of fs.readdirSync(repoApiDir)) {
    if (!name.endsWith(".js")) continue;
    fs.copyFileSync(path.join(repoApiDir, name), path.join(portalApiDir, name));
  }
} else if (fs.existsSync(portalApiDir)) {
  fs.mkdirSync(repoApiDir, { recursive: true });
  for (const name of fs.readdirSync(portalApiDir)) {
    if (!name.endsWith(".js")) continue;
    fs.copyFileSync(path.join(portalApiDir, name), path.join(repoApiDir, name));
  }
}
const repoLibDir = path.join(repoRoot, "lib");
const portalLibDir = path.join(portalDir, "lib");
if (fs.existsSync(portalLibDir)) {
  fs.mkdirSync(repoLibDir, { recursive: true });
  for (const name of fs.readdirSync(portalLibDir)) {
    if (!name.endsWith(".cjs") && !name.endsWith(".js")) continue;
    fs.copyFileSync(path.join(portalLibDir, name), path.join(repoLibDir, name));
  }
}
if (fs.existsSync(repoLibDir)) {
  fs.mkdirSync(portalLibDir, { recursive: true });
  for (const name of fs.readdirSync(repoLibDir)) {
    if (!name.endsWith(".cjs") && !name.endsWith(".js")) continue;
    const dest = path.join(portalLibDir, name);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(repoLibDir, name), dest);
    }
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.cpSync(portalDir, outDir, { recursive: true });

const nestedApi = path.join(outDir, "api");
if (fs.existsSync(nestedApi)) {
  fs.rmSync(nestedApi, { recursive: true, force: true });
}
/* API serverless na Vercel: api/ + lib/ (Redis helper). */
const outApi = path.join(outDir, "api");
const srcApi = path.join(portalDir, "api");
const srcLib = path.join(portalDir, "lib");
if (fs.existsSync(srcApi)) {
  fs.mkdirSync(outApi, { recursive: true });
  for (const name of fs.readdirSync(srcApi)) {
    if (!name.endsWith(".js")) continue;
    fs.copyFileSync(path.join(srcApi, name), path.join(outApi, name));
  }
}
if (fs.existsSync(srcLib)) {
  const outLib = path.join(outDir, "lib");
  fs.mkdirSync(outLib, { recursive: true });
  for (const name of fs.readdirSync(srcLib)) {
    if (!name.endsWith(".cjs") && !name.endsWith(".js")) continue;
    fs.copyFileSync(path.join(srcLib, name), path.join(outLib, name));
  }
}

/* Injeta credenciais Supabase nas meta tags (variáveis na Vercel: SUPABASE_URL, SUPABASE_ANON_KEY). */
const indexHtml = path.join(outDir, "index.html");
if (fs.existsSync(indexHtml)) {
  const urlEnv =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://ppxtwqvzgujllfzarpuz.supabase.co";
  const anonEnv =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "";
  let html = fs.readFileSync(indexHtml, "utf8");
  html = html.replace(
    /<meta\s+name="dk-supabase-url"\s+content="[^"]*"\s*>/i,
    `<meta name="dk-supabase-url" content="${escHtmlAttrValue(urlEnv)}">`
  );
  if (anonEnv) {
    html = html.replace(
      /<meta\s+name="dk-supabase-anon-key"\s+content="[^"]*"\s*>/i,
      `<meta name="dk-supabase-anon-key" content="${escHtmlAttrValue(anonEnv)}">`
    );
  }
  const waSecret = process.env.DK_WHATSAPP_SEND_SECRET || "";
  if (waSecret) {
    html = html.replace(
      /<meta\s+name="dk-whatsapp-send-secret"\s+content="[^"]*"\s*>/i,
      `<meta name="dk-whatsapp-send-secret" content="${escHtmlAttrValue(waSecret)}">`
    );
  }
  const backupSecret = process.env.DK_BACKUP_SEND_SECRET || process.env.CRON_SECRET || "";
  if (backupSecret) {
    html = html.replace(
      /<meta\s+name="dk-backup-send-secret"\s+content="[^"]*"\s*>/i,
      `<meta name="dk-backup-send-secret" content="${escHtmlAttrValue(backupSecret)}">`
    );
  }
  fs.writeFileSync(indexHtml, html);
  for (const name of ["dklocadora.html", "dkcentroautomotivo.html", "dkconstrutora.html"]) {
    fs.copyFileSync(indexHtml, path.join(outDir, name));
  }
  console.log(
    "copy-portal-for-vercel: Supabase meta injetadas (chave:",
    anonEnv ? "env" : "mantida-do-index",
    "); WhatsApp send:",
    waSecret ? "secret injetado" : "sem DK_WHATSAPP_SEND_SECRET",
    "; Backup send:",
    backupSecret ? "secret injetado" : "sem DK_BACKUP_SEND_SECRET/CRON_SECRET"
  );
}

console.log("copy-portal-for-vercel: ok →", outDir);
