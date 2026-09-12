/**
 * Testes estáticos + HTTP controlados da sincronização dk-cloud-snapshot.
 * Não martela o endpoint oficial com o snapshot gordo.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const apiJs = fs.readFileSync(path.join(ROOT, "api/dk-cloud-snapshot.js"), "utf8");
const authJs = fs.readFileSync(path.join(ROOT, "lib/dk-portal-auth.cjs"), "utf8");
const syncJs = fs.readFileSync(path.join(ROOT, "portal-supabase-sync.js"), "utf8");

const handlerSrc = apiJs.slice(apiJs.indexOf("async function handler"));
rec("OPTIONS sai antes do rate limit", handlerSrc.includes('req.method === "OPTIONS"') && handlerSrc.indexOf("OPTIONS") < handlerSrc.indexOf("enforceRateLimit"), "");
rec("anónimo limitado à parte", apiJs.includes("cloud-snapshot-anon") && apiJs.includes("requirePortalAuth"), "");
rec("GET e POST em baldes separados", apiJs.includes("cloud-snapshot-get") && apiJs.includes("cloud-snapshot-post"), "");
rec("quota autenticada por CPF", apiJs.includes("identity: ident") && authJs.includes("opts.identity"), "");
rec("429 com Retry-After", authJs.includes('Retry-After') && authJs.includes("retryAfter"), "");
rec("auth não foi removida", apiJs.includes("requirePortalAuth") && !/allowCliente:\s*true[\s\S]{0,40}return res\.status\(200\)/.test(apiJs.split("requirePortalAuth")[0]), "");
rec("POST não devolve ok se Redis falhar no catch", apiJs.includes('return res.status(500)') && apiJs.includes("await redis.set"), "");
rec("POST espera confirmação do upsert Supabase", apiJs.includes("upsertSnapshotByLabel") && apiJs.includes("persistencia") && apiJs.includes("20000"), "");
rec("estado antigo não vence updated_at mais novo", apiJs.includes("existingTs > incomingTs") && apiJs.includes("neverLoseCadastroPayload"), "");
rec("frontend coalescing GET", syncJs.includes("snapshotGetInFlight") && syncJs.includes("SNAPSHOT_GET_CACHE_MS"), "");
rec("pull não faz GET duplo de consulta", /const data = await fetchCloudSnapshotPayload\(\);\s*const consultaSync/.test(syncJs), "");
rec("consulta sync não dispara POST", syncJs.includes("syncConsultaKeysFromCloudPayload") && /suppressCloudHook = true;[\s\S]{0,180}saveCadastro\(k, next/.test(syncJs), "");
rec("troca de tela com intervalo", syncJs.includes("Sem intervalo mínimo") && syncJs.includes("SNAPSHOT_GET_CACHE_MS"), "");
rec("POST igual é ignorado", syncJs.includes("unchanged") && syncJs.includes("lastPushedFingerprint"), "");
rec("dirty após POST em curso", syncJs.includes("cloudPushDirty") && syncJs.includes("scheduleCloudPushDebounced"), "");
rec("429 faz backoff sem loop", syncJs.includes("rate_limited") && syncJs.includes("cloudBackoffUntil") && /rate_limited[\s\S]{0,80}break/.test(syncJs), "");
rec("faixa prometida mantida", syncJs.includes("Cópia Supabase não confirmou") && syncJs.includes("Os dados estão no Redis (nuvem principal)."), "");
rec("timeout/429 não pintam a faixa", syncJs.includes('info.code === "timeout" || info.code === "rate_limited"'), "");

const BASE = "https://grupodkempreendimentos.com.br/";
async function hit(method, body) {
  const init = { method, cache: "no-store", headers: { Accept: "application/json" } };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const r = await fetch(`${BASE}api/dk-cloud-snapshot?probe=${Date.now()}`, init);
  const j = await r.json().catch(() => ({}));
  return { status: r.status, reason: j.reason || "", retryAfter: r.headers.get("retry-after") };
}

try {
  const opt = await fetch(`${BASE}api/dk-cloud-snapshot`, { method: "OPTIONS" });
  rec("A OPTIONS anónimo 204", opt.status === 204, String(opt.status));
  const g = await hit("GET");
  rec("A anónimo GET 401/403", g.status === 401 || g.status === 403, String(g.status));
  const p = await hit("POST", { payload: { dk_clientes_cadastro: [] } });
  rec("B anónimo POST bloqueado", p.status === 401 || p.status === 403 || p.status === 429, String(p.status));

  if (process.env.DK_SNAPSHOT_BURST === "1") {
    let limited = 0;
    let last = { status: 0 };
    for (let i = 0; i < 24; i += 1) {
      last = await hit("GET");
      if (last.status === 429) {
        limited += 1;
        break;
      }
    }
    rec("J rajada anónima ainda pode 429", limited > 0, `429=${limited} last=${last.status} ra=${last.retryAfter || "-"}`);
  } else {
    rec("J rajada anónima reservada (DK_SNAPSHOT_BURST=1)", true, "não martela produção neste passo");
  }
} catch (e) {
  rec("HTTP oficial alcançável", false, String(e && e.message ? e.message : e));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} testes snapshot sync ---`);
if (failed.length) process.exit(1);
