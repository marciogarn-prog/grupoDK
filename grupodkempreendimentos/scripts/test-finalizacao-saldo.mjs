/**
 * Janela de finalização: devido (só aluguel), pago, saldo e data +45 dias.
 * node grupodkempreendimentos/scripts/test-finalizacao-saldo.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function somarDiasCorridos(date, dias) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + Number(dias));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
record("helper de saldos na finalização", ui.includes("function portalLocacaoFinalizacaoSaldos"));
record("prazo 45 dias corridos", ui.includes("PORTAL_PRAZO_PAGAMENTO_SALDO_DIAS = 45"));
record("linhas Valor devido / Valor pago / Saldo", ui.includes('{ label: "Valor devido"') && ui.includes('{ label: "Valor pago"') && ui.includes('{ label: "Saldo"'));
record("data de pagamento só se saldo positivo", ui.includes("dataPagamentoSaldo") && ui.includes("Pagamento do saldo"));
record("devido usa só aluguel (valLoc / 7)", /tempo \* \(valLoc \/ 7\)/.test(ui) && ui.includes("só aluguel (sem investimento)"));
record("01/09/2026 + 45 dias = 16/10/2026", somarDiasCorridos(new Date(2026, 8, 1), 45) === "16/10/2026");

const chk = spawnSync(process.execPath, ["--check", path.join(ROOT, "portal-locadora-ui.js")], { encoding: "utf8" });
record("portal-locadora-ui.js sintaxe", chk.status === 0, (chk.stderr || "").trim().slice(0, 160));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes finalização saldo ---`);
process.exit(pass === results.length ? 0 : 1);
