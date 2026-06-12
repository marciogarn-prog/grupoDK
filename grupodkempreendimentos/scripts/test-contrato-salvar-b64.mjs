/**
 * Testa normalização base64 do PDF (mesma lógica do Salvar contrato).
 */
function base64ToBlob(b64, mime) {
  const bin = atob(String(b64 || ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/pdf" });
}

async function normalizarBlobLocal(recebido, mimeType = "application/pdf") {
  if (!recebido) return null;
  const mime = String(mimeType || "application/pdf").toLowerCase();
  if (recebido instanceof Blob) return recebido;
  if (typeof recebido === "object" && typeof recebido.b64 === "string" && recebido.b64) {
    return base64ToBlob(recebido.b64, recebido.type || mime);
  }
  return null;
}

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const b64 = Buffer.from(pdfBytes).toString("base64");
const blob = await normalizarBlobLocal({ b64, type: "application/pdf" });
if (!blob || blob.size !== pdfBytes.length) {
  console.error("FAIL contrato salvar b64", blob?.size);
  process.exit(1);
}
console.log("CONTRATO SALVAR B64 OK", blob.size);
