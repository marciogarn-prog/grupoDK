/**
 * Importa clientes retroativos lote 14 (cód. 0131–0140) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote14-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0131",
    dataCadastro: "qua 01/10/2025",
    cpf: "08027467489",
    nome: "LUCAS MESSIAS MOURA ARRUDA OLIVEIRA",
    celular: "(74) 98862-5131",
    cnh: "07144275690",
    categoria: "AB",
    vencimento: "06/03/2033",
    ear: "SIM",
    cep: "56302-905",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA BAHIA, 855 - APTO 302 - VILA MOCÓ",
  },
  {
    codigo: "0132",
    dataCadastro: "qua 01/10/2025",
    cpf: "79884377553",
    nome: "JOÃO BOSCO RODRIGUES DOS SANTOS",
    celular: "(74) 99938-6222",
    recado1: "(87) 98809-0622",
    recado2: "(74) 99103-7734",
    cnh: "02589667903",
    categoria: "AD",
    vencimento: "21/08/2030",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "QD D J10 - DOM AVELAR",
  },
  {
    codigo: "0133",
    dataCadastro: "qua 01/10/2025",
    cpf: "07508019482",
    nome: "FRANCISCO JOSCIEL CORDEIRO DOS SANTOS",
    celular: "(62) 99550-6606",
    recado1: "(87) 99198-2571",
    recado2: "(87) 99122-9418",
    cnh: "08275357873",
    categoria: "AB",
    vencimento: "31/01/2033",
    ear: "SIM",
    cep: "56353-700",
    municipioUf: "PETROLINA/PE",
    endereco: "VIA NOVA, 03 - CASA 18 - PISNC - NÚCLEO 7 - MASSANGANO",
  },
  {
    codigo: "0134",
    dataCadastro: "qua 01/10/2025",
    cpf: "08374794526",
    nome: "ALESSANDRO LOPES DO NASCIMENTO",
    celular: "(74) 99932-8054",
    cnh: "06924831542",
    categoria: "AB",
    vencimento: "28/11/2033",
    ear: "NÃO",
    cep: "48924-999",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA SAUL ROSA, 281 - ALTO DA ALIANÇA",
  },
  {
    codigo: "0135",
    dataCadastro: "qua 01/10/2025",
    cpf: "06836210412",
    nome: "TARCIANO FREITAS DA SILVA",
    celular: "(87) 98833-7137",
    recado1: "(87) 98108-6949",
    recado2: "(87) 98104-9247",
    cnh: "03851112714",
    categoria: "AD",
    vencimento: "06/12/2033",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "QD D J10 - DOM AVELAR",
  },
  {
    codigo: "0136",
    dataCadastro: "qua 01/10/2025",
    cpf: "71550309455",
    nome: "ANDRÉ LUAN OLIVEIRA DO NASCIMENTO",
    celular: "(87) 99177-5685",
    recado1: "(87) 99908-6413",
    recado2: "(87) 99179-0968",
    cnh: "NÃO POSSUI",
    categoria: "XX",
    cep: "56319-010",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SANTA EDWIRGENS, 07 - CASA DO SALÃO - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0137",
    dataCadastro: "seg 06/10/2025",
    cpf: "79521363487",
    nome: "EVERALDO SOARES MONTEIRO",
    celular: "(87) 98831-9429",
    recado1: "(87) 99183-1856",
    recado2: "(87) 99670-4114",
    cnh: "05858415964",
    categoria: "AB",
    vencimento: "21/02/2029",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA VINTE E DOIS, 45-A - JARDIM PETROPOLIS",
  },
  {
    codigo: "0138",
    dataCadastro: "ter 07/10/2025",
    cpf: "04032604428",
    nome: "JAILSON AMARAL DE LIMA",
    celular: "(87) 99131-8928",
    recado1: "(21) 98364-5308",
    recado2: "(87) 99127-5287",
    cnh: "04649256900",
    categoria: "AD",
    vencimento: "30/05/2033",
    ear: "SIM",
    cep: "56322-040",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOS VALORES, 33-A - DOM AVELAR",
  },
  {
    codigo: "0139",
    dataCadastro: "qua 08/10/2025",
    cpf: "05387181533",
    nome: "JOILSON DOS SANTOS SILVA",
    celular: "(87) 99195-1387",
    recado1: "(87) 99676-8337",
    recado2: "(74) 98816-8434",
    cnh: "05762987443",
    categoria: "AB",
    vencimento: "09/03/2033",
    ear: "SIM",
    cep: "56315-010",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SÃO GABRIEL, 141 - VILA EULÁLIA",
  },
  {
    codigo: "0140",
    dataCadastro: "qui 09/10/2025",
    cpf: "09677058436",
    nome: "MANOEL RAIMUNDO DA SILVA LIMA",
    celular: "(87) 98874-4270",
    recado1: "(87) 98866-4462",
    recado2: "(87) 98160-7173",
    cnh: "05160240040",
    categoria: "AD",
    vencimento: "18/08/2032",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA UM, 60 - SANTA LUZIA",
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
  console.log("Lote 14:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 14 (0131–0140) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
