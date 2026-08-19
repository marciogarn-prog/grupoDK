/**
 * Importa clientes retroativos lote 11 (cód. 0101–0110) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote11-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0101",
    dataCadastro: "qua 17/09/2025",
    cpf: "06865266439",
    nome: "DOUGLAS BARBOSA ANGELIM",
    celular: "(87) 98155-4700",
    recado1: "(87) 98155-4700",
    recado2: "(87) 98839-9950",
    cnh: "04096783648",
    categoria: "AB",
    vencimento: "12/12/2026",
    ear: "SIM",
    cep: "56322-291",
    municipioUf: "PETROLINA/PE",
    endereco: "TRAV. DO MANGANÊS, 420 - DOM AVELAR",
  },
  {
    codigo: "0102",
    dataCadastro: "sex 19/09/2025",
    cpf: "71494851466",
    nome: "FELIPE NUNES SANTANA",
    celular: "(16) 98111-9629",
    recado1: "(87) 99662-6417",
    recado2: "(87) 99187-9048",
    cnh: "09089212922",
    categoria: "AB",
    vencimento: "20/08/2026",
    ear: "SIM",
    cep: "56353-700",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA JOTA, 20 - S PISNC NÚCLEO 10 - MASSANGANO",
  },
  {
    codigo: "0103",
    dataCadastro: "sex 19/09/2025",
    cpf: "10410232432",
    nome: "ANDSON OLIVEIRA SOUZA",
    celular: "(87) 98838-6637",
    recado1: "(87) 98875-0233",
    recado2: "(87) 99922-7386",
    cnh: "06125328600",
    categoria: "AB",
    vencimento: "02/09/2030",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CINCO, 05 - JARDIM IMPERIAL",
  },
  {
    codigo: "0104",
    dataCadastro: "sáb 20/09/2025",
    cpf: "06658959412",
    nome: "JEFFERSON CLEITON SANTOS COSTA",
    celular: "(87) 98823-3983",
    recado1: "(87) 99209-7847",
    recado2: "(87) 98845-1986",
    cnh: "08127336086",
    categoria: "AB",
    vencimento: "27/10/2032",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DEZESSETE, 181 - FERNANDO IDALINO BEZERRA",
  },
  {
    codigo: "0105",
    dataCadastro: "seg 22/09/2025",
    cpf: "10936915498",
    nome: "FABRICIO RIBEIRO FERREIRA",
    celular: "(87) 98153-9921",
    recado1: "(87) 98135-7723",
    recado2: "(87) 98146-4763",
    cnh: "06134817437",
    categoria: "AB",
    vencimento: "18/03/2035",
    ear: "SIM",
    cep: "56323-280",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. DOS SENTIMENTOS, 81 - DOM AVELAR",
  },
  {
    codigo: "0106",
    dataCadastro: "seg 22/09/2025",
    cpf: "07440964489",
    nome: "RANIERI DOS SANTOS GOMES",
    celular: "(87) 99134-9258",
    recado1: "(87) 99113-4021",
    recado2: "(71) 99697-2485",
    cnh: "06069651164",
    categoria: "AB",
    vencimento: "28/02/2030",
    ear: "SIM",
    cep: "56316-758",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA IPÊ AMARELO, 190 - NOVA VIDA I",
  },
  {
    codigo: "0107",
    dataCadastro: "ter 23/09/2025",
    cpf: "70598203451",
    nome: "MATHEUS LIMOEIRO DE CARVALHO",
    celular: "(87) 98817-0952",
    recado1: "(74) 98808-1138",
    recado2: "(87) 99211-2914",
    cnh: "06962510591",
    categoria: "AB",
    vencimento: "19/09/2032",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA G1, 31 - APTO 104 - RESIDENCIAL VIVENDAS II",
  },
  {
    codigo: "0108",
    dataCadastro: "ter 23/09/2025",
    cpf: "06336638405",
    nome: "AILTON ALMEIDA PEREIRA",
    celular: "(87) 99965-5181",
    recado1: "(87) 98811-7395",
    recado2: "(87) 99191-7069",
    cnh: "05205922044",
    categoria: "AB",
    vencimento: "05/02/2034",
    ear: "SIM",
    cep: "56314-710",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA RADIAUSTA FRANKLIN DELANO, 316 - RESIDENCIAL JARDIM SÃO PAULO",
  },
  {
    codigo: "0109",
    dataCadastro: "ter 23/09/2025",
    cpf: "71813243492",
    nome: "JOÃO GUILHERME LEITE SILVA",
    celular: "(87) 98821-1314",
    recado1: "(87) 98835-9279",
    recado2: "(87) 98855-5449",
    cnh: "07940006567",
    categoria: "AB",
    vencimento: "07/04/2032",
    ear: "SIM",
    cep: "56321-440",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. DA REDENÇÃO, 14 A - SÃO JORGE",
  },
  {
    codigo: "0110",
    dataCadastro: "ter 23/09/2025",
    cpf: "07629588550",
    nome: "MARCIO GIL NASCIMENTO DE SOUZA",
    celular: "(11) 94477-8009",
    recado1: "(11) 94477-8009",
    recado2: "(11) 94445-3385",
    cnh: "07635759265",
    categoria: "AB",
    vencimento: "10/06/2035",
    ear: "SIM",
    cep: "56318-000",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. SETE DE SETEMBRO, 740 C - OURO PRETO",
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
  console.log("Lote 11:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 11 (0101–0110) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
