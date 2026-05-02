/**
 * Grava o backup JSON do DK em uma cópia do Excel financeiro.
 *
 * 1) No app: Área do administrador → Dados de utilização → Exportar backup (JSON).
 * 2) Execute:
 *    node save-backup-to-financeiro-xlsx.cjs "caminho\dk-backup-localstorage-....json"
 *
 * O Excel padrão é:
 *   DK-FINANCEIRO 2026 - Copia.xlsx
 * na pasta do projeto. Passe um segundo argumento para usar outro ficheiro.
 *
 * Abre o .xlsx existente (se houver), remove folhas antigas DK_App_* e adiciona
 * folhas novas com os dados do backup, sem apagar as suas outras abas.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = __dirname;
const DEFAULT_OUT = path.join(ROOT, "DK-FINANCEIRO 2026 - Copia.xlsx");
const PREFIX = "DK_App_";

function safeSheetName(raw) {
  const s = String(raw || "sheet")
    .replace(/[\[\]*?:/\\]/g, "_")
    .slice(0, 31);
  return s || "Sheet";
}

function removeSheetsByPrefix(wb, prefix) {
  const toRemove = wb.SheetNames.filter((n) => String(n).startsWith(prefix));
  toRemove.forEach((name) => {
    delete wb.Sheets[name];
  });
  wb.SheetNames = wb.SheetNames.filter((n) => !String(n).startsWith(prefix));
}

function sheetFromValue(key, val) {
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return XLSX.utils.aoa_to_sheet([
        ["(vazio)"],
        [`chave: ${key}`],
      ]);
    }
    if (typeof val[0] === "object" && val[0] !== null) {
      return XLSX.utils.json_to_sheet(val);
    }
    return XLSX.utils.aoa_to_sheet(val.map((row) => [row]));
  }
  if (val && typeof val === "object") {
    return XLSX.utils.aoa_to_sheet([[JSON.stringify(val, null, 2)]]);
  }
  return XLSX.utils.aoa_to_sheet([[String(val)]]);
}

const jsonPath = process.argv[2];
const outPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUT;

if (!jsonPath || !fs.existsSync(jsonPath)) {
  console.error("Uso: node save-backup-to-financeiro-xlsx.cjs <backup.json> [saida.xlsx]");
  console.error("");
  console.error("Exemplo:");
  console.error(
    `  node save-backup-to-financeiro-xlsx.cjs "${path.join("C:", "Users", "...", "dk-backup-localstorage-xxxx.json")}"`
  );
  console.error("");
  console.error(`Saída padrão (se omitir o 2º argumento):`);
  console.error(`  ${DEFAULT_OUT}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path.resolve(jsonPath), "utf8"));
if (!payload || typeof payload.data !== "object" || !payload.data) {
  console.error("Backup inválido: esperado { data: { ... } }.");
  process.exit(1);
}

let wb;
if (fs.existsSync(outPath)) {
  wb = XLSX.readFile(outPath);
} else {
  wb = XLSX.utils.book_new();
}

removeSheetsByPrefix(wb, PREFIX);

const metaSheet = XLSX.utils.aoa_to_sheet([
  ["propriedade", "valor"],
  ["backup_json_fonte", path.basename(jsonPath)],
  ["backup_version", payload.version ?? ""],
  ["backup_source", payload.source ?? ""],
  ["exportado_em_iso", payload.exportedAtIso ?? ""],
  ["exportado_por", payload.exportedBy ?? ""],
  ["gerado_node_em", new Date().toISOString()],
]);
XLSX.utils.book_append_sheet(wb, metaSheet, safeSheetName(`${PREFIX}meta`));

for (const [key, val] of Object.entries(payload.data)) {
  const ws = sheetFromValue(key, val);
  const name = safeSheetName(`${PREFIX}${key}`);
  let unique = name;
  let n = 2;
  while (wb.SheetNames.includes(unique)) {
    unique = safeSheetName(`${name.slice(0, 27)}_${n}`);
    n += 1;
  }
  XLSX.utils.book_append_sheet(wb, ws, unique);
}

XLSX.writeFile(wb, outPath);
console.log(`OK: dados gravados em`);
console.log(`    ${outPath}`);
console.log(`    (${wb.SheetNames.length} folhas no livro.)`);
