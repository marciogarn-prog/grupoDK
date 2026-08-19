/**
 * Importa clientes retroativos lote 3 (cód. 0021–0030) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote3-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0021",
    dataCadastro: "qua 21/05/2025",
    cpf: "10908213441",
    nome: "HÉLIO PEREIRA ROCHA",
    celular: "(87) 98866-4677",
    municipioUf: "PETROLINA/PE",
    endereco: "VIVENDAS, 102 - BLOCO JOANES - VIVENDAS 2",
  },
  {
    codigo: "0022",
    dataCadastro: "qua 21/05/2025",
    cpf: "70764016490",
    nome: "WESLEY DE SOUZA SILVA",
    celular: "(87) 99201-4020",
    cep: "56318-780",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA TRINTA E CINCO, 111 - ALTO DO COCAR",
  },
  {
    codigo: "0023",
    dataCadastro: "dom 08/06/2025",
    cpf: "10708101429",
    nome: "MARCOS VITOR DA COSTA FILHO",
    celular: "(83) 98209-8159",
    vencimento: "21/07/2032",
    cep: "56306-210",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PRINCESA LEOPODINA, S/N - GERCINO COELHO",
  },
  {
    codigo: "0024",
    dataCadastro: "sex 13/06/2025",
    cpf: "01419972499",
    nome: "ANTÔNIO MARQUES GUIMARÃES JUNIOR",
    celular: "(87) 99683-1313",
    cep: "56310-766",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOZE, 290 - LOTEAMENTO RECIFE",
  },
  {
    codigo: "0025",
    dataCadastro: "sex 13/06/2025",
    cpf: "01272744485",
    nome: "CLAUCIO LUCAS DA SILVA",
    celular: "(87) 98832-7681",
    cnh: "05331271380",
    categoria: "AB",
    vencimento: "29/05/2029",
    ear: "SIM",
    cep: "56326-280",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA OITO, 40 - VILA DÉBORA",
  },
  {
    codigo: "0026",
    dataCadastro: "sex 13/06/2025",
    cpf: "07035218459",
    nome: "ROBEILDA BARTIRALINO",
    celular: "(87) 99154-3966",
    cnh: "04791303377",
    categoria: "AB",
    vencimento: "23/10/2034",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA GONZAGUINHA, 141 - VILA DÉBORA",
  },
  {
    codigo: "0027",
    dataCadastro: "seg 16/06/2025",
    cpf: "01361302593",
    nome: "TERIVALDO CARVALHO DE SOUSA",
    celular: "(87) 98854-9853",
    cnh: "03079139219",
    categoria: "AB",
    vencimento: "13/07/2031",
    ear: "SIM",
    cep: "56310-330",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MARIA DE BELÉM TEIXEIRA COELHO, 15 - COHA MASSANGANO",
  },
  {
    codigo: "0028",
    dataCadastro: "qui 19/06/2025",
    cpf: "08400400402",
    nome: "YURI GONÇALVES GUIMARÃES",
    celular: "(87) 99110-5856",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA JOÃO FRANCISCO DA SILVA, 211 - BELA VISTA",
  },
  {
    codigo: "0029",
    dataCadastro: "qui 26/06/2025",
    cpf: "04681055492",
    nome: "ERASMO CARLOS DE SOUZA",
    celular: "(87) 98808-3910",
    recado1: "(87) 99174-4232",
    cep: "56330-080",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DA CAATINGUEIRA, 65 - AREIA BRANCA",
  },
  {
    codigo: "0030",
    dataCadastro: "ter 01/07/2025",
    cpf: "01978737408",
    nome: "RODRIGO FORTES DE SOUZA",
    celular: "(87) 99996-7880",
    cnh: "03762893411",
    categoria: "AD",
    vencimento: "18/11/2034",
    ear: "SIM",
    cep: "56321-730",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA ACÁCIA, 100 - ANTÔNIO CASSIMIRO",
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
  console.log("Lote 3:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 3 (0021–0030) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
