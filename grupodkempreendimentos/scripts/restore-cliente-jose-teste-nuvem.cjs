/**
 * Restaura cadastro + locação 2026010101 (José Cândido) na nuvem se tiverem sido apagados.
 * Não repõe comprovantes nem pagamentos.
 *
 *   node grupodkempreendimentos/scripts/restore-cliente-jose-teste-nuvem.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

const CPF = "19174403400";
const PROTO = "2026010101";

const CLIENTE = {
  cpf: CPF,
  nome: "JOSÉ CANDIDO DOS SANTOS",
  celular: "",
  categoria: "AB",
  dataCadastro: "01/01/2026",
};

const LOCACAO = {
  id: 2026010101001,
  createdAt: 1735689600000,
  cpf: CPF,
  nome: CLIENTE.nome,
  numeroContrato: PROTO,
  placa: "AAA0A00",
  marcaModelo: "FERRARI",
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
  const res = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, updated_at: new Date().toISOString() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "Redis POST falhou");
}

function mergeRestore(payload) {
  const report = { clienteAdicionado: false, locacaoAdicionada: false, locacaoAtualizada: false };
  if (!Array.isArray(payload.dk_clientes_cadastro)) payload.dk_clientes_cadastro = [];
  if (!Array.isArray(payload.dk_locacoes_cadastro)) payload.dk_locacoes_cadastro = [];

  const hasCliente = payload.dk_clientes_cadastro.some(
    (c) => onlyDigits(c.cpf).slice(0, 11) === CPF
  );
  if (!hasCliente) {
    payload.dk_clientes_cadastro.push({ ...CLIENTE });
    report.clienteAdicionado = true;
  }

  const protoN = normProto(PROTO);
  const idx = payload.dk_locacoes_cadastro.findIndex(
    (l) =>
      onlyDigits(l.cpf).slice(0, 11) === CPF && normProto(l.numeroContrato) === protoN
  );
  if (idx < 0) {
    payload.dk_locacoes_cadastro.push({ ...LOCACAO });
    report.locacaoAdicionada = true;
  } else {
    const cur = payload.dk_locacoes_cadastro[idx];
    payload.dk_locacoes_cadastro[idx] = {
      ...LOCACAO,
      ...cur,
      numeroContrato: PROTO,
      cpf: CPF,
      placa: cur.placa || LOCACAO.placa,
      marcaModelo: cur.marcaModelo || LOCACAO.marcaModelo,
      nome: cur.nome || LOCACAO.nome,
      fim: "",
      statusLocacao: "ATIVO",
      portalLancamentosAluguel: [],
      lancamentosAluguel: [],
      portalManutencoesRegistro: [],
      portalMultasTransito: [],
    };
    report.locacaoAtualizada = true;
  }

  return report;
}

async function main() {
  const { payload, source } = await readPayload();
  const report = mergeRestore(payload);
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
  console.log("Restauro:", report);
  console.log("Gravado Supabase:", supaOk ? "sim" : "não");
  console.log("Gravado Redis: sim");
  console.log("\nNo portal: Ctrl+F5 → Carregar da nuvem.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
