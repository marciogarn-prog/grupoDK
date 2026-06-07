/**
 * Smoke test no ambiente DEMO (branch demo / demo.grupodkempreendimentos.com.br).
 *
 * Uso:
 *   node grupodkempreendimentos/scripts/test-portal-demo.mjs
 *
 * Preview Vercel (antes do subdomínio):
 *   set DK_TEST_BASE_URL=https://SEU-PREVIEW-git-demo-xxx.vercel.app/
 *   node grupodkempreendimentos/scripts/test-portal-demo.mjs
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const prodTest = path.join(scriptDir, "test-portal-producao.mjs");
const base =
  process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/";

const r = spawnSync(process.execPath, [prodTest], {
  stdio: "inherit",
  env: { ...process.env, DK_TEST_BASE_URL: base },
});

process.exit(typeof r.status === "number" ? r.status : 1);
