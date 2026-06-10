/** Inspeção: docs de locação na nuvem demo — CRLVs enviados/quebrados. */
const BASE = "https://demo.grupodkempreendimentos.com.br";

const res = await fetch(`${BASE}/api/dk-cloud-snapshot?channel=demo&nocache=${Date.now()}`, {
  headers: { "X-DK-Deploy-Channel": "demo" },
});
const body = await res.json();
const payload = body?.payload || body || {};
const docs = Array.isArray(payload.dk_locacao_documentos_v1) ? payload.dk_locacao_documentos_v1 : [];

console.log("total docs na nuvem:", docs.length);
const rows = docs.map((d) => ({
  id: String(d.id).slice(0, 24),
  nc: d.numeroContrato,
  cpf: String(d.cpf || "").slice(0, 11),
  tipo: d.tipo || d.origemDepositoCategoria || "?",
  nome: String(d.nome || "").slice(0, 38),
  enviado: d.enviadoCliente === true,
  excluido: d.excluido === true,
  b64: String(d.arquivoBase64 || "").length,
  pdfRedis: d.pdfNaCopiaRedis === true,
  createdAt: d.createdAt ? new Date(Number(d.createdAt)).toISOString().slice(0, 16) : "-",
}));

const problemas = rows.filter((r) => r.enviado && !r.excluido && r.b64 === 0);
console.log("\n=== ENVIADOS SEM PDF (b64=0) ===");
console.table ? console.table(problemas) : console.log(JSON.stringify(problemas, null, 1));

console.log("\n=== TODOS (resumo por estado) ===");
const ag = {};
for (const r of rows) {
  const k = `${r.tipo}|env=${r.enviado}|exc=${r.excluido}|pdf=${r.b64 > 0 ? "sim" : r.pdfRedis ? "redis" : "nao"}`;
  ag[k] = (ag[k] || 0) + 1;
}
console.log(JSON.stringify(ag, null, 1));

console.log("\n=== CRLVs mais recentes ===");
rows
  .filter((r) => r.tipo === "crlv")
  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  .slice(0, 12)
  .forEach((r) => console.log(JSON.stringify(r)));
