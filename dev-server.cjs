/**
 * Servidor estático local para testar o site com http:// (Service Worker / PWA).
 * Uso: na pasta do projeto, execute: node dev-server.cjs
 * Depois abra: http://localhost:8080/
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = path.normalize(path.join(root, decoded)).replace(/^(\.\.[\/\\])+/, "");
  if (!candidate.startsWith(root)) return null;
  return candidate;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && String(req.url || "").startsWith("/api/locacoes-xlsx")) {
    try {
      const fileName =
        fs.readdirSync(ROOT).find((n) => /^dados de loca.*\.xlsx$/i.test(String(n || ""))) || "";
      if (!fileName) {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Arquivo dados de locação.xlsx não encontrado." }));
        return;
      }
      const filePath = path.join(ROOT, fileName);
      const psScript =
        "$ErrorActionPreference='Stop'; " +
        `$file='${String(filePath).replace(/'/g, "''")}'; ` +
        "$tmp = Join-Path $env:TEMP 'dk_locacoes_api.xlsx'; " +
        "Copy-Item -LiteralPath $file -Destination $tmp -Force; " +
        "$excel=New-Object -ComObject Excel.Application; " +
        "$excel.Visible=$false; $excel.DisplayAlerts=$false; " +
        "$wb=$excel.Workbooks.Open($tmp); " +
        "$ws=$null; " +
        "for($si=1; $si -le $wb.Worksheets.Count; $si++){ " +
        "  $cand=$wb.Worksheets.Item($si); $ur=$cand.UsedRange; if(-not $ur){ continue }; " +
        "  $cc=[int]$ur.Columns.Count; $heads=@(); " +
        "  for($c=1; $c -le $cc; $c++){ $heads += [string]$ur.Cells.Item(1,$c).Text }; " +
        "  $hasProt=$false; $hasPlaca=$false; " +
        "  foreach($h in $heads){ $hl=$h.ToLower(); if($hl.Contains('protocolo')){ $hasProt=$true }; if($hl.Contains('placa')){ $hasPlaca=$true } }; " +
        "  if($hasProt -and $hasPlaca){ $ws=$cand; break } " +
        "}; " +
        "if(-not $ws){ $ws=$wb.Worksheets.Item(1) }; " +
        "$used=$ws.UsedRange; " +
        "$rows=@(); $rowCount=$used.Rows.Count; $colCount=$used.Columns.Count; " +
        "$headers=@(); for($c=1;$c -le $colCount;$c++){ $headers += [string]$used.Cells.Item(1,$c).Text } " +
        "for($r=2;$r -le $rowCount;$r++){ " +
        "  $obj=[ordered]@{}; " +
        "  for($c=1;$c -le $colCount;$c++){ $h=[string]$headers[$c-1]; if(-not [string]::IsNullOrWhiteSpace($h)){ $obj[$h]=[string]$used.Cells.Item($r,$c).Text } } " +
        "  if($obj.Count -gt 0){ $rows += [pscustomobject]$obj } " +
        "} " +
        "$wb.Close($false); $excel.Quit(); " +
        "[System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null; " +
        "[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null; " +
        "$rows | ConvertTo-Json -Depth 6";
      const stdout = execFileSync("powershell.exe", ["-NoProfile", "-Command", psScript], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      });
      const rows = JSON.parse(stdout || "[]");
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ source: fileName, count: rows.length, rows }));
      return;
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "Falha ao ler planilha de locações.",
          detail: String(err && err.message ? err.message : err),
        })
      );
      return;
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }

  let rel = req.url === "/" ? "/index.html" : req.url;
  const filePath = safeJoin(ROOT, rel);

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Abra no navegador: http://localhost:${PORT}/`);
  console.log(`Pare o servidor com Ctrl+C neste terminal.`);
});
