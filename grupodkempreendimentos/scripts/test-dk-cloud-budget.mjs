/**
 * Proteção financeira da nuvem (sem chamar produção).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const budget = fs.readFileSync(path.join(ROOT, "lib/dk-cloud-budget.cjs"), "utf8");
const redis = fs.readFileSync(path.join(ROOT, "lib/dk-redis-env.cjs"), "utf8");
const auth = fs.readFileSync(path.join(ROOT, "lib/dk-portal-auth.cjs"), "utf8");
const snap = fs.readFileSync(path.join(ROOT, "api/dk-cloud-snapshot.js"), "utf8");
const fin = fs.readFileSync(path.join(ROOT, "api/cadastro-financeiro-ceo.js"), "utf8");
const sync = fs.readFileSync(path.join(ROOT, "portal-supabase-sync.js"), "utf8");
const ceo = fs.readFileSync(path.join(ROOT, "portal-financeiro-ceo.js"), "utf8");
const door = fs.readFileSync(path.join(ROOT, "lib/dk-supabase-doorman.cjs"), "utf8");

rec("orçamento horário existe", budget.includes("SNAP_GET_HOUR_MAX = 600") && budget.includes("SNAP_POST_HOUR_MAX = 240"), "");
rec("cota estourada corta Redis", redis.includes("tripCloudBudget") && redis.includes("isQuotaError"), "");
rec("rate limit não fail-open em cota", auth.includes("budgetReject") && auth.includes("isQuotaError(e)"), "");
rec("snapshot respeita orçamento", snap.includes("assertHourlyBudget") && snap.includes("cloud_budget"), "");
rec("financeiro CEO corta na cota", fin.includes("isCloudBudgetTripped") && ceo.includes("cloud_budget"), "");
rec("frontend para de gastar nuvem", sync.includes("haltCloudBudget") && sync.includes("proteção financeira"), "");
rec("Supabase não é chamado no corte", door.includes('reason: "cloud_budget"'), "");

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- ${results.length - failed}/${results.length} testes cloud-budget ---`);
process.exit(failed ? 1 : 0);
