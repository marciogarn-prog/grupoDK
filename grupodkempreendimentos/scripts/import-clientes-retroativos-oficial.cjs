/**
 * Importa clientes retroativos (cód. 0001–0009) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0001",
    dataCadastro: "sex 21/03/2025",
    cpf: "06242649551",
    nome: "FELIPE YAGO GOMES RIBEIRO",
    celular: "(74) 98807-1669",
    cnh: "07263609641",
    categoria: "A",
    vencimento: "15/04/2034",
    ear: "NÃO",
    cep: "56317-386",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SABIÁ LARANJEIRA, 420 - PEDRA LINDA",
  },
  {
    codigo: "0002",
    dataCadastro: "sex 21/03/2025",
    cpf: "08360620431",
    nome: "MAGNO LOPES FERREIRA",
    celular: "(87) 99121-2060",
    cnh: "04776990950",
    categoria: "AB",
    vencimento: "14/11/2033",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SETE, 191 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0003",
    dataCadastro: "sáb 29/03/2025",
    cpf: "00175015554",
    nome: "ALOISIO DE SENA SILVA JUNIOR",
    celular: "(87) 99114-3391",
    cnh: "03711100333",
    categoria: "AB",
    vencimento: "06/01/2033",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA NOVE, 590 - JARDIM SÃO PAULO",
  },
  {
    codigo: "0004",
    dataCadastro: "qua 16/04/2025",
    cpf: "09006509656",
    nome: "ARISMAR BRAGA COSTA",
    celular: "(74) 98124-7974",
    cep: "48924-999",
    municipioUf: "JUAZEIRO/BA",
    endereco: "ILHA DO MASSANGANO, 101",
  },
  {
    codigo: "0005",
    dataCadastro: "ter 22/04/2025",
    cpf: "70393366421",
    nome: "ERICLES DAMARES DA SILVA REIS",
    celular: "(87) 98148-8520",
    cep: "56328-230",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SERRA TALHADA, 160 - VILA EDUARDO",
  },
  {
    codigo: "0006",
    dataCadastro: "ter 22/04/2025",
    cpf: "05692584565",
    nome: "JEANDERSON FERNANDES DOS SANTOS",
    celular: "(74) 98824-7809",
    cep: "48900-000",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA MANDACARÚ, 52 - PRAIA DO RODEADOURO",
  },
  {
    codigo: "0007",
    dataCadastro: "sáb 26/04/2025",
    cpf: "71361906499",
    nome: "NATANAEL DA SILVA SAMPAIO",
    celular: "(87) 98855-8368",
    cnh: "08942493349",
    categoria: "AB",
    vencimento: "21/03/2026",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TRINTA E UM, 110 - JARDIM PETRÓPOLIS",
  },
  {
    codigo: "0008",
    dataCadastro: "sex 09/05/2025",
    cpf: "93630590578",
    nome: "ADRIANO CARDOSO RIBEIRO",
    celular: "(74) 98157-9472",
    cnh: "03729673387",
    categoria: "A",
    vencimento: "18/11/2034",
    ear: "NÃO",
    cep: "48904-570",
    municipioUf: "JUAZEIRO/BA",
    endereco: "TRAV. ANTÔNIO LUIZ FERREIRA, 511-A - CENTRO",
  },
  {
    codigo: "0009",
    dataCadastro: "ter 13/05/2025",
    cpf: "07777997408",
    nome: "ERLANDERSON ALVES DOS SANTOS",
    celular: "(87) 99195-5328",
    cnh: "05540718257",
    categoria: "AB",
    vencimento: "30/09/2034",
    ear: "SIM",
    cep: "56312-270",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. BAIXA GRANDE, 581 - SÃO GONÇALO",
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
  console.log("Clientes antes:", antes, "→ depois merge local:", payload.dk_clientes_cadastro.length);
  console.log("Importados (planilha):", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 24)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(
      `ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem (guarda de corte pode ainda bloquear — faça deploy da API primeiro).`
    );
    process.exit(1);
  }
  console.log("OK — clientes retroativos na nuvem oficial.");
  console.log("Nota: registo 0010 (JEFERSON) omitido — CPF em falta na planilha.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
