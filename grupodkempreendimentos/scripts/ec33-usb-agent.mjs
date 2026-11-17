#!/usr/bin/env node
/**
 * Agente USB EC33 — envia comandos GT06 (#) pela porta Quectel AT.
 *
 *   node grupodkempreendimentos/scripts/ec33-usb-agent.mjs
 *
 * HTTP local: http://127.0.0.1:8787/comando  { "cmd":"STATUS#", "imei":"..." }
 * Também consulta IMEI na abertura e aplica TIMER padrão na SOX2B04.
 */
import http from "node:http";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT_HTTP = Number(process.env.DK_EC33_USB_HTTP || 8787);
const BAUD = Number(process.env.DK_EC33_USB_BAUD || 115200);
const IMEI_ESPERADO = "869137082186396";
const LOG = path.join(__dirname, "..", "docs", "ec33", "usb-agent-log.txt");

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG, line + "\n");
  } catch {
    /* ignore */
  }
}

async function listarPortasQuectel() {
  const ports = await SerialPort.list();
  return ports.filter((p) => {
    const hay = `${p.path} ${p.friendlyName || ""} ${p.manufacturer || ""} ${p.pnpId || ""}`.toLowerCase();
    return /quectel|vid_2c7c|at port/i.test(hay) || /COM(9|11|12|13)/i.test(p.path) && /quectel|2c7c/i.test(hay);
  });
}

async function descobrirPortaAt() {
  const all = await SerialPort.list();
  const prefer = all.find((p) => /AT Port/i.test(p.friendlyName || ""));
  if (prefer) return prefer.path;
  const q = all.find((p) => /VID_2C7C|Quectel/i.test(`${p.pnpId} ${p.friendlyName} ${p.manufacturer}`));
  return q?.path || process.env.DK_EC33_COM || "";
}

function abrirPorta(pathCom) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: pathCom, baudRate: BAUD, autoOpen: false });
    port.open((err) => {
      if (err) reject(err);
      else resolve(port);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enviarLinha(port, linha, waitMs = 1500) {
  const parser = port.pipe(new ReadlineParser({ delimiter: "\r" }));
  let buf = "";
  const onData = (d) => {
    buf += String(d);
  };
  parser.on("data", onData);
  port.write(linha.endsWith("\r") ? linha : linha + "\r");
  await sleep(waitMs);
  parser.off("data", onData);
  try {
    port.unpipe(parser);
  } catch {
    /* ignore */
  }
  return buf.trim();
}

async function lerImei(port) {
  const r = await enviarLinha(port, "AT+CGSN", 1200);
  const m = r.match(/(\d{15})/);
  return m ? m[1] : "";
}

/**
 * EC33: AT puro OU comando GT06 (#). Hash no AT muitas vezes devolve ERROR
 * (firmware QuecPython) — o comando fica enviado na série para a app do rastreador.
 */
async function enviarComandoEc33(port, cmd) {
  const c = String(cmd || "").trim();
  if (!c) return { ok: false, resposta: "comando vazio" };

  if (/^AT/i.test(c)) {
    const resp = await enviarLinha(port, c.replace(/#$/, ""), 2000);
    const ok = /OK/i.test(resp) && !/\bERROR\b/i.test(resp.replace(/^\s*AT.*$/im, ""));
    return { ok: /OK/i.test(resp), resposta: resp || "(sem eco AT)", via: "at" };
  }

  const hash = c.endsWith("#") ? c : `${c}#`;
  await enviarLinha(port, "AT", 600);
  let resp = await enviarLinha(port, hash, 2500);
  // ERROR no interpretador AT é esperado para STATUS#/TIMER#; a app EC33 pode consumir o texto.
  const appOk = /TIMER|RELAY|STATUS|WHERE|PARAM|IMEI|Battery|LastPosition|OK/i.test(resp);
  return {
    ok: true,
    resposta: resp || `(comando ${hash} enviado na COM — sem eco da app)`,
    via: appOk ? "serial_hash" : "serial_hash_queued_to_app",
    atEcho: resp,
  };
}

let portaAberta = null;
let pathAtual = "";
let imeiUsb = "";

async function garantirPorta() {
  if (portaAberta && portaAberta.isOpen) return portaAberta;
  const pathCom = await descobrirPortaAt();
  if (!pathCom) throw new Error("Nenhuma porta Quectel AT encontrada. Ligue o EC33 no USB.");
  pathAtual = pathCom;
  portaAberta = await abrirPorta(pathCom);
  log("Aberta", pathCom);
  imeiUsb = await lerImei(portaAberta);
  log("IMEI USB", imeiUsb || "(não lido)");
  return portaAberta;
}

async function configurarSox2b04() {
  const port = await garantirPorta();
  const passos = [
    "STATUS#",
    "PARAM#",
    "TIMER,30,1800#",
    "TIMER#",
    "GMT,W,0,0#",
  ];
  const out = [];
  for (const cmd of passos) {
    const r = await enviarComandoEc33(port, cmd);
    out.push({ cmd, ...r });
    log("CFG", cmd, "→", (r.resposta || "").replace(/\s+/g, " ").slice(0, 160));
    await sleep(400);
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT_HTTP}`);

  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        porta: pathAtual,
        imei: imeiUsb,
        imeiEsperado: IMEI_ESPERADO,
        placa: "SOX2B04",
      })
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/comando") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let data = {};
    try {
      data = JSON.parse(body || "{}");
    } catch {
      data = {};
    }
    try {
      const port = await garantirPorta();
      if (data.imei && imeiUsb && String(data.imei) !== imeiUsb) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, msg: `USB é IMEI ${imeiUsb}, pedido ${data.imei}` }));
        return;
      }
      const r = await enviarComandoEc33(port, data.cmd || data.comando);
      log("CMD", data.cmd, r.ok ? "OK" : "FAIL", (r.resposta || "").slice(0, 120));
      res.writeHead(r.ok ? 200 : 502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: r.ok, resposta: r.resposta, via: r.via, porta: pathAtual, imei: imeiUsb }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, msg: String(e && e.message ? e.message : e) }));
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/configurar") {
    try {
      const out = await configurarSox2b04();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, imei: imeiUsb, placa: "SOX2B04", passos: out }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, msg: String(e && e.message ? e.message : e) }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, msg: "Use GET /status, POST /comando, POST /configurar" }));
});

async function main() {
  const ports = await SerialPort.list();
  log(
    "Portas:",
    ports.map((p) => `${p.path}:${p.friendlyName || ""}`).join(" | ")
  );
  try {
    await garantirPorta();
    await configurarSox2b04();
  } catch (e) {
    log("Aviso na abertura:", e.message || e);
  }
  server.listen(PORT_HTTP, "127.0.0.1", () => {
    log(`Agente USB EC33 em http://127.0.0.1:${PORT_HTTP}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
