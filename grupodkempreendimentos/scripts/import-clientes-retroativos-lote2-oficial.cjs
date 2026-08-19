/**
 * Importa clientes retroativos lote 2 (cód. 0011–0020) na nuvem do site oficial.
 * node grupodkempreendimentos/scripts/import-clientes-retroativos-lote2-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");

const CLIENTES = [
  {
    codigo: "0011",
    dataCadastro: "qua 14/05/2025",
    cpf: "04115684500",
    nome: "UELTON DE ALMEIDA SANTOS",
    celular: "(87) 99253-0811",
    cnh: "07450153071",
    categoria: "AB",
    vencimento: "29/10/2034",
    ear: "SIM",
    cep: "48024-999",
    municipioUf: "JUAZEIRO/BA",
    endereco: "RESIDENCIAL PALMARES, 01 - RESIDENCIAL PALMARES - QUIDÉ",
  },
  {
    codigo: "0012",
    dataCadastro: "qua 14/05/2025",
    cpf: "10575686430",
    nome: "FELIPE FRANCISCO DE SOUSA",
    celular: "(87) 99992-0523",
    cnh: "05997808423",
    categoria: "AB",
    vencimento: "25/03/2034",
    ear: "SIM",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA UM, 25 - MANDACARU",
  },
  {
    codigo: "0013",
    dataCadastro: "qua 14/05/2025",
    cpf: "13781946401",
    nome: "RUTCHELLY VIDA PEREIRA SANTOS",
    celular: "(87) 98868-3667",
    cnh: "07961987251",
    categoria: "AB",
    vencimento: "13/04/2032",
    ear: "SIM",
    cep: "56306-210",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PRINCESA LEOPODINA, S/N - GERCINO COELHO",
  },
  {
    codigo: "0014",
    dataCadastro: "qua 14/05/2025",
    cpf: "10779631900",
    nome: "MATEUS DE SÁ",
    vencimento: "02/02/2034",
    cep: "56306-210",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PRINCESA LEOPODINA, S/N - GERCINO COELHO",
  },
  {
    codigo: "0015",
    dataCadastro: "qui 15/05/2025",
    cpf: "11311814418",
    nome: "ALEXANDRE DA SILVA FERREIRA",
    celular: "(87) 98808-9945",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA OITENTA, 110 - VILA CHOCOLATE - SÃO GONÇALO",
  },
  {
    codigo: "0016",
    dataCadastro: "sex 16/05/2025",
    cpf: "00000000003",
    nome: "MARCIO (AMIGO DE BALA)",
    vencimento: "01/01/2026",
    cep: "56306-210",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PRINCESA LEOPODINA, S/N - GERCINO COELHO",
  },
  {
    codigo: "0017",
    dataCadastro: "sex 16/05/2025",
    cpf: "00000000002",
    nome: "MIKEAEL (BALA)",
    vencimento: "01/10/2025",
    cep: "56306-210",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PRINCESA LEOPODINA, S/N - GERCINO COELHO",
  },
  {
    codigo: "0018",
    dataCadastro: "sáb 17/05/2025",
    cpf: "10552698431",
    nome: "MAILTON BESERRA TEIXEIRA CAVALCANTI",
    celular: "(87) 98817-1558",
    cep: "56320-310",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA RIACHO D SOBRADO, 05 - JOSÉ E MARIA",
  },
  {
    codigo: "0019",
    dataCadastro: "sáb 17/05/2025",
    cpf: "04959338563",
    nome: "WILLIAN CESAR DA SILVA DIAS",
    celular: "(87) 99116-0115",
    cep: "56320-815",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DOZE, 229 - VILA MARCELA",
  },
  {
    codigo: "0020",
    dataCadastro: "dom 18/05/2025",
    cpf: "00000000005",
    nome: "NICINHO",
    vencimento: "02/02/2026",
    cep: "56306-210",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PRINCESA LEOPODINA, 193 - GERCINO COELHO",
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
  console.log("Lote 2:", novos.map((c) => `${c.codigo} ${c.nome.slice(0, 28)}`).join(" | "));
  console.log("Supabase:", supaOk ? "ok" : "falhou/ignorado");
  console.log("Verificação nuvem:", verify);

  if (verify.found !== CLIENTES.length) {
    console.error(`ERRO: só ${verify.found}/${CLIENTES.length} códigos confirmados na nuvem.`);
    process.exit(1);
  }
  console.log("OK — lote 2 (0011–0020) na nuvem oficial.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
