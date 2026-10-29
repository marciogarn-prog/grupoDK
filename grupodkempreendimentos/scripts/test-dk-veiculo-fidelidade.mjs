/**
 * Contrato de fidelidade dos veículos.
 * As fixtures são fictícias. A prova ao vivo só lê.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const f = require("../lib/dk-veiculo-fidelidade.cjs");
const pg = require("../lib/dk-veiculos-pg.cjs");
const log = require("../lib/dk-log-apresentacao.cjs");

const oficial = {
  id: "vei-teste-1",
  placa: "TST0B00",
  marca: "MARCA TESTE",
  modelo: "MODELO TESTE",
  marcaModelo: "MARCA TESTE / MODELO TESTE",
  anoFabricacao: "2024",
  anoModelo: "2024",
  cor: "AZUL",
  chassi: "CHASSI-TESTE-0001",
  renavam: "00000000000",
  tipo: "MOTO",
  categoria: "PASSEIO",
  combustivel: "FLEX",
  quilometragem: 10,
  valorCompra: 0,
  valorInvestimento: null,
  dataAquisicao: "",
  fornecedor: "FORNECEDOR TESTE",
  proprietario: "PROPRIETARIO TESTE",
  proprietarioCpfCnpj: "00000000000",
  situacao: "DISPONIVEL",
  status: "DISPONIVEL",
  observacoes: "observação fictícia",
  documentos: [{ tipo: "crlv", ref: "doc-teste-1" }],
  fotos: ["foto-a", "foto-b"],
  financeiro: { parcelas: [1, 0, 3], moeda: "BRL" },
  campo_futuro_teste: { subcampo: "preservar", lista: ["a", "b"] },
};

assert.equal(Object.keys(oficial).length >= 20, true);
const ida = f.dkVeiculoParaTerminal(f.dkVeiculoParaPersistencia(oficial));
assert.equal(f.dkVeiculoCompararRoundTrip(oficial, ida).ok, true);
assert.equal(ida.anoFabricacao, "2024");
assert.equal(typeof ida.anoFabricacao, "string");
assert.equal(ida.valorCompra, 0);
assert.equal(ida.valorInvestimento, null);
assert.equal(Object.prototype.hasOwnProperty.call(ida, "dataAquisicao"), true);
assert.equal(ida.dataAquisicao, "");
assert.deepEqual(ida.fotos, ["foto-a", "foto-b"]);
assert.equal(ida.campo_futuro_teste.subcampo, "preservar");

const patch = f.dkVeiculoAplicarPatch(oficial, { quilometragem: 11 });
assert.equal(patch.quilometragem, 11);
assert.equal(patch.valorCompra, 0);
assert.equal(patch.valorInvestimento, null);
assert.equal(patch.dataAquisicao, "");
assert.equal(patch.campo_futuro_teste.lista[1], "b");
assert.equal(Object.prototype.hasOwnProperty.call(f.dkVeiculoAplicarPatch(oficial, { cor: "PRETO" }), "valorCompra"), true);

const ausente = { id: "vei-teste-2", placa: "TST0B01" };
assert.equal(Object.prototype.hasOwnProperty.call(ausente, "valorCompra"), false);
assert.equal(Object.prototype.hasOwnProperty.call(f.dkVeiculoAplicarPatch(ausente, { quilometragem: 1 }), "valorCompra"), false);

const resumo = f.dkVeiculoResumo(oficial);
assert.equal(Object.keys(resumo).length <= 5, true);
assert.equal(f.dkVeiculoSubstituir(oficial, resumo).ok, false);
assert.equal(f.dkVeiculoConflitoVersao(8, 9).status, 409);
assert.equal(f.dkVeiculoConflitoVersao(8, 8).ok, true);
assert.deepEqual(f.COLUNAS_TECNICAS, ["id", "placa", "created_at", "updated_at", "deleted_at"]);
assert.equal(f.COLUNAS_TECNICAS.includes("updatedAt"), false);
assert.equal(f.LEGACY_FALLBACKS.every((item) => item.classe === "LEGACY_FALLBACK"), true);

const divergenciaNova = f.dkVeiculoClassificarEspelho(
  [{ id: "1", modelo: "A", updatedAt: 1 }],
  [{ id: "1", modelo: "B", updatedAt: 2 }]
);
assert.equal(divergenciaNova.classe, "DIVERGENCIA_NOVA");

const api = fs.readFileSync(new URL("../api/cadastro-veiculos.js", import.meta.url), "utf8");
const pgSrc = fs.readFileSync(new URL("../lib/dk-veiculos-pg.cjs", import.meta.url), "utf8");
assert.equal(api.includes('req.query?.detalhe || "") === "1"'), true);
assert.equal(api.includes("lerVeiculoCompleto"), true);
assert.equal(pgSrc.includes("dkVeiculoAplicarPatch"), true);
assert.equal(api.includes("dk_portal_veiculos_cadastro"), true);
assert.equal(fs.readFileSync(new URL("../lib/dk-veiculos-fonte.cjs", import.meta.url), "utf8").includes("snapshot"), true);
assert.equal(fs.readFileSync(new URL("../lib/dk-veiculos-copiar.cjs", import.meta.url), "utf8").includes("dk_veiculos_cadastro"), true);

const ui = fs.readFileSync(new URL("../portal-locadora-ui.js", import.meta.url), "utf8");
const envio = ui.slice(ui.indexOf("async function portalEnviarUmVeiculoParaNuvem"), ui.indexOf("const doSaveVeiculo"));
assert.equal(envio.includes("revisao_conflito"), false);

const evento = log.sanitizarEvento({
  event_type: "system.vehicle_fidelity_contract_verified",
  action: "verified",
  payload: { vehicles: 199 },
  details: { imagemRecortada: "data:application/pdf;base64," + "A".repeat(400), crlv: { pdf: "x" } },
});
assert.equal(evento.summary, "Contrato de fidelidade dos veículos verificado");
assert.equal(Object.prototype.hasOwnProperty.call(evento.details, "imagemRecortada"), false);
assert.equal(Object.prototype.hasOwnProperty.call(evento.details, "crlv"), false);

const memoria = new Map();
function restFalso(caminho, opts = {}) {
  const metodo = String(opts.method || "GET").toUpperCase();
  if (metodo === "GET" && String(caminho).includes("id=eq.")) {
    const id = decodeURIComponent(String(caminho).split("id=eq.")[1].split("&")[0]);
    return Promise.resolve({ ok: true, status: 200, data: memoria.has(id) ? [memoria.get(id)] : [] });
  }
  if (metodo === "GET" && String(caminho).includes("placa=eq.")) {
    const placa = decodeURIComponent(String(caminho).split("placa=eq.")[1].split("&")[0]);
    return Promise.resolve({ ok: true, status: 200, data: [...memoria.values()].filter((row) => row.placa === placa) });
  }
  if (metodo === "POST") {
    memoria.set(opts.body.id, { ...opts.body });
    return Promise.resolve({ ok: true, status: 201, data: [opts.body] });
  }
  return Promise.resolve({ ok: true, status: 200, data: [] });
}
memoria.set("vei-teste-1", {
  id: oficial.id,
  placa: oficial.placa,
  payload: oficial,
  updated_at: "2026-10-29T12:00:00.000Z",
});
const salvo = await pg.upsertUm({ id: oficial.id, placa: oficial.placa, quilometragem: 12 }, "2026-10-29T12:00:00.000Z", restFalso);
assert.equal(salvo.ok, true);
assert.equal(memoria.get("vei-teste-1").payload.quilometragem, 12);
assert.equal(memoria.get("vei-teste-1").payload.valorCompra, 0);
assert.equal(memoria.get("vei-teste-1").payload.campo_futuro_teste.subcampo, "preservar");
assert.deepEqual(memoria.get("vei-teste-1").payload.fotos, ["foto-a", "foto-b"]);

console.log("ok dk-veiculo-fidelidade");

if (process.env.DK_SB_TOKEN) {
  const { classificarBlocoDocumento, hashValue, entityRef, inventoryKeys } = await import("../lib/dk-integrity-canonical.mjs");
  const backup = JSON.parse(
    zlib.gunzipSync(fs.readFileSync("C:/Users/marci/OneDrive/Área de Trabalho/backup.json.gz")).toString("utf8")
  );
  const golden = JSON.parse(
    zlib.gunzipSync(fs.readFileSync("C:/Users/marci/OneDrive/Área de Trabalho/dk-integrity-golden-baseline-20261029.json.gz")).toString("utf8")
  );
  const oficiais = backup.data.dk_veiculos_cadastro;
  const espelho = backup.data.dk_portal_veiculos_cadastro;
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
  for (let offset = 0; offset < 5000; offset += 20) {
    const lote = await sql(
      "select id, payload from public.dk_veiculos where deleted_at is null order by id limit 20 offset " + offset
    );
    atuais.push(...lote);
    if (lote.length < 20) break;
  }
  const fantasma = await sql(
    "select count(*)::int as n from public.dk_veiculos where deleted_at is null and (upper(placa) = 'AAA1A11' or upper(payload->>'placa') = 'AAA1A11')"
  );
  const porId = new Map(atuais.map((row) => [String(row.id), row]));
  let aprovados = 0;
  let falhos = 0;
  let missing = 0;
  let extra = 0;
  let types = 0;
  let values = 0;
  const chaves = new Map();
  for (const item of oficiais) {
    for (const chave of Object.keys(item || {})) chaves.set(chave, (chaves.get(chave) || 0) + 1);
    const row = porId.get(String(item.id));
    const terminalBanco = row ? f.dkVeiculoParaTerminal(row) : null;
    const idaReal = f.dkVeiculoParaTerminal(f.dkVeiculoParaPersistencia(item));
    const memoriaOk = f.dkVeiculoCompararRoundTrip(item, idaReal).ok;
    const diff = terminalBanco
      ? f.classificarDiferencas(item, terminalBanco)
      : { ok: false, missing: ["registro"], extra: [], typeChanges: [], valueChanges: [] };
    if (memoriaOk && diff.ok) aprovados += 1;
    else {
      falhos += 1;
      missing += diff.missing.length;
      extra += diff.extra.length;
      types += diff.typeChanges.length;
      values += diff.valueChanges.length;
    }
  }
  const espelhoClasse = f.dkVeiculoClassificarEspelho(oficiais, espelho);
  const linhas = oficiais
    .map((item) => entityRef("veiculos", item.id) + " " + hashValue(item))
    .sort();
  const hashOficial = hashValue(linhas);
  const goldenMod = (golden.modules || []).find((item) => item.module === "veiculos");
  function docsCrlv(raiz) {
    const saida = [];
    function walk(node, caminho) {
      if (typeof node === "string" && node.startsWith("data:")) {
        const bloco = classificarBlocoDocumento({ data: node });
        if (bloco && caminho.toLowerCase().includes("crlv")) saida.push(bloco);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, indice) => walk(item, caminho + "[" + indice + "]"));
        return;
      }
      if (!node || typeof node !== "object") return;
      const bloco = classificarBlocoDocumento(node);
      if (bloco && caminho.toLowerCase().includes("crlv")) saida.push({ ...bloco, dono: node.placa || node.veiculoId || node.id || "" });
      for (const chave of Object.keys(node)) {
        if (bloco && ["data", "imagem", "imagemRecortada", "arquivo", "pdf", "conteudo"].includes(chave)) continue;
        walk(node[chave], caminho ? caminho + "." + chave : chave);
      }
    }
    walk(raiz, "dk_patrimonio_crlv_v1");
    return saida;
  }
  const placas = new Set(
    oficiais.map((item) => String(item.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean)
  );
  const crlv = docsCrlv(backup.data.dk_patrimonio_crlv_v1);
  const crlvGolden = (golden.documentos || []).filter((item) => item.doc_type === "crlv");
  const assinatura = (lista) =>
    lista
      .map((item) => item.status + ":" + (item.sha256 || "") + ":" + (item.bytes || 0) + ":" + (item.mime || ""))
      .sort()
      .join("\n");
  const verificados = crlv.filter((item) => item.status === "verified");
  const vinculados = verificados.filter((item) => placas.has(String(item.dono || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))).length;
  const aaaBackup = oficiais.filter((item) => String(item.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === "AAA1A11").length;
  const motos = oficiais.filter((item) => String(item.tipo || "").toUpperCase() === "MOTO").length;
  const carros = oficiais.filter((item) => String(item.tipo || "").toUpperCase() === "CARRO").length;
  const incomuns = [...chaves.entries()].filter(([, n]) => n > 0 && n < oficiais.length * 0.1).length;
  const shaGolden = createHash("sha256")
    .update(fs.readFileSync("C:/Users/marci/OneDrive/Área de Trabalho/dk-integrity-golden-baseline-20261029.json.gz"))
    .digest("hex");
  const relatorio = {
    total: oficiais.length,
    atual: atuais.length,
    roundtrip_aprovados: aprovados,
    roundtrip_falhos: falhos,
    missing,
    extra,
    types,
    values,
    chaves: chaves.size,
    caminhos: inventoryKeys(oficiais).length,
    hash_oficial: hashOficial,
    hash_golden: goldenMod ? goldenMod.aggregate_hash : "",
    hash_igual: Boolean(goldenMod) && goldenMod.aggregate_hash === hashOficial,
    aaa1a11_backup: aaaBackup,
    aaa1a11_banco: Number(fantasma[0] && fantasma[0].n),
    espelho: espelhoClasse.classe,
    espelho_updated_at: espelhoClasse.updatedAt,
    espelho_proprietario: espelhoClasse.proprietario,
    espelho_documento: espelhoClasse.proprietarioDocumento,
    espelho_outras: espelhoClasse.outras.length,
    espelho_refs: espelhoClasse.refs,
    crlv_verified: verificados.length,
    crlv_absent: crlv.filter((item) => item.status === "absent_in_source").length,
    crlv_missing: crlv.filter((item) => item.status === "document_missing").length,
    crlv_vinculados: vinculados,
    crlv_hash_igual: assinatura(crlv) === assinatura(crlvGolden),
    motos,
    carros,
    chaves_incomuns: incomuns,
    golden_sha_ok: shaGolden === "9ad7a1c8fe664dfe274cb93bdf79f248c18c166d34b66787266a4be10dc06d56",
  };
  console.log(JSON.stringify(relatorio));
  if (
    aprovados !== 199 ||
    falhos !== 0 ||
    aaaBackup !== 0 ||
    Number(fantasma[0] && fantasma[0].n) !== 0 ||
    espelhoClasse.classe !== "KNOWN_LEGACY_MIRROR_DIFFERENCE" ||
    !relatorio.crlv_hash_igual ||
    relatorio.crlv_verified !== 15 ||
    relatorio.crlv_absent !== 122 ||
    relatorio.crlv_missing !== 0 ||
    !relatorio.hash_igual ||
    motos < 5 ||
    carros < 5
  ) {
    process.exit(1);
  }
}
