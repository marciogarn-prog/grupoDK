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
const parityTest = path.join(scriptDir, "compare-demo-oficial-ui.mjs");
const base =
  process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/";

const r = spawnSync(process.execPath, [prodTest], {
  stdio: "inherit",
  env: { ...process.env, DK_TEST_BASE_URL: base },
});
if (r.status !== 0) process.exit(typeof r.status === "number" ? r.status : 1);

const mielTest = path.join(scriptDir, "test-portal-miel-etapas.mjs");
const m = spawnSync(process.execPath, [mielTest], {
  stdio: "inherit",
  env: { ...process.env, DK_TEST_BASE_URL: base },
});
if (m.status !== 0) process.exit(typeof m.status === "number" ? m.status : 1);

const p = spawnSync(process.execPath, [parityTest], { stdio: "inherit" });
process.exit(typeof p.status === "number" ? p.status : 1);
