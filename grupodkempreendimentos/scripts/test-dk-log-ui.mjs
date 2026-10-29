import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fonte = fs.readFileSync(path.join(raiz, "portal-log-ui.js"), "utf8");
const ui = require("../portal-log-ui.js");

assert.ok(!fonte.includes("innerHTML"));
assert.ok(fonte.includes("textContent"));
assert.ok(!fonte.includes("setInterval"));

const malicioso = "<img src=x onerror=alert(1)>";
const linha = ui.linhaCompacta({
  audit_no: 2,
  seq: 12,
  created_at: "2026-10-28T22:01:25.000Z",
  event_type: "system.realtime_initialized",
  action: "initialized",
  module: "system",
  actor_name: "Sistema",
  device_label: "servidor",
  summary: malicioso,
});
assert.ok(linha.startsWith("#2"));
assert.ok(linha.includes("Sistema"));
assert.ok(linha.includes("servidor"));
assert.ok(linha.includes(malicioso));
assert.strictEqual(fonte.split('fetch("/api/dk-log"').length - 1, 1);
assert.ok(!fonte.includes("mouseenter\", function") || !fonte.includes("fetch(queryLog"));

console.log("log ui ok");
