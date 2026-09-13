/**
 * Protocolo de cliente + inatividade de 30 min (sem chamar APIs de produção).
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

const auth = fs.readFileSync(path.join(ROOT, "lib/dk-portal-auth.cjs"), "utf8");
const snap = fs.readFileSync(path.join(ROOT, "api/dk-cloud-snapshot.js"), "utf8");
const login = fs.readFileSync(path.join(ROOT, "api/dk-portal-auth.js"), "utf8");
const apiJs = fs.readFileSync(path.join(ROOT, "dk-portal-api-auth.js"), "utf8");
const sync = fs.readFileSync(path.join(ROOT, "portal-supabase-sync.js"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const vercel = fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8");

rec("protocolo mínimo 20260913", auth.includes("DK_CLIENT_PROTOCOL_MIN = 20260913") && apiJs.includes("CLIENT_PROTOCOL = 20260913"), "");
rec("versão antiga vira client_stale", auth.includes('reason: "client_stale"') && snap.includes("assertEquipaClientProtocol"), "");
rec("inatividade 30 min no Redis", auth.includes("SESSAO_ATIVA_TTL_SEC = 30 * 60") && auth.includes("dk:portal:sessao_ativa:v1:"), "");
rec("login acende sessão ativa", login.includes("touchSessaoAtiva"), "");
rec("header de protocolo e atividade", apiJs.includes("X-DK-Client-Protocol") && apiJs.includes("X-DK-User-Active"), "");
rec("loop de troca de tela limitado", sync.includes("SCREEN_PULL_MIN_INTERVAL_MS = 20000"), "");
rec("frontend encerra idle/stale", sync.includes("haltCloudSyncIdleOrStale") && ui.includes("PORTAL_IDLE_LIMIT_MS"), "");
rec("HTML e Vercel publicam o protocolo", html.includes('name="dk-client-protocol"') && vercel.includes("X-DK-Client-Protocol"), "");

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- ${results.length - failed}/${results.length} testes idle-protocol ---`);
process.exit(failed ? 1 : 0);
