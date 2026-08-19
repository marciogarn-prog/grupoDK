/**
 * Importa clientes retroativos lote 12 (cód. 0111–0120) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote12-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0111",
    dataCadastro: "qua 24/09/2025",
    cpf: "70928471411",
    nome: "EMERSON MAGALHÃES PEREIRA",
    celular: "(87) 99120-2304",
    recado1: "(87) 99110-5239",
    recado2: "(87) 98842-3507",
    cnh: "06701622045",
    categoria: "AB",
    vencimento: "18/04/2034",
    ear: "SIM",
    cep: "56306-330",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DA LIBERDADE, 125 - JARDIM MARAVILHA",
  },
  {
    codigo: "0112",
    dataCadastro: "qua 24/09/2025",
    cpf: "89579046549",
    nome: "GLEUBER LIMA DA SILVA",
    celular: "(74) 98817-0921",
    recado1: "(74) 98851-0250",
    recado2: "(74) 99126-1712",
    cnh: "03732955415",
    categoria: "AB",
    vencimento: "26/04/2031",
    ear: "NÃO",
    cep: "48903-440",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA F, 153 - EXPEDITO DE ALMEIDA NASCIMENTO",
  },
  {
    codigo: "0113",
    dataCadastro: "qui 25/09/2025",
    cpf: "02279823551",
    nome: "WELLINGTON BORGENS DOS SANTOS",
    celular: "(71) 98444-4326",
    recado1: "(71) 99145-1201",
    recado2: "(75) 99253-5422",
    cnh: "04310201478",
    categoria: "AB",
    vencimento: "05/01/2032",
    ear: "SIM",
    cep: "41215-800",
    municipioUf: "SALVADOR/BA",
    endereco: "TRAV. MARIA LUZINETE, 68 - CASA 01 - NOVO HORIZONTE",
  },
  {
    codigo: "0114",
    dataCadastro: "sex 26/09/2025",
    cpf: "01664129537",
    nome: "MARCOS ANTÔNIO SILVA DE SENA",
    celular: "(74) 99804-3817",
    recado1: "(74) 98839-2335",
    recado2: "(74) 98802-4203",
    cnh: "04458915035",
    categoria: "AB",
    vencimento: "06/05/2031",
    ear: "SIM",
    cep: "48916-445",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA CONCEIÇÃO, 400 - ARGEMIRO",
  },
  {
    codigo: "0115",
    dataCadastro: "sáb 27/09/2025",
    cpf: "05679531496",
    nome: "ÂNGELO RODRIGUES LEITE",
    celular: "(87) 99109-6574",
    recado1: "(87) 99177-3473",
    recado2: "(89) 98100-7505",
    cnh: "05062517133",
    categoria: "AB",
    vencimento: "27/10/2032",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DEZOITO, 170 - SÃO JOAQUIM",
  },
  {
    codigo: "0116",
    dataCadastro: "sáb 27/09/2025",
    cpf: "72073793401",
    nome: "DAVI DO NASCIMENTO OLIVEIRA",
    celular: "(87) 98129-7665",
    recado1: "(48) 98869-3995",
    recado2: "(87) 99616-6239",
    cnh: "08968487592",
    categoria: "AB",
    vencimento: "13/04/2026",
    ear: "SIM",
  },
  {
    codigo: "0117",
    dataCadastro: "sáb 27/09/2025",
    cpf: "05369079510",
    nome: "DANIEL FELIPE SANTANA DE ARAÚJO",
    celular: "(87) 99204-3495",
    recado1: "(87) 99154-6333",
    recado2: "(87) 99646-2326",
    cnh: "08165199826",
    categoria: "AB",
    vencimento: "30/08/2032",
    ear: "SIM",
    cep: "56328-130",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PRESIDENTE CASTELO BRANCO, 174 - VILA EDUARDO",
  },
  {
    codigo: "0118",
    dataCadastro: "sáb 27/09/2025",
    cpf: "71261901401",
    nome: "MAIANYSOM BORGES FEITOSA",
    celular: "(87) 99207-3763",
    recado1: "(87) 99207-3763",
    recado2: "(87) 98858-3641",
    cnh: "07582429809",
    categoria: "AB",
    vencimento: "06/10/2025",
    cep: "56318-320",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CREMILDA GOMES DA SILVA, 73 - JARDIM AMAZONAS",
  },
  {
    codigo: "0119",
    dataCadastro: "sáb 27/09/2025",
    cpf: "71503988473",
    nome: "JOÃO VITOR ANTÔNIO DOS SANTOS",
    celular: "(87) 98142-4212",
    recado1: "(87) 98856-0209",
    recado2: "(87) 99994-7985",
    cnh: "08902847638",
    categoria: "AB",
    vencimento: "23/07/2034",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA E, 25 - PEDRO RAIMUNDO",
  },
  {
    codigo: "0120",
    dataCadastro: "sáb 27/09/2025",
    cpf: "53572939453",
    nome: "JOSÉ AJROM FREIRE",
    celular: "(87) 99951-5169",
    recado1: "(87) 99211-1181",
    recado2: "(87) 99128-1245",
    cnh: "03171745736",
    categoria: "AD",
    vencimento: "17/11/2027",
    ear: "NÃO",
    cep: "56330-360",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA WASHINGTON LUIZ, 86 - MARIA AUXILIADORA",
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
  console.log("Lote 12:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 12 (0111–0120) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
