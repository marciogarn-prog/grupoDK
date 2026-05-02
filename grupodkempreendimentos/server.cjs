/**
 * Servidor estático local — só precisa do Node.js (sem npm/npx).
 * Na pasta grupodkempreendimentos:
 *   node server.cjs
 * Abra: http://localhost:3000/
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(String(urlPath).split("?")[0]);
  let p = path.normalize(path.join(root, decoded)).replace(/^(\.\.[\/\\])+/, "");
  if (!p.startsWith(root)) return null;
  return p;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end();
    return;
  }

  let filePath = safeJoin(ROOT, req.url === "/" ? "/index.html" : req.url);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Não encontrado — confira se abriu http://localhost:" + PORT + "/ e se o servidor está rodando nesta pasta.");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Grupo DK — servidor local");
  console.log("  http://localhost:" + PORT + "/");
  console.log("Pare com Ctrl+C");
});
