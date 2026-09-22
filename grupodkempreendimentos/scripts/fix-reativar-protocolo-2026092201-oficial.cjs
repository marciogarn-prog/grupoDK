/**
 * Reativa o protocolo 2026092201 (Rafael / RZN6C77), cancelado/finalizado por engano
 * quando o operador finalizou o 2026090202. Atribui id novo para não partilhar
 * assinatura com o 2026090202 (mesmo id antigo).
 *
 *   node grupodkempreendimentos/scripts/fix-reativar-protocolo-2026092201-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const BASE = "https://grupodkempreendimentos.com.br/";
const SNAP_URL = BASE + "api/dk-cloud-snapshot";
const SENHA = process.env.DK_OWNER_SENHA || "110499@Gb";
const PROTO = "2026092201";
const PROTO_IRMAO = "2026090202";

function dig(s) {
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
      Prefer: "return=representation",
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

async function portalAuth() {
  const auth = await fetch(BASE + "api/dk-portal-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo: "equipa",
      cpf: "03037897430",
      senha: SENHA,
      confirmarUnico: true,
      deviceId: "dk-fix-reativar-2026092201",
    }),
  }).then((r) => r.json());
  if (!auth?.token) throw new Error("Auth CEO falhou: " + JSON.stringify(auth));
  return {
    Authorization: "Bearer " + auth.token,
    "X-DK-Portal-Token": auth.token,
    "X-DK-Client-Protocol": "20260913",
    "X-DK-User-Active": "1",
  };
}

function reativarRow(prev, now) {
  const newId = now;
  return {
    ...prev,
    id: newId,
    updatedAt: now,
    fim: "",
    dataFim: "",
    horaFim: "",
    kmFinal: "",
    odometroFim: "",
    statusLocacao: "ATIVO",
    status: "ATIVO",
    contratoCancelado: false,
    tempoDiasContrato: "",
    portalLocacaoFinalizadoPorCpf: "",
    portalLocacaoFinalizadoPorNome: "",
    portalLocacaoFinalizadoEmMs: 0,
    portalLocacaoCanceladoPorCpf: "",
    portalLocacaoCanceladoPorNome: "",
    portalLocacaoCanceladoEmMs: 0,
    iniciativaDistrato: "",
    motivoDistrato: "",
    distratoGeradoEmMs: 0,
    portalLocacaoReativadoPorCpf: "03037897430",
    portalLocacaoReativadoPorNome: "Márcio Santos",
    portalLocacaoReativadoEmMs: now,
    portalLocacaoReativadoMotivo: "Reativação oficial — cancelamento/finalização precipitada (irmão 2026090202).",
  };
}

async function main() {
  const headers = await portalAuth();
  const snap = await fetch(SNAP_URL + "?nocache=" + Date.now(), { headers }).then((r) => r.json());
  const locs = Array.isArray(snap?.payload?.dk_locacoes_cadastro) ? snap.payload.dk_locacoes_cadastro : [];
  const idx = locs.findIndex((l) => normProto(l.numeroContrato) === PROTO);
  if (idx < 0) throw new Error("Protocolo " + PROTO + " não encontrado na nuvem.");
  const prev = locs[idx];
  const irmao = locs.find((l) => normProto(l.numeroContrato) === PROTO_IRMAO);
  console.log("antes", {
    proto: prev.numeroContrato,
    id: prev.id,
    status: prev.statusLocacao,
    cancel: prev.contratoCancelado,
    inicio: prev.inicio,
    fim: prev.fim,
    placa: prev.placa,
    irmaoId: irmao?.id,
    irmaoStatus: irmao?.statusLocacao,
  });

  const now = Date.now() + 60 * 1000;
  const next = reativarRow(prev, now);

  const post = await fetch(SNAP_URL, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      payload: { dk_locacoes_cadastro: [next] },
      updated_at: new Date(now).toISOString(),
    }),
  }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));
  if (!post.ok) throw new Error("POST snapshot falhou: " + JSON.stringify(post));

  // Espelhar no Supabase se possível (opcional — a API Redis já é a fonte de leitura do portal).
  try {
    let payload = snap.payload || {};
    payload = {
      ...payload,
      dk_locacoes_cadastro: locs.map((l) => (normProto(l.numeroContrato) === PROTO ? next : l)),
    };
    await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload, updated_at: new Date(now).toISOString() }),
    });
    console.log("Supabase: ok");
  } catch (e) {
    console.warn("Supabase (ignorado):", e.message || e);
  }

  const verify = await fetch(SNAP_URL + "?nocache=" + Date.now(), { headers }).then((r) => r.json());
  const vLocs = Array.isArray(verify?.payload?.dk_locacoes_cadastro) ? verify.payload.dk_locacoes_cadastro : [];
  const v = vLocs.find((l) => normProto(l.numeroContrato) === PROTO);
  const vIrmao = vLocs.find((l) => normProto(l.numeroContrato) === PROTO_IRMAO);
  const ok =
    v &&
    String(v.statusLocacao || "").toUpperCase() === "ATIVO" &&
    !v.contratoCancelado &&
    !String(v.fim || "").trim() &&
    Number(v.id) !== Number(vIrmao?.id || 0);
  console.log("depois", {
    proto: v?.numeroContrato,
    id: v?.id,
    status: v?.statusLocacao,
    cancel: v?.contratoCancelado,
    inicio: v?.inicio,
    fim: v?.fim || "(vazio)",
    placa: v?.placa,
    irmaoId: vIrmao?.id,
    irmaoStatus: vIrmao?.statusLocacao,
    idsDistintos: Number(v?.id) !== Number(vIrmao?.id || 0),
  });
  if (!ok) {
    console.error("Verificação falhou");
    process.exit(1);
  }
  console.log("OK — protocolo", PROTO, "reativado na nuvem oficial.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
