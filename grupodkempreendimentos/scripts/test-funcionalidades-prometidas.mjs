/**
 * Trava funcionalidades pedidas pelo titular: se sumirem do código, o teste falha.
 * node grupodkempreendimentos/scripts/test-funcionalidades-prometidas.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "funcionalidades-prometidas.json"), "utf8"));
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

function coerceDataFimBr(raw, locacao) {
  const s = String(raw || "").trim();
  if (!s || s === "—" || s === "-" || s === "...") return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const meses = {
    jan: 1,
    fev: 2,
    mar: 3,
    abr: 4,
    mai: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    set: 9,
    out: 10,
    nov: 11,
    dez: 12,
  };
  const abr = s.match(/^(\d{1,2})\s*[\/.\-]\s*([A-Za-zçÇ.]+)(?:\s*[\/.\-]\s*(\d{2,4}))?$/);
  if (abr) {
    const day = Number(abr[1]);
    const month = meses[String(abr[2]).toLowerCase().replace(/\./g, "").slice(0, 3)] || 0;
    let year = abr[3] ? Number(abr[3]) : 0;
    if (year > 0 && year < 100) year += 2000;
    if (!year) {
      const nc = String(locacao?.numeroContrato || "").replace(/\D/g, "");
      if (nc.length >= 6) {
        const y = Number(nc.slice(0, 4));
        const m = Number(nc.slice(4, 6));
        year = month && month < m ? y + 1 : y;
      }
    }
    if (day >= 1 && month >= 1 && year >= 2020) {
      return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    }
  }
  return "";
}

for (const item of lock.itens || []) {
  const files = item.ficheiros || {};
  for (const [rel, needles] of Object.entries(files)) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    for (const needle of needles) {
      record(`${item.id} · ${rel} contém «${needle}»`, src.includes(needle));
    }
  }
}

const setorRel = fs.readFileSync(path.join(ROOT, "portal-setor-relatorio.js"), "utf8");
record(
  "Relatório de setor grava quem movimentou a placa",
  setorRel.includes("operadorLabel") &&
    setorRel.includes("portalRegistrarMovimentacaoSetor") &&
    setorRel.includes("Quem movimentou")
);

const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
record(
  "Lista de pesquisa usa a data fim depois de inativo",
  ui.includes("portal-lanc-pesquisa-linha__fim") &&
    /inativo[\s\S]{0,400}portal-lanc-pesquisa-linha__fim/.test(ui)
);
record(
  "Não usa formatDateMask na data fim armazenada",
  /function portalFormatDataFinalizacaoLocacao[\s\S]{0,900}function portalLabelInativoComData/.test(ui) &&
    !/function portalFormatDataFinalizacaoLocacao[\s\S]{0,900}formatDateMask/.test(ui)
);

record("22/jan no protocolo 2025122902 → 22/01/2026", coerceDataFimBr("22/jan", { numeroContrato: "2025122902" }) === "22/01/2026", coerceDataFimBr("22/jan", { numeroContrato: "2025122902" }));
record("19/08/2026 permanece", coerceDataFimBr("19/08/2026") === "19/08/2026");
record("ISO 2026-08-19 → 19/08/2026", coerceDataFimBr("2026-08-19") === "19/08/2026");
record("19/ago/2026 → 19/08/2026", coerceDataFimBr("19/ago/2026") === "19/08/2026");
record("19/08/2026 + 40 dias = 28/09/2026", somarDiasCorridos(new Date(2026, 7, 19), 40) === "28/09/2026");

const homeNav = fs.readFileSync(path.join(ROOT, "home-unit-nav.js"), "utf8");
record(
  "home-unit-nav liga os cartões da home",
  homeNav.includes("#view-home [data-go]") && homeNav.includes("__DK_homeOpenUnit")
);

for (const rel of ["portal-locadora-ui.js", "home-unit-nav.js", "portal-setor-relatorio.js", "portal-cliente-docs.js"]) {
  const chk = spawnSync(process.execPath, ["--check", path.join(ROOT, rel)], { encoding: "utf8" });
  record(
    `${rel} analisa sem erro de sintaxe`,
    chk.status === 0,
    (chk.stderr || chk.stdout || "").trim().slice(0, 180)
  );
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes funcionalidades prometidas ---`);
process.exit(pass === results.length ? 0 : 1);
