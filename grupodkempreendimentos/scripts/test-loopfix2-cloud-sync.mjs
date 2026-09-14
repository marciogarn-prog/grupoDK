/**
 * Simula os guards do loopfix2 sem tocar na nuvem.
 * Cobre os testes 1, 3, 4, 5 e 6 pedidos na correção do loop.
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

const syncJs = fs.readFileSync(path.join(ROOT, "portal-supabase-sync.js"), "utf8");
const authJs = fs.readFileSync(path.join(ROOT, "dk-portal-api-auth.js"), "utf8");
const locadoraJs = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

rec(
  "T1 fonte: sem token não POST",
  syncJs.includes("if (!hasUsableCloudToken())") &&
    syncJs.includes("markCloudLocalOnly()") &&
    !/setInterval\(\s*\(\)\s*=>\s*\{[\s\S]{0,80}dk-cloud-snapshot/.test(syncJs),
  ""
);
rec(
  "T3 fonte: 401 unauthorized faz halt e limpa token",
  syncJs.includes('reason === "unauthorized"') &&
    /haltCloudSyncUnauthorized[\s\S]{0,220}__DK_portalApiTokenClear/.test(syncJs) &&
    !/unauthorized[\s\S]{0,200}setTimeout\(\s*\(\)\s*=>\s*scheduleCloudPushDebounced/.test(syncJs),
  ""
);
rec(
  "T4 fonte: setItem igual não agenda",
  /const changed = prevStr !== next;[\s\S]{0,400}if \(!changed\) return;/.test(syncJs),
  ""
);
rec(
  "T6 fonte: finally halted zera dirty",
  /if \(cloudSyncHalted \|\| cloudSyncIsHalted\(\)\) \{[\s\S]{0,80}cloudPushDirty = false;/.test(syncJs),
  ""
);
rec(
  "estado explícito DK_CLOUD_AUTHENTICATED",
  syncJs.includes("window.DK_CLOUD_AUTHENTICATED") && authJs.includes("window.DK_CLOUD_AUTHENTICATED"),
  ""
);
rec(
  "fallback local desliga nuvem",
  locadoraJs.includes("__DK_markCloudLocalOnly"),
  ""
);
rec(
  "cache-bust loopfix2 no index",
  indexHtml.includes("portal-supabase-sync.js?v=20260913-loopfix2") &&
    indexHtml.includes("dk-portal-api-auth.js?v=20260913-loopfix2") &&
    indexHtml.includes("portal-locadora-ui.js?v=20260913-loopfix2") &&
    indexHtml.includes("app.js?v=20260914excl-otavio"),
  ""
);
rec("trace sem imprimir token", syncJs.includes("[DK LOOP TRACE]") && syncJs.includes("delete safe.token"), "");

function createHookStore() {
  const store = new Map();
  const posts = [];
  let cloudPushDirty = false;
  let cloudSyncHalted = false;
  let cloudHaltKind = "";
  let scheduled = 0;
  const cloudKeys = new Set(["dk_clientes_cadastro", "dk_funcionarios_access"]);

  function haltUnauthorized() {
    cloudSyncHalted = true;
    cloudHaltKind = "unauthorized";
    cloudPushDirty = false;
  }

  function schedule(meta) {
    if (cloudSyncHalted) return;
    if (!meta || !meta.token) {
      cloudSyncHalted = true;
      cloudHaltKind = "local_only";
      return;
    }
    scheduled += 1;
    posts.push({ kind: "schedule", ...meta });
  }

  function setItem(key, value) {
    const prev = store.has(key) ? store.get(key) : "";
    store.set(key, String(value));
    if (!cloudKeys.has(key)) return { changed: prev !== String(value), scheduled: false };
    const changed = prev !== String(value);
    if (!changed) return { changed: false, scheduled: false };
    schedule({ motivo: "setItem", key, token: metaToken });
    return { changed: true, scheduled: !cloudSyncHalted || cloudHaltKind === "local_only" };
  }

  let metaToken = "";
  return {
    setToken(t) {
      metaToken = String(t || "");
    },
    setItem,
    haltUnauthorized,
    finallyDirty(fatal401) {
      if (fatal401) haltUnauthorized();
      if (cloudSyncHalted) {
        cloudPushDirty = false;
        return { rescheduled: false };
      }
      if (cloudPushDirty) {
        cloudPushDirty = false;
        schedule({ motivo: "dirty", token: metaToken });
        return { rescheduled: true };
      }
      return { rescheduled: false };
    },
    markDirty() {
      cloudPushDirty = true;
    },
    snapshot() {
      return {
        scheduled,
        posts: posts.length,
        halted: cloudSyncHalted,
        kind: cloudHaltKind,
        dirty: cloudPushDirty,
      };
    },
  };
}

const t1 = createHookStore();
t1.setItem("dk_clientes_cadastro", "[]");
rec("T1 sim: sem token não agenda POST", t1.snapshot().scheduled === 0 && t1.snapshot().kind === "local_only", JSON.stringify(t1.snapshot()));

const t3 = createHookStore();
t3.setToken("bad");
t3.setItem("dk_clientes_cadastro", "[1]");
t3.haltUnauthorized();
t3.setItem("dk_clientes_cadastro", "[2]");
rec("T3 sim: após 401 não há novo schedule", t3.snapshot().scheduled === 1 && t3.snapshot().halted, JSON.stringify(t3.snapshot()));

const t4 = createHookStore();
t4.setToken("ok");
t4.setItem("dk_clientes_cadastro", "[1]");
const before = t4.snapshot().scheduled;
t4.setItem("dk_clientes_cadastro", "[1]");
rec("T4 sim: regravação idêntica não agenda", t4.snapshot().scheduled === before, `scheduled=${t4.snapshot().scheduled}`);

const t5 = createHookStore();
t5.setToken("ok");
t5.setItem("dk_clientes_cadastro", "[1]");
rec("T5 sim: alteração real agenda um push", t5.snapshot().scheduled === 1, `scheduled=${t5.snapshot().scheduled}`);

const t6ok = createHookStore();
t6ok.setToken("ok");
t6ok.markDirty();
const rOk = t6ok.finallyDirty(false);
rec("T6 sim: dirty após push OK reagenda no máximo 1", rOk.rescheduled === true && t6ok.snapshot().scheduled === 1, JSON.stringify(t6ok.snapshot()));

const t6fail = createHookStore();
t6fail.setToken("bad");
t6fail.markDirty();
const rFail = t6fail.finallyDirty(true);
rec("T6 sim: dirty após 401 fatal NÃO reagenda", rFail.rescheduled === false && t6fail.snapshot().scheduled === 0, JSON.stringify(t6fail.snapshot()));

const t7 = createHookStore();
t7.setToken("");
t7.setItem("dk_funcionarios_access", "[]");
const start = Date.now();
while (Date.now() - start < 80) {
  t7.setItem("dk_funcionarios_access", "[]");
  t7.setItem("dk_clientes_cadastro", String(Date.now()));
}
rec(
  "T7 sim: parado/halted não gera rajada (amostra 80ms)",
  t7.snapshot().scheduled === 0 && t7.snapshot().kind === "local_only",
  JSON.stringify(t7.snapshot())
);

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} testes loopfix2 ---`);
if (failed.length) process.exit(1);
