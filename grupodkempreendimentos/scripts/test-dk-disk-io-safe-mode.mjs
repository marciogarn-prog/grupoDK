/**
 * Modo seguro manual: DK_DISK_IO_SAFE_MODE=1.
 * Não fala com Supabase. Confere o que fica suspenso e o que continua gravando.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  diskIoSafeModeAtivo,
  devePularGravacaoManutencaoAutomatica,
} = require("../lib/dk-disk-io-safe-mode.cjs");
const { mergeManutencoesRapidas } = require("../lib/dk-append-only-merge.cjs");
const { corpoPresencaModoSeguro } = require("../api/dk-equipa-presenca.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (nome) => fs.readFileSync(path.join(root, nome), "utf8");

let falhas = 0;
function ok(nome, cond) {
  if (!cond) {
    falhas += 1;
    console.error("FALHA", nome);
    return;
  }
  console.log("ok", nome);
}

const anterior = process.env.DK_DISK_IO_SAFE_MODE;
delete process.env.DK_DISK_IO_SAFE_MODE;
ok("sem variável o modo fica desligado", diskIoSafeModeAtivo() === false);
for (const valor of ["0", "true", "yes", "01", "1 ", ""]) {
  process.env.DK_DISK_IO_SAFE_MODE = valor;
  ok(`valor ${JSON.stringify(valor)} não liga`, diskIoSafeModeAtivo() === false);
}
process.env.DK_DISK_IO_SAFE_MODE = "1";
ok("somente 1 liga", diskIoSafeModeAtivo() === true);
delete process.env.DK_DISK_IO_SAFE_MODE;
ok("remover a variável desliga na hora", diskIoSafeModeAtivo() === false);

const ficha = {
  id: "MR-1",
  placa: "ABC1D23",
  criadoEm: "2026-10-02T12:00:00.000Z",
  valorPago: 40,
  os: "OS000001",
  origemPortal: true,
};
const decidir = (extra) =>
  devePularGravacaoManutencaoAutomatica({
    safeMode: true,
    automatico: true,
    base: [ficha],
    incoming: [ficha],
    merge: mergeManutencoesRapidas,
    ...extra,
  });

ok("abrir o portal com a mesma lista não grava", decidir() === true);
ok(
  "criar manutenção não é bloqueado",
  decidir({
    incoming: [ficha, { ...ficha, id: "MR-2", os: "OS000002", valorPago: 55, criadoEm: "2026-10-03T12:00:00.000Z" }],
  }) === false
);
ok(
  "editar manutenção não é bloqueado",
  decidir({
    incoming: [{ ...ficha, valorPago: 90, criadoEm: "2026-10-04T12:00:00.000Z" }],
  }) === false
);
ok("salvamento explícito não é bloqueado mesmo se igual", decidir({ automatico: false }) === false);
ok("sem a marca de automático não bloqueia", decidir({ automatico: undefined }) === false);
ok("modo desligado volta a gravar até o envio igual", decidir({ safeMode: false }) === false);
ok(
  "comparação que falha não bloqueia",
  devePularGravacaoManutencaoAutomatica({
    safeMode: true,
    automatico: true,
    base: [ficha],
    incoming: [ficha],
    merge() {
      throw new Error("incerto");
    },
  }) === false
);

const suspenso = corpoPresencaModoSeguro();
ok(
  "presença suspensa não apaga e não inventa operador",
  suspenso.ok === true &&
    suspenso.success === true &&
    Array.isArray(suspenso.cpfs) &&
    suspenso.cpfs.length === 0 &&
    suspenso.operadores.length === 0 &&
    suspenso.suspenso === true
);

const lib = ler("lib/dk-disk-io-safe-mode.cjs");
ok("modo não tem timer nem cron", !/setTimeout|setInterval|cron|schedule/.test(lib));

const apiPresenca = ler("api/dk-equipa-presenca.js");
const getPresenca = apiPresenca.slice(apiPresenca.indexOf('if (req.method === "GET")'), apiPresenca.indexOf('if (req.method === "POST")'));
const postPresenca = apiPresenca.slice(apiPresenca.indexOf('if (req.method === "POST")'));
ok(
  "presença no modo seguro não lê nem grava o snapshot",
  getPresenca.indexOf("diskIoSafeModeAtivo()") < getPresenca.indexOf("lerEquipaPresencaComIo") &&
    getPresenca.indexOf("corpoPresencaModoSeguro()") < getPresenca.indexOf("io.ler(") &&
    postPresenca.indexOf("diskIoSafeModeAtivo()") < postPresenca.indexOf("gravarEquipaPresencaComIo(") &&
    postPresenca.indexOf("corpoPresencaModoSeguro()") < postPresenca.indexOf("gravarEquipaPresencaComIo(")
);
ok("logout no modo seguro ainda encerra a sessão", postPresenca.indexOf("clearSessaoAtivaSeDona") < postPresenca.indexOf("corpoPresencaModoSeguro()"));
ok("autenticação continua antes do modo seguro", apiPresenca.indexOf("requireLiveSession") < apiPresenca.indexOf("diskIoSafeModeAtivo()"));

const apiManut = ler("api/cadastro-manutencoes-rapidas.js");
const postManut = apiManut.slice(apiManut.indexOf('if (req.method === "POST")'));
const pulo = postManut.slice(postManut.indexOf("diskIoSafeModeAtivo()"), postManut.indexOf("manutencaoRelacionalAtiva()"));
ok(
  "manutenção igual usa a lista do Supabase e não regrava",
  pulo.includes("ioSnapshotOficial") &&
    pulo.includes("leitura.payload") &&
    pulo.includes("data: base") &&
    !pulo.includes("executarGravacaoCentral") &&
    !pulo.includes("redis.set") &&
    postManut.indexOf("devePularGravacaoManutencaoAutomatica") < postManut.indexOf("executarGravacaoCentral(")
);
ok("gravação real da manutenção continua no caminho do snapshot", postManut.includes("executarGravacaoCentral("));

const tela = ler("portal-manutencao-rapida.js");
const gravar = tela.slice(tela.indexOf("function gravar("), tela.indexOf("function apiHeadersManut"));
const sync = tela.slice(tela.indexOf("function syncManutencoesComNuvem"), tela.indexOf("function linhasDoPeriodo"));
ok("salvar do usuário não marca envio automático", gravar.includes("pushManutencoesParaNuvem(next)") && !gravar.includes("automatico"));
ok("sincronização ao abrir marca envio automático", sync.includes("automatico: true"));
ok("salvar do usuário ainda pede a nuvem", gravar.includes("__DK_pushCloudSnapshotNow"));

const permanentes = [
  "api/cadastro-clientes.js",
  "api/cadastro-veiculos.js",
  "api/dk-cliente-geo.js",
  "api/dk-cloud-snapshot.js",
  "api/dk-locacao.js",
  "lib/dk-persistencia-central.cjs",
  "lib/dk-cliente-geo-pg.cjs",
  "lib/dk-portal-auth.cjs",
  "lib/dk-collect-backup.cjs",
  "api/cron-daily-backup.js",
  "api/dk-backup-latest.js",
  "api/dk-backup-email.js",
  "api/cadastro-financeiro-ceo.js",
  "portal-financeiro-ceo.js",
  "portal-supabase-sync.js",
];
ok(
  "clientes, veículos, locações, financeiro, documentos, autenticação, backup e geo não entram no modo seguro",
  permanentes.every((nome) => fs.existsSync(path.join(root, nome)) && !ler(nome).includes("DK_DISK_IO_SAFE_MODE"))
);

if (anterior == null) delete process.env.DK_DISK_IO_SAFE_MODE;
else process.env.DK_DISK_IO_SAFE_MODE = anterior;

if (falhas) {
  console.error(falhas, "falhas");
  process.exit(1);
}
console.log("test-dk-disk-io-safe-mode ok");
