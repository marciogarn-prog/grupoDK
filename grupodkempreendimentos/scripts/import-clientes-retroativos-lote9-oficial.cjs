/**
 * Importa clientes retroativos lote 9 (cód. 0081–0090) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote9-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0081",
    dataCadastro: "qua 03/09/2025",
    cpf: "40322718449",
    nome: "STEPHENSON GOMES DE BRITO",
    celular: "(87) 98804-5402",
    recado1: "(87) 98852-7606",
    cnh: "02202245041",
    categoria: "AD",
    vencimento: "21/05/2030",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DORIVAL CAYMMI, 260 - LOTEAMENTO VALE DOURADO",
  },
  {
    codigo: "0082",
    dataCadastro: "qui 04/09/2025",
    cpf: "02812174404",
    nome: "RONALDO RIBEIRO E SILVA",
    celular: "(87) 99142-2583",
    recado1: "(87) 98862-4789",
    recado2: "(87) 98805-1751",
    cnh: "05036391520",
    categoria: "AD",
    vencimento: "30/10/2033",
    ear: "SIM",
    cep: "56321-630",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. H. DA FONSECA, 900 - COND. C. GRANDE RIO - RUA B, 390 - A. CASSIMIRO",
  },
  {
    codigo: "0083",
    dataCadastro: "sex 05/09/2025",
    cpf: "49987378803",
    nome: "GUILHERME MARTINS LEÃO DE SOUSA",
    celular: "(74) 99942-2085",
    recado1: "(74) 98127-1125",
    recado2: "(74) 98157-5407",
    cnh: "08645120115",
    categoria: "AB",
    vencimento: "05/09/2033",
    ear: "NÃO",
    cep: "48924-999",
    municipioUf: "JUAZEIRO/BA",
    endereco: "CJ JUAZEIRO 4 - RUA D - CAM 40 4 - DOM JOSÉ RODRIGUES",
  },
  {
    codigo: "0084",
    dataCadastro: "sex 05/09/2025",
    cpf: "04634318474",
    nome: "JOHN CARLOS MOTA DOS SANTOS",
    celular: "(87) 99636-5748",
    recado1: "(87) 98815-0648",
    recado2: "(87) 99183-6017",
    cnh: "03121649477",
    categoria: "AB",
    vencimento: "20/07/2031",
    ear: "SIM",
    cep: "56321-280",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOS GRAVATÁS, 120 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0085",
    dataCadastro: "sex 05/09/2025",
    cpf: "10165813431",
    nome: "JOANDERSON DA SILVA ANDRADE",
    celular: "(87) 99116-5034",
    cnh: "05331282983",
    categoria: "AC",
    vencimento: "07/02/2034",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. MARIA AILA SILVA, 884 - JOÃO DE DEUS",
  },
  {
    codigo: "0086",
    dataCadastro: "sáb 06/09/2025",
    cpf: "01430894474",
    nome: "EDNALDO DE ALMEIDA RIBEIRO",
    celular: "(87) 99154-3421",
    recado1: "(87) 99158-9590",
    cnh: "03936435499",
    categoria: "AB",
    vencimento: "21/12/2033",
    ear: "NÃO",
    cep: "56310-740",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA RUBEM AMORIM ARAÚJO, 316 - COHAB MASSANGANO",
  },
  {
    codigo: "0087",
    dataCadastro: "sáb 06/09/2025",
    cpf: "02964136580",
    nome: "GLEISON PASSOS BORGES",
    celular: "(74) 98126-2118",
    recado1: "(87) 98144-4962",
    cnh: "05470777747",
    categoria: "AD",
    vencimento: "27/05/2035",
    cep: "56321-630",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. DAS NAÇÕES FERNANDO FARIAS, 1000 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0088",
    dataCadastro: "sáb 06/09/2025",
    cpf: "10914326430",
    nome: "JONATA SILVA XAVIER",
    celular: "(87) 99614-1737",
    recado1: "(87) 98108-8636",
    recado2: "(87) 99664-8244",
    cnh: "07646648068",
    categoria: "AB",
    vencimento: "27/01/2026",
    ear: "SIM",
    cep: "56306-640",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TERRA NOVA, 735 - JARDIM MARAVILHA",
  },
  {
    codigo: "0089",
    dataCadastro: "sáb 06/09/2025",
    cpf: "08178511517",
    nome: "LUIS CARLOS MEDEIROS DOS SANTOS",
    celular: "(87) 98138-1021",
    recado1: "(87) 99915-7483",
    cnh: "07425358768",
    categoria: "AB",
    vencimento: "14/01/2035",
    ear: "NÃO",
    cep: "48907-221",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA D, 103 - AP 103 - BL 008 - QD B - RESIDENCIAL JUAZEIRO I - ITABERABA",
  },
  {
    codigo: "0090",
    dataCadastro: "sáb 06/09/2025",
    cpf: "04308783461",
    nome: "ROGÉRIO PORFIRIO DOS SANTOS",
    celular: "(87) 98150-2604",
    recado1: "(87) 98831-5424",
    cnh: "04290834617",
    categoria: "AC",
    vencimento: "15/10/2034",
    ear: "SIM",
    cep: "56322-552",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA OITO, 126 - BAIRRO SÃO JORGE",
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
  console.log("Lote 9:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 9 (0081–0090) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
