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
const celulas = ui.celulasDoEvento({
  seq: 2,
  created_at: "2026-10-28T20:00:00.000Z",
  event_type: malicioso,
  entity_type: "system",
  entity_id: "log-dk",
  action: "initialized",
  module: "system",
  actor_user_id: null,
  actor_session_id: null,
  payload: { message: malicioso },
});
assert.strictEqual(celulas[0], "2");
assert.strictEqual(celulas[2], "Sistema");
assert.strictEqual(celulas[4], "system");
assert.strictEqual(celulas[5], malicioso);
assert.ok(celulas[7].includes("initialized"));
assert.ok(celulas[7].includes(malicioso));
assert.deepStrictEqual(ui.celulasDoEvento(null).slice(0, 1), [""]);

console.log("log ui ok");
