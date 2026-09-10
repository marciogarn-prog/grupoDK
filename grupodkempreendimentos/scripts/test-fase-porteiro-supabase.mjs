/**
 * Porteiro Supabase — testes locais (sem chamar a nuvem).
 * node grupodkempreendimentos/scripts/test-fase-porteiro-supabase.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORTAL = path.join(ROOT, "grupodkempreendimentos");

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail || "") });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

const doorRoot = read(path.join(ROOT, "lib/dk-supabase-doorman.cjs"));
const doorPortal = read(path.join(PORTAL, "lib/dk-supabase-doorman.cjs"));
rec("lib raiz = portal (SHA lógico)", doorRoot === doorPortal, "");
rec("porteiro só SERVICE_ROLE", doorRoot.includes("SUPABASE_SERVICE_ROLE_KEY") && !doorRoot.includes("SUPABASE_ANON_KEY"), "");
rec("porteiro não usa chave publishable", !doorRoot.includes("SUPABASE_PUBLISHABLE_KEY"), "");

const door = require(path.join(PORTAL, "lib/dk-supabase-doorman.cjs"));
const prev = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
rec("sem chave = não configurado", door.isSupabaseDoormanConfigured() === false, "");
const miss = await door.upsertSnapshotByLabel("default", { a: 1 }, new Date().toISOString());
rec("upsert sem chave recusa", miss.ok === false && miss.reason === "doorman_key_missing", miss.reason);
if (prev != null) process.env.SUPABASE_SERVICE_ROLE_KEY = prev;

const snapRoot = read(path.join(ROOT, "api/dk-cloud-snapshot.js"));
const snapPortal = read(path.join(PORTAL, "api/dk-cloud-snapshot.js"));
rec("API snapshot chama porteiro", snapRoot.includes("upsertSnapshotByLabel") && snapPortal.includes("upsertSnapshotByLabel"), "");
rec("API snapshot GET fallback", snapRoot.includes('source: "supabase"') && snapRoot.includes("fetchSnapshotByLabel"), "");
rec("POST devolve supabase.ok", snapRoot.includes("supabase: { ok:") || snapRoot.includes("supabase: { ok: Boolean"), "");

const syncJs = read(path.join(PORTAL, "portal-supabase-sync.js"));
rec("browser não faz upsert direto", !syncJs.includes('.from("dk_cloud_snapshots")'), "");
rec("probe não usa anon", syncJs.includes("doorman_server"), "");
rec("push lê supabase da API", syncJs.includes("red.supabase") && syncJs.includes("pushRedundantSnapshotPayload"), "");

const uiJs = read(path.join(PORTAL, "portal-locadora-ui.js"));
rec("UI não lê snapshot anon", !uiJs.includes('.from("dk_cloud_snapshots")'), "");

const sql = read(path.join(PORTAL, "supabase/fase-porteiro-service-role.sql"));
rec("SQL GRANT service_role", /grant select, insert, update/i.test(sql) && sql.includes("service_role"), "");
rec("SQL não libera anon", !/grant\s+.+\s+to\s+anon/i.test(sql), "");

const html = read(path.join(PORTAL, "index.html"));
rec("cache-bust porteiro", html.includes("20260910porteiro"), "");

const backup = read(path.join(PORTAL, "lib/dk-collect-backup.cjs"));
rec("backup sem fallback anon", !backup.includes("SUPABASE_ANON_KEY") && backup.includes("doorman_key_missing"), "");

const failed = results.filter((x) => !x.ok);
console.log(`\nPorteiro local: ${results.length - failed.length}/${results.length} OK`);
if (failed.length) process.exit(1);
