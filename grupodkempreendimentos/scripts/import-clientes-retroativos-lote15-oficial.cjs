/**
 * Importa clientes retroativos lote 15 (cód. 0141–0150) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote15-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0141",
    dataCadastro: "qua 15/10/2025",
    cpf: "87876329349",
    nome: "CICERO DORIVAN DA SILVA GALDINO",
    celular: "(88) 99498-8542",
    recado1: "(87) 99195-5328",
    recado2: "(87) 98839-3692",
    cnh: "04796995845",
    categoria: "AD",
    vencimento: "30/11/2032",
    ear: "SIM",
    cep: "48903-560",
    municipioUf: "JUAZEIRO/BA",
    endereco: "TRAV. DR. EDSON RIBEIRO, 12 - CENTRO (PRÓXIMO AOS CORREIOS)",
  },
  {
    codigo: "0142",
    dataCadastro: "qui 16/10/2025",
    cpf: "11244123447",
    nome: "RENATO DOS SANTOS FEITOZA",
    celular: "(87) 99253-9946",
    cnh: "05966151038",
    categoria: "AB",
    vencimento: "05/11/2025",
    ear: "SIM",
    cep: "56318-330",
    municipioUf: "PETROLINA/PE",
    endereco: "RESIDENCIAL VILA VERDE - AV. HERMES DA FONSECA, 26827 - BL 14 - APTO 104",
  },
  {
    codigo: "0143",
    dataCadastro: "qui 16/10/2025",
    cpf: "10831107480",
    nome: "LEONARDO GOMES DE SOUZA",
    celular: "(87) 99906-6631",
    cnh: "05810408025",
    categoria: "AB",
    vencimento: "20/06/2033",
    ear: "SIM",
    cep: "56318-330",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA EVA MOTA, 253 - JARDIM AMAZONAS",
  },
  {
    codigo: "0144",
    dataCadastro: "sex 17/10/2025",
    cpf: "06674174432",
    nome: "WILLIAN NASCIMENTO CARVALHO",
    celular: "(87) 99100-5970",
    recado1: "(74) 99801-6813",
    recado2: "(74) 99122-0072",
    cnh: "04666018823",
    categoria: "AB",
    vencimento: "25/04/2034",
    ear: "SIM",
    cep: "56327-140",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CLARICE LISPECTOR, 221 - QD E - LT 03 - BOA ESPERANÇA - LOTEAMENTO PAI MANOEL",
  },
  {
    codigo: "0145",
    dataCadastro: "sex 17/10/2025",
    cpf: "70532030427",
    nome: "ELIVELTON OLIVEIRA GUNDIM",
    celular: "(87) 98108-8843",
    recado1: "(87) 99146-8322",
    recado2: "(87) 99136-5326",
    cnh: "08920565992",
    categoria: "AB",
    vencimento: "26/02/2026",
    ear: "SIM",
    cep: "56353-700",
    municipioUf: "PETROLINA/PE",
    endereco: "QD I, 19 - NUCLEO 9 - CENTRO - MASSANGANO",
  },
  {
    codigo: "0146",
    dataCadastro: "ter 21/10/2025",
    cpf: "10246148403",
    nome: "RIVALDO SEVERINO DA SILVA NETO",
    celular: "(87) 98832-9146",
    recado1: "(87) 99613-3042",
    recado2: "(87) 98833-5657",
    cnh: "05627930750",
    categoria: "AB",
    vencimento: "27/01/2033",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MARIA LUNA, 210 A - APTO 03 - LOTEAMENTO BELA VISTA",
  },
  {
    codigo: "0147",
    dataCadastro: "ter 21/10/2025",
    cpf: "02885869569",
    nome: "CICERO NASCIMENTO SANTOS",
    celular: "(74) 99137-2304",
    recado1: "(74) 98825-5967",
    recado2: "(74) 98818-2446",
    cnh: "07297794028",
    categoria: "AB",
    vencimento: "31/01/2034",
    ear: "SIM",
    cep: "48924-999",
    municipioUf: "JUAZEIRO/BA",
    endereco: "TRAV. DO CRUZEIRO, 10 - ARGEMIRO",
  },
  {
    codigo: "0148",
    dataCadastro: "qua 22/10/2025",
    cpf: "05949369505",
    nome: "VINICIOS RAFAEL FRANÇA CARDOSO",
    celular: "(74) 99971-5119",
    recado1: "(74) 99901-8426",
    recado2: "(74) 99926-3252",
    cnh: "05062516224",
    categoria: "AB",
    vencimento: "22/02/2026",
    ear: "SIM",
    cep: "48905-415",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA PEDRO SILVA E SANTANA, 02 - CENTENÁRIO",
  },
  {
    codigo: "0149",
    dataCadastro: "sex 24/10/2025",
    cpf: "95410414500",
    nome: "GIVANILDO JOSÉ DOS SANTOS SILVA",
    celular: "(75) 99226-7775",
    recado1: "(74) 98835-5261",
    recado2: "(74) 98853-6637",
    cnh: "02722451325",
    categoria: "AB",
    vencimento: "05/11/2035",
    ear: "SIM",
    cep: "48924-999",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA DAS PALMEIRAS, 07 - MALHADA DA AREIA",
  },
  {
    codigo: "0150",
    dataCadastro: "sex 24/10/2025",
    cpf: "08611055403",
    nome: "MARIA APARECIDA ROCHA",
    celular: "(87) 99131-5858",
    recado1: "(87) 99638-5594",
    recado2: "(87) 98812-8024",
    cnh: "06146610602",
    categoria: "AB",
    vencimento: "31/08/2033",
    ear: "SIM",
    cep: "56328-140",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA GETÚLIO VARGAS, 426 - VILA EDUARDO",
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
  console.log("Lote 15:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 15 (0141–0150) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
