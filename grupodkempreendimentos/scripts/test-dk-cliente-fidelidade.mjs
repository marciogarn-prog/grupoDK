import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import fs from "node:fs";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const f = require("../lib/dk-cliente-fidelidade.cjs");
const log = require("../lib/dk-log-apresentacao.cjs");
const pg = require("../lib/dk-clientes-pg.cjs");

const cliente = {
  id: "c-100",
  nome: "CLIENTE FICTICIO",
  cpf: "123.456.789-01",
  rg: "MG-1",
  nascimento: "01/01/1990",
  telefone: "11999990000",
  telefoneAlternativo: "",
  email: "ficticio@example.com",
  endereco: "Rua Teste",
  numero: "10",
  complemento: null,
  bairro: "Centro",
  cidade: "Cidade",
  estado: "SP",
  cep: "01000-000",
  cnh: "00000000000",
  numeroCnh: "00000000000",
  categoriaCnh: "A",
  validadeCnh: "01/01/2030",
  emissaoCnh: "01/01/2020",
  profissao: "Teste",
  empresa: "Empresa Ficticia",
  renda: "123",
  referencias: [{ nome: "Ref Um", telefone: "11888880000" }],
  contatos: ["a", "b"],
  observacoes: "nota",
  status: "ATIVO",
  documentos: [{ tipo: "cnh", ref: "doc-ficticio" }],
  cadastro: { origem: "teste", legado: true },
  campo_futuro_teste: { subcampo: "preservar" },
};

const persistido = f.dkClienteParaPersistencia(cliente);
const terminal = f.dkClienteParaTerminal({ id: persistido.id, cpf: persistido.cpf, payload: persistido.payload });
assert.equal(f.dkClienteCompararRoundTrip(cliente, terminal).ok, true);
assert.equal(persistido.cpf, "12345678901");
assert.equal(persistido.payload.cpf, "123.456.789-01");
assert.equal(persistido.payload.renda, "123");
assert.notEqual(typeof persistido.payload.renda, "number");

const patch = f.dkClienteAplicarPatch(cliente, { telefone: "11777770000" });
assert.equal(patch.telefone, "11777770000");
assert.equal(f.textoEstavel(f.dkClienteCanonicalizar({ ...cliente, telefone: "11777770000" })), f.textoEstavel(f.dkClienteCanonicalizar(patch)));
assert.equal(patch.validadeCnh, "01/01/2030");
assert.equal(Object.prototype.hasOwnProperty.call(f.dkClienteAplicarPatch(cliente, { telefone: "1" }), "validadeCnh"), true);

assert.deepEqual(f.dkClienteAplicarPatch(cliente, { campo_futuro_teste: { subcampo: "preservar" } }).campo_futuro_teste, {
  subcampo: "preservar",
});
assert.deepEqual(patch.referencias, cliente.referencias);
assert.deepEqual(patch.contatos, ["a", "b"]);
assert.equal(f.dkClienteAplicarPatch({ complemento: null }, {}).complemento, null);
assert.equal(Object.prototype.hasOwnProperty.call(f.dkClienteAplicarPatch({ telefone: "1" }, {}), "validadeCnh"), false);
assert.equal(f.dkClienteAplicarPatch({ telefoneAlternativo: "" }, {}).telefoneAlternativo, "");
assert.equal(f.dkClienteAplicarPatch({ telefoneAlternativo: "1" }, { telefoneAlternativo: "" }).telefoneAlternativo, "");

const resumo = { id: "c-100", nome: "CLIENTE FICTICIO", cpf: "12345678901", status: "ATIVO" };
assert.equal(f.dkClienteEhResumo(resumo), true);
assert.equal(f.dkClienteSubstituir(cliente, resumo).ok, false);
assert.equal(f.dkClienteAplicarPatch(cliente, { telefone: "11000000000" }).cnh, "00000000000");
assert.equal(f.dkClienteResumo(cliente).cpf.includes("12345678901"), false);

const versao = f.dkClienteConflitoVersao(5, 5);
assert.equal(versao.ok, true);
assert.equal(versao.proxima, 6);
const stale = f.dkClienteConflitoVersao(5, 6);
assert.equal(stale.ok, false);
assert.equal(stale.status, 409);

assert.equal(log.resumoEvento({ event_type: "system.integrity_baseline_created" }), "Baseline de integridade criada");
assert.equal(f.LEGACY_FALLBACKS.length >= 3, true);
assert.ok(f.LEGACY_FALLBACKS.every((item) => item.classe === "LEGACY_FALLBACK"));

const memoria = new Map();
const restFalso = async (caminho, opts) => {
  const metodo = (opts && opts.method) || "GET";
  if (metodo === "GET" && String(caminho).includes("cpf=eq.")) {
    return { ok: true, status: 200, data: [...memoria.values()] };
  }
  if (metodo === "POST") {
    memoria.set(opts.body.id, opts.body);
    return { ok: true, status: 201, data: [opts.body] };
  }
  return { ok: true, status: 200, data: [] };
};
memoria.set("c-100", {
  id: "c-100",
  cpf: "12345678901",
  payload: cliente,
  updated_at: "2026-10-29T12:00:00.000Z",
});
const salvo = await pg.upsertUm({ cpf: "123.456.789-01", telefone: "11666660000" }, "2026-10-29T12:00:00.000Z", restFalso);
assert.equal(salvo.ok, true);
assert.equal(memoria.get("c-100").payload.telefone, "11666660000");
assert.equal(memoria.get("c-100").payload.campo_futuro_teste.subcampo, "preservar");
assert.equal(memoria.get("c-100").payload.contatos[0], "a");
assert.equal(memoria.get("c-100").payload.complemento, null);

const ui = fs.readFileSync(new URL("../portal-locadora-ui.js", import.meta.url), "utf8");
const envio = ui.slice(ui.indexOf("async function portalEnviarUmClienteParaNuvem"), ui.indexOf("async function portalAgendarEnvioClienteParaNuvem"));
assert.equal(envio.includes("revisao_conflito"), false);
assert.equal(log.sanitizarEvento({ event_type: "system.integrity_baseline_created", audit_no: 3, seq: 20, payload: { baseline_id: "x" } }).summary, "Baseline de integridade criada");

console.log("ok dk-cliente-fidelidade");

if (process.env.DK_SB_TOKEN) {
  const { classificarBlocoDocumento } = await import("../lib/dk-integrity-canonical.mjs");
  const backup = JSON.parse(
    zlib.gunzipSync(fs.readFileSync("C:/Users/marci/OneDrive/Área de Trabalho/backup.json.gz")).toString("utf8")
  );
  const golden = JSON.parse(
    zlib.gunzipSync(fs.readFileSync("C:/Users/marci/OneDrive/Área de Trabalho/dk-integrity-golden-baseline-20261029.json.gz")).toString("utf8")
  );
  const clientesBackup = backup.data.dk_clientes_cadastro;
  async function sql(query) {
    const res = await fetch("https://api.supabase.com/v1/projects/ppxtwqvzgujllfzarpuz/database/query/read-only", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.DK_SB_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error("sql_" + res.status);
    return res.json();
  }
  const atuais = [];
  for (let offset = 0; offset < 5000; offset += 40) {
    const lote = await sql(
      "select id, payload from public.dk_clientes where deleted_at is null order by id limit 40 offset " + offset
    );
    atuais.push(...lote);
    if (lote.length < 40) break;
  }
  const porId = new Map(atuais.map((row) => [String(row.id), row]));
  let aprovados = 0;
  let falhos = 0;
  let missing = 0;
  let extra = 0;
  let types = 0;
  let values = 0;
  for (const item of clientesBackup) {
    const row = porId.get(String(item.id));
    const terminalBanco = row ? f.dkClienteParaTerminal(row) : null;
    const ida = f.dkClienteParaTerminal(f.dkClienteParaPersistencia(item));
    const memoriaOk = f.dkClienteCompararRoundTrip(item, ida).ok;
    const diff = terminalBanco ? f.classificarDiferencas(item, terminalBanco) : { ok: false, missing: ["registro"], extra: [], typeChanges: [], valueChanges: [] };
    if (memoriaOk && diff.ok) aprovados += 1;
    else {
      falhos += 1;
      missing += diff.missing.length;
      extra += diff.extra.length;
      types += diff.typeChanges.length;
      values += diff.valueChanges.length;
    }
  }
  function docsCliente(raiz) {
    const saida = [];
    function walk(node, caminho) {
      if (Array.isArray(node)) {
        node.forEach((item, indice) => walk(item, caminho + "[" + indice + "]"));
        return;
      }
      if (!node || typeof node !== "object") return;
      const bloco = classificarBlocoDocumento(node);
      if (bloco) {
        const tipo = caminho.toLowerCase().includes("resid") ? "residencia" : caminho.toLowerCase().includes("cnh") ? "cnh" : "anexo";
        saida.push(tipo + ":" + bloco.status + ":" + (bloco.sha256 || ""));
      }
      for (const chave of Object.keys(node)) {
        if (bloco && ["data", "imagem", "imagemRecortada", "arquivo", "pdf", "conteudo"].includes(chave)) continue;
        walk(node[chave], caminho ? caminho + "." + chave : chave);
      }
    }
    walk(raiz, "dk_cliente_docs_v1");
    return saida.sort();
  }
  const docsAgora = docsCliente(backup.data.dk_cliente_docs_v1);
  const docsAntes = (golden.documentos || [])
    .filter((item) => item.doc_type === "cnh" || item.doc_type === "residencia")
    .map((item) => item.doc_type + ":" + item.status + ":" + item.sha256)
    .sort();
  const docsIguais = JSON.stringify(docsAntes) === JSON.stringify(docsAgora);
  const shaGolden = createHash("sha256")
    .update(fs.readFileSync("C:/Users/marci/OneDrive/Área de Trabalho/dk-integrity-golden-baseline-20261029.json.gz"))
    .digest("hex");
  console.log(
    JSON.stringify({
      roundtrip_aprovados: aprovados,
      roundtrip_falhos: falhos,
      missing,
      extra,
      types,
      values,
      total: clientesBackup.length,
      atual: atuais.length,
      documentos_iguais: docsIguais,
      documentos: docsAgora.length,
      golden_sha_ok: shaGolden === "9ad7a1c8fe664dfe274cb93bdf79f248c18c166d34b66787266a4be10dc06d56",
    })
  );
  if (aprovados !== 437 || falhos !== 0 || !docsIguais) process.exit(1);
}
