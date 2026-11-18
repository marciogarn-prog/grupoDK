#!/usr/bin/env node
/**
 * Bridge TCP GT06 (EC33) → API /api/dk-veiculo-geo
 *
 * - Recebe login/posição/status e grava na API
 * - Envia comandos da fila do portal por GPRS (pacote 0x80), sem SMS
 *
 * Uso (VM / servidor com IP público ou DNS):
 *   set DK_GT06_PORT=5023
 *   set DK_VEICULO_GEO_URL=https://grupodkempreendimentos.com.br/api/dk-veiculo-geo
 *   set DK_PORTAL_API_SECRET=...   (mesmo segredo da Vercel)
 *   node grupodkempreendimentos/scripts/gt06-tcp-bridge.mjs
 *
 * No EC33 (1ª vez — SMS ou chip com SMS):
 *   APN,sua_apn,user,senha#
 *   SERVER,1,seu.dns.ou.ip,5023,0#
 *   TIMER,30,1800#
 *   RESET#
 *
 * Depois: STATUS# / PARAM# / WHERE# / RELAY… pelo mapa DK → fila → este bridge (0x80).
 */
import net from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  extractPackets,
  parsePacket,
  buildServerCommand,
} = require(path.join(__dirname, "..", "lib", "dk-gt06-protocol.cjs"));

const PORT = Number(process.env.DK_GT06_PORT || 5023);
const API_URL = String(process.env.DK_VEICULO_GEO_URL || "https://grupodkempreendimentos.com.br/api/dk-veiculo-geo").trim();
const SECRET = String(
  process.env.DK_PORTAL_API_SECRET || process.env.DK_BACKUP_SEND_SECRET || process.env.CRON_SECRET || ""
).trim();
const POLL_MS = Math.max(1500, Number(process.env.DK_GT06_CMD_POLL_MS) || 3000);
const REPLY_WAIT_MS = Math.max(3000, Number(process.env.DK_GT06_CMD_REPLY_MS) || 15000);

if (!SECRET) {
  console.error("[gt06-bridge] Defina DK_PORTAL_API_SECRET (mesmo da Vercel).");
  process.exit(1);
}

/** @type {Map<string, { socket: import('node:net').Socket, serial: number, peer: string, lastSeen: number, waiters: Array<(t:string)=>void> }>} */
const sessions = new Map();

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SECRET}`,
  };
}

async function postPosicao(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...payload, source: "ec33_gt06", modelo: "EC33" }),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    console.warn("[gt06-bridge] API", res.status, data);
  } else {
    console.log("[gt06-bridge] gravou", payload.imei, payload.lat, payload.lng, data.inalterado ? "(inalterado)" : "");
  }
}

async function claimComandos(imei) {
  const url = new URL(API_URL);
  url.searchParams.set("comandos", "1");
  url.searchParams.set("claim", "1");
  url.searchParams.set("imei", imei);
  url.searchParams.set("limite", "5");
  const res = await fetch(url, { method: "GET", headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("[gt06-bridge] claim", res.status, data);
    return [];
  }
  return Array.isArray(data.comandos) ? data.comandos : [];
}

async function postResultado(id, ok, resposta) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      acao: "comando_resultado",
      id,
      ok: ok !== false,
      resposta: String(resposta || "").slice(0, 2000),
      via: "gt06_gprs",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn("[gt06-bridge] resultado", res.status, text.slice(0, 200));
  }
}

function registrarSessao(imei, socket, peer) {
  const key = String(imei || "").replace(/\D/g, "").slice(0, 15);
  if (key.length < 14) return null;
  const prev = sessions.get(key);
  if (prev && prev.socket && prev.socket !== socket) {
    try {
      prev.socket.destroy();
    } catch {
      /* ignore */
    }
  }
  const session = {
    socket,
    serial: (prev && prev.serial) || 1,
    peer,
    lastSeen: Date.now(),
    waiters: [],
  };
  sessions.set(key, session);
  return session;
}

function sessaoDeSocket(socket) {
  for (const [imei, s] of sessions.entries()) {
    if (s.socket === socket) return { imei, session: s };
  }
  return null;
}

function notificarResposta(session, text) {
  const t = String(text || "").trim();
  if (!t || !session) return;
  const waiters = session.waiters.splice(0, session.waiters.length);
  for (const w of waiters) {
    try {
      w(t);
    } catch {
      /* ignore */
    }
  }
}

function enviarComandoGprs(session, cmdText) {
  session.serial = (session.serial + 1) & 0xffff || 1;
  const flag = (Date.now() & 0xffffffff) >>> 0;
  const packet = buildServerCommand(cmdText, session.serial, flag, 2);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (text) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const idx = session.waiters.indexOf(finish);
      if (idx >= 0) session.waiters.splice(idx, 1);
      resolve(text || "");
    };
    const timer = setTimeout(() => finish(""), REPLY_WAIT_MS);
    session.waiters.push(finish);
    try {
      session.socket.write(packet);
    } catch (err) {
      finish(`(falha write: ${err.message || err})`);
    }
  });
}

async function despacharFilaParaImei(imei) {
  const session = sessions.get(imei);
  if (!session || !session.socket || session.socket.destroyed) return;
  let comandos = [];
  try {
    comandos = await claimComandos(imei);
  } catch (err) {
    console.warn("[gt06-bridge] claim erro", imei, err.message || err);
    return;
  }
  for (const item of comandos) {
    const cmd = String(item.cmd || "").trim();
    if (!cmd) {
      await postResultado(item.id, false, "comando vazio");
      continue;
    }
    console.log("[gt06-bridge] GPRS 0x80 →", imei, cmd);
    const reply = await enviarComandoGprs(session, cmd);
    await postResultado(
      item.id,
      true,
      reply || "(enviado GPRS 0x80; terminal sem eco 0x15 no prazo)"
    );
    console.log("[gt06-bridge] resposta", imei, (reply || "(sem eco)").slice(0, 160));
  }
}

async function pollComandos() {
  const imeis = [...sessions.keys()];
  for (const imei of imeis) {
    await despacharFilaParaImei(imei);
  }
}

const server = net.createServer((socket) => {
  let buf = Buffer.alloc(0);
  let imei = "";
  let lastStatus = {};
  const peer = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log("[gt06-bridge] conexão", peer);

  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const { packets, rest } = extractPackets(buf);
    buf = Buffer.from(rest);
    for (const pkt of packets) {
      const parsed = parsePacket(pkt);
      if (!parsed) continue;
      try {
        socket.write(parsed.ack);
      } catch {
        /* ignore */
      }
      if (parsed.type === "login" && parsed.imei) {
        imei = parsed.imei;
        registrarSessao(imei, socket, peer);
        console.log("[gt06-bridge] login IMEI", imei, peer, "| online:", sessions.size);
        void despacharFilaParaImei(imei);
      }
      const bound = sessaoDeSocket(socket);
      if (bound) {
        bound.session.lastSeen = Date.now();
        imei = bound.imei;
      }
      if (parsed.type === "status" && parsed.status) {
        lastStatus = { ...lastStatus, ...parsed.status };
      }
      if (parsed.type === "string") {
        const text = parsed.text || "";
        console.log("[gt06-bridge] string 0x15", imei || peer, text.slice(0, 200));
        if (bound) notificarResposta(bound.session, text);
      }
      if ((parsed.type === "position" || parsed.type === "alarm") && parsed.position && imei) {
        const p = parsed.position;
        void postPosicao({
          imei,
          lat: p.lat,
          lng: p.lng,
          speed: p.speed,
          heading: p.heading,
          ts: p.ts,
          acc: lastStatus.acc,
          ignicao: lastStatus.ignicao,
          gsm: lastStatus.gsm,
          bateria: lastStatus.bateria,
        });
      }
    }
  });

  socket.on("error", (err) => {
    console.warn("[gt06-bridge] socket", peer, err.message);
  });
  socket.on("close", () => {
    const bound = sessaoDeSocket(socket);
    if (bound && sessions.get(bound.imei)?.socket === socket) {
      sessions.delete(bound.imei);
    }
    console.log("[gt06-bridge] fechou", peer, imei || "", "| online:", sessions.size);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[gt06-bridge] à escuta em 0.0.0.0:${PORT} → ${API_URL}`);
  console.log("[gt06-bridge] 1ª config SMS: SERVER,1,<este-host>," + PORT + ",0#");
  console.log("[gt06-bridge] depois: comandos do portal por GPRS 0x80 (poll " + POLL_MS + " ms)");
  setInterval(() => {
    void pollComandos();
  }, POLL_MS);
});
