#!/usr/bin/env node
/**
 * Bridge TCP GT06 (EC33) → API /api/dk-veiculo-geo
 *
 * Uso (VM / servidor com IP público ou DNS):
 *   set DK_GT06_PORT=5023
 *   set DK_VEICULO_GEO_URL=https://grupodkempreendimentos.com.br/api/dk-veiculo-geo
 *   set DK_PORTAL_API_SECRET=...   (mesmo segredo da Vercel)
 *   node grupodkempreendimentos/scripts/gt06-tcp-bridge.mjs
 *
 * No EC33 (SMS):
 *   APN,sua_apn,user,senha#
 *   SERVER,1,seu.dns.ou.ip,5023,0#
 *   TIMER,30,1800#
 *   RESET#
 */
import net from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { extractPackets, parsePacket } = require(path.join(__dirname, "..", "lib", "dk-gt06-protocol.cjs"));

const PORT = Number(process.env.DK_GT06_PORT || 5023);
const API_URL = String(process.env.DK_VEICULO_GEO_URL || "https://grupodkempreendimentos.com.br/api/dk-veiculo-geo").trim();
const SECRET = String(
  process.env.DK_PORTAL_API_SECRET || process.env.DK_BACKUP_SEND_SECRET || process.env.CRON_SECRET || ""
).trim();

if (!SECRET) {
  console.error("[gt06-bridge] Defina DK_PORTAL_API_SECRET (mesmo da Vercel).");
  process.exit(1);
}

async function postPosicao(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
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
        console.log("[gt06-bridge] login IMEI", imei, peer);
      }
      if (parsed.type === "status" && parsed.status) {
        lastStatus = { ...lastStatus, ...parsed.status };
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
    console.log("[gt06-bridge] fechou", peer, imei || "");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[gt06-bridge] à escuta em 0.0.0.0:${PORT} → ${API_URL}`);
  console.log("[gt06-bridge] SMS no EC33: SERVER,1,<este-host>," + PORT + ",0#");
});
