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

const neverLoseTest = path.join(scriptDir, "test-never-lose-cadastro.mjs");
const n = spawnSync(process.execPath, [neverLoseTest], {
  stdio: "inherit",
});
if (n.status !== 0) process.exit(typeof n.status === "number" ? n.status : 1);

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

const cad10Test = path.join(scriptDir, "test-demo-cadastro-10.mjs");
const c10 = spawnSync(process.execPath, [cad10Test], {
  stdio: "inherit",
  env: { ...process.env, DK_TEST_BASE_URL: base },
});
if (c10.status !== 0) process.exit(typeof c10.status === "number" ? c10.status : 1);

const handoffTest = path.join(scriptDir, "test-manutencao-handoff-7-8.mjs");
const h = spawnSync(process.execPath, [handoffTest], {
  stdio: "inherit",
  env: { ...process.env, DK_TEST_BASE_URL: base },
});
if (h.status !== 0) process.exit(typeof h.status === "number" ? h.status : 1);

const p = spawnSync(process.execPath, [parityTest], { stdio: "inherit" });
process.exit(typeof p.status === "number" ? p.status : 1);
