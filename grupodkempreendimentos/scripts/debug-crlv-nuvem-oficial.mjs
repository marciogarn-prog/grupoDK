/** Inspeção: estado da nuvem OFICIAL — cadastros e docs de locação. */
const BASE = "https://grupodkempreendimentos.com.br";

const res = await fetch(`${BASE}/api/dk-cloud-snapshot?nocache=${Date.now()}`);
const body = await res.json();
const p = body?.payload || {};
const len = (k) => (Array.isArray(p[k]) ? p[k].length : p[k] && typeof p[k] === "object" ? Object.keys(p[k]).length : 0);

console.log("guard:", p.dk_oficial_cadastro_guard_v1 || "-");
console.log("clientes:", len("dk_clientes_cadastro"));
console.log("veiculos:", len("dk_veiculos_cadastro"));
console.log("locacoes:", len("dk_locacoes_cadastro"));
console.log("docs locacao:", len("dk_locacao_documentos_v1"));
console.log("deposito:", JSON.stringify(
  p.dk_documentos_deposito_v1
    ? Object.fromEntries(Object.entries(p.dk_documentos_deposito_v1).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]))
    : null
));

const locs = Array.isArray(p.dk_locacoes_cadastro) ? p.dk_locacoes_cadastro : [];
locs.slice(0, 10).forEach((l) =>
  console.log("LOC:", JSON.stringify({ nc: l.numeroContrato, cpf: String(l.cpf || "").slice(0, 11), placa: l.placa, inicio: l.inicio, fim: l.fim || "", dataCadastro: l.dataCadastro }))
);

const docs = Array.isArray(p.dk_locacao_documentos_v1) ? p.dk_locacao_documentos_v1 : [];
docs.forEach((d) =>
  console.log("DOC:", JSON.stringify({
    id: String(d.id).slice(0, 22),
    nc: d.numeroContrato,
    tipo: d.tipo || d.origemDepositoCategoria,
    nome: String(d.nome || "").slice(0, 40),
    enviado: d.enviadoCliente === true,
    excluido: d.excluido === true,
    b64: String(d.arquivoBase64 || "").length,
    createdAt: d.createdAt ? new Date(Number(d.createdAt)).toISOString() : "-",
  }))
);

const dep = p.dk_documentos_deposito_v1;
if (dep && typeof dep === "object") {
  for (const [cat, arr] of Object.entries(dep)) {
    (Array.isArray(arr) ? arr : []).forEach((e) =>
      console.log("DEP:", cat, JSON.stringify({ id: String(e.id).slice(0, 22), chave: e.chave, nome: e.nomeArquivo, criadoEm: e.criadoEm }))
    );
  }
}
