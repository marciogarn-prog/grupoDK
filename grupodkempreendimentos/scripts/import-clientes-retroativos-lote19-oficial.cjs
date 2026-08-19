/**
 * Importa clientes retroativos lote 19 (cód. 0181–0190) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote19-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0181",
    dataCadastro: "qua 19/11/2025",
    cpf: "70814000436",
    nome: "ALEXANDRE DANOA SANTOS",
    celular: "(87) 99125-3117",
    recado1: "(87) 98101-8633",
    recado2: "(87) 98154-0693",
    cnh: "07730026314",
    categoria: "AB",
    vencimento: "06/09/2031",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. MONSENHOR ANGELO SAMPAIO, 12 - VILA EDUARDO",
  },
  {
    codigo: "0182",
    dataCadastro: "qua 19/11/2025",
    cpf: "10981450466",
    nome: "PAULO RAMON DE SOUZA LIMA",
    celular: "(87) 99164-7719",
    recado1: "(87) 98826-8129",
    recado2: "(87) 98868-1982",
    cnh: "08232267149",
    categoria: "AB",
    vencimento: "13/05/2032",
    ear: "NÃO",
    cep: "56328-180",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TIRADENTES, 456 - VILA EDUARDO",
  },
  {
    codigo: "0183",
    dataCadastro: "qui 20/11/2025",
    cpf: "10578492431",
    nome: "SANDRO JOSÉ DOS SANTOS JUNIOR",
    celular: "(87) 99197-0173",
    recado1: "(87) 98875-9792",
    recado2: "(87) 99952-5261",
    cnh: "08757123623",
    categoria: "AB",
    vencimento: "29/11/2033",
    ear: "SIM",
    cep: "56328-120",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DANTAS BARRETO, 341 D - VILA EDUARDO",
  },
  {
    codigo: "0184",
    dataCadastro: "qui 20/11/2025",
    cpf: "08844560488",
    nome: "ALEXANDRE SILVA DE AQUINO",
    celular: "(87) 99949-8356",
    recado1: "(87) 98165-0288",
    recado2: "(87) 99160-7399",
    cnh: "04415024391",
    categoria: "AB",
    vencimento: "04/01/2033",
    ear: "SIM",
    cep: "56316-748",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA FLAMBOYANT, 141 - JOÃO DE DEUS",
  },
  {
    codigo: "0185",
    dataCadastro: "sáb 22/11/2025",
    cpf: "11498953492",
    nome: "LEANDRO XAVIER GOMES",
    celular: "(87) 98809-3662",
    recado1: "(87) 99135-8660",
    recado2: "(87) 98849-0635",
    cnh: "08738081767",
    categoria: "AB",
    vencimento: "16/11/2033",
    ear: "SIM",
    cep: "56318-280",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CHATEAUBRIAND, 870 - JARDIM AMAZONAS",
  },
  {
    codigo: "0186",
    dataCadastro: "seg 24/11/2025",
    cpf: "11001894405",
    nome: "RICHARDOSOM WICTTOR PEREIRA VILA NOVA",
    celular: "(87) 99188-3637",
    recado1: "(87) 98844-4681",
    recado2: "(87) 98837-0822",
    cnh: "08015691167",
    categoria: "AB",
    vencimento: "15/07/2032",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA ONZE, 295 - SÃO JORGE",
  },
  {
    codigo: "0187",
    dataCadastro: "ter 25/11/2025",
    cpf: "11719088497",
    nome: "GUSTAVO ANGELO FORTALEZA DA SILVA",
    celular: "(82) 98777-6901",
    recado1: "(87) 99615-0249",
    recado2: "(87) 98858-8797",
    cnh: "09161392860",
    categoria: "A",
    vencimento: "10/11/2026",
    ear: "NÃO",
    cep: "56320-540",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TRÊS MARIAS, 183 - JOSÉ E MARIA",
  },
  {
    codigo: "0188",
    dataCadastro: "qua 26/11/2025",
    cpf: "09973944470",
    nome: "WEXILEY FONSECA RIBEIRO",
    celular: "(87) 99119-3593",
    recado1: "(87) 99116-7045",
    recado2: "(87) 99122-0143",
    cnh: "05185661000",
    categoria: "AD",
    vencimento: "21/12/2025",
    ear: "SIM",
    cep: "56310-410",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA ANTÔNIA SILVA CARVALHO, 165 - COHAB MASSANGANO",
  },
  {
    codigo: "0189",
    dataCadastro: "seg 01/12/2025",
    cpf: "08509242437",
    nome: "LEIDIVAN XAVIER",
    celular: "(87) 99925-7669",
    recado1: "(87) 99103-4858",
    recado2: "(87) 99203-5241",
    cnh: "04290845552",
    categoria: "AB",
    vencimento: "05/12/2034",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SETE, 690 A - MANDACARÚ",
  },
  {
    codigo: "0190",
    dataCadastro: "qua 03/12/2025",
    cpf: "03754322486",
    nome: "FRANCISCO DE ASSIS FERREIRA SIQUEIRA",
    celular: "(87) 98802-1759",
    recado1: "(87) 98151-9174",
    recado2: "(87) 98871-6998",
    cnh: "06927376609",
    categoria: "AB",
    vencimento: "22/04/2032",
    ear: "NÃO",
    cep: "56312-853",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PROJETADA 03, 36 - JARDIM PETRÓPOLIS",
  },
];

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function buildClienteRecord(row, idx) {
  const cpf = onlyDigits(row.cpf).slice(0, 11);
  const baseTs = Date.now() - (CLIENTES.length - idx) * 60000;
  return {
    id: baseTs,
    createdAt: baseTs,
    updatedAt: Date.now(),
    origemPortal: true,
    cadastroRetroativo: true,
    status: "ATIVO",
    ambiente: "real",
    senha: "123456",
    codigo: String(row.codigo || "").trim(),
    dataCadastro: String(row.dataCadastro || "").trim(),
    cpf,
    nome: String(row.nome || "").trim(),
    celular: String(row.celular || "").trim(),
    recado1: String(row.recado1 || "").trim(),
    recado2: String(row.recado2 || "").trim(),
    cnh: String(row.cnh || "").trim(),
    categoria: String(row.categoria || "").trim(),
    vencimento: String(row.vencimento || "").trim(),
    ear: String(row.ear || "").trim(),
    cep: String(row.cep || "").trim(),
    municipioUf: String(row.municipioUf || "").trim(),
    endereco: String(row.endereco || "").trim(),
  };
}

async function supabaseFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(typeof data === "object" && data?.message ? data.message : text);
  return data;
}

async function readPayload() {
  try {
    const rows = await supabaseFetch(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=payload`
    );
    if (rows[0]?.payload) return { payload: rows[0].payload, source: "supabase" };
  } catch (e) {
    console.warn("Supabase:", e.message || e);
  }
  const res = await fetch(`${REDIS_SNAPSHOT_URL}?nocache=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  if (!data?.payload) return { payload: {}, source: "redis-empty" };
  return { payload: data.payload, source: "redis" };
}

async function pushRedis(payload) {
  const res = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, updated_at: new Date().toISOString() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "Redis POST falhou");
  return data;
}

async function verifyCloud() {
  const res = await fetch(`${REDIS_SNAPSHOT_URL}?nocache=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  const list = data?.payload?.dk_clientes_cadastro || [];
  const codigos = CLIENTES.map((c) => c.codigo);
  const found = codigos.filter((cod) =>
    list.some((r) => String(r.codigo || "").trim() === cod && onlyDigits(r.cpf).length === 11)
  );
  return { total: list.length, found: found.length, codigos: found };
}

async function main() {
  const novos = CLIENTES.map((row, idx) => buildClienteRecord(row, idx));
  const { payload, source } = await readPayload();
  if (!Array.isArray(payload.dk_clientes_cadastro)) payload.dk_clientes_cadastro = [];
  const antes = payload.dk_clientes_cadastro.length;
  payload.dk_clientes_cadastro = mergeClientesCadastro(payload.dk_clientes_cadastro, novos);
  payload.dk_cadastro_manual_portal_v1 = true;
  const updatedAt = new Date().toISOString();

  let supaOk = false;
  try {
    await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload, updated_at: updatedAt }),
    });
    supaOk = true;
  } catch (e) {
    console.warn("Supabase PATCH:", e.message || e);
  }

  await pushRedis(payload);
  const verify = await verifyCloud();

  console.log("Fonte leitura:", source);
  console.log("Clientes antes:", antes, "→ depois merge:", payload.dk_clientes_cadastro.length);
  console.log("Lote 19:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 19 (0181–0190) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
