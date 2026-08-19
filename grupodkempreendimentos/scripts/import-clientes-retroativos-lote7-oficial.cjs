/**
 * Importa clientes retroativos lote 7 (cód. 0061–0070) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote7-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0061",
    dataCadastro: "qui 21/08/2025",
    cpf: "05000313550",
    nome: "MARCIO OLIVEIRA MIRANDA JUNIOR",
    celular: "(73) 99146-5525",
    recado1: "(73) 98206-6674",
    recado2: "(73) 98839-5908",
    cnh: "05160783201",
    categoria: "AD",
    vencimento: "23/02/2032",
    ear: "NÃO",
    cep: "56321-280",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOS GRAVATÁS, 455 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0062",
    dataCadastro: "sex 22/08/2025",
    cpf: "70274179440",
    nome: "ERICK SANTOS DO NASCIMENTO",
    celular: "(87) 99113-9695",
    recado1: "(74) 98837-4927",
    recado2: "(74) 98110-2172",
    cnh: "07324026720",
    categoria: "AB",
    vencimento: "04/01/2034",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MANECA DUARTE, 125 - COHAB VI",
  },
  {
    codigo: "0063",
    dataCadastro: "sex 22/08/2025",
    cpf: "02588165540",
    nome: "GESSER PEREIRA",
    celular: "(74) 98811-1384",
    recado1: "(74) 98816-7350",
    recado2: "(74) 98100-3800",
    cnh: "05628320205",
    categoria: "AB",
    vencimento: "08/06/2031",
    cep: "48900-000",
    municipioUf: "JUAZEIRO/BA",
    endereco: "AV. PRÓPRIA, 09 - MONTE CASTELO",
  },
  {
    codigo: "0064",
    dataCadastro: "sex 22/08/2025",
    cpf: "70918887402",
    nome: "KYWAN CAVALCANTI DAMASCENO",
    celular: "(87) 98812-1681",
    recado1: "(87) 98839-8631",
    cep: "56309-500",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CINQUENTA E UM, 185 A - COHAB VI",
  },
  {
    codigo: "0065",
    dataCadastro: "sáb 23/08/2025",
    cpf: "09196903430",
    nome: "VITOR MAIA E SILVA",
    celular: "(87) 99942-8938",
    cep: "56310-265",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA VINTE E SETE, 175 - COHAB MASSANGANO",
  },
  {
    codigo: "0066",
    dataCadastro: "seg 25/08/2025",
    cpf: "09871005482",
    nome: "ALLEF PEREIRA SILVA CONCEIÇÃO",
    celular: "(87) 98173-0450",
    recado1: "(87) 98108-8386",
    cnh: "05603343063",
    categoria: "AB",
    vencimento: "13/01/2033",
    ear: "SIM",
    cep: "56312-275",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CINQUENTA E SETE, 71 - SÃO GONÇALO",
  },
  {
    codigo: "0067",
    dataCadastro: "ter 26/08/2025",
    cpf: "06167113360",
    nome: "DECLEON ARAÚJO DA COSTA",
    celular: "(87) 99122-6260",
    recado1: "(86) 99807-3009",
    recado2: "(74) 99938-9447",
    cnh: "06499814644",
    categoria: "AB",
    vencimento: "27/10/2035",
    ear: "SIM",
    cep: "56326-090",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA COLIBRI, 07 - DOM AVELAR",
  },
  {
    codigo: "0068",
    dataCadastro: "ter 26/08/2025",
    cpf: "71184497419",
    nome: "FRANCISCO EUGÊNIO DA SILVA MOREIRA",
  },
  {
    codigo: "0069",
    dataCadastro: "ter 26/08/2025",
    cpf: "70695379488",
    nome: "ISAIAS RODRIGUES COELHO",
    celular: "(87) 99903-1948",
    recado1: "(87) 98118-8263",
    cnh: "08396289876",
    categoria: "AB",
    vencimento: "15/09/2032",
    ear: "SIM",
    cep: "56313-420",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MAJERICÃO, 151-A - COSME E DAMIÃO",
  },
  {
    codigo: "0070",
    dataCadastro: "ter 26/08/2025",
    cpf: "08917268455",
    nome: "RANIERY BRAELLE SILVA",
    celular: "(48) 99949-8932",
    recado1: "(74) 98814-0408",
    recado2: "(87) 99940-6058",
    cnh: "04816538702",
    categoria: "AB",
    vencimento: "12/04/2031",
    ear: "SIM",
    cep: "56306-150",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. DA INTEGRAÇÃO, 337 - GERCINO COELHO",
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
  console.log("Lote 7:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 7 (0061–0070) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
