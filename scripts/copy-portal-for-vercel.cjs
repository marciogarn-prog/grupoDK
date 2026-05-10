/**
 * Build step para Vercel quando o repositório é a raiz do Git mas o site é `grupodkempreendimentos/`.
 * Copia o portal para outputDirectory. Remove `api/` da cópia para as rotas serverless
 * virem só de `api/` na raiz do repositório (evita servir .js como arquivo estático).
 */
const fs = require("fs");
const path = require("path");

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

console.log("copy-portal-for-vercel: ok →", outDir);
