/**
 * POST do share_target (comprovante do banco → DK Cliente).
 * Corre  na Edge antes do ficheiro estático (evita 405) quando a API serverless não está no deploy.
 */
export const config = {
  matcher: ["/cliente", "/api/cliente-share"],
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function pickFile(form) {
  let file = form.get("file") || form.get("files");
  if (file && typeof file !== "string" && file.size > 0) return file;
  for (const [, v] of form.entries()) {
    if (v && typeof v !== "string" && typeof v.size === "number" && v.size > 0) return v;
  }
  return null;
}

export default async function middleware(request) {
  if (request.method !== "POST") return;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (path !== "/cliente" && path !== "/api/cliente-share") return;

  try {
    const form = await request.formData();
    const file = await pickFile(form);
    if (!file) {
      return Response.redirect(new URL("/cliente?dkShare=empty", url), 302);
    }
    const buf = await file.arrayBuffer();
    if (buf.byteLength > 4 * 1024 * 1024) {
      return Response.redirect(new URL("/cliente?dkShare=large", url), 302);
    }
    const html = bridgeHtml({
      name: file.name || "comprovante",
      mime: file.type || "application/octet-stream",
      b64: arrayBufferToBase64(buf),
    });
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.redirect(new URL("/cliente?dkShare=error", url), 302);
  }
}
