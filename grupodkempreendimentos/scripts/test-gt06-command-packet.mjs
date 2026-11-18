#!/usr/bin/env node
/** Smoke test: pacote GT06 0x80 (comando servidor) e parse 0x15. */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  buildServerCommand,
  extractPackets,
  parsePacket,
  crc16X25,
} = require(path.join(__dirname, "..", "lib", "dk-gt06-protocol.cjs"));

const pkt = buildServerCommand("STATUS#", 1, 0x12345678, 2);
if (pkt[0] !== 0x78 || pkt[1] !== 0x78) throw new Error("start bit");
if (pkt[3] !== 0x80) throw new Error("protocol != 0x80");
if (pkt[pkt.length - 2] !== 0x0d || pkt[pkt.length - 1] !== 0x0a) throw new Error("stop bit");

const len = pkt[2];
// CRC cobre do byte de comprimento até o serial (exclusive os 2 bytes CRC)
const crcExpected = (pkt[2 + len - 1] << 8) | pkt[2 + len];
const crcGot = crc16X25(pkt, 2, 2 + len - 1);
if (crcExpected !== crcGot) throw new Error(`crc mismatch exp=${crcExpected} got=${crcGot}`);

const ascii = pkt.toString("ascii");
if (!ascii.includes("STATUS#")) throw new Error("STATUS# missing in packet");

// Monta eco 0x15 mínimo com flag + texto
const flag = Buffer.alloc(4);
flag.writeUInt32BE(0x12345678, 0);
const text = Buffer.from("Battery:4.0V;GPRS:Online#", "ascii");
const info = Buffer.concat([Buffer.from([4 + text.length]), flag, text]);
const serial = Buffer.from([0x00, 0x02]);
const packetLen = 1 + info.length + 2 + 2;
const body = Buffer.concat([Buffer.from([packetLen, 0x15]), info, serial]);
const crc = crc16X25(body, 0, body.length);
const reply = Buffer.concat([
  Buffer.from([0x78, 0x78]),
  body,
  Buffer.from([(crc >> 8) & 0xff, crc & 0xff, 0x0d, 0x0a]),
]);
const { packets } = extractPackets(reply);
if (packets.length !== 1) throw new Error("extract 0x15 failed");
const parsed = parsePacket(packets[0]);
if (!parsed || parsed.type !== "string") throw new Error("parse type");
if (!/Battery|GPRS/i.test(parsed.text || "")) throw new Error("text missing");

console.log("OK buildServerCommand STATUS# bytes=", pkt.length, "hex=", pkt.toString("hex"));
console.log("OK parse 0x15 text=", JSON.stringify(parsed.text));
