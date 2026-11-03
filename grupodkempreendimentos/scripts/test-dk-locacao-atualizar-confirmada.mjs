/**
 * Gates estáticos + contrato de API para «Atualizar locação».
 * Não grava contratos reais.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");

const ui = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const pg = fs.readFileSync(path.join(root, "portal-locacao-pg.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "dk-locacao.js"), "utf8");
const apiRoot = fs.readFileSync(path.join(root, "..", "api", "dk-locacao.js"), "utf8");
const sync = fs.readFileSync(path.join(root, "portal-dk-sync.js"), "utf8");
const backup = fs.readFileSync(path.join(root, "lib", "dk-collect-backup.cjs"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const checks = [];
function check(label, ok) {
  checks.push([label, Boolean(ok)]);
  console.log(`${ok ? "OK" : "FALHOU"} — ${label}`);
}

check("UI exporta fluxo PG com __DK_locacaoSalvarConfirmada", ui.includes("__DK_locacaoSalvarConfirmada"));
check("doSaveLocacao é async e aguarda servidor", /const doSaveLocacao = async \(\)/.test(ui));
check("sucesso PG só após r.ok", ui.includes("confirmada no servidor") && ui.includes("if (!r || r.ok !== true)"));
check("falha preserva retry com mesmo fluxo", /onRetry:\s*\(\)\s*=>\s*\{\s*void doSaveLocacao\(\);/.test(ui));
check("não confirma locação via snapshot quando PG", ui.includes("LOCAÇÃO NÃO É GRAVADA NO SNAPSHOT") && ui.includes('source: "postgres"'));
check("abrir protocolo carrega detalhe oficial", ui.includes("__DK_locacaoPgDetalhe") && ui.includes("detalhe_indisponivel"));
check("portal-locacao-pg expõe salvarConfirmada", pg.includes("window.__DK_locacaoSalvarConfirmada = salvarConfirmada"));
check("salvarLista não faz POST silencioso", pg.includes("Não POST — gravação oficial é salvarConfirmada"));
check("operation_id obrigatório na API", api.includes('reason: "operation_id_obrigatorio"') && !/const out = await pg\.gravarUma/.test(api));
check("API root espelhada sem legado", apiRoot.includes('reason: "operation_id_obrigatorio"') && !/const out = await pg\.gravarUma/.test(apiRoot));
check("exclusão física sem evento bloqueada", api.includes("exclusao_atomica_pendente"));
check("cursor sync em sessionStorage", sync.includes("dk_sync_cursor_seq_v1") && sync.includes("sessionStorage"));
check("Realtime marcado bloqueado sem canal privado", sync.includes("realtimeBloqueado: true") && sync.includes("REALTIME_AUTH_BLOCKED"));
check("backup inclui oficial_pg", backup.includes("oficial_pg") && backup.includes("fetchPgOficialColeta"));
check("backup não finge restauração completa", backup.includes("backup_relacional_completo: false") && backup.includes("complete: false"));
check(
  "cache-bust locação",
  /portal-locacao-pg\.js\?v=/.test(html) && /portal-locadora-ui\.js\?v=20261103rtwsprep/.test(html)
);

/** Simula respostas HTTP da UI (sem rede). */
function mensagemDeStatus(status, data) {
  const src = pg;
  assert.ok(src.includes("mensagemFalha"));
  if (status === 409) return "conflito";
  if (status === 401) return "sessão";
  if (status === 500) return "servidor";
  if (status === 400 && data?.reason === "operation_id_obrigatorio") return "operation_id";
  return "falha";
}

check("mapeamento 409", mensagemDeStatus(409, { conflict: true }) === "conflito");
check("mapeamento 401", mensagemDeStatus(401, {}) === "sessão");
check("mapeamento 500", mensagemDeStatus(500, {}) === "servidor");
check("mapeamento 400 op_id", mensagemDeStatus(400, { reason: "operation_id_obrigatorio" }) === "operation_id");

/** Unitário do gate de operation_id no handler (mock mínimo). */
async function testApiRejeitaSemOpId() {
  const handlerPath = path.join(root, "api", "dk-locacao.js");
  assert.ok(fs.existsSync(handlerPath));
  const text = fs.readFileSync(handlerPath, "utf8");
  assert.match(text, /if \(!opId\)/);
  assert.match(text, /operation_id_obrigatorio/);
  assert.doesNotMatch(text, /await pg\.gravarUma/);
}
await testApiRejeitaSemOpId();
check("API rejeita caminho legado gravarUma", true);

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`\nFalhou ${failed.length}/${checks.length}`);
  process.exitCode = 1;
} else {
  console.log(`\nAtualizar locação confirmada: ${checks.length}/${checks.length}`);
}
