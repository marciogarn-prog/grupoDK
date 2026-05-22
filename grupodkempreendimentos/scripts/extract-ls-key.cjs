const fs = require("fs");
const path = require("path");
const os = require("os");

const file = process.argv[2];
const key = process.argv[3];
if (!file || !key) {
  console.error("Uso: node extract-ls-key.cjs <ldb> <key>");
  process.exit(1);
}

const buf = fs.readFileSync(file);
const key16 = Buffer.from(key, "utf16le");

function parseArray(text, from) {
  const j = text.indexOf("[{", from);
  if (j < 0) return null;
  let depth = 0;
  for (let k = j; k < text.length; k++) {
    if (text[k] === "[") depth++;
    else if (text[k] === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(j, k + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

let idx = 0;
while ((idx = buf.indexOf(key16, idx)) >= 0) {
  const chunk = buf.slice(idx + key16.length, idx + key16.length + 8_000_000).toString("utf16le");
  const arr = parseArray(chunk, 0);
  if (arr) {
    console.log(JSON.stringify({ key, count: arr.length, file: path.basename(file) }));
    console.log(JSON.stringify(arr, null, 2));
    process.exit(0);
  }
  idx += key16.length;
}
console.error("Não encontrado:", key);
process.exit(1);
