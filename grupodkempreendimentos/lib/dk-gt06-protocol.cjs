/**
 * Decodificador GT06 (Concox / EC33) — pacotes 0x7878.
 * Usado pelo bridge TCP e por testes unitários.
 */
const CRC_TABLE = (() => {
  const table = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = 0;
    let c = i << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc ^ c) & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      c <<= 1;
      crc &= 0xffff;
    }
    table[i] = crc;
  }
  return table;
})();

function crc16X25(buf, start, end) {
  let crc = 0xffff;
  for (let i = start; i < end; i++) {
    const idx = ((crc >> 8) ^ buf[i]) & 0xff;
    crc = ((crc << 8) ^ CRC_TABLE[idx]) & 0xffff;
  }
  return (~crc) & 0xffff;
}

function bcdByte(b) {
  return ((b >> 4) & 0x0f) * 10 + (b & 0x0f);
}

function readImei(buf, offset) {
  let s = "";
  for (let i = 0; i < 8; i++) {
    const b = buf[offset + i];
    const hi = (b >> 4) & 0x0f;
    const lo = b & 0x0f;
    if (i === 0 && hi === 0) s += String(lo);
    else s += String(hi) + String(lo);
  }
  return s.replace(/\D/g, "").slice(0, 15);
}

function decodeLatLng(latRaw, lngRaw, flags) {
  const lat = latRaw / 1800000;
  const lng = lngRaw / 1800000;
  const south = Boolean(flags & 0x04);
  const west = Boolean(flags & 0x08);
  return {
    lat: south ? -lat : lat,
    lng: west ? -lng : lng,
    gpsFixed: Boolean(flags & 0x10),
  };
}

function decodePosition(info) {
  if (!info || info.length < 18) return null;
  const year = 2000 + bcdByte(info[0]);
  const month = bcdByte(info[1]);
  const day = bcdByte(info[2]);
  const hour = bcdByte(info[3]);
  const minute = bcdByte(info[4]);
  const second = bcdByte(info[5]);
  const courseStatus = (info[16] << 8) | info[17];
  const latRaw = (info[7] << 24) | (info[8] << 16) | (info[9] << 8) | info[10];
  const lngRaw = (info[11] << 24) | (info[12] << 16) | (info[13] << 8) | info[14];
  const speed = info[15];
  const coords = decodeLatLng(latRaw >>> 0, lngRaw >>> 0, courseStatus);
  const course = courseStatus & 0x03ff;
  const ts = Date.UTC(year, month - 1, day, hour, minute, second);
  return {
    ...coords,
    speed,
    heading: course,
    satellites: info[6] & 0x0f,
    ts: Number.isFinite(ts) ? ts : Date.now(),
  };
}

function decodeStatus(info) {
  if (!info || info.length < 1) return {};
  const terminal = info[0];
  return {
    acc: Boolean(terminal & 0x02),
    ignicao: Boolean(terminal & 0x02),
    gpsFixed: Boolean(terminal & 0x40),
    bateria: info.length > 1 ? info[1] : null,
    gsm: info.length > 2 ? info[2] : null,
  };
}

function buildAck(protocolNumber, serialHi, serialLo) {
  // 78 78 05 PROTO SERIAL_H SERIAL_L CRC_H CRC_L 0D 0A
  const body = Buffer.from([0x05, protocolNumber & 0xff, serialHi & 0xff, serialLo & 0xff]);
  const crc = crc16X25(body, 0, body.length);
  return Buffer.from([
    0x78,
    0x78,
    0x05,
    protocolNumber & 0xff,
    serialHi & 0xff,
    serialLo & 0xff,
    (crc >> 8) & 0xff,
    crc & 0xff,
    0x0d,
    0x0a,
  ]);
}

/**
 * Monta pacote GT06 0x80 (comando do servidor → terminal).
 * O conteúdo ASCII é o mesmo dos comandos SMS/manual (ex.: STATUS#).
 * @param {string} commandText
 * @param {number} [serial=1] número de série 0..65535
 * @param {number} [serverFlag=0] ecoado pelo terminal na resposta 0x15
 * @param {number} [language=2] 1=chinês, 2=inglês
 */
function buildServerCommand(commandText, serial = 1, serverFlag = 0, language = 2) {
  let cmd = String(commandText || "").trim();
  if (!cmd) throw new Error("comando GT06 vazio");
  if (!cmd.endsWith("#")) cmd += "#";
  const content = Buffer.from(cmd, "ascii");
  if (content.length > 200) throw new Error("comando GT06 demasiado longo");
  const flag = Buffer.alloc(4);
  flag.writeUInt32BE(serverFlag >>> 0, 0);
  const lang = Buffer.from([0x00, language & 0xff]);
  // Length of Command = Server Flag Bit + Command Content
  const lengthOfCommand = 4 + content.length;
  const info = Buffer.concat([Buffer.from([lengthOfCommand & 0xff]), flag, content, lang]);
  const serialN = Number(serial) || 1;
  const serialHi = (serialN >> 8) & 0xff;
  const serialLo = serialN & 0xff;
  // packetLen = proto + info + serial + crc
  const packetLen = 1 + info.length + 2 + 2;
  if (packetLen > 255) throw new Error("pacote GT06 0x80 excede 255 bytes");
  const body = Buffer.concat([Buffer.from([packetLen & 0xff, 0x80]), info, Buffer.from([serialHi, serialLo])]);
  const crc = crc16X25(body, 0, body.length);
  return Buffer.concat([
    Buffer.from([0x78, 0x78]),
    body,
    Buffer.from([(crc >> 8) & 0xff, crc & 0xff, 0x0d, 0x0a]),
  ]);
}

/**
 * Extrai texto ASCII de info 0x15 (resposta a comando online).
 * @param {Buffer} info
 */
function decodeStringInfo(info) {
  if (!info || info.length < 5) {
    return { serverFlag: 0, text: info && info.length ? info.toString("ascii").replace(/[^\x20-\x7E\r\n]/g, "").trim() : "" };
  }
  const serverFlag = info.readUInt32BE(1);
  const text = info.subarray(5).toString("ascii").replace(/[^\x20-\x7E\r\n]/g, "").trim();
  return { serverFlag, text };
}

/**
 * Consome bytes de um buffer e devolve pacotes completos + resto.
 * @param {Buffer} buffer
 */
function extractPackets(buffer) {
  const packets = [];
  let i = 0;
  while (i + 5 < buffer.length) {
    if (buffer[i] !== 0x78 || buffer[i + 1] !== 0x78) {
      i += 1;
      continue;
    }
    const packetLen = buffer[i + 2];
    const total = 2 + 1 + packetLen + 2; // start + len + payload(len) + stop
    if (i + total > buffer.length) break;
    const stopOk = buffer[i + total - 2] === 0x0d && buffer[i + total - 1] === 0x0a;
    if (!stopOk) {
      i += 1;
      continue;
    }
    packets.push(buffer.subarray(i, i + total));
    i += total;
  }
  return { packets, rest: buffer.subarray(i) };
}

/**
 * @param {Buffer} packet
 */
function parsePacket(packet) {
  if (!packet || packet.length < 10) return null;
  const packetLen = packet[2];
  const protocol = packet[3];
  const infoLen = packetLen - 5; // proto already counted in len? GT06: length = proto+info+serial+crc = 5+N
  const infoEnd = 4 + Math.max(0, packetLen - 5);
  const info = packet.subarray(4, infoEnd);
  const serialHi = packet[infoEnd];
  const serialLo = packet[infoEnd + 1];
  const out = {
    protocol,
    serialHi,
    serialLo,
    ack: buildAck(protocol, serialHi, serialLo),
  };
  if (protocol === 0x01) {
    out.type = "login";
    out.imei = readImei(info, 0);
    return out;
  }
  if (protocol === 0x12 || protocol === 0x22) {
    out.type = "position";
    out.position = decodePosition(info);
    return out;
  }
  if (protocol === 0x13) {
    out.type = "status";
    out.status = decodeStatus(info);
    return out;
  }
  if (protocol === 0x16) {
    out.type = "alarm";
    out.position = decodePosition(info);
    out.status = decodeStatus(info.length > 18 ? info.subarray(18) : info);
    return out;
  }
  if (protocol === 0x15) {
    out.type = "string";
    const decoded = decodeStringInfo(info);
    out.serverFlag = decoded.serverFlag;
    out.text = decoded.text;
    return out;
  }
  out.type = "other";
  return out;
}

module.exports = {
  crc16X25,
  extractPackets,
  parsePacket,
  buildAck,
  buildServerCommand,
  decodeStringInfo,
  decodePosition,
  readImei,
};
