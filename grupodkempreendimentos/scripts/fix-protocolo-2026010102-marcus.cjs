/**
 * Corrige na nuvem: protocolo 2026010102 → CPF 06523244440 (Marcus), não José.
 * 2026010101 permanece com José (19174403400).
 *
 *   node grupodkempreendimentos/scripts/fix-protocolo-2026010102-marcus.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

const CPF_MARCUS = "06523244440";
const CPF_JOSE = "19174403400";
const PROTO_MARCUS = "2026010102";
const PROTO_JOSE = "2026010101";

const CLIENTE_MARCUS = {
  cpf: CPF_MARCUS,
  nome: "MARCUS VINICIUS SIQUEIRA DOS SANTOS",
  celular: "",
  categoria: "AB",
  dataCadastro: "01/01/2026",
  senha: "123456",
  origemPortal: true,
  status: "ATIVO",
};

const LOC_MARCUS = {
  id: 2026010102001,
  createdAt: 1735689600000,
  cpf: CPF_MARCUS,
  nome: CLIENTE_MARCUS.nome,
  numeroContrato: PROTO_MARCUS,
  placa: "",
  marcaModelo: "",
  inicio: "01/01/2026",
  fim: "",
  statusLocacao: "ATIVO",
  plano: "SEMANAL",
  valorLocacao: "",
  valorInvestimento: "",
  valorSemanal: "",
  valorParcela: "",
  diaPagto: "",
  periodoLocacao: "",
  modalidade: "",
  opcaoContrato: "",
  periodoContrato: "",
  kmInicial: "",
  configPrecoKm: "",
  tabela: "",
  clienteCodigo: "",
  portalLancamentosAluguel: [],
  lancamentosAluguel: [],
  portalManutencoesRegistro: [],
  portalMultasTransito: [],
  origemPortal: true,
};

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function normProto(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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
  const res = await fetch(REDIS_SNAPSHOT_URL);
  const data = await res.json().catch(() => ({}));
  if (!data?.payload) throw new Error("Snapshot indisponível");
  return { payload: data.payload, source: "redis" };
}

async function pushRedis(payload) {
  payload._dkFullReplaceKeys = ["dk_clientes_cadastro", "dk_locacoes_cadastro"];
  const res = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, updated_at: new Date().toISOString(), replace: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "Redis POST falhou");
}

function fixPayload(payload) {
  const report = {
    clienteMarcusAdicionado: false,
    loc2026010102RemovidaDeJose: 0,
    loc2026010102Marcus: false,
    loc2026010101Jose: false,
  };
  if (!Array.isArray(payload.dk_clientes_cadastro)) payload.dk_clientes_cadastro = [];
  if (!Array.isArray(payload.dk_locacoes_cadastro)) payload.dk_locacoes_cadastro = [];

  const hasMarcus = payload.dk_clientes_cadastro.some(
    (c) => onlyDigits(c.cpf).slice(0, 11) === CPF_MARCUS
  );
  if (!hasMarcus) {
    payload.dk_clientes_cadastro.push({ ...CLIENTE_MARCUS });
    report.clienteMarcusAdicionado = true;
  }

  const protoM = normProto(PROTO_MARCUS);
  const protoJ = normProto(PROTO_JOSE);

  payload.dk_locacoes_cadastro = payload.dk_locacoes_cadastro.filter((l) => {
    const p = normProto(l.numeroContrato);
    const cpf = onlyDigits(l.cpf).slice(0, 11);
    if (p === protoM && cpf === CPF_JOSE) {
      report.loc2026010102RemovidaDeJose += 1;
      return false;
    }
    return true;
  });

  const idxM = payload.dk_locacoes_cadastro.findIndex(
    (l) => normProto(l.numeroContrato) === protoM && onlyDigits(l.cpf).slice(0, 11) === CPF_MARCUS
  );
  if (idxM < 0) {
    payload.dk_locacoes_cadastro.push({ ...LOC_MARCUS });
    report.loc2026010102Marcus = true;
  } else {
    const cur = payload.dk_locacoes_cadastro[idxM];
    payload.dk_locacoes_cadastro[idxM] = {
      ...LOC_MARCUS,
      ...cur,
      cpf: CPF_MARCUS,
      nome: cur.nome || LOC_MARCUS.nome,
      numeroContrato: PROTO_MARCUS,
      placa: cur.placa || LOC_MARCUS.placa,
      marcaModelo: cur.marcaModelo || LOC_MARCUS.marcaModelo,
      fim: "",
      statusLocacao: "ATIVO",
    };
    report.loc2026010102Marcus = true;
  }

  report.loc2026010101Jose = payload.dk_locacoes_cadastro.some(
    (l) =>
      normProto(l.numeroContrato) === protoJ && onlyDigits(l.cpf).slice(0, 11) === CPF_JOSE
  );

  return report;
}

async function main() {
  const { payload, source } = await readPayload();
  const report = fixPayload(payload);
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

  console.log("Fonte:", source);
  console.log("Correção:", report);
  console.log("\nProtocolo 2026010102 → CPF", CPF_MARCUS, "(Marcus Vinicius Siqueira dos Santos)");
  console.log("Protocolo 2026010101 → CPF", CPF_JOSE, "(José Cândido)");
  console.log("Gravado Supabase:", supaOk ? "sim" : "não");
  console.log("Gravado Redis: sim");
  console.log("\nPortal: Ctrl+F5 → Carregar da nuvem.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
