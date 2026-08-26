/**
 * Importa clientes 0370–0385 na nuvem do site oficial (após 0369).
 * node grupodkempreendimentos/scripts/import-clientes-370-385-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0370",
    status: "ATIVO",
    dataCadastro: "sex 14/08/2026",
    cpf: "11069888419",
    nome: "JOANA DARC SOUZA SANTANA",
    celular: "(87) 99184-2042",
    recado1: "(87) 98866-8958",
    recado2: "(74) 99919-0009",
    cnh: "07107519674",
    categoria: "AB",
    vencimento: "31/10/2032",
    ear: "SIM",
    cep: "56318-927",
    municipioUf: "PETROLINA/PE",
    endereco: "VILA PSH - RUA H, 66 - VALE DO GRANDE RIO",
  },
  {
    codigo: "0371",
    status: "ATIVO",
    dataCadastro: "seg 17/08/2026",
    cpf: "09284384494",
    nome: "HELDER SOUZA CAMPOS",
    celular: "(87) 99111-2423",
    recado1: "(87) 99183-7754",
    recado2: "(87) 98814-5063",
    cnh: "05845257503",
    categoria: "AB",
    vencimento: "15/06/2030",
    ear: "SIM",
    cep: "56306-010",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MAURICIO DE NASSAU, 517 - GERCINO COELHO",
  },
  {
    codigo: "0372",
    status: "ATIVO",
    dataCadastro: "seg 17/08/2026",
    cpf: "70997465450",
    nome: "GABRIEL CASTRO AMORIM",
    celular: "(87) 99161-1875",
    recado1: "(87) 98838-7249",
    recado2: "(87) 99917-8396",
    cnh: "09090935795",
    categoria: "A",
    vencimento: "22/08/2026",
    ear: "NÃO",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA NILO COELHO, 628 A - GERCINO COELHO",
  },
  {
    codigo: "0373",
    status: "INATIVO",
    dataCadastro: "seg 17/08/2026",
    cpf: "10027568474",
    nome: "LEONARDO NUNES MENDOZA",
    celular: "(87) 99911-3767",
    recado1: "(87) 99654-5735",
    recado2: "(87) 98851-5564",
    cnh: "06435303603",
    categoria: "B",
    vencimento: "07/03/2034",
    ear: "SIM",
    cep: "56373-120",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DA AMIZADE, 170 - DOM AVELAR",
  },
  {
    codigo: "0374",
    status: "ATIVO",
    dataCadastro: "seg 17/08/2026",
    cpf: "01379491975",
    nome: "VICTOR HUGO SANTA CASTANO",
    celular: "(87) 99857-1611",
    recado1: "(87) 98100-5877",
    recado2: "(87) 99144-5460",
    cnh: "09805292822",
    categoria: "B",
    vencimento: "01/04/2034",
    ear: "SIM",
    cep: "56300-560",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA ESMERALDA, 171 A - DOM AVELAR",
  },
  {
    codigo: "0375",
    status: "ATIVO",
    dataCadastro: "ter 18/08/2026",
    cpf: "10634985469",
    nome: "LARRY FELIPE ROMERO LARANJEIRA",
    celular: "(87) 98839-8418",
    recado1: "(74) 98144-3835",
    recado2: "(87) 98847-1061",
    cnh: "07084007354",
    categoria: "AB",
    vencimento: "24/07/2033",
    ear: "SIM",
    cep: "56321-520",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA MAR NEGRO (RUA DITO), 130 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "0376",
    status: "ATIVO",
    dataCadastro: "ter 18/08/2026",
    cpf: "07668991441",
    nome: "ROMÁRIO CORREIA DE ARAÚJO",
    celular: "(87) 99137-7701",
    recado1: "(87) 99187-4118",
    recado2: "(87) 99916-9414",
    cnh: "04481542546",
    categoria: "AB",
    vencimento: "01/03/2034",
    ear: "SIM",
    cep: "56330-300",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. MONSENHOR ANGELO SAMPAIO, 715 - MARIA AUXILIADORA",
  },
  {
    codigo: "0377",
    status: "ATIVO",
    dataCadastro: "ter 18/08/2026",
    cpf: "07141781528",
    nome: "ITALO PEREIRA DA SILVA",
    celular: "(87) 99108-9171",
    recado1: "(74) 99807-2348",
    recado2: "(74) 99812-8775",
    cnh: "08497287373",
    categoria: "B",
    vencimento: "15/09/2033",
    ear: "SIM",
    cep: "56357-180",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SÃO JOAQUIM, 331 - VILA EULÁLIA",
  },
  {
    codigo: "0378",
    status: "ATIVO",
    dataCadastro: "qua 19/08/2026",
    cpf: "08942796532",
    nome: "JOÃO VITOR COSTA MELO",
    celular: "(87) 99636-2395",
    recado1: "(87) 99209-8301",
    recado2: "",
    cnh: "09379344396",
    categoria: "A",
    vencimento: "11/07/2027",
    ear: "NÃO",
    cep: "56308-220",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SALGUEIRO, 82 - VILA EDUARDO",
  },
  {
    codigo: "0379",
    status: "ATIVO",
    dataCadastro: "qua 19/08/2026",
    cpf: "06988254544",
    nome: "RONALDO FERNANDES DA CUNHA",
    celular: "(74) 98862-3302",
    recado1: "(74) 98813-6892",
    recado2: "",
    cnh: "06047959555",
    categoria: "AB",
    vencimento: "13/03/2033",
    ear: "NÃO",
    cep: "48904-387",
    municipioUf: "JUAZEIRO/BA",
    endereco: "AV. LUIZ INÁCIO LULA DA SILVA, 16 B - LOMANTO JUNIOR",
  },
  {
    codigo: "0380",
    status: "ATIVO",
    dataCadastro: "qui 20/08/2026",
    cpf: "06131390460",
    nome: "ROSINEIDE BESERRA SOARES",
    celular: "(87) 99193-8851",
    recado1: "(87) 98110-3670",
    recado2: "(87) 99135-3824",
    cnh: "04999259603",
    categoria: "AB",
    vencimento: "19/02/2036",
    ear: "NÃO",
    cep: "56318-370",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA GERALDO BARBOSA, 10 - JARDIM AMAZONAS",
  },
  {
    codigo: "0381",
    status: "ATIVO",
    dataCadastro: "sex 21/08/2026",
    cpf: "06184228544",
    nome: "FRANCELIO SOUZA SANTOS",
    celular: "(74) 98851-3457",
    recado1: "(74) 98150-5404",
    recado2: "(74) 98149-0796",
    cnh: "05433930048",
    categoria: "AD",
    vencimento: "22/01/2034",
    ear: "SIM",
    cep: "48905-280",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA DA LIBERDADE, 418 - PALMARES I",
  },
  {
    codigo: "0382",
    status: "ATIVO",
    dataCadastro: "sex 21/08/2026",
    cpf: "03882642505",
    nome: "JADIEL DE OLIVEIRA CASTRO",
    celular: "(74) 98955-6683",
    recado1: "(74) 98848-8705",
    recado2: "(87) 99195-1299",
    cnh: "04144027923",
    categoria: "AD",
    vencimento: "09/05/2035",
    ear: "SIM",
    cep: "56302-905",
    municipioUf: "PETROLINA/PE",
    endereco: "AV. DOIS, 1190 - CASA C - COLINA DO RIO",
  },
  {
    codigo: "0383",
    status: "ATIVO",
    dataCadastro: "seg 24/08/2026",
    cpf: "13513527411",
    nome: "JOÃO LUCAS DANTAS DA SILVA",
    celular: "(74) 98112-9697",
    recado1: "(87) 98847-0899",
    recado2: "(87) 99184-8626",
    cnh: "07574229984",
    categoria: "A",
    vencimento: "19/03/2036",
    ear: "NÃO",
    cep: "56320-705",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA CRISTINO BEZERRA, 173 - VILA MARCELA",
  },
  {
    codigo: "0384",
    status: "ATIVO",
    dataCadastro: "seg 24/08/2026",
    cpf: "05084875369",
    nome: "MICHAEL MANOEL PEREIRA",
    celular: "(74) 99142-8063",
    recado1: "(74) 99111-1993",
    recado2: "(99) 99139-0384",
    cnh: "05659254558",
    categoria: "AB",
    vencimento: "21/12/2032",
    ear: "SIM",
    cep: "48900-000",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RUA SETE, 33 C - ANTÔNIO GUILHERMINO",
  },
  {
    codigo: "0385",
    status: "ATIVO",
    dataCadastro: "seg 24/08/2026",
    cpf: "71389311406",
    nome: "ISMAEL DOS SANTOS SOUSA",
    celular: "(87) 99170-9889",
    recado1: "(87) 98879-0794",
    recado2: "(87) 98872-0526",
    cnh: "09031588615",
    categoria: "AB",
    vencimento: "08/07/2034",
    ear: "SIM",
    cep: "56316-140",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOZE, 841 - JOÃO DE DEUS",
  },
];

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function cpfOk(d) {
  d = onlyDigits(d).padStart(11, "0").slice(0, 11);
  if (d.length !== 11 || /^(.)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = (s * 10) % 11 % 10;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = (s * 10) % 11 % 10;
  return r === +d[10];
}

function buildClienteRecord(row, idx) {
  const cpf = onlyDigits(row.cpf).slice(0, 11);
  if (!cpfOk(cpf)) throw new Error(`CPF inválido ${row.codigo}: ${row.cpf}`);
  const baseTs = Date.now() - (CLIENTES.length - idx) * 60000;
  return {
    id: baseTs,
    createdAt: baseTs,
    updatedAt: Date.now(),
    origemPortal: true,
    cadastroRetroativo: true,
    status: String(row.status || "ATIVO").trim() || "ATIVO",
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
    body: JSON.stringify({
      payload,
      updated_at: new Date().toISOString(),
      wipe_keys: ["dk_clientes_cadastro", "dk_portal_clientes_cadastro"],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "Redis POST falhou");
  return data;
}

async function verifyCloud() {
  const res = await fetch(`${REDIS_SNAPSHOT_URL}?nocache=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  const list = data?.payload?.dk_clientes_cadastro || [];
  const byCpf = new Set(
    list.map((r) => onlyDigits(r.cpf)).filter((c) => c.length === 11)
  );
  const codigos = CLIENTES.map((c) => c.codigo);
  const found = codigos.filter((cod) =>
    list.some((r) => String(r.codigo || "").trim() === cod && onlyDigits(r.cpf).length === 11)
  );
  return { total: list.length, uniqueCpf: byCpf.size, found: found.length, codigos: found };
}

async function main() {
  for (const row of CLIENTES) {
    if (!cpfOk(row.cpf)) throw new Error(`CPF inválido antes do import: ${row.codigo} ${row.cpf}`);
  }
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
  console.log(
    "Importados:",
    novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | ")
  );
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  if (verify.uniqueCpf < 385) {
    console.warn(`Aviso: unique CPF=${verify.uniqueCpf} (esperado ≥385).`);
  }
  console.log("OK — clientes 0370–0385 na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
