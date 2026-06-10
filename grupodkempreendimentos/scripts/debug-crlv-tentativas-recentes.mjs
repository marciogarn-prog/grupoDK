/** Inspeção: tentativas recentes (docs + depósito) na nuvem demo. */
const BASE = "https://demo.grupodkempreendimentos.com.br";

const res = await fetch(`${BASE}/api/dk-cloud-snapshot?channel=demo&nocache=${Date.now()}`, {
  headers: { "X-DK-Deploy-Channel": "demo" },
});
const body = await res.json();
const p = body?.payload || {};

const horasAtras = (iso) => {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  return Number.isFinite(t) ? ((Date.now() - t) / 3600000).toFixed(1) : "?";
};

console.log("=== DOCS DE LOCAÇÃO (todos, por data) ===");
const docs = Array.isArray(p.dk_locacao_documentos_v1) ? p.dk_locacao_documentos_v1 : [];
docs
  .slice()
  .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
  .forEach((d) =>
    console.log(
      JSON.stringify({
        haHoras: horasAtras(Number(d.createdAt)),
        nc: d.numeroContrato,
        cpf: String(d.cpf || "").slice(0, 11),
        tipo: d.tipo || d.origemDepositoCategoria,
        nome: String(d.nome || "").slice(0, 42),
        enviado: d.enviadoCliente === true,
        confirmado: d.conferidoOperador === true,
        excluido: d.excluido === true,
        b64: String(d.arquivoBase64 || "").length,
      })
    )
  );

console.log("\n=== DEPÓSITO (entradas mais recentes por categoria) ===");
const dep = p.dk_documentos_deposito_v1 || {};
for (const [cat, arr] of Object.entries(dep)) {
  const list = (Array.isArray(arr) ? arr : [])
    .slice()
    .sort((a, b) => (Date.parse(b.criadoEm || 0) || 0) - (Date.parse(a.criadoEm || 0) || 0));
  console.log(`-- ${cat}: ${list.length} ficheiro(s)`);
  list.slice(0, 10).forEach((e) =>
    console.log(
      "  ",
      JSON.stringify({ haHoras: horasAtras(e.criadoEm), chave: e.chave, nome: String(e.nomeArquivo || "").slice(0, 44) })
    )
  );
}
