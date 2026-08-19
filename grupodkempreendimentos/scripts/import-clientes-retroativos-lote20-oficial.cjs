/**
 * Importa clientes retroativos lote 20 (cód. 0191–0200) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote20-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0191",
    dataCadastro: "qua 03/12/2025",
    cpf: "86361495507",
    nome: "CARLOS HENRIQUE BATISTA SOBRAL",
    celular: "(74) 98817-2255",
    recado1: "(74) 98874-0851",
    recado2: "(87) 98843-2138",
    cnh: "09100840796",
    categoria: "AB",
    vencimento: "02/09/2026",
    ear: "NÃO",
    cep: "48924-999",
    municipioUf: "JUAZEIRO/BA",
    endereco: "TRAV. PLANALTO, 100 A - PADRE VICENTE",
  },
  {
    codigo: "0192",
    dataCadastro: "ter 09/12/2025",
    cpf: "22082646572",
    nome: "JOSÉ SANTANA DOS SANTOS",
    celular: "(62) 99618-4480",
    recado1: "(87) 98875-4091",
    recado2: "(87) 98826-9400",
    cnh: "03265778105",
    categoria: "AC",
    vencimento: "10/08/2027",
    ear: "NÃO",
    cep: "55000-000",
    municipioUf: "PETROLINA/PE",
    endereco: "LOTEAMENTO VALE DAS ESMERALDAS, 50 B - TOPÁZIO",
  },
  {
    codigo: "0193",
    dataCadastro: "qua 10/12/2025",
    cpf: "70728082489",
    nome: "THIAGO GOMES DE SOUZA",
    celular: "(87) 98181-0487",
    recado1: "(87) 99123-6974",
    recado2: "(87) 98181-0487",
    cnh: "07654320890",
    categoria: "AB",
    vencimento: "12/12/2035",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA VINTE E TRÊS, 23 - SÃO JOAQUIM",
  },
  {
    codigo: "0194",
    dataCadastro: "qui 11/12/2025",
    cpf: "06106780439",
    nome: "ADRIANO DA SILVA LIMEIRA",
    celular: "(87) 98812-7855",
    recado1: "(87) 99163-1029",
    recado2: "(87) 98867-0695",
    cnh: "03429618750",
    categoria: "AE",
    vencimento: "02/12/2025",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA JOTA, 30 - APTO 03 - RESIDENCIAL VIVENDAS I",
  },
  {
    codigo: "0195",
    dataCadastro: "qui 11/12/2025",
    cpf: "07098676543",
    nome: "DIEGO BORGES LOPES",
    celular: "(87) 99170-0009",
    recado1: "(74) 98852-1915",
    recado2: "(87) 99627-2670",
    cnh: "06844694428",
    categoria: "AB",
    vencimento: "14/04/2032",
    ear: "NÃO",
    cep: "47200-000",
    municipioUf: "REMANSO/BA",
    endereco: "AV. PRESIDENTE GETÚLIO VARGAS, 9998 - QUADRA 20",
  },
  {
    codigo: "0196",
    dataCadastro: "sex 12/12/2025",
    cpf: "09652952494",
    nome: "JOSÉ PEDRO CASADO NETO",
    celular: "(87) 98872-0710",
    recado1: "(87) 99130-0824",
    recado2: "(87) 99105-1749",
    cnh: "07559893550",
    categoria: "AB",
    vencimento: "10/11/2035",
    ear: "SIM",
    cep: "56320-185",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA RIO IPANEMA, 64 - JOSÉ E MARIA",
  },
  {
    codigo: "0197",
    dataCadastro: "seg 15/12/2025",
    cpf: "12000092403",
    nome: "JOSÉ IANDERSON PEREIRA CAMPOS",
    celular: "(87) 99100-6324",
    recado1: "(87) 99100-6324",
    recado2: "(87) 99938-7767",
    cnh: "07228967914",
    categoria: "AB",
    vencimento: "08/11/2026",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CINCO, 430 - TOPÁZIO - PARK PETROLINA",
  },
  {
    codigo: "0198",
    dataCadastro: "qua 17/12/2025",
    cpf: "09296770564",
    nome: "EDUARDO MIRANDA DE SOUZA",
    celular: "(87) 98175-3375",
    recado1: "(87) 98172-4448",
    recado2: "(87) 98877-4946",
    cnh: "07837712686",
    categoria: "AB",
    vencimento: "10/11/2031",
    ear: "SIM",
    cep: "56312-200",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA EDINHO SANTANA, 30 - SÃO GONÇALO",
  },
  {
    codigo: "0199",
    dataCadastro: "sex 19/12/2025",
    cpf: "09893497566",
    nome: "JOHNNY WESLEY JESUS DA SILVA",
    celular: "(74) 98875-5759",
    recado1: "(74) 98805-1881",
    recado2: "(74) 98875-5759",
    cnh: "08583260237",
    categoria: "AB",
    vencimento: "20/10/2033",
    ear: "SIM",
    cep: "48905-540",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA COLIBRI, 74 - JARDIM NOVO ENCONTRO",
  },
  {
    codigo: "0200",
    dataCadastro: "sex 19/12/2025",
    cpf: "10067966497",
    nome: "JORGE MIKAEL DA SILVA",
    celular: "(87) 98148-4344",
    cnh: "05653418850",
    categoria: "AE",
    vencimento: "24/08/2029",
    ear: "SIM",
    cep: "56321-430",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MAR VERMELHO, 530 - ANTÔNIO CASSIMIRO",
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
  console.log("Lote 20:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 20 (0191–0200) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
