/**
 * Remove protocolo errado 2026122501 (duplicata) e mantém 2025122201
 * (Adriano Cardoso Ribeiro / SOY5D66) na nuvem oficial.
 *
 *   node grupodkempreendimentos/scripts/fix-protocolo-adriano-2025122201-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

const WRONG = "2026122501";
const RIGHT = "2025122201";
const CPF = "93630590578";
const PLACA = "SOY5D66";

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function normProto(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function normPlaca(v) {
  return String(v ?? "")
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
  const res = await fetch(`${REDIS_SNAPSHOT_URL}?nocache=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  if (!data?.payload) throw new Error("Snapshot indisponível");
  return { payload: data.payload, source: "redis" };
}

async function pushRedis(payload) {
  const res = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload,
      updated_at: new Date().toISOString(),
      wipe_keys: ["dk_locacoes_cadastro"],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "Redis POST falhou");
  return data;
}

function fillIfEmpty(target, source, keys) {
  for (const k of keys) {
    const cur = target[k];
    const src = source[k];
    const empty =
      cur == null ||
      cur === "" ||
      (Array.isArray(cur) && !cur.length);
    if (empty && src != null && src !== "") target[k] = src;
  }
}

function fixPayload(payload) {
  const report = {
    removedWrong: false,
    enrichedRight: false,
    before: 0,
    after: 0,
    rightOk: false,
  };
  if (!Array.isArray(payload.dk_locacoes_cadastro)) payload.dk_locacoes_cadastro = [];
  report.before = payload.dk_locacoes_cadastro.length;

  const wrongIdx = payload.dk_locacoes_cadastro.findIndex((l) => normProto(l.numeroContrato) === WRONG);
  const rightIdx = payload.dk_locacoes_cadastro.findIndex((l) => normProto(l.numeroContrato) === RIGHT);

  if (wrongIdx < 0 && rightIdx < 0) {
    throw new Error("Nem o protocolo errado nem o correto foram encontrados.");
  }

  if (wrongIdx >= 0 && rightIdx >= 0) {
    const wrong = payload.dk_locacoes_cadastro[wrongIdx];
    const right = { ...payload.dk_locacoes_cadastro[rightIdx] };
    fillIfEmpty(right, wrong, [
      "nome",
      "marcaModelo",
      "modalidade",
      "valorLocacao",
      "valorParcela",
      "valorSemanal",
      "valorInvestimento",
      "diaPagto",
      "periodoLocacao",
      "periodoContrato",
      "opcaoContrato",
      "statusLocacao",
      "clienteCodigo",
    ]);
    if (!onlyDigits(right.cpf)) right.cpf = CPF;
    if (!normPlaca(right.placa)) right.placa = PLACA;
    right.numeroContrato = RIGHT;
    right.origemPortal = true;
    right.updatedAt = Date.now();
    payload.dk_locacoes_cadastro[rightIdx] = right;
    report.enrichedRight = true;
  } else if (wrongIdx >= 0 && rightIdx < 0) {
    const wrong = payload.dk_locacoes_cadastro[wrongIdx];
    payload.dk_locacoes_cadastro[wrongIdx] = {
      ...wrong,
      numeroContrato: RIGHT,
      cpf: onlyDigits(wrong.cpf) || CPF,
      placa: normPlaca(wrong.placa) || PLACA,
      origemPortal: true,
      updatedAt: Date.now(),
    };
    report.enrichedRight = true;
  }

  const beforeFilter = payload.dk_locacoes_cadastro.length;
  payload.dk_locacoes_cadastro = payload.dk_locacoes_cadastro.filter(
    (l) => normProto(l.numeroContrato) !== WRONG
  );
  report.removedWrong = payload.dk_locacoes_cadastro.length < beforeFilter;

  const right = payload.dk_locacoes_cadastro.find((l) => normProto(l.numeroContrato) === RIGHT);
  report.rightOk = Boolean(
    right &&
      onlyDigits(right.cpf) === CPF &&
      normPlaca(right.placa) === PLACA
  );
  report.after = payload.dk_locacoes_cadastro.length;
  return report;
}

async function verify() {
  const res = await fetch(`${REDIS_SNAPSHOT_URL}?nocache=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  const locs = data?.payload?.dk_locacoes_cadastro || [];
  return {
    hasWrong: locs.some((l) => normProto(l.numeroContrato) === WRONG),
    right: locs.find((l) => normProto(l.numeroContrato) === RIGHT) || null,
    total: locs.length,
  };
}

async function main() {
  const { payload, source } = await readPayload();
  const report = fixPayload(payload);
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
  const v = await verify();

  console.log("Fonte:", source);
  console.log("Report:", report);
  console.log("Supabase:", supaOk ? "ok" : "falhou");
  console.log("Verify:", {
    total: v.total,
    hasWrong: v.hasWrong,
    right: v.right
      ? {
          numeroContrato: v.right.numeroContrato,
          cpf: v.right.cpf,
          placa: v.right.placa,
          nome: v.right.nome,
          inicio: v.right.inicio,
          fim: v.right.fim,
        }
      : null,
  });

  if (v.hasWrong || !v.right) {
    console.error("ERRO: correção não confirmada na nuvem.");
    process.exit(1);
  }
  console.log("OK — protocolo correto 2025122201; 2026122501 removido.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
