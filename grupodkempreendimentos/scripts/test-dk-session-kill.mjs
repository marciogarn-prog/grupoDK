/**
 * Testes estáticos do bloqueio de sessões do CEO.
 * Não chama POST /api/dk-session-kill em produção.
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
const kill = fs.readFileSync(path.join(ROOT, "api/dk-session-kill.js"), "utf8");
const snap = fs.readFileSync(path.join(ROOT, "api/dk-cloud-snapshot.js"), "utf8");
const login = fs.readFileSync(path.join(ROOT, "api/dk-portal-auth.js"), "utf8");
const sync = fs.readFileSync(path.join(ROOT, "portal-supabase-sync.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

rec("epoch no Redis separado do snapshot", auth.includes("dk:portal:session_epoch:v1") && !kill.includes("cloud_snapshot:v1"), "");
rec("API exige CEO owner no servidor", kill.includes("requireCeoEmergencyLock") && auth.includes('role || "") !== "owner"'), "");
rec("serviço não pode matar sessões", kill.includes("requireCeoEmergencyLock") && auth.includes("allowService: false"), "");
rec("login carimba geração no token", login.includes("mintTokenWithSession") && auth.includes("sg: epoch.n"), "");
rec("CEO owner não é revogado pelo epoch", auth.includes('role || "").trim() === "owner") return gate'), "");
rec("login CEO de emergência se snapshot cair", login.includes("podeLoginCeoEmergencia") && auth.includes("podeLoginCeoEmergencia"), "");
rec("snapshot devolve session_revoked", snap.includes("session_revoked") && snap.includes("attachLiveSession"), "");
rec("snapshot recusa cliente antigo antes do Redis", snap.includes("assertEquipaClientProtocol") && snap.indexOf("assertEquipaClientProtocol") < snap.indexOf("await redis.get(REDIS_KEY)"), "");
rec("snapshot valida sessão antes do GET Redis", snap.indexOf("attachLiveSession") < snap.indexOf("await redis.get(REDIS_KEY)"), "");
rec("UI CEO na área da equipa", html.includes("CONTROLE DE SESSÕES") && html.includes("BLOQUEAR OUTRAS SESSÕES") && html.includes("CONFIRMAR BLOQUEIO"), "");
rec("frontend para timers ao revogar", sync.includes("haltCloudSyncRevoked") && sync.includes("cloudSyncIsHalted") && sync.includes("SESSÃO ENCERRADA PELO ADMINISTRADOR CEO"), "");
rec("rate limit do kill existe e é baixo", kill.includes('enforceRateLimit(req, res, "session-kill", 10)'), "");
rec("quota do snapshot não foi aumentada", snap.includes("isPost ? 24 : 40") && snap.includes("cloud-snapshot-anon\", 20"), "");

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- ${results.length - failed}/${results.length} testes session-kill ---`);
process.exit(failed ? 1 : 0);
