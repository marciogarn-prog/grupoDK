/**
 * Restaura na nuvem: protocolo 2026010104 → CPF 00445040556 (Nilza).
 * Dados inferidos do cadastro + geo (placa AAA0A00, DK MEU TRANSPORTE).
 *
 *   node grupodkempreendimentos/scripts/restore-protocolo-2026010104-nilza.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

const CPF = "00445040556";
const PROTO = "2026010104";

const LOC_NILZA = {
  id: 2026010104001,
  createdAt: 1735689600000,
  cpf: CPF,
  nome: "nilza maria da silva santos",
  numeroContrato: PROTO,
  placa: "AAA0A00",
  marcaModelo: "",
  inicio: "01/01/2026",
  fim: "",
  statusLocacao: "ATIVO",
  plano: "DK MEU TRANSPORTE",
  opcaoContrato: "DK MEU TRANSPORTE",
  valorLocacao: "",
  valorInvestimento: "R$ 0,00",
  valorSemanal: "",
  valorParcela: "",
  diaPagto: "",
  periodoLocacao: "",
  modalidade: "",
  periodoContrato: "",
  kmInicial: "",
  configPrecoKm: "",
  tabela: "",
  clienteCodigo: "CLIENTE 311",
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
  const res = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, updated_at: new Date().toISOString(), replace: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "Redis POST falhou");
}

function fixPayload(payload) {
  const report = { loc2026010104Nilza: false, locCountBefore: 0, locCountAfter: 0 };
  if (!Array.isArray(payload.dk_locacoes_cadastro)) payload.dk_locacoes_cadastro = [];
  report.locCountBefore = payload.dk_locacoes_cadastro.length;

  const protoN = normProto(PROTO);
  const idx = payload.dk_locacoes_cadastro.findIndex(
    (l) => normProto(l.numeroContrato) === protoN
  );
  if (idx < 0) {
    payload.dk_locacoes_cadastro.push({ ...LOC_NILZA });
    report.loc2026010104Nilza = true;
  } else {
    const cur = payload.dk_locacoes_cadastro[idx];
    payload.dk_locacoes_cadastro[idx] = {
      ...LOC_NILZA,
      ...cur,
      cpf: CPF,
      nome: cur.nome || LOC_NILZA.nome,
      numeroContrato: PROTO,
      placa: cur.placa || LOC_NILZA.placa,
      plano: cur.plano || LOC_NILZA.plano,
      opcaoContrato: cur.opcaoContrato || LOC_NILZA.opcaoContrato,
      fim: "",
      statusLocacao: "ATIVO",
    };
    report.loc2026010104Nilza = true;
  }

  report.locCountAfter = payload.dk_locacoes_cadastro.length;
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

  const verify = await fetch(REDIS_SNAPSHOT_URL).then((r) => r.json());
  const ok = (verify.payload?.dk_locacoes_cadastro || []).some(
    (l) =>
      normProto(l.numeroContrato) === normProto(PROTO) &&
      onlyDigits(l.cpf).slice(0, 11) === CPF
  );

  console.log("Fonte leitura:", source);
  console.log("Correção:", report);
  console.log("Protocolo", PROTO, "→ CPF", CPF, "(Nilza)");
  console.log("Gravado Supabase:", supaOk ? "sim" : "não");
  console.log("Gravado Redis: sim");
  console.log("Verificação Redis:", ok ? "OK" : "FALHOU");
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
