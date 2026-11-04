/**
 * Valida JWT ES256 (standby) contra JWKS do projeto e tenta join Realtime privado.
 * Não grava dados de negócio.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const jwt = require("../lib/dk-realtime-jwt-es256.cjs");
const aqui = path.dirname(fileURLToPath(import.meta.url));
const jwkPath = path.join(process.env.LOCALAPPDATA || "", "DK-secrets", "dk-realtime-es256-jwk.json");
if (!fs.existsSync(jwkPath)) {
  console.error("jwk_ausente");
  process.exit(2);
}
const jwk = JSON.parse(fs.readFileSync(jwkPath, "utf8"));
const out = jwt.emitirCredencialRealtime({
  forcarTeste: true,
  jwk,
  kid: jwk.kid,
  gate: { ok: true, cpf: "39072202866", sid: "homolog-sid-1", role: "owner", typ: "equipa" },
  empresa: "locadora",
  ttl: 120,
});
if (!out.ok) {
  console.error(JSON.stringify(out));
  process.exit(1);
}
const token = out.body.token;
const jwks = await (await fetch("https://ppxtwqvzgujllfzarpuz.supabase.co/auth/v1/.well-known/jwks.json")).json();
const pub = (jwks.keys || []).find((k) => k.kid === jwk.kid);
if (!pub) {
  console.error(JSON.stringify({ ok: false, reason: "kid_ausente_jwks" }));
  process.exit(1);
}
const v = jwt.verificarEs256(token, pub, {
  kid: jwk.kid,
  issuer: jwt.DEFAULT_ISS,
  aud: "authenticated",
});
console.log(
  JSON.stringify({
    minted: true,
    canal: out.body.canal,
    kid: out.body.kid,
    verify_local: v.ok,
    reason: v.reason || null,
  })
);
if (!v.ok) process.exit(1);

const WsCtor = globalThis.WebSocket;
if (typeof WsCtor !== "function") {
  console.log(JSON.stringify({ realtime_join: "skipped_no_ws", note: "JWT/JWKS OK" }));
  process.exit(0);
}

const anon = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const url =
  "wss://ppxtwqvzgujllfzarpuz.supabase.co/realtime/v1/websocket?apikey=" +
  encodeURIComponent(anon) +
  "&vsn=1.0.0";
const ws = new WsCtor(url);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("ws_timeout")), 12000);
  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({
        topic: "realtime:dk:events",
        event: "phx_join",
        payload: {
          config: { broadcast: { self: false }, presence: { key: "" }, private: true },
          access_token: token,
        },
        ref: "1",
      })
    );
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.ref === "1") {
      clearTimeout(t);
      const status = msg.payload && msg.payload.status;
      console.log(
        JSON.stringify({
          realtime_join: msg.event,
          status,
          response: msg.payload && msg.payload.response,
        })
      );
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (msg.event === "phx_reply" && status === "ok") resolve();
      else reject(new Error("realtime_join_" + String(status || msg.event)));
    }
  });
  ws.addEventListener("error", (err) => {
    clearTimeout(t);
    reject(err);
  });
}).then(
  () => process.exit(0),
  (err) => {
    console.error(String(err && err.message ? err.message : err));
    process.exit(1);
  }
);
