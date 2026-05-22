/**
 * Bateria completa — app cliente + portal (produção).
 * node grupodkempreendimentos/scripts/test-app-cliente-completo-producao.mjs
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const SUITES = [
  { name: "Portal geral", script: "test-portal-producao.mjs" },
  { name: "Lançamento aluguel 4 painéis", script: "test-lancamento-aluguel-subdiv-producao.mjs" },
  { name: "Valor devido × tempo", script: "test-valor-devido-tempo-producao.mjs" },
  { name: "CPF Marcus + login José", script: "test-clientes-cpf-app-producao.mjs" },
  { name: "Protocolo 2026010102", script: "test-protocolo-2026010102-producao.mjs" },
  { name: "De acordo", script: "test-cliente-de-acordo-producao.mjs" },
  { name: "Avisos lidos", script: "test-cliente-notificacoes-producao.mjs" },
  { name: "Centavos / fila operador", script: "test-comprovante-040-producao.mjs" },
  { name: "José 0,40 real", script: "test-jose-040-app-producao.mjs" },
  { name: "Invalidar pagamento", script: "test-invalidar-pagamento-producao.mjs" },
];

function runScript(script) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(__dirname, script)], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DK_EXPECT_BUNDLE:
          script === "test-lancamento-aluguel-subdiv-producao.mjs"
            ? "20260522lanc-aluguel-menu"
            : script === "test-invalidar-pagamento-producao.mjs"
              ? process.env.DK_EXPECT_BUNDLE || "20260522lanc-aluguel-menu"
              : process.env.DK_EXPECT_BUNDLE || "20260522jose-040-fix",
      },
    });
    let out = "";
    p.stdout.on("data", (d) => {
      out += d;
      process.stdout.write(d);
    });
    p.stderr.on("data", (d) => {
      out += d;
      process.stderr.write(d);
    });
    p.on("close", (code) => {
      const m = out.match(/---\s*(\d+)\/(\d+)/g);
      const last = m ? m[m.length - 1] : "";
      const parts = last.match(/(\d+)\/(\d+)/);
      resolve({
        code: code ?? 1,
        pass: parts ? Number(parts[1]) : 0,
        total: parts ? Number(parts[2]) : 0,
        summary: last,
      });
    });
  });
}

async function main() {
  console.log("=== Testes app cliente + portal (produção) ===\n");
  const rows = [];
  for (const s of SUITES) {
    console.log(`\n>>> ${s.name} (${s.script})\n`);
    const r = await runScript(s.script);
    rows.push({ ...s, ...r });
  }
  console.log("\n=== RESUMO ===\n");
  let fail = 0;
  for (const r of rows) {
    const ok = r.code === 0;
    if (!ok) fail += 1;
    console.log(`${ok ? "OK" : "FALHOU"} | ${r.name} | ${r.summary || `exit ${r.code}`}`);
  }
  const totalPass = rows.reduce((a, r) => a + r.pass, 0);
  const totalAll = rows.reduce((a, r) => a + r.total, 0);
  console.log(`\nTotal: ${totalPass}/${totalAll} checks | ${rows.length - fail}/${rows.length} suites`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
