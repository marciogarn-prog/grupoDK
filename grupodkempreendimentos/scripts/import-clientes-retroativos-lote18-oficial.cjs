/**
 * Importa clientes retroativos lote 18 (cód. 0171–0180) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote18-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0171",
    dataCadastro: "sex 14/11/2025",
    cpf: "00614529557",
    nome: "EDILSON JOSÉ DOS SANTOS SILVA",
    celular: "(74) 98853-6637",
    recado1: "(74) 98853-6637",
    recado2: "(74) 98106-5970",
    cnh: "04178009951",
    categoria: "AB",
    vencimento: "07/03/2032",
    ear: "SIM",
    cep: "48901-225",
    municipioUf: "JUAZEIRO/BA",
    endereco: "AV. JORGE KHOURY, 379 - QUIDÉ",
  },
  {
    codigo: "0172",
    dataCadastro: "sex 14/11/2025",
    cpf: "70741822490",
    nome: "EDILTON VALDEMIR DOS SANTOS",
    celular: "(74) 98819-1327",
    recado1: "(87) 98839-8330",
    recado2: "(87) 99139-7254",
    cnh: "07753069765",
    categoria: "AB",
    vencimento: "26/11/2035",
    ear: "SIM",
    cep: "56321-700",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SUCUPIRA, 120 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0173",
    dataCadastro: "sex 14/11/2025",
    cpf: "03356147528",
    nome: "UESLLEN DOURADO LOPES",
    celular: "(74) 99808-2770",
    recado1: "(87) 99614-2293",
    recado2: "(74) 98817-1116",
    cnh: "04751764820",
    categoria: "AD",
    vencimento: "29/09/2031",
    ear: "SIM",
    cep: "56304-306",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. DAS NAÇÕES, 25 - CENTRO",
  },
  {
    codigo: "0174",
    dataCadastro: "ter 18/11/2025",
    cpf: "04204311440",
    nome: "ROGÉRIO DOS SANTOS PEREIRA",
    celular: "(87) 99201-4720",
    recado1: "(87) 99906-6719",
    recado2: "(87) 98843-1624",
    cnh: "04238106008",
    categoria: "AB",
    vencimento: "26/09/2035",
    ear: "SIM",
    cep: "56312-822",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MERÊNCIA TEODORO EVANGELISTA DE LIMA, 205 - JARDIM PETROPOLIS",
  },
  {
    codigo: "0175",
    dataCadastro: "ter 18/11/2025",
    cpf: "07761234400",
    nome: "JOANDERSON DA SILVA",
    celular: "(87) 99135-0498",
    recado1: "(87) 99155-3193",
    recado2: "(87) 98162-2378",
    cnh: "05357995453",
    categoria: "AB",
    vencimento: "29/11/2031",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA P, 70 - BL 70 - APTO 002 B - RESIDENCIAL NOVA PETROLINA - LOT TO",
  },
  {
    codigo: "0176",
    dataCadastro: "ter 18/11/2025",
    cpf: "03574615507",
    nome: "JOSENILDO PEREIRA DA SILVA",
    celular: "(74) 98118-9736",
    recado1: "(74) 98857-7775",
    recado2: "(87) 98837-0686",
    cnh: "06507088262",
    categoria: "AB",
    vencimento: "30/08/2031",
    ear: "SIM",
    cep: "56317-388",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CURRUPIÃO, 173 - PEDRA LINDA",
  },
  {
    codigo: "0177",
    dataCadastro: "ter 18/11/2025",
    cpf: "10224205420",
    nome: "MARIO DANIEL DO BONFIM ALVES",
    celular: "(87) 99963-4246",
    recado1: "(87) 99963-4246",
    recado2: "(87) 98150-4757",
    cnh: "05912321290",
    categoria: "A",
    vencimento: "17/03/2033",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CINCO, 481 - PEDRA LINDA - LOT PEDRA LINDA",
  },
  {
    codigo: "0178",
    dataCadastro: "ter 18/11/2025",
    cpf: "11778154433",
    nome: "UNEWTON DUARTE DE OLIVEIRA",
    celular: "(74) 98147-1276",
    recado1: "(87) 99205-5696",
    recado2: "(87) 98174-2593",
    cnh: "07823654008",
    categoria: "AB",
    vencimento: "13/11/2025",
    ear: "SIM",
    cep: "56320-240",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA RIO MISSISSIPE, 47 - JOSÉ E MARIA",
  },
  {
    codigo: "0179",
    dataCadastro: "ter 18/11/2025",
    cpf: "11010515403",
    nome: "HUGO RAFAEL SILVA DE LIMA",
    celular: "(87) 99951-2121",
    recado1: "(74) 99129-5998",
    recado2: "(87) 97400-6234",
    cnh: "07139590740",
    categoria: "AB",
    vencimento: "29/05/2035",
    ear: "SIM",
    cep: "56318-070",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA AGOSTINHO DOS SANTOS, 65 - OURO PRETO",
  },
  {
    codigo: "0180",
    dataCadastro: "ter 18/11/2025",
    cpf: "09973955404",
    nome: "IVO PAES PEREIRA DOS SANTOS",
    celular: "(11) 96445-4563",
    recado1: "(87) 98837-0381",
    recado2: "(87) 98871-3321",
    cnh: "07872657969",
    categoria: "AB",
    vencimento: "13/09/2026",
    ear: "SIM",
    cep: "56312-315",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SESSENTA E UM, 152 - SÃO GONÇALO",
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
  console.log("Lote 18:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 18 (0171–0180) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
