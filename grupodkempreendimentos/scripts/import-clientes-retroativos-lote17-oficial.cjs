/**
 * Importa clientes retroativos lote 17 (cód. 0161–0170) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote17-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0161",
    dataCadastro: "sex 31/10/2025",
    cpf: "00000000161",
    nome: "NEJAIN LIMA DE SOUZA NETO",
    categoria: "XX",
  },
  {
    codigo: "0162",
    dataCadastro: "seg 03/11/2025",
    cpf: "86414662585",
    nome: "LIOEZIO ALVES DA SILVA NETO",
    celular: "(74) 99811-2674",
    recado1: "(74) 98104-5460",
    recado2: "(74) 98838-3960",
    cnh: "07278075180",
    categoria: "AB",
    vencimento: "05/12/2033",
    ear: "SIM",
    cep: "48916-445",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA CONCEIÇÃO, 02 - ARGEMIRO",
  },
  {
    codigo: "0163",
    dataCadastro: "seg 03/11/2025",
    cpf: "09020512455",
    nome: "RIVELINO RIAN ALVES ROCHA",
    celular: "(87) 99957-4220",
    recado1: "(87) 98879-1374",
    cnh: "07690481730",
    categoria: "AB",
    vencimento: "04/11/2025",
    ear: "SIM",
    cep: "56322-705",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA ALBERTO MARTINS DA CRUZ, 110 - TERRA DO SUL",
  },
  {
    codigo: "0164",
    dataCadastro: "qua 05/11/2025",
    cpf: "06424427465",
    nome: "GILDENOR MARQUES DE SÁ JUNIOR",
    celular: "(87) 99243-4963",
    recado1: "(87) 98843-7252",
    recado2: "(87) 98855-4125",
    cnh: "04624371647",
    categoria: "AB",
    vencimento: "16/02/2034",
    ear: "NÃO",
    cep: "56309-730",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA POMBINHO CESAR, 206 - COHAB VI",
  },
  {
    codigo: "0165",
    dataCadastro: "seg 10/11/2025",
    cpf: "05647749445",
    nome: "ALBERTINO CANDIDO DA SILVA",
    celular: "(87) 99116-2391",
    recado1: "(87) 99142-7538",
    recado2: "(87) 99116-2391",
    cnh: "06151645592",
    categoria: "AB",
    vencimento: "12/02/2036",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DEZ, 181 - VILA MARCELA (PRÓXIMO AO MERCADINHO ALICE)",
  },
  {
    codigo: "0166",
    dataCadastro: "seg 10/11/2025",
    cpf: "01440729557",
    nome: "MARCELO SOARES DE CARVALHO JUNIOR",
    celular: "(87) 99110-4747",
    recado1: "(87) 98804-8048",
    recado2: "(87) 98117-4953",
    cnh: "06004618233",
    categoria: "AB",
    vencimento: "12/09/2034",
    ear: "SIM",
    cep: "48903-100",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA TIRADENTES, 130 - SANTO ANTÔNIO",
  },
  {
    codigo: "0167",
    dataCadastro: "qui 13/11/2025",
    cpf: "05478221465",
    nome: "THIAGO EMANUEL MENDES DA SILVA",
    celular: "(87) 99140-3390",
    recado1: "(87) 99126-8128",
    recado2: "(87) 99142-6225",
    cnh: "03775807873",
    categoria: "AE",
    vencimento: "12/06/2033",
    ear: "SIM",
    cep: "56310-020",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SARGENTO OZEAS RODRIGUES, 125 - COHAB IV",
  },
  {
    codigo: "0168",
    dataCadastro: "qui 13/11/2025",
    cpf: "10455403406",
    nome: "RAUL REMÍGIO GOMES NETO",
    celular: "(87) 98837-4871",
    recado1: "(74) 99929-6645",
    recado2: "(87) 99135-0752",
    cnh: "05273642410",
    categoria: "AB",
    vencimento: "18/10/2035",
    ear: "SIM",
    cep: "56331-230",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA GALILÉIA, 51 - VILA EULÁLIA",
  },
  {
    codigo: "0169",
    dataCadastro: "qui 13/11/2025",
    cpf: "10233351400",
    nome: "JOÃO PEDRO FERREIRA DIÓGENES",
    celular: "(87) 98866-5274",
    recado1: "(87) 98803-8560",
    recado2: "(87) 99146-4911",
    cnh: "07640161586",
    categoria: "AB",
    vencimento: "19/11/2025",
    ear: "SIM",
    cep: "56314-465",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA OITO, 52 - PARQUE SÃO PAULO",
  },
  {
    codigo: "0170",
    dataCadastro: "sex 14/11/2025",
    cpf: "09888264451",
    nome: "GABRIEL RODRIGUES DA SILVA",
    celular: "(87) 99202-2593",
    recado1: "(87) 99997-3028",
    recado2: "(87) 98859-6207",
    cnh: "08706506760",
    categoria: "AB",
    vencimento: "12/12/2033",
    ear: "SIM",
    cep: "56314-410",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA NOVE, 1115 A - MANDACARÚ",
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
  console.log("Lote 17:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 17 (0161–0170) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
