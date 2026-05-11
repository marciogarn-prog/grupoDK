/**
 * Build step para Vercel: o ÚNICO site público deste projeto é o portal DK Locadora
 * em `grupodkempreendimentos/` (Operação, cadastros, relatórios). Esse diretório é
 * copiado integralmente para outputDirectory; o restante do repositório não vira HTML/CSS/JS
 * no deploy (há outros ficheiros na raiz só para desenvolvimento ou ferramentas locais).
 *
 * Rotas serverless `/api/*` vêm da pasta `api/` na raiz do repo (sincronização Redis), não do
 * `grupodkempreendimentos/api/` — por isso removemos `api/` da cópia do portal (evita servir .js
 * como estático em duplicado).
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
  const anonEnv = process.env.SUPABASE_ANON_KEY || "";
  let html = fs.readFileSync(indexHtml, "utf8");
  html = html.replace(
    /<meta\s+name="dk-supabase-url"\s+content="[^"]*"\s*>/i,
    `<meta name="dk-supabase-url" content="${escHtmlAttrValue(urlEnv)}">`
  );
  html = html.replace(
    /<meta\s+name="dk-supabase-anon-key"\s+content="[^"]*"\s*>/i,
    `<meta name="dk-supabase-anon-key" content="${escHtmlAttrValue(anonEnv)}">`
  );
  fs.writeFileSync(indexHtml, html);
  console.log("copy-portal-for-vercel: Supabase meta injetadas (anon:", anonEnv ? "sim" : "vazio", ")");
}

console.log("copy-portal-for-vercel: ok →", outDir);
