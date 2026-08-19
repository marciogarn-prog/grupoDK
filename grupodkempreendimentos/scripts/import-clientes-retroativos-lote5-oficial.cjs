/**
 * Importa clientes retroativos lote 5 (cód. 0041–0050) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote5-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0041",
    dataCadastro: "qua 23/07/2025",
    cpf: "70614419417",
    nome: "LUCAS MATEUS CUSTÓDIO MARTINS",
    celular: "(87) 98822-0434",
    recado1: "(87) 98826-1768",
    cnh: "08213346141",
    categoria: "AB",
    vencimento: "27/12/2031",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TRINTA E UM, 30 - JARDIM PETRÓPOLIS",
  },
  {
    codigo: "0042",
    dataCadastro: "qui 31/07/2025",
    cpf: "03154532498",
    nome: "MARIOMARCOS FRANCISCO ASSIS",
    celular: "(89) 99653-9476",
    cnh: "02279020029",
    categoria: "AB",
    vencimento: "17/11/2033",
    ear: "NÃO",
  },
  {
    codigo: "0043",
    dataCadastro: "sex 01/08/2025",
    cpf: "11121338445",
    nome: "JEFFERSON DOS SANTOS CARMO",
    cep: "56312-853",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA FRANCISCO TEIXEIRA, 31 - VILA LIONS",
  },
  {
    codigo: "0044",
    dataCadastro: "sex 01/08/2025",
    cpf: "11377276406",
    nome: "MIQUEIAS RODRIGUES MARTINS",
    celular: "(87) 99130-2456",
    recado1: "(87) 99118-5209",
    recado2: "(87) 99157-0879",
    cnh: "06407793304",
    categoria: "AB",
    vencimento: "04/08/2035",
    ear: "SIM",
    cep: "56353-700",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA M, 71 - N10",
  },
  {
    codigo: "0045",
    dataCadastro: "sáb 02/08/2025",
    cpf: "05365443527",
    nome: "URIEL ALMEIDA SANTANA",
    celular: "(87) 98875-4091",
    cnh: "05075987608",
    categoria: "AD",
    vencimento: "14/01/2036",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TRÊS, 50 B - LOTEAMENTO VALE DAS ESMERALDAS (TOPÁZIO)",
  },
  {
    codigo: "0046",
    dataCadastro: "seg 04/08/2025",
    cpf: "06069733541",
    nome: "RAFAEL DA SILVA CELESTINO",
    celular: "(87) 98117-5891",
    recado1: "(87) 98837-9397",
    recado2: "(87) 99173-6193",
    cnh: "05438696130",
    categoria: "AB",
    vencimento: "15/03/2032",
    ear: "NÃO",
    cep: "56314-720",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA EDUCADOR PAULO FREIRE, 186 - RESIDENCIAL JARDIM SÃO PAULO",
  },
  {
    codigo: "0047",
    dataCadastro: "qui 07/08/2025",
    cpf: "70481459430",
    nome: "ERIK EMANOEL DA SILVA",
    celular: "(87) 99627-4624",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA C, 112 A - PSNC N10 MASSANGANO",
  },
  {
    codigo: "0048",
    dataCadastro: "qui 07/08/2025",
    cpf: "71301840432",
    nome: "WANDERSON BARBOSA RODRIGUES",
    celular: "(87) 99932-1517",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "ESTRADA DA TAPERA, 06 - SITIO AVELINO - ZONA RURAL",
  },
  {
    codigo: "0049",
    dataCadastro: "sex 08/08/2025",
    cpf: "02998812457",
    nome: "GENTIL CARLOS DA SILVA",
    celular: "(87) 98875-8976",
    cep: "56312-695",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DO TAMARINDO, 13 - RIO CORRENTE",
  },
  {
    codigo: "0050",
    dataCadastro: "sex 08/08/2025",
    cpf: "08862744439",
    nome: "RENATO BRUNO PEREIRA RODRIGUES",
    celular: "(87) 99209-8835",
    cep: "56314-550",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA VINTE E QUATRO, 36 - QUATI",
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
  console.log("Lote 5:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 5 (0041–0050) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
