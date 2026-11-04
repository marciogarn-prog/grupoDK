/**
 * Verifica se a nuvem (PG + eventos + Realtime) está preparada para todos os módulos.
 * Não grava cadastros de negócio.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(aqui, "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const atomic = fs.readFileSync(path.join(root, "lib/dk-atomic-write.cjs"), "utf8");
const atomicLpm = fs.readFileSync(path.join(root, "lib/dk-atomic-write-lpm.cjs"), "utf8");
const vei = fs.readFileSync(path.join(root, "lib/dk-veiculos-pg.cjs"), "utf8");
const cli = fs.readFileSync(path.join(root, "lib/dk-clientes-pg.cjs"), "utf8");
const sync = fs.readFileSync(path.join(root, "portal-dk-sync.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");

assert(atomic.includes("dk_cliente_mutate_with_event"), "rpc_cliente");
assert(atomic.includes("dk_veiculo_mutate_with_event"), "rpc_veiculo");
assert(atomicLpm.includes("dk_locacao_mutate_with_event"), "rpc_locacao");
assert(atomicLpm.includes("dk_pagamento_mutate_with_event"), "rpc_pagamento");
assert(atomicLpm.includes("dk_manutencao_mutate_with_event"), "rpc_manutencao");
assert(vei.includes("lerPorPlaca") && vei.includes("Placa é a chave"), "veiculo_por_placa");
assert(cli.includes("operationId") || cli.includes("operation_id"), "cliente_op_id");
assert(atomic.includes("oficial.id"), "forca_id_oficial");
assert(sync.includes("dkSyncAplicarSinalRedis") && sync.includes("redis_sinal"), "ws_sinal");
assert(sync.includes("__DK_clientePgRecarregar") && sync.includes("__DK_veiculoPgRecarregar"), "hooks_reload");
assert(sync.includes("__DK_manutencaoRecarregar") || sync.includes("__DK_portalSyncManutencoesRapidas"), "hook_manut");
assert(sync.includes("__DK_portalRepintarPagamentosAbertos"), "hook_pagamento");
assert(sync.includes("__DK_locacaoPgRecarregar"), "hook_locacao");
assert(ui.includes("__DK_clientePgRecarregar") && ui.includes("__DK_veiculoPgRecarregar"), "hooks_ui");
assert(ui.includes("dkSyncCatchUp(\"cliente_gravado\")") || ui.includes('dkSyncCatchUp("cliente_gravado")'), "catchup_cliente");
assert(ui.includes("dkSyncCatchUp(\"veiculo_gravado\")") || ui.includes('dkSyncCatchUp("veiculo_gravado")'), "catchup_veiculo");
assert(!ui.includes("O cadastro ficou neste PC."), "sem_ficou_neste_pc");
const manutJs = fs.readFileSync(path.join(root, "portal-manutencao-rapida.js"), "utf8");
assert(manutJs.includes("__DK_manutencaoRecarregar"), "manut_reload_export");
const locPg = fs.readFileSync(path.join(root, "portal-locacao-pg.js"), "utf8");
assert(locPg.includes("dkSyncCatchUp") && locPg.includes("dk:log:recarregar"), "locacao_catchup_log");

const jwt = require("../lib/dk-realtime-jwt-es256.cjs");
const jwkPath = path.join(process.env.LOCALAPPDATA || "", "DK-secrets", "dk-realtime-es256-jwk.json");
assert(fs.existsSync(jwkPath), "jwk_local");
const jwk = JSON.parse(fs.readFileSync(jwkPath, "utf8"));
const out = jwt.emitirCredencialRealtime({
  forcarTeste: true,
  jwk,
  kid: jwk.kid,
  gate: { ok: true, cpf: "39072202866", sid: "modulos-ws-1", role: "owner", typ: "equipa" },
  empresa: "locadora",
  ttl: 90,
});
assert(out.ok && out.body && out.body.token, "mint_jwt");

const jwks = await (await fetch("https://ppxtwqvzgujllfzarpuz.supabase.co/auth/v1/.well-known/jwks.json")).json();
assert((jwks.keys || []).some((k) => k.kid === jwk.kid), "kid_jwks");

const token = out.body.token;
const anon = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const url =
  "wss://ppxtwqvzgujllfzarpuz.supabase.co/realtime/v1/websocket?apikey=" +
  encodeURIComponent(anon) +
  "&vsn=1.0.0";
assert(typeof WebSocket === "function", "ws_nativo");
const ws = new WebSocket(url);
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
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (msg.event === "phx_reply" && msg.payload && msg.payload.status === "ok") resolve();
      else reject(new Error("join_" + JSON.stringify(msg.payload || msg.event)));
    }
  });
  ws.addEventListener("error", (err) => {
    clearTimeout(t);
    reject(err);
  });
});

console.log(
  JSON.stringify({
    ok: true,
    modulos: ["cliente", "veiculo", "locacao", "pagamento", "manutencao"],
    realtime_join: "ok",
    canal: out.body.canal,
  })
);
process.exit(0);
