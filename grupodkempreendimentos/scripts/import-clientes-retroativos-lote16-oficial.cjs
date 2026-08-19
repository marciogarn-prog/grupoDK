/**
 * Importa clientes retroativos lote 16 (cód. 0151–0160) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote16-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0151",
    dataCadastro: "sex 24/10/2025",
    cpf: "00870402471",
    nome: "FILIPE EMMANUEL ARRUDA ROLIM",
    celular: "(83) 99199-8741",
    recado1: "(87) 99929-9081",
    recado2: "(87) 98818-0731",
    cnh: "05558555141",
    categoria: "AB",
    vencimento: "07/01/2032",
    ear: "SIM",
    cep: "56306-280",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MEN DE SÁ, 231 B - GERCINO COELHO",
  },
  {
    codigo: "0152",
    dataCadastro: "sex 24/10/2025",
    cpf: "11302263447",
    nome: "GEOVANO PAULINO DA SILVA",
    celular: "(87) 99200-8796",
    recado1: "(87) 98130-6574",
    cnh: "07960209930",
    categoria: "AB",
    vencimento: "09/06/2027",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DEZOITO, 421 - SÃO JOAQUIM",
  },
  {
    codigo: "0153",
    dataCadastro: "sáb 27/09/2025",
    cpf: "11377158802",
    nome: "CARLOS HENRIQUE GOMES DOS SANTOS",
    celular: "(87) 98806-8916",
    recado1: "(87) 98833-1782",
    recado2: "(87) 99161-8288",
    cnh: "04791944971",
    categoria: "AB",
    vencimento: "26/06/2028",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA D, 21 - APTO 102 B - RESIDENCIAL NOVA PETROLINA",
  },
  {
    codigo: "0154",
    dataCadastro: "seg 27/10/2025",
    cpf: "10825265410",
    nome: "WILLAMIS GOMES SOARES",
    celular: "(87) 98866-1317",
    cnh: "06185487060",
    categoria: "AB",
    vencimento: "20/02/2034",
    ear: "NÃO",
  },
  {
    codigo: "0155",
    dataCadastro: "seg 27/10/2025",
    cpf: "07043982499",
    nome: "MANOEL SOBREIRA DE LIMA NETO",
    celular: "(87) 99904-8826",
    recado1: "(87) 99629-7368",
    recado2: "(87) 98111-2605",
    cnh: "05052302410",
    categoria: "AD",
    vencimento: "02/03/2036",
    ear: "SIM",
    cep: "56322-740",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA OITO, 74 - TERRA DO SUL",
  },
  {
    codigo: "0156",
    dataCadastro: "seg 27/10/2025",
    cpf: "05478212393",
    nome: "HERICLYS VINCENTH DE FRANÇA CRUZ",
    celular: "(87) 98832-4042",
    recado1: "(74) 98157-4352",
    recado2: "(89) 99414-7010",
    cnh: "09025427130",
    categoria: "AB",
    vencimento: "13/06/2026",
    ear: "SIM",
    cep: "56326-000",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. DAS GRAÇAS, 1211 A - LOTEAMENTO PADRE CICERO DOM AVELAR",
  },
  {
    codigo: "0157",
    dataCadastro: "seg 27/10/2025",
    cpf: "70282163492",
    nome: "LEONARDO DE SOUZA SILVA",
    celular: "(87) 99970-8631",
    cnh: "07552765558",
    categoria: "AB",
    vencimento: "30/09/2035",
    ear: "SIM",
  },
  {
    codigo: "0158",
    dataCadastro: "seg 27/10/2025",
    cpf: "07565095567",
    nome: "LUCAS HENRIQUE ALVES DA SILVA",
    celular: "(74) 99978-4392",
    recado1: "(74) 98849-9147",
    recado2: "(74) 99978-4392",
    cnh: "08578121723",
    categoria: "AB",
    vencimento: "07/08/2033",
    ear: "SIM",
    cep: "48906-788",
    municipioUf: "JUAZEIRO/BA",
    endereco: "AV. SÃO FRANCISCO, 785 G - ITABERABA",
  },
  {
    codigo: "0159",
    dataCadastro: "seg 27/10/2025",
    cpf: "70814564488",
    nome: "MARCELO GOMES DE SOUZA",
    celular: "(87) 98873-9102",
    cnh: "08007510010",
    categoria: "AB",
    vencimento: "20/04/2032",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA QUATRO, 305 B - SÃO JORGE",
  },
  {
    codigo: "0160",
    dataCadastro: "sex 31/10/2025",
    cpf: "04353292439",
    nome: "DIOMEDES VERAS TORRES",
    celular: "(87) 99618-0932",
    recado1: "(87) 98805-7335",
    cnh: "03345979608",
    categoria: "AB",
    vencimento: "31/10/2033",
    ear: "SIM",
    cep: "55000-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TERRAS DO SUL, 221 - DOM AVELAR",
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
  console.log("Lote 16:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 16 (0151–0160) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
