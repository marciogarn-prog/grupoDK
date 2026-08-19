/**
 * Importa clientes retroativos lote 6 (cód. 0051–0060) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote6-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0051",
    dataCadastro: "sex 08/08/2025",
    cpf: "00088212599",
    nome: "MICHELY CAROLINE DE ARAÚJO",
    celular: "(87) 98179-7658",
    cnh: "01606916211",
    categoria: "AB",
    vencimento: "17/11/2025",
    ear: "SIM",
    cep: "56306-385",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. MANOEL DO ARROZ, 85 - BLOCO 06 - APTO 03 - RESIDENCIAL PAULISTA",
  },
  {
    codigo: "0052",
    dataCadastro: "qua 13/08/2025",
    cpf: "09135482435",
    nome: "FELIPE DE SOUZA LIMA",
    celular: "(87) 99167-7437",
    recado1: "(87) 98825-6919",
    recado2: "(87) 99165-8460",
    cnh: "04437845135",
    categoria: "AB",
    vencimento: "08/04/2026",
    ear: "SIM",
    cep: "56330-260",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA VITAL BRASIL, 816 - MARIA AUXILIADORA",
  },
  {
    codigo: "0053",
    dataCadastro: "qui 14/08/2025",
    cpf: "10825268435",
    nome: "LUCAS VIEIRA DA SILVA",
    celular: "(87) 98808-9860",
    cep: "56326-040",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DA HONRA, 13 - DOM AVELAR",
  },
  {
    codigo: "0054",
    dataCadastro: "qui 14/08/2025",
    cpf: "08722107401",
    nome: "MOISES OLIVEIRA DE SOUZA",
    celular: "(87) 98873-2713",
    recado1: "(87) 98828-8722",
    recado2: "(87) 99195-7945",
    cnh: "05378249494",
    categoria: "AB",
    vencimento: "14/05/2031",
    ear: "NÃO",
    cep: "56312-817",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA ONZE, 220 A - JARDIM PETRÓPOLIS",
  },
  {
    codigo: "0055",
    dataCadastro: "sex 15/08/2025",
    cpf: "09715859461",
    nome: "ALEXSANDRO LACERDA PAIXÃO",
    celular: "(87) 99120-4983",
    recado1: "(87) 99183-1946",
    recado2: "(87) 98167-1231",
    cnh: "05440832495",
    categoria: "AB",
    vencimento: "19/05/2032",
    ear: "SIM",
    cep: "56322-720",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA QUATRO, 540 - TERRAS DO SUL",
  },
  {
    codigo: "0056",
    dataCadastro: "sáb 16/08/2025",
    cpf: "71626277479",
    nome: "ALYRIO RODRIGO CARVALHO",
    celular: "(87) 99113-9714",
    cep: "56302-905",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DEZ, 227 - RESIDENCIAL NOVO TEMPO",
  },
  {
    codigo: "0057",
    dataCadastro: "seg 18/08/2025",
    cpf: "11239197470",
    nome: "ITALO SANTOS DE LIMA",
    celular: "(87) 99907-7745",
    recado1: "(87) 99613-2165",
    recado2: "(87) 99942-3055",
    cnh: "07158652334",
    categoria: "AD",
    vencimento: "21/03/2032",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOIS, 120 - RIO CORRENTE",
  },
  {
    codigo: "0058",
    dataCadastro: "qui 21/08/2025",
    cpf: "39339176898",
    nome: "ALEX RAONI DE SOUZA SANTOS",
    celular: "(87) 99243-3295",
    recado1: "(87) 99177-4891",
    cnh: "07332680003",
    categoria: "AB",
    vencimento: "19/03/2034",
    ear: "SIM",
    cep: "48903-440",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA ESPERANÇA, SN - QUIDÉ",
  },
  {
    codigo: "0059",
    dataCadastro: "qui 21/08/2025",
    cpf: "12873371471",
    nome: "JOÃO PEDRO FRUTUOSO DA ROCHA",
  },
  {
    codigo: "0060",
    dataCadastro: "qui 21/08/2025",
    cpf: "05135601309",
    nome: "LUAN CARLOS RAMALHO MENEZES",
    celular: "(87) 99652-1598",
    recado1: "(87) 98826-0002",
    recado2: "(87) 99201-0637",
    cnh: "05823703583",
    categoria: "A",
    vencimento: "03/09/2031",
    ear: "NÃO",
    cep: "56353-700",
    municipioUf: "PETROLINA/PE",
    endereco: "PISNC - N5 - QD B LT 40 - MASSANGANO",
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
  console.log("Lote 6:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 6 (0051–0060) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
