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
if (fs.existsSync(repoApiDir)) {
  fs.mkdirSync(portalApiDir, { recursive: true });
  for (const name of fs.readdirSync(repoApiDir)) {
    if (!name.endsWith(".js")) continue;
    fs.copyFileSync(path.join(repoApiDir, name), path.join(portalApiDir, name));
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.cpSync(portalDir, outDir, { recursive: true });

const nestedApi = path.join(outDir, "api");
if (fs.existsSync(nestedApi)) {
  fs.rmSync(nestedApi, { recursive: true, force: true });
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
