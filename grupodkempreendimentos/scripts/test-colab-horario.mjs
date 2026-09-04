/**
 * node grupodkempreendimentos/scripts/test-colab-horario.mjs
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { horarioPadrao, statusHorario, AVISO_TEXTO } = require(path.join(ROOT, "portal-colab-horario.js"));

const padrao = horarioPadrao();
const checks = [
  ["padrão seg ativo 08:00-18:00", padrao.seg.ativo === true && padrao.seg.inicio === "08:00" && padrao.seg.fim === "18:00"],
  ["padrão sex ativo", padrao.sex.ativo === true && padrao.sex.inicio === "08:00"],
  ["padrão sab desmarcado", padrao.sab.ativo === false],
  ["padrão dom desmarcado", padrao.dom.ativo === false],
  ["texto aviso 30 min", AVISO_TEXTO === "O SISTEMA FICARA INDISPONIVEL EM 30 MINUTOS"],
];

const quarta10 = new Date(2026, 8, 2, 10, 0, 0); // qua 02/09/2026 10:00
const stOk = statusHorario(padrao, quarta10);
checks.push(["quarta 10:00 permitido", stOk.permitido === true && stOk.avisar30 !== true]);

const quarta1730 = new Date(2026, 8, 2, 17, 30, 0);
const st30 = statusHorario(padrao, quarta1730);
checks.push(["quarta 17:30 avisa 30 min", st30.permitido === true && st30.avisar30 === true && st30.faltamMinutos === 30]);

const quarta18 = new Date(2026, 8, 2, 18, 0, 0);
const stFim = statusHorario(padrao, quarta18);
checks.push(["quarta 18:00 bloqueado", stFim.permitido === false]);

const sabado10 = new Date(2026, 8, 5, 10, 0, 0); // sáb 05/09/2026
const stSab = statusHorario(padrao, sabado10);
checks.push(["sábado sem acesso", stSab.permitido === false]);

const legado = statusHorario(null, quarta10);
checks.push(["sem horário cadastrado não bloqueia", legado.permitido === true && legado.legado === true]);

let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}`);
  if (!ok) fail += 1;
}
if (fail) {
  console.error(`\n${fail} falha(s)`);
  process.exit(1);
}
console.log(`\n${checks.length} checks OK`);
