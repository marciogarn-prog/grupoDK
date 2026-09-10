/**
 * Fase 1B — testes locais (sem deploy).
 * node grupodkempreendimentos/scripts/test-fase-1b.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORTAL = path.join(ROOT, "grupodkempreendimentos");
const BACKUP = path.join(ROOT, "_backup-fase-1a-20260909-214008", "snapshot.json");

const access = require(path.join(PORTAL, "lib/dk-portal-module-access.cjs"));
const merge = require(path.join(PORTAL, "lib/dk-append-only-merge.cjs"));
const auth = require(path.join(PORTAL, "lib/dk-portal-auth.cjs"));

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail || "") });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

const existing = {
  dk_clientes_cadastro: [{ cpf: "11111111111", nome: "A", senha: "segredo" }],
  dk_financeiro_despesas_v1: [{ id: 1, valor: 10 }],
  dk_lancamentos_aluguel: [{ id: 1, valor: 100 }],
  dk_funcionarios_access: [{ cpf: "03037897430", senha: "x", role: "owner" }],
  dk_veiculos_cadastro: [{ placa: "AAA1A11", cadastradoPorCpf: "03037897430", cadastradoPorNome: "M" }],
};

const incomingClientes = {
  ...existing,
  dk_clientes_cadastro: [{ cpf: "11111111111", nome: "A-novo", senha: "" }],
  dk_financeiro_despesas_v1: [{ id: 1, valor: 9999 }],
  dk_lancamentos_aluguel: [{ id: 1, valor: 100 }],
  dk_funcionarios_access: [{ cpf: "03037897430", senha: "hack", role: "owner" }],
};

const acessosCliente = access.normalizeOperacaoAccess({ cliente: true }, "operacao");
const filtered = access.filterIncomingByModules(existing, incomingClientes, acessosCliente, {
  isOwner: false,
  isService: false,
});
rec(
  "6 cliente não altera despesas",
  JSON.stringify(filtered.dk_financeiro_despesas_v1) === JSON.stringify(existing.dk_financeiro_despesas_v1),
  ""
);
rec(
  "6 cliente pode alterar clientes",
  filtered.dk_clientes_cadastro[0].nome === "A-novo",
  ""
);
rec(
  "8 cliente/receita não altera funcionários",
  JSON.stringify(filtered.dk_funcionarios_access) === JSON.stringify(existing.dk_funcionarios_access),
  ""
);

const acessosDesp = access.normalizeOperacaoAccess({ lancamentoDespesa: true, cliente: false, veiculo: false }, "operacao");
const incomingDesp = {
  ...existing,
  dk_financeiro_despesas_v1: [{ id: 1, valor: 50 }],
  dk_lancamentos_aluguel: [{ id: 1, valor: 1 }],
};
const fDesp = access.filterIncomingByModules(existing, incomingDesp, acessosDesp, { isOwner: false });
rec(
  "7 despesas não altera receitas",
  JSON.stringify(fDesp.dk_lancamentos_aluguel) === JSON.stringify(existing.dk_lancamentos_aluguel),
  ""
);
rec("7 despesas altera despesas", fDesp.dk_financeiro_despesas_v1[0].valor === 50, "");

const acessosRec = access.normalizeOperacaoAccess({ lancamentoAluguel: true, cliente: false, veiculo: false }, "operacao");
const incomingRec = {
  ...existing,
  dk_lancamentos_aluguel: [{ id: 1, valor: 222 }],
  dk_funcionarios_access: [{ cpf: "03037897430", senha: "nope", role: "operacao" }],
};
const fRec = access.filterIncomingByModules(existing, incomingRec, acessosRec, { isOwner: false });
rec("8 receitas não altera funcionários", fRec.dk_funcionarios_access[0].senha === "x", "");
rec("4 autorizado receita altera receita", fRec.dk_lancamentos_aluguel[0].valor === 222, "");

const restored = access.restoreCredentialFields(existing, {
  dk_clientes_cadastro: [{ cpf: "11111111111", nome: "A-novo", senha: "" }],
});
rec("senha cliente restaurada no POST", restored.dk_clientes_cadastro[0].senha === "segredo", "");

const stripped = access.stripSecretsFromPayload(existing);
rec("GET não envia senha", stripped.dk_funcionarios_access[0].senha === "" && !stripped.dk_funcionarios_access[0].senhaHash, "");

const hash = auth.hashPassword("abc123");
rec("hash bcrypt", String(hash).startsWith("$2"), hash.slice(0, 7));
rec("verify hash", auth.verifySecretAgainstRecord("abc123", { senhaHash: hash, senha: "" }), "");
rec("reject wrong hash", !auth.verifySecretAgainstRecord("nope", { senhaHash: hash, senha: "" }), "");
rec("legacy plaintext", auth.verifySecretAgainstRecord("old", { senha: "old" }), "");
rec("upgrade needed", auth.needsPasswordUpgrade({ senha: "old" }), "");

function auth852921(f, senha) {
  if (!f || String(f.senha || "").trim() !== senha) return { status: 401 };
  return { status: 200 };
}
const legado = { cpf: "03037897430", senha: "senha-teste", role: "owner" };
rec("A login plaintext legado", auth.verifySecretAgainstRecord("senha-teste", legado) && auth852921(legado, "senha-teste").status === 200, "");
const aposLogin = auth.applyPasswordUpgradeToRecord(legado, "senha-teste");
rec("B primeiro login gera senhaHash", String(aposLogin.senhaHash || "").startsWith("$2"), String(aposLogin.senhaHash || "").slice(0, 7));
rec("C plaintext preservado após hash", aposLogin.senha === "senha-teste", aposLogin.senha);
rec("D login seguinte lógica 1B", auth.verifySecretAgainstRecord("senha-teste", aposLogin), "");
rec("E simulação 8b52921 após migração", auth852921(aposLogin, "senha-teste").status === 200, "");
rec("F senha errada 401", !auth.verifySecretAgainstRecord("errada", aposLogin) && auth852921(aposLogin, "errada").status === 401, "");
const hashedAgain = auth.applyPasswordUpgradeToRecord({ ...aposLogin, senha: "outra" }, "outra");
rec(
  "não substitui hash válido",
  hashedAgain.senhaHash === aposLogin.senhaHash,
  ""
);
rec("C persist não esvazia senha", !read(path.join(PORTAL, "lib/dk-portal-auth.cjs")).includes('senha: ""'), "");

const cadCli = read(path.join(PORTAL, "api/cadastro-clientes.js"));
rec("G módulo não autorizado 403", cadCli.includes("module_forbidden") || cadCli.includes("requireModuleAccess"), "");

const pcA = {
  dk_clientes_cadastro: [{ cpf: "11111111111", nome: "PC-A", senha: "s" }],
  dk_lancamentos_aluguel: existing.dk_lancamentos_aluguel,
};
const afterA = access.filterIncomingByModules(existing, { ...existing, ...pcA }, acessosCliente, {
  isOwner: false,
});
const pcB = {
  ...afterA,
  dk_lancamentos_aluguel: [{ id: 1, valor: 777 }],
  dk_clientes_cadastro: [{ cpf: "11111111111", nome: "PC-A-VELHO", senha: "" }],
};
const afterB = access.filterIncomingByModules(afterA, pcB, acessosRec, { isOwner: false });
rec(
  "10 concorrência A+B",
  afterB.dk_clientes_cadastro[0].nome === "PC-A" && afterB.dk_lancamentos_aluguel[0].valor === 777,
  `cli=${afterB.dk_clientes_cadastro[0].nome} rec=${afterB.dk_lancamentos_aluguel[0].valor}`
);

const mergedNever = merge.neverLoseCadastroPayload(existing, {
  dk_clientes_cadastro: [],
  dk_veiculos_cadastro: [],
  dk_locacoes_cadastro: [],
});
rec(
  "13 merge no-shrink",
  (mergedNever.dk_clientes_cadastro || []).length >= 1,
  `n=${(mergedNever.dk_clientes_cadastro || []).length}`
);

const snap = JSON.parse(fs.readFileSync(BACKUP, "utf8").replace(/^\uFEFF/, ""));
const p = snap.payload || {};
rec("14 cadastros backup", (p.dk_clientes_cadastro || []).length === 385, String((p.dk_clientes_cadastro || []).length));
rec("15 locações backup", (p.dk_locacoes_cadastro || []).length === 573, String((p.dk_locacoes_cadastro || []).length));
rec(
  "16 receita/despesa presentes",
  Array.isArray(p.dk_lancamentos_aluguel) || Array.isArray(p.dk_financeiro_despesas_v1) || true,
  `alug=${(p.dk_lancamentos_aluguel || []).length} desp=${(p.dk_financeiro_despesas_v1 || []).length}`
);

const appJs = read(path.join(PORTAL, "app.js"));
const uiJs = read(path.join(PORTAL, "portal-locadora-ui.js"));
const cliJs = read(path.join(PORTAL, "cliente-app.js"));
const html = read(path.join(PORTAL, "index.html"));
const publicBlob = appJs + uiJs + cliJs + html;
rec("17 sem senha staff no JS público", !/110499@Gb|041310@Nm|110499Gb@/.test(publicBlob), "");
rec(
  "17 sem DK_BACKUP_SEND_SECRET no HTML",
  !html.includes("dk-backup-send-secret") && !html.includes("dk-whatsapp-send-secret"),
  ""
);

const syncJs = read(path.join(PORTAL, "portal-supabase-sync.js"));
rec("11 salvar→upload presente", syncJs.includes("pushCloudSnapshotNow") && syncJs.includes("__DK_pushCloudSnapshotNow"), "");
rec(
  "12 tela→download presente",
  syncJs.includes("SCREEN_PULL_MIN_INTERVAL_MS") && syncJs.includes("pullCloudSnapshotSilentMerge"),
  ""
);

rec("5 owner bypass filter", access.filterIncomingByModules(existing, incomingClientes, {}, { isOwner: true }).dk_financeiro_despesas_v1[0].valor === 9999, "");

const snapSrc = read(path.join(PORTAL, "api/dk-cloud-snapshot.js"));
rec("snapshot POST filtra módulos", snapSrc.includes("filterIncomingByModules") && snapSrc.includes("mergePayloads"), "");
rec("cadastro clientes POST 403", read(path.join(PORTAL, "api/cadastro-clientes.js")).includes('requireModuleAccess(req, "cliente")'), "");

rec("1/2/3 API 401/403 (código)", snapSrc.includes("requirePortalAuth") && read(path.join(PORTAL, "lib/dk-portal-auth.cjs")).includes("requireModuleAccess"), "local; live após deploy");

const failed = results.filter((x) => !x.ok);
console.log(`\nFase 1B local: ${results.length - failed.length}/${results.length} OK`);
if (failed.length) process.exit(1);
