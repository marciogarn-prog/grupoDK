/**
 * Avisos de pagamento não podem ser apagados pelo filtro oficial
 * (dk_cliente_notificacoes era tratado como cadastro de cliente).
 * node grupodkempreendimentos/scripts/test-avisos-pagamento-guard.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const guardSrc = readFileSync(join(root, "dk-oficial-cadastro-guard.js"), "utf8");
record("família notificacao antes de cliente", /includes\("notificac"\)[\s\S]*includes\("cliente"\)/.test(guardSrc));
record("datas de aviso usam criadoEm", guardSrc.includes("notificacao: [\"criadoEm\", \"createdAt\", \"dataPagamento\"]"));

const sandbox = { window: { __DK_IS_DEMO_DEPLOY__: false }, console };
vm.createContext(sandbox);
vm.runInContext(guardSrc, sandbox);
const filter = sandbox.window.__DK_filterOficialCadastroArray;
const sanitize = sandbox.window.__DK_sanitizeOficialCloudPayload;

const aviso = {
  id: "cn_test_ailton",
  tipo: "pagamento_lancado",
  cpf: "06336638405",
  protocolo: "2025092903",
  placa: "SPA5A67",
  valor: 350,
  dataPagamento: "24/08/2026",
  mensagem: "Pagamento de R$ 350,00 em 24/08/2026 registado no protocolo 2025092903 · veículo SPA5A67.",
  criadoEm: "2026-08-24T15:00:00.000Z",
  createdAt: "2026-08-24T15:00:00.000Z",
  origemPortal: true,
  lido: false,
};
const kept = filter("dk_cliente_notificacoes", [aviso]);
record("filtro oficial mantém aviso de pagamento", Array.isArray(kept) && kept.length === 1 && kept[0].id === aviso.id);

const payload = sanitize({ dk_cliente_notificacoes: [aviso] });
record(
  "sanitize da nuvem mantém aviso de pagamento",
  Array.isArray(payload.dk_cliente_notificacoes) && payload.dk_cliente_notificacoes.length === 1
);

const apiSrc = readFileSync(join(root, "api/dk-cloud-snapshot.js"), "utf8");
record("API trata notificac à parte de cliente", apiSrc.includes("includes(\"notificac\")") && apiSrc.includes("isNotif"));

const notifSrc = readFileSync(join(root, "cliente-notificacoes.js"), "utf8");
record("origemPortal nos avisos novos", notifSrc.includes("origemPortal: true"));
record("reposição local dos pagamentos no app", notifSrc.includes("garantirAvisosPagamentosDoCliente"));

const appSrc = readFileSync(join(root, "cliente-app.js"), "utf8");
record("app cliente chama reposição antes de pintar avisos", appSrc.includes("garantirAvisosPagamentosNoApp"));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes avisos pagamento ---`);
process.exit(pass === results.length ? 0 : 1);
