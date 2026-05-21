/**
 * Recebe POST do share_target (comprovante do banco) e redireciona para /cliente com ficheiro em sessionStorage.
 * Evita erro 405 da Vercel em POST direto em /cliente (ficheiro estático).
 * Deve existir em grupodkempreendimentos/api/ (Root Directory Vercel = portal).
 */
const Busboy = require("busboy");

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function bridgeHtml(payloadObj) {
  const stored = JSON.stringify(payloadObj);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DK Cliente</title></head><body>
<p style="font-family:system-ui,sans-serif;padding:1rem">A abrir DK Cliente com o comprovante…</p>
<script>
try {
  sessionStorage.setItem("dk_cliente_share_pending", ${JSON.stringify(stored)});
} catch (e) {
  try {
    localStorage.setItem("dk_cliente_share_pending", ${JSON.stringify(stored)});
  } catch (e2) {}
}
location.replace("/cliente?dkShare=file");
</script></body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    res.writeHead(302, { Location: "/cliente" });
    return res.end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    return res.status(405).send("Method Not Allowed");
  }

  return new Promise((resolve) => {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = "comprovante";
    let mime = "application/octet-stream";

    busboy.on("file", (field, stream, info) => {
      const chunks = [];
      if (info.filename) fileName = info.filename;
      if (info.mimeType) mime = info.mimeType;
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        if (!chunks.length) return;
        const buf = Buffer.concat(chunks);
        if (!fileBuffer || buf.length > fileBuffer.length) {
          fileBuffer = buf;
        }
      });
    });

    busboy.on("error", () => {
      res.writeHead(302, { Location: "/cliente?dkShare=error" });
      res.end();
      resolve();
    });

    busboy.on("finish", () => {
      if (!fileBuffer || !fileBuffer.length) {
        res.writeHead(302, { Location: "/cliente?dkShare=empty" });
        res.end();
        resolve();
        return;
      }

      if (fileBuffer.length > 4 * 1024 * 1024) {
        res.writeHead(302, { Location: "/cliente?dkShare=large" });
        res.end();
        resolve();
        return;
      }

      const b64 = fileBuffer.toString("base64");
      const html = bridgeHtml({ name: fileName, mime, b64 });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(html);
      resolve();
    });

    req.pipe(busboy);
  });
};
