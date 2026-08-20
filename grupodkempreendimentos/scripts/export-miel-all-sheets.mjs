/**
 * Exporta layout de todas as 84 abas (área visível + vínculos).
 * node scripts/export-miel-all-sheets.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/miel/miel-workbook-map.json"), "utf8"));
const exportScript = path.join(__dirname, "export-miel-sheet-layout.mjs");

const ID_OVERRIDE = {
  "Locação_de_Veículos": "locacao-veiculos",
  Dpto_Pessoal: "depto-pessoal",
  "Ctrl_de_Manutenção": "ctrl-manutencao",
  Consulta_Veíc_ou_Cliente: "consulta-integrada",
  Relação_Clientes: "relacao-clientes",
  Relação_Veículos: "relacao-veiculos",
  Status_Veículos: "status-veiculos",
  "Acomp._Transf._Propriedade": "acomp-transf",
  Relação_de_Motos_Vendidas: "motos-vendidas",
  Form_de_Lista_de_Espera: "form-lista-espera",
  "ID_Chaveiros_(Carros)": "id-chaveiros-carros",
  "ID_Chaveiros_(Motos)": "id-chaveiros-motos",
  Ctrl_Multas: "ctrl-multas",
  Relatório_de_Status_CNH_e_EAR: "relatorio-ear",
};

function colToNum(col) {
  let n = 0;
  for (const c of col) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}

function parseDim(dim) {
  const m = String(dim || "").match(/([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/);
  if (!m) return { maxCol: 20, maxRow: 20 };
  if (!m[3]) return { maxCol: colToNum(m[1]), maxRow: +m[2] };
  return { maxCol: colToNum(m[3]), maxRow: +m[4] };
}

function bounds(s) {
  const dim = parseDim(s.dimension);
  const special = {
    Cad_Clientes: { rowEnd: 11, maxCol: 19, template: 12, header: 11 },
    Cad_Veículos: { rowEnd: 17, maxCol: 22, template: 18, header: 17 },
    Relação_Clientes: { rowEnd: 4, maxCol: 12, template: 5, header: 4 },
    Relação_Veículos: { rowEnd: 4, maxCol: 18, template: 5, header: 4 },
    Status_Veículos: { rowEnd: 4, maxCol: 16, template: 5, header: 4 },
  };
  if (special[s.name]) return special[s.name];
  if (s.index >= 1 && s.index <= 10) {
    return { rowEnd: 46, maxCol: Math.min(82, Math.max(20, dim.maxCol)), template: 47, header: 46 };
  }
  const maxRow = Math.min(Math.max(dim.maxRow || 20, 8), 40);
  const maxCol = Math.min(Math.max(dim.maxCol || 16, 8), 40);
  return { rowEnd: maxRow, maxCol, template: maxRow + 1, header: maxRow };
}

const results = [];
for (const s of map.inventory) {
  if (!s.exists || !s.xml) {
    results.push({ name: s.name, ok: false, err: "xml missing" });
    continue;
  }
  const id = ID_OVERRIDE[s.name] || s.id;
  const b = bounds(s);
  const args = [
    exportScript,
    s.name,
    s.xml,
    `${id}-layout`,
    String(1),
    String(b.rowEnd),
    String(b.maxCol),
    String(b.template),
    String(b.header),
    "layouts",
  ];
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  const ok = r.status === 0;
  results.push({ name: s.name, id, ok, out: (r.stdout || r.stderr || "").trim().split("\n").pop() });
  if (!ok) console.error("FAIL", s.name, r.stderr || r.stdout);
  else console.log(s.index, s.name, "OK");
}

  const copyIds = [
    "cad-clientes",
    "cad-veiculos",
    "relacao-clientes",
    "relacao-veiculos",
    "status-veiculos",
    "consulta-integrada",
    "acomp-transf",
    "motos-vendidas",
    "form-lista-espera",
    "id-chaveiros-carros",
    "id-chaveiros-motos",
    "ctrl-multas",
    "relatorio-ear",
  ];
  const layoutsDir = path.join(__dirname, "../data/miel/layouts");
  const rootDir = path.join(__dirname, "../data/miel");
  for (const id of copyIds) {
    for (const ext of [".js", ".json"]) {
      const src = path.join(layoutsDir, `${id}-layout${ext}`);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(rootDir, `${id}-layout${ext}`));
    }
  }
const failed = results.filter((x) => !x.ok);
console.log("exported", results.filter((x) => x.ok).length, "/", results.length, "fail", failed.length);
if (failed.length) console.log(failed);
