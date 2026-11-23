/**
 * Receita real por semana (rotatividade): dia a dia, semanas dom→sáb, quebradas.
 * node grupodkempreendimentos/scripts/test-receita-real-semanal.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import assert from "assert";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ui = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function brToMs(br) {
  const m = String(br).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return NaN;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 0, 0, 0, 0).getTime();
}
function msIni(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function domingo(ms) {
  const d = new Date(msIni(ms));
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}
function receitaDia(locs, dayMs) {
  const dia = msIni(dayMs);
  let s = 0;
  for (const loc of locs) {
    const ini = msIni(brToMs(loc.inicio));
    if (dia < ini) continue;
    if (loc.fim) {
      const fim = msIni(brToMs(loc.fim));
      if (dia >= fim) continue;
    }
    s += loc.semanal / 7;
  }
  return s;
}
function calc(locs, iniBr, fimBr) {
  const first = msIni(brToMs(iniBr));
  const last = msIni(brToMs(fimBr));
  const by = new Map();
  let total = 0;
  const cur = new Date(first);
  while (cur.getTime() <= last) {
    const day = cur.getTime();
    const r = receitaDia(locs, day);
    const dom = domingo(day);
    if (!by.has(dom)) by.set(dom, { dias: 0, receita: 0, ini: day, fim: day });
    const w = by.get(dom);
    w.fim = day;
    w.dias += 1;
    w.receita += r;
    total += r;
    cur.setDate(cur.getDate() + 1);
  }
  return { total, semanas: [...by.values()] };
}

const fails = [];
function ok(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
  if (!cond) fails.push(name);
}

ok("UI tem cálculo dia a dia", /portalCalcularReceitaRealSemanalRotatividade/.test(ui));
ok("UI usa valor semanal / 7", /sem \/ 7/.test(ui));
ok("UI semana começa no domingo", /portalDomingoSemanaRotatividade/.test(ui));
ok("HTML tem caixa receita real", /operacaoRotatividadeReceitaRealBox/.test(html));
ok("CSS tem estilo verde da caixa", /portal-rotatividade-receita-real/.test(css));

// Exemplo do titular (ajustado: +2 de 50 => 22, não 12)
const locs = [
  ...Array.from({ length: 10 }, () => ({ inicio: "01/11/2026", fim: "", semanal: 287 })), // 41/dia
  ...Array.from({ length: 20 }, () => ({ inicio: "01/11/2026", fim: "", semanal: 350 })), // 50/dia
];
// finaliza 1 de 41 no dia 02; cria 2 de 50 no dia 02
locs[0].fim = "02/11/2026";
locs.push({ inicio: "02/11/2026", fim: "", semanal: 350 });
locs.push({ inicio: "02/11/2026", fim: "", semanal: 350 });

const d1 = receitaDia(locs, brToMs("01/11/2026"));
const d2 = receitaDia(locs, brToMs("02/11/2026"));
ok("dia 1 = 10×41 + 20×50", Math.abs(d1 - (10 * 41 + 20 * 50)) < 0.01, String(d1));
ok("dia 2 = 9×41 + 22×50", Math.abs(d2 - (9 * 41 + 22 * 50)) < 0.01, String(d2));

// Mês começando quarta: 01/04/2026 é quarta → 1ª semana quebrada qua–sáb (4 dias)
assert.strictEqual(new Date(2026, 3, 1).getDay(), 3);
const abril = calc([{ inicio: "01/01/2026", fim: "", semanal: 700 }], "01/04/2026", "30/04/2026");
ok("abril/2026 tem semana quebrada de 4 dias no início", abril.semanas[0].dias === 4, String(abril.semanas[0].dias));
ok("abril/2026 última semana também pode ser quebrada", abril.semanas[abril.semanas.length - 1].dias <= 7);

// Nov/2026 começa domingo → 1ª semana completa 7 dias se filtro 01–07
assert.strictEqual(new Date(2026, 10, 1).getDay(), 0);
const nov = calc([{ inicio: "01/10/2026", fim: "", semanal: 350 }], "01/11/2026", "07/11/2026");
ok("01–07/11/2026 = 1 semana de 7 dias", nov.semanas.length === 1 && nov.semanas[0].dias === 7);
ok("7 dias × 50 = 350", Math.abs(nov.total - 350) < 0.01, String(nov.total));

if (fails.length) {
  console.error(`FAIL ${fails.length}`);
  process.exit(1);
}
console.log("OK receita real semanal");
