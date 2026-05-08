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

function toPathname(rawUrl) {
  try {
    return new URL(String(rawUrl || "/"), "http://localhost").pathname || "/";
  } catch {
    return "/";
  }
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end();
    return;
  }

  const pathname = toPathname(req.url);
  const wantedPath = pathname === "/" ? "/index.html" : pathname;
  let filePath = safeJoin(ROOT, wantedPath);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Fallback SPA: para rotas sem extensão, devolve o index.
    if (!path.extname(pathname)) {
      const indexPath = path.join(ROOT, "index.html");
      fs.stat(indexPath, (indexErr, indexSt) => {
        if (indexErr || !indexSt.isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Não encontrado — confira se abriu http://localhost:" + PORT + "/ e se o servidor está rodando nesta pasta.");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        fs.createReadStream(indexPath).pipe(res);
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Não encontrado — confira se abriu http://localhost:" + PORT + "/ e se o servidor está rodando nesta pasta.");
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Grupo DK — servidor local");
  console.log("  http://localhost:" + PORT + "/");
  console.log("Pare com Ctrl+C");
});
