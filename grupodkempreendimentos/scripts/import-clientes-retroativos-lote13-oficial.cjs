/**
 * Importa clientes retroativos lote 13 (cód. 0121–0130) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote13-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0121",
    dataCadastro: "sáb 27/09/2025",
    cpf: "02124600567",
    nome: "DANILO DOS ANJOS COSTA SANTOS",
    celular: "(87) 98859-0024",
    recado1: "(87) 99122-5086",
    recado2: "(87) 98844-0430",
    cnh: "09051427113",
    categoria: "AB",
    vencimento: "12/07/2026",
    ear: "SIM",
    cep: "56321-630",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. HERMES DA FONSECA, 26827 - BL 18 - APT 103 - RESIDENCIAL VILA VERDE",
  },
  {
    codigo: "0122",
    dataCadastro: "seg 29/09/2025",
    cpf: "01052168442",
    nome: "ÉDER WILSON MEDRADO DE OLIVEIRA",
    celular: "(87) 99809-7604",
    recado1: "(87) 98845-6495",
    recado2: "(87) 98808-7906",
    cnh: "04840133768",
    categoria: "AB",
    vencimento: "05/05/2030",
    ear: "SIM",
    cep: "56310-390",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA JOÃO CAVALCANTI RODRIGUES, 16 - COHAB MASSANGANO",
  },
  {
    codigo: "0123",
    dataCadastro: "seg 29/09/2025",
    cpf: "70175239460",
    nome: "MICHAEL DOUGLAS LOPES DE OLIVEIRA",
    celular: "(87) 98808-5825",
    recado1: "(87) 98836-2949",
    cnh: "07632409832",
    categoria: "AB",
    vencimento: "23/09/2035",
    ear: "SIM",
    cep: "56321-010",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DO ECOLOGISTA, 231 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0124",
    dataCadastro: "seg 29/09/2025",
    cpf: "09898949406",
    nome: "ERIC DE SOUSA LACERDA",
    celular: "(87) 99652-5915",
    recado1: "(87) 99139-6868",
    recado2: "(87) 99951-4763",
    cnh: "06537901978",
    categoria: "AB",
    vencimento: "12/04/2031",
    ear: "SIM",
    cep: "56304-500",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA ANA NERY, 190 - CENTRO",
  },
  {
    codigo: "0125",
    dataCadastro: "seg 29/09/2025",
    cpf: "01973361590",
    nome: "CLEITON DE SOUZA PONTES",
    celular: "(87) 99140-4656",
    recado1: "(74) 98803-5742",
    recado2: "(74) 98856-1240",
    cnh: "03316242407",
    categoria: "AD",
    vencimento: "27/09/2031",
    ear: "SIM",
    cep: "56318-070",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA AGOSTINHO DOS SANTOS, 444 - OURO PRETO",
  },
  {
    codigo: "0126",
    dataCadastro: "seg 29/09/2025",
    cpf: "03515573429",
    nome: "JOÃO BATISTA DOS SANTOS FILHO",
    celular: "(87) 99620-4800",
    recado1: "(87) 99192-6885",
    recado2: "(87) 99640-7464",
    cnh: "04501685537",
    categoria: "AD",
    vencimento: "09/11/2033",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOIS, 25 - JARDIM MASSANGANO",
  },
  {
    codigo: "0127",
    dataCadastro: "seg 29/09/2025",
    cpf: "70290076463",
    nome: "JOERMESON ANTÔNIO DOS SANTOS BATISTA",
    celular: "(87) 98174-7913",
    recado1: "(87) 98829-0154",
    recado2: "(87) 99147-8632",
    cnh: "09006321010",
    categoria: "AB",
    vencimento: "24/05/2026",
    ear: "SIM",
    cep: "56308-390",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PADRE VALERIANO, 25 - PALHINHAS",
  },
  {
    codigo: "0128",
    dataCadastro: "seg 29/09/2025",
    cpf: "08133777496",
    nome: "JAILSON AMARAL DE LIMA",
    celular: "(11) 94815-5484",
    recado1: "(87) 98120-4138",
    recado2: "(87) 98153-9921",
    cnh: "04237677810",
    categoria: "AB",
    vencimento: "06/06/2033",
    ear: "SIM",
    cep: "56322-040",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOS VALORES, 33-A - DOM AVELAR",
  },
  {
    codigo: "0129",
    dataCadastro: "qua 01/10/2025",
    cpf: "11360848436",
    nome: "LUCAS COSTA DO NASCIMENTO SILVA",
    celular: "(87) 99933-8937",
    recado1: "(87) 98823-2703",
    recado2: "(87) 99253-9607",
    cnh: "08054427626",
    categoria: "A",
    vencimento: "22/12/2031",
    ear: "NÃO",
    cep: "56302-905",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DA FORTUNA, 06 - DOM AVELAR",
  },
  {
    codigo: "0130",
    dataCadastro: "qua 01/10/2025",
    cpf: "05800728437",
    nome: "FLAVIO SANTOS SOBRINHO GOMES",
    celular: "(87) 99201-2812",
    recado1: "(87) 99633-3252",
    recado2: "(87) 98821-1478",
    cnh: "05884183007",
    categoria: "AB",
    vencimento: "14/04/2033",
    ear: "SIM",
    cep: "56323-710",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DO SILENCIO, 7 - DOM AVELAR",
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
  console.log("Lote 13:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 13 (0121–0130) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
