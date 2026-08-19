/**
 * Importa clientes retroativos lote 10 (cód. 0091–0100) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote10-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0091",
    dataCadastro: "seg 08/09/2025",
    cpf: "12142358403",
    nome: "EMANUEL VITOR MENDES ANGELIM",
    celular: "(87) 99119-8569",
    recado1: "(87) 98110-1046",
    recado2: "(87) 99636-8620",
    cnh: "08943842160",
    categoria: "AB",
    vencimento: "22/03/2026",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DEZ, 40 B - TERRA DO SUL",
  },
  {
    codigo: "0092",
    dataCadastro: "ter 09/09/2025",
    cpf: "07049503401",
    nome: "MAX DE SOUZA AMARIZ",
    celular: "(87) 99610-4672",
    recado1: "(87) 98812-3533",
    recado2: "(87) 99166-4842",
    cnh: "03611719718",
    categoria: "AB",
    vencimento: "11/06/2035",
    ear: "NÃO",
    cep: "56321-630",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. H DA FONSECA, 26827 BL 26 APTO 104 - COND RESID VILA VERDE -",
  },
  {
    codigo: "0093",
    dataCadastro: "ter 09/09/2025",
    cpf: "03657704426",
    nome: "ROMILDO FERREIRA DO NASCIMENTO",
    celular: "(87) 98111-4891",
    recado1: "(87) 99919-6248",
    recado2: "(87) 98166-8836",
    cnh: "03567451643",
    categoria: "AB",
    vencimento: "10/04/2035",
    ear: "SIM",
    cep: "56317-386",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SABIÁ LARANJEIRA, 225 QD Z LT 22 - PEDRA LINDA",
  },
  {
    codigo: "0094",
    dataCadastro: "qua 10/09/2025",
    cpf: "21450300855",
    nome: "ALEX SANDER BAPTISTA",
    celular: "(87) 99643-9528",
    recado1: "(74) 98833-9642",
    recado2: "(87) 98867-1483",
    cnh: "01306131412",
    categoria: "AD",
    vencimento: "13/10/2025",
    ear: "NÃO",
    cep: "56304-210",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TOBIAS BARRETO, 259 - CENTRO",
  },
  {
    codigo: "0095",
    dataCadastro: "qua 10/09/2025",
    cpf: "71966045476",
    nome: "CÍCERO AUGUSTO DOS SANTOS SILVA SOARES",
    celular: "(87) 99189-8388",
    cnh: "08109300291",
    categoria: "AB",
    vencimento: "27/04/2026",
    ear: "SIM",
    cep: "56316-030",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA UM, 50 - JOÃO DE DEUS",
  },
  {
    codigo: "0096",
    dataCadastro: "qua 10/09/2025",
    cpf: "70962205427",
    nome: "FELIPE BARBOSA FONSECA",
    celular: "(71) 98433-6749",
    cnh: "06998498888",
    categoria: "AB",
    vencimento: "30/08/2032",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA HELENA SILVA DE SOUZA, 61 - SÃO GONÇALO",
  },
  {
    codigo: "0097",
    dataCadastro: "qua 10/09/2025",
    cpf: "07246732454",
    nome: "FRANCISCO MARCIO SILVA DE JESUS",
    celular: "(87) 98808-9903",
    recado1: "(87) 98842-7641",
    recado2: "(87) 98808-1741",
    cnh: "04237815904",
    categoria: "AD",
    vencimento: "27/08/2031",
    ear: "SIM",
    cep: "56322-240",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. DOS MINÉRIOS, 01 E - SÃO JOAQUIM",
  },
  {
    codigo: "0098",
    dataCadastro: "qua 10/09/2025",
    cpf: "08290664460",
    nome: "RAFAEL PABLO CONCEIÇÃO DE ARAÚJO",
    celular: "(87) 99169-4439",
    cnh: "04198566952",
    categoria: "AB",
    vencimento: "08/11/2031",
    cep: "56306-280",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MENDES SÁ, 119 - GERCINO COELHO",
  },
  {
    codigo: "0099",
    dataCadastro: "sex 12/09/2025",
    cpf: "85982948535",
    nome: "LUIS CARLOS DOS SANTOS SILVA",
    celular: "(87) 98110-1046",
    recado1: "(87) 99176-9248",
    recado2: "(87) 99104-8445",
    cnh: "08952232238",
    categoria: "A",
    vencimento: "29/03/2026",
    ear: "NÃO",
    cep: "56322-745",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA NOVE, 40 - TERRA DO SUL",
  },
  {
    codigo: "0100",
    dataCadastro: "seg 15/09/2025",
    cpf: "60566277301",
    nome: "CAIO WERLANIO ANGELO VIEIRA",
    celular: "(87) 99111-6625",
    recado1: "(87) 99209-1998",
    recado2: "(88) 98886-1721",
    cnh: "08301555584",
    categoria: "AB",
    vencimento: "28/10/2032",
    ear: "NÃO",
    cep: "56321-150",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DEZ, 600 - MANDACARU",
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
  console.log("Lote 10:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 10 (0091–0100) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
