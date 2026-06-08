/**
 * Bateria completa — oficial + demo.
 * node grupodkempreendimentos/scripts/test-sistema-completo-oficial-demo.mjs
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const node = process.execPath;

const SUITES = [
  {
    label: "OFICIAL — portal produção",
    script: "test-portal-producao.mjs",
    env: { DK_TEST_BASE_URL: "https://grupodkempreendimentos.com.br/" },
  },
  {
    label: "DEMO — portal produção",
    script: "test-portal-demo.mjs",
    env: {},
  },
  {
    label: "OFICIAL — hub E2E",
    script: "test-portal-hub-e2e.mjs",
    env: { BASE_URL: "https://grupodkempreendimentos.com.br/" },
  },
  {
    label: "DEMO — hub E2E",
    script: "test-portal-hub-e2e.mjs",
    env: { BASE_URL: "https://demo.grupodkempreendimentos.com.br/" },
  },
  {
    label: "OFICIAL — varredura UI telas/botões",
    script: "test-portal-ui-varredura.mjs",
    env: { DK_TEST_BASE_URL: "https://grupodkempreendimentos.com.br/" },
  },
  {
    label: "DEMO — varredura UI telas/botões",
    script: "test-portal-ui-varredura.mjs",
    env: { DK_TEST_BASE_URL: "https://demo.grupodkempreendimentos.com.br/" },
  },
  {
    label: "OFICIAL — instalação PWA",
    script: "test-instalacao-producao.mjs",
    env: {},
  },
  {
    label: "OFICIAL — lançamentos modo estrito (sem legado demo)",
    script: "test-lancamentos-oficial-strict.mjs",
    env: { DK_TEST_BASE_URL: "https://grupodkempreendimentos.com.br/" },
  },
  {
    label: "DEMO — sincronismo lançamentos portal/app",
    script: "test-lancamentos-sync.mjs",
    env: { DK_TEST_BASE_URL: "https://demo.grupodkempreendimentos.com.br/" },
  },
];

function runSuite(suite) {
  console.log(`\n${"=".repeat(72)}\n>>> ${suite.label}\n${"=".repeat(72)}\n`);
  const r = spawnSync(node, [path.join(scriptDir, suite.script)], {
    stdio: "inherit",
    env: { ...process.env, ...suite.env },
  });
  return typeof r.status === "number" ? r.status : 1;
}

let failed = 0;
for (const s of SUITES) {
  const code = runSuite(s);
  if (code !== 0) failed += 1;
}

console.log(`\n${"=".repeat(72)}`);
console.log(`RESUMO FINAL: ${SUITES.length - failed}/${SUITES.length} suites OK`);
console.log(`${"=".repeat(72)}\n`);
process.exit(failed === 0 ? 0 : 1);
