/**
 * Importa clientes retroativos lote 8 (cód. 0071–0080) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote8-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0071",
    dataCadastro: "qui 28/08/2025",
    cpf: "09205057401",
    nome: "JOÃO HENRIQUE MARINHO FERNANDES",
    celular: "(87) 98145-8246",
    cep: "56320-380",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA RIO NEGRO, 265 - JOSÉ E MARIA",
  },
  {
    codigo: "0072",
    dataCadastro: "sex 29/08/2025",
    cpf: "47498480425",
    nome: "SEVERINO DE SOUZA RAMOS FILHO",
    celular: "(87) 98118-5161",
    cep: "56317-160",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CANTO DO VAQUEIRO, 441 - PEDRA LINDA",
  },
  {
    codigo: "0073",
    dataCadastro: "sáb 30/08/2025",
    cpf: "03840504414",
    nome: "ANDERSON GERICO DA CRUZ",
    celular: "(87) 99108-9809",
    recado1: "(87) 98814-9653",
    cnh: "02315174801",
    categoria: "AD",
    vencimento: "21/01/2035",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SEIS, 75 - QUATI",
  },
  {
    codigo: "0074",
    dataCadastro: "sáb 30/08/2025",
    cpf: "02627276506",
    nome: "ROBERTO DE ALMEIDA RIBEIRO",
    celular: "(74) 99192-6928",
    recado1: "(74) 98811-4082",
    recado2: "(74) 98854-0253",
    cnh: "07784546086",
    categoria: "AB",
    vencimento: "25/10/2031",
    ear: "SIM",
    cep: "48913-042",
    municipioUf: "JUAZEIRO/BA",
    endereco: "CAMINHO 41, 19 - DOM JOSÉ RODRIGUES",
  },
  {
    codigo: "0075",
    dataCadastro: "sáb 30/08/2025",
    cpf: "06283637450",
    nome: "TIAGO ALVES PEREIRA",
    celular: "(87) 99186-7424",
    recado1: "(87) 98130-9528",
    cep: "56300-085",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA RIO EXÚ, 13 - JOSÉ E MARIA",
  },
  {
    codigo: "0076",
    dataCadastro: "seg 01/09/2025",
    cpf: "71317277414",
    nome: "THIAGO COSTA DO NASCIMENTO SILVA",
    celular: "(87) 99253-9607",
    recado1: "(87) 99933-8937",
    recado2: "(87) 99105-9496",
    cnh: "09017753633",
    categoria: "AB",
    vencimento: "06/06/2026",
    ear: "SIM",
    cep: "56302-905",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DA FORTUNA, 06 - DOM AVELAR",
  },
  {
    codigo: "0077",
    dataCadastro: "ter 02/09/2025",
    cpf: "09196904402",
    nome: "GABRIEL MAIA E SILVA",
    celular: "(87) 99631-1950",
    recado1: "(87) 98127-6373",
    recado2: "(87) 99942-8938",
    cnh: "05360865589",
    categoria: "AB",
    vencimento: "27/04/2031",
    ear: "NÃO",
    cep: "56310-265",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA OTILIA FERREIRA TELES, 175 - COHAB MASSANGANO",
  },
  {
    codigo: "0078",
    dataCadastro: "ter 02/09/2025",
    cpf: "09329398480",
    nome: "JARLITON RAUYR NOGUEIRA FERREIRA",
    celular: "(87) 99989-4855",
    recado1: "(87) 99909-7903",
    cnh: "04924246058",
    categoria: "AB",
    vencimento: "29/08/2033",
    ear: "NÃO",
    cep: "56312-280",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. SÃO GONÇALO, 10 B - SÃO GONÇALO",
  },
  {
    codigo: "0079",
    dataCadastro: "ter 02/09/2025",
    cpf: "05649094403",
    nome: "NELZITO DE SOUZA RETRÃO",
    celular: "(87) 99806-0019",
    recado1: "(87) 99150-2585",
    cnh: "04402790819",
    categoria: "AB",
    vencimento: "22/05/2034",
    ear: "SIM",
    cep: "56316-756",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA BRASILEIRINHO, 81 - JOÃO DE DEUS",
  },
  {
    codigo: "0080",
    dataCadastro: "qua 03/09/2025",
    cpf: "01395489203",
    nome: "MARCIO ARNOUR DE ASSIS",
    celular: "(91) 99374-0227",
    cep: "66635-210",
    municipioUf: "BELÉM/PA",
    endereco: "CJ JARDIM SEVILHA, SN - BLOCO 20 B - APTO 303 - PARQUE VERDE",
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
  console.log("Lote 8:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 8 (0071–0080) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
