/**
 * Importa clientes retroativos lote 4 (cód. 0031–0040) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote4-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0031",
    dataCadastro: "qua 02/07/2025",
    cpf: "07146187489",
    nome: "TASSIO CESAR DE DEUS SILVA",
    celular: "(81) 99519-8019",
    cnh: "05487328313",
    categoria: "AB",
    vencimento: "23/12/2032",
    ear: "SIM",
    cep: "54470-052",
    municipioUf: "JABOATÃO DOS GUARARAPES/PE",
    endereco: "RUA JUNDIAÍ, 309 - BAIRRO DE JANGADA",
  },
  {
    codigo: "0032",
    dataCadastro: "qua 09/07/2025",
    cpf: "08424164474",
    nome: "DENILSON DOMINGOS DO NASCIMENTO",
    celular: "(87) 98803-4719",
    recado1: "(87) 98171-0661",
    recado2: "(87) 3300-9003",
    cnh: "05331273423",
    categoria: "AB",
    vencimento: "15/03/2026",
    ear: "SIM",
    cep: "56312-250",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TEREZINHA FERREIRA DE LIMA, 51 A - SÃO GONÇALO",
  },
  {
    codigo: "0033",
    dataCadastro: "qua 16/07/2025",
    cpf: "70550550402",
    nome: "HILTON MAYCON DAS NEVES SANTOS",
    celular: "(87) 98847-3224",
    recado1: "(87) 99151-7195",
    recado2: "(87) 98140-3658",
    cnh: "09031849588",
    categoria: "AB",
    vencimento: "20/06/2026",
    ear: "SIM",
    cep: "56321-210",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DO COQUEIRO, 1001 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0034",
    dataCadastro: "qui 17/07/2025",
    cpf: "06810021310",
    nome: "HAROLDO PINHEIRO SILVA",
    celular: "(88) 98198-0177",
    cep: "56314-533",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MARIA JOSÉ DE FARIAS NOGUEIRA, 101 - JARDIM SÃO PAULO",
  },
  {
    codigo: "0035",
    dataCadastro: "qui 17/07/2025",
    cpf: "09988438494",
    nome: "IGOR RAFAEL NASCIMENTO MOREIRA",
    celular: "(87) 99639-2653",
    cnh: "04903573705",
    categoria: "AB",
    vencimento: "19/04/2032",
    ear: "SIM",
    cep: "56318-190",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA ARINO REMÍGIO (RUA 17), 71 - PEDRO RAIMUNDO",
  },
  {
    codigo: "0036",
    dataCadastro: "qui 17/07/2025",
    cpf: "09673982740",
    nome: "JOSÉ FRANCISCO JUNIOR",
    celular: "(87) 99165-0835",
    recado1: "(87) 98145-3952",
    cnh: "05087270202",
    categoria: "AB",
    vencimento: "04/07/2033",
    ear: "SIM",
    cep: "56317-386",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SABIÁ LARANJEIRA, 17 - PEDRA LINDA",
  },
  {
    codigo: "0037",
    dataCadastro: "qui 17/07/2025",
    cpf: "10913694452",
    nome: "LUCAS GABRIEL BARROS DE OLIVEIRA",
    celular: "(87) 99988-5695",
    recado1: "(87) 99615-3179",
    recado2: "(81) 99146-0898",
    cnh: "05719804154",
    categoria: "AB",
    vencimento: "06/07/2032",
    ear: "SIM",
    cep: "56319-655",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA QUATORZE, 191 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0038",
    dataCadastro: "seg 21/07/2025",
    cpf: "15378442702",
    nome: "LIVIA OLIVEIRA E SILVA",
    celular: "(21) 96522-8484",
    recado1: "(87) 99106-2866",
    recado2: "(87) 99188-6913",
    cnh: "06622710117",
    categoria: "AB",
    vencimento: "08/07/2031",
    ear: "NÃO",
    cep: "56330-015",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PAU DARCO, 06 - APTO 303 - AREIA BRANCA",
  },
  {
    codigo: "0039",
    dataCadastro: "seg 21/07/2025",
    cpf: "53573781420",
    nome: "MARINALVA GOMES DA SILVA",
    celular: "(87) 98872-1033",
    cep: "56316-748",
    municipioUf: "PETROLINA/PE",
    endereco: "NOVA VIDA 1, 481",
  },
  {
    codigo: "0040",
    dataCadastro: "seg 21/07/2025",
    cpf: "40916700836",
    nome: "GLENISSON FARIAS LINS",
    celular: "(11) 97793-8619",
    vencimento: "01/10/2025",
    cep: "48324-999",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA DOIS, 888 - QUIDÉ",
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
  console.log("Lote 4:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 4 (0031–0040) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
