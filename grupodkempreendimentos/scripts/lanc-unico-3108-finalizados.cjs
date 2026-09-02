/**
 * Lançamento único 31/08/2026 (fonte azul, Márcio Santos) nos protocolos
 * finalizados da planilha «TOTAL PAGO ATE 31/08/2026» (lotes 1 e 2).
 *
 *   node grupodkempreendimentos/scripts/lanc-unico-3108-finalizados.cjs
 *   node grupodkempreendimentos/scripts/lanc-unico-3108-finalizados.cjs --dry-run
 */
const { mergeLocacoesCadastro, filtrarPortalLancamentosPorRemovidos, mergePortalLancamentosRemovidos } =
  require("../lib/dk-append-only-merge.cjs");

const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const LOCACOES_API = "https://grupodkempreendimentos.com.br/api/cadastro-locacoes";

const CPF_MARCIO = "03037897430";
const NOME_MARCIO = "Márcio Santos";
const DATA_UNICO = "31/08/2026";
const COMENTARIO = "Total pago até 31/08/2026";

const ROWS = [
  { protocolo: "2025042201", placa: "SOQ3B79", cpf: "70393366421", nome: "ERICLES DAMARES DA SILVA REIS", fim: "18/06/2025", valor: 1289 },
  { protocolo: "2025050901", placa: "RDO7E19", cpf: "93630590578", nome: "ADRIANO CARDOSO RIBEIRO", fim: "25/08/2025", valor: 3750 },
  { protocolo: "2025051301", placa: "RZP5E86", cpf: "07777997408", nome: "ERLANDERSON ALVES DOS SANTOS", fim: "08/10/2025", valor: 5285.71 },
  { protocolo: "2025052102", placa: "PCK8G70", cpf: "70764016490", nome: "WESLEY DE SOUSA SILVA", fim: "05/08/2025", valor: 2050 },
  { protocolo: "2025061303", placa: "QYW8I91", cpf: "07035218459", nome: "ROBEILDA BARTIRA LINO", fim: "15/05/2026", valor: 11000 },
  { protocolo: "2025061901", placa: "RZJ3D92", cpf: "08400400402", nome: "IURY GONCALVES GUIMARAES", fim: "09/07/2025", valor: 714 },
  { protocolo: "2025062601", placa: "SOQ3B79", cpf: "04681055492", nome: "ERASMO CARLOS DE SOUZA", fim: "12/08/2025", valor: 1000 },
  { protocolo: "2025070101", placa: "SJR1B50", cpf: "01978737408", nome: "RODRIGO FORTES DE SOUZA", fim: "13/10/2025", valor: 3760 },
  { protocolo: "2025070201", placa: "SOU2I56", cpf: "07146187489", nome: "TASSIO CESAR DE DEUS SILVA", fim: "19/01/2026", valor: 5742.86 },
  { protocolo: "2025070901", placa: "SOT1I98", cpf: "08424164474", nome: "DENILSON DOMINGOS DO NASCIMENTO", fim: "18/08/2025", valor: 1428.57 },
  { protocolo: "2025071601", placa: "RZJ3D92", cpf: "70550550402", nome: "HILTON MAYCON DAS NEVES SANTOS", fim: "18/08/2025", valor: 1178.57 },
  { protocolo: "2025071701", placa: "QYU5H13", cpf: "06810021310", nome: "HAROLDO PINHEIRO SILVA", fim: "24/07/2025", valor: 250 },
  { protocolo: "2025071702", placa: "RCY4F05", cpf: "09988438494", nome: "IGOR RAFAEL NASCIMENTO MOREIRA", fim: "05/03/2026", valor: 7750 },
  { protocolo: "2025072102", placa: "SOU5E29", cpf: "15378442702", nome: "LÍVIA OLIVEIRA E SILVA", fim: "01/08/2025", valor: 425 },
  { protocolo: "2025072103", placa: "SOW0B92", cpf: "53573781420", nome: "MARINALVA GOMES DA SILVA", fim: "28/07/2025", valor: 250 },
  { protocolo: "2025072301", placa: "SOW5B81", cpf: "70614419417", nome: "LUCAS MATEUS NASCIMENTO CUSTODIO MARTINS", fim: "27/05/2026", valor: 11000.02 },
  { protocolo: "2025080101", placa: "SOW0B92", cpf: "11121338445", nome: "JEFFERSON DOS SANTOS CARMO", fim: "07/08/2025", valor: 250 },
  { protocolo: "2025080102", placa: "RZP6J73", cpf: "11377276406", nome: "MIQUEIAS RODRIGUE MARTINS", fim: "12/08/2025", valor: 392.86 },
  { protocolo: "2025080201", placa: "QYU5H13", cpf: "05365443527", nome: "URIEL ALMEIDA SANTANA", fim: "26/05/2026", valor: 10392.84 },
  { protocolo: "2025080701", placa: "SOW0B92", cpf: "70481459430", nome: "ERIK EMANOEL DA SILVA", fim: "13/08/2025", valor: 214.29 },
  { protocolo: "2025080702", placa: "SOQ2D39", cpf: "71301840432", nome: "WANDERSON BARBOSA RODRIGUES", fim: "14/08/2025", valor: 971 },
  { protocolo: "2025080802", placa: "SOX6I83", cpf: "08862744439", nome: "RENATO BRUNO PEREIRA RODRIGUES", fim: "08/09/2025", valor: 1072 },
  { protocolo: "2025081202", placa: "PCK8G70", cpf: "11377276406", nome: "MIQUEIAS RODRIGUE MARTINS", fim: "14/08/2025", valor: 71.43 },
  { protocolo: "2025081301", placa: "SOW0B92", cpf: "09135482435", nome: "FELIPE DE SOUZA LIMA", fim: "14/08/2025", valor: 35.71 },
  { protocolo: "2025081401", placa: "SOX2A34", cpf: "09135482435", nome: "FELIPE DE SOUZA LIMA", fim: "18/08/2025", valor: 142.86 },
  { protocolo: "2025081801", placa: "SOY4H40", cpf: "08424164474", nome: "DENILSON DOMINGOS DO NASCIMENTO", fim: "19/11/2025", valor: 3731.43 },
  { protocolo: "2025081802", placa: "RZJ3D92", cpf: "09135482435", nome: "FELIPE DE SOUZA LIMA", fim: "18/09/2025", valor: 1286 },
  { protocolo: "2025081804", placa: "SOX2B54", cpf: "70550550402", nome: "HILTON MAYCON DAS NEVES SANTOS", fim: "21/07/2026", valor: 11705.69 },
  { protocolo: "2025081805", placa: "SOT1I98", cpf: "11239197470", nome: "ITALO SANTOS DE LIMA", fim: "03/07/2026", valor: 12990 },
  { protocolo: "2025081901", placa: "RZP6J73", cpf: "11377276406", nome: "MIQUEIAS RODRIGUE MARTINS", fim: "22/08/2025", valor: 107.14 },
  { protocolo: "2025082101", placa: "SOX2A94", cpf: "39339176898", nome: "ALEX RAONI DE SOUZA SANTOS", fim: "25/08/2025", valor: 142.86 },
  { protocolo: "2025082102", placa: "PCK8G70", cpf: "12873371471", nome: "JOÃO PEDRO FRUTUOSO DA ROCHA", fim: "17/09/2025", valor: 1000 },
  { protocolo: "2025082103", placa: "SOW0B92", cpf: "05135601309", nome: "LUAN CARLOS RAMALHO MENEZES", fim: "19/03/2026", valor: 7500 },
  { protocolo: "2025082201", placa: "SOX6I44", cpf: "70274179440", nome: "ERICK SANTOS DO NASCIMENTO", fim: "17/03/2026", valor: 7392.86 },
  { protocolo: "2025082202", placa: "SOX2A44", cpf: "02588165540", nome: "GESSER PEREIRA", fim: "29/08/2025", valor: 250 },
  { protocolo: "2025082203", placa: "SOW0B72", cpf: "70918887402", nome: "KYWAN CAVALCANTI DAMASCENO", fim: "02/09/2025", valor: 500 },
  { protocolo: "2025082204", placa: "RZP6J73", cpf: "11377276406", nome: "MIQUEIAS RODRIGUE MARTINS", fim: "12/02/2026", valor: 6214.29 },
  { protocolo: "2025082301", placa: "SOX2A34", cpf: "09715859461", nome: "ALEXSANDRO LACERDA PAIXÃO", fim: "20/01/2026", valor: 5357.14 },
  { protocolo: "2025082302", placa: "SOU5C59", cpf: "09196903430", nome: "VÍTOR MAIA E SILVA", fim: "28/08/2025", valor: 140 },
  { protocolo: "2025082501", placa: "SOY5D66", cpf: "93630590578", nome: "ADRIANO CARDOSO RIBEIRO", fim: "22/12/2025", valor: 5780 },
  { protocolo: "2025082504", placa: "SOY5D76", cpf: "06242649551", nome: "FELIPE YAGO GOMES RIBEIRO", fim: "26/01/2026", valor: 6540 },
  { protocolo: "2025082505", placa: "SOX2B44", cpf: "09673982740", nome: "JOSÉ FRANCISCO JÚNIOR", fim: "17/09/2025", valor: 1080 },
  { protocolo: "2025082601", placa: "SOY5D46", cpf: "06167113360", nome: "DECLEON ARAUJO DA COSTA", fim: "27/09/2025", valor: 1250 },
  { protocolo: "2025082602", placa: "RZW5D99", cpf: "71184497419", nome: "FRANCISCO EUGÊNIO DA SILVA MOREIRA", fim: "11/09/2025", valor: 536 },
  { protocolo: "2025082603", placa: "SOY5D16", cpf: "70695379488", nome: "ISAIAS RODRIGUES COELHO", fim: "30/07/2026", valor: 9707.14 },
  { protocolo: "2025082801", placa: "SOU5C59", cpf: "00175015554", nome: "ALOISIO DE SENA SILVA JUNIOR", fim: "16/01/2026", valor: 5035.71 },
  { protocolo: "2025082802", placa: "SOQ3B79", cpf: "09205057401", nome: "JOAO HENRIQUE MARINHO FERNANDES", fim: "02/04/2026", valor: 7830 },
  { protocolo: "2025082901", placa: "SOX2B74", cpf: "47498480425", nome: "SEVERINO DE SOUZA RAMOS FILHO", fim: "05/09/2025", valor: 250 },
  { protocolo: "2025083003", placa: "QYP3E99", cpf: "06283637450", nome: "TIAGO ALVES PEREIRA", fim: "01/09/2025", valor: 78 },
  { protocolo: "2025090101", placa: "SOY4I50", cpf: "08722107401", nome: "MOISES OLIVEIRA DE SOUZA", fim: "16/09/2025", valor: 500 },
  { protocolo: "2025090102", placa: "SOX2A94", cpf: "71317277414", nome: "THIAGO COSTA DO NASCIMENTO SILVA", fim: "08/09/2025", valor: 250 },
  { protocolo: "2025090201", placa: "SOU5A29", cpf: "09196904402", nome: "GABRIEL MAIA E SILVA", fim: "28/10/2025", valor: 1700 },
  { protocolo: "2025090202", placa: "SOX2A44", cpf: "09329398480", nome: "JARLITON RAUYR NOGUEIRA FERREIRA", fim: "13/07/2026", valor: 11777.15 },
  { protocolo: "2025090203", placa: "SOX2B14", cpf: "70918887402", nome: "KYWAN CAVALCANTI DAMASCENO", fim: "22/09/2025", valor: 500 },
  { protocolo: "2025090204", placa: "SOW0D02", cpf: "05649094403", nome: "NELZITO DE SOUSA BETRÃO", fim: "27/09/2025", valor: 964.29 },
  { protocolo: "2025090301", placa: "SOX2B04", cpf: "01395489203", nome: "MÁRCIO ARNOUR DE ASSIS", fim: "02/10/2025", valor: 1036 },
  { protocolo: "2025090601", placa: "SOY2A84", cpf: "01430894474", nome: "EDNALDO DE ALMEIDA RIBEIRO", fim: "23/10/2025", valor: 1490 },
  { protocolo: "2025090602", placa: "SOX2B74", cpf: "02964136580", nome: "GLEISON PASSOS BORGES", fim: "13/09/2025", valor: 250 },
  { protocolo: "2025090603", placa: "SOY2B04", cpf: "04308783461", nome: "ROGERIO PORFIRIO DOS SANTOS", fim: "16/09/2025", valor: 500 },
  { protocolo: "2025090801", placa: "SOZ5C50", cpf: "12142358403", nome: "EMANUEL VITOR MENDES ANGELIM", fim: "12/01/2026", valor: 4590 },
  { protocolo: "2025090802", placa: "SOZ5C60", cpf: "10914326430", nome: "JONATA SILVA XAVIER", fim: "29/09/2025", valor: 810 },
  { protocolo: "2025090803", placa: "SOX6I83", cpf: "03657704426", nome: "ROMILDO FERREIRA DO NASCIMENTO", fim: "10/03/2026", valor: 7540 },
  { protocolo: "2025090804", placa: "SOU5E29", cpf: "02812174404", nome: "RONALDO RIBEIRO E SILVA", fim: "22/09/2025", valor: 500 },
  { protocolo: "2025090901", placa: "SOX2A94", cpf: "07049503401", nome: "MAX DE SOUZA AMARIZ", fim: "12/09/2025", valor: 250 },
  { protocolo: "2025091202", placa: "RZW5D99", cpf: "07049503401", nome: "MAX DE SOUZA AMARIZ", fim: "04/05/2026", valor: 9300 },
  { protocolo: "2025091601", placa: "SPA9H12", cpf: "04308783461", nome: "ROGERIO PORFIRIO DOS SANTOS", fim: "15/05/2026", valor: 7940 },
  { protocolo: "2025091701", placa: "SOY4I50", cpf: "09673982740", nome: "JOSÉ FRANCISCO JÚNIOR", fim: "22/12/2025", valor: 3440.86 },
  { protocolo: "2025091801", placa: "PCK8G70", cpf: "06865266439", nome: "DOUGLAS BARBOSA ANGELIM", fim: "06/11/2025", valor: 1750 },
  { protocolo: "2025091902", placa: "SPA9G12", cpf: "85982948535", nome: "LUIS CARLOS DOS SANTOS SILVA", fim: "10/02/2026", valor: 6280 },
  { protocolo: "2025092201", placa: "SPA3B44", cpf: "02812174404", nome: "RONALDO RIBEIRO E SILVA", fim: "22/01/2026", valor: 4357.14 },
];

function digits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function ncNorm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function plateNorm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function roundCents(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100 + Number.EPSILON) / 100 : NaN;
}

function dataBrNorm(s) {
  const m = String(s || "")
    .trim()
    .match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
}

function protocoloLancamentoMarcio(index) {
  const ss = String(index % 60).padStart(2, "0");
  const mm = String(Math.floor(index / 60)).padStart(2, "0");
  return `2026083118${mm}${ss}-030`;
}

function createdAtUnico(index) {
  return Date.UTC(2026, 7, 31, 21, 0, index);
}

function isLancUnico3108(lan, valor) {
  if (!lan || typeof lan !== "object") return false;
  if (dataBrNorm(lan.data) !== DATA_UNICO) return false;
  if (roundCents(lan.valor) !== roundCents(valor)) return false;
  const cpf = digits(lan.registradoPorCpf).slice(0, 11);
  return lan.fonteAzul === true || cpf === CPF_MARCIO;
}

function stampResumo(loc) {
  const arr = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
  const visiveis = filtrarPortalLancamentosPorRemovidos(arr, loc.portalLancamentosAluguelRemovidos);
  const sum = visiveis.reduce((s, x) => s + Number(x.valor || 0), 0);
  loc.totalPagoAno2025 = sum.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!visiveis.length) {
    loc.ultimoLancamentoAluguelData = "";
    loc.ultimoLancamentoAluguelValor = "";
    return loc;
  }
  const last = visiveis.reduce(
    (a, b) => (Number(b.createdAt || 0) >= Number(a.createdAt || 0) ? b : a),
    visiveis[0]
  );
  loc.ultimoLancamentoAluguelData = String(last.data || "").trim();
  loc.ultimoLancamentoAluguelValor =
    "R$\u00a0" +
    Number(last.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return loc;
}

function applyLancamentosUnicos3108(locacoes, nowMs = Date.now()) {
  const list = Array.isArray(locacoes) ? locacoes.map((l) => ({ ...l })) : [];
  const byNc = new Map();
  for (const loc of list) {
    const k = ncNorm(loc.numeroContrato);
    if (k) byNc.set(k, loc);
  }
  const report = [];
  const outgoing = [];

  ROWS.forEach((row, index) => {
    const loc = byNc.get(row.protocolo);
    const item = { protocolo: row.protocolo, valor: row.valor, ok: false, action: "missing" };
    if (!loc) {
      report.push(item);
      return;
    }
    const cpfOk = digits(loc.cpf).slice(0, 11) === row.cpf;
    const placaOk = plateNorm(loc.placa) === row.placa;
    if (!cpfOk || !placaOk) {
      item.action = "mismatch";
      item.cpf = digits(loc.cpf);
      item.placa = loc.placa;
      report.push(item);
      return;
    }

    const prev = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel.slice() : [];
    const existingUnico = prev.find((lan) => isLancUnico3108(lan, row.valor));
    const unico = existingUnico
      ? {
          ...existingUnico,
          data: DATA_UNICO,
          valor: row.valor,
          fonteAzul: true,
          registradoPorCpf: CPF_MARCIO,
          registradoPorNome: NOME_MARCIO,
          comentarioPagamento: String(existingUnico.comentarioPagamento || COMENTARIO).trim() || COMENTARIO,
        }
      : {
          data: DATA_UNICO,
          valor: row.valor,
          createdAt: createdAtUnico(index),
          registradoPorCpf: CPF_MARCIO,
          registradoPorNome: NOME_MARCIO,
          protocoloLancamento: protocoloLancamentoMarcio(index),
          fonteAzul: true,
          comentarioPagamento: COMENTARIO,
        };

    const toRemove = prev.filter((lan) => !isLancUnico3108(lan, row.valor));
    const tombs = toRemove.map((lan) => ({
      protocoloLancamento: String(lan.protocoloLancamento || lan.protocolo || "").trim(),
      data: String(lan.data || "").trim(),
      valor: Number(lan.valor),
      createdAt: Number(lan.createdAt || 0),
      registradoPorCpf: digits(lan.registradoPorCpf).slice(0, 11),
      removedAt: nowMs,
    }));

    loc.portalLancamentosAluguel = [unico];
    loc.portalLancamentosAluguelRemovidos = mergePortalLancamentosRemovidos([
      loc.portalLancamentosAluguelRemovidos,
      tombs,
    ]);
    loc.origemPortal = true;
    loc.cadastroRetroativo = true;
    loc.updatedAt = nowMs;
    stampResumo(loc);

    item.ok = true;
    item.action = existingUnico ? "kept" : "added";
    item.tombstones = tombs.length;
    item.protocoloLancamento = unico.protocoloLancamento;
    report.push(item);
    outgoing.push(loc);
  });

  return { locacoes: list, outgoing, report };
}

function somaValoresPlanilha() {
  return ROWS.reduce((s, r) => s + Number(r.valor || 0), 0);
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

async function readLocacoesApi() {
  const res = await fetch(`${LOCACOES_API}?n=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "GET cadastro-locacoes falhou");
  return Array.isArray(data.data) ? data.data : [];
}

async function postLocacoesApi(arr) {
  const res = await fetch(LOCACOES_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: arr }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || "POST cadastro-locacoes falhou");
  return data;
}

async function readSnapshot() {
  try {
    const rows = await supabaseFetch(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=payload,updated_at`
    );
    if (rows[0]?.payload) return { payload: rows[0].payload, source: "supabase", updated_at: rows[0].updated_at };
  } catch (e) {
    console.warn("Supabase:", e.message || e);
  }
  const res = await fetch(`${REDIS_SNAPSHOT_URL}?n=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  if (!data?.payload) throw new Error("Snapshot indisponível");
  return { payload: data.payload, source: "redis", updated_at: data.updated_at };
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

function verifyLocacoes(arr) {
  const byNc = new Map();
  for (const loc of arr || []) {
    const k = ncNorm(loc.numeroContrato);
    if (k) byNc.set(k, loc);
  }
  return ROWS.map((row) => {
    const loc = byNc.get(row.protocolo);
    if (!loc) return { protocolo: row.protocolo, ok: false, reason: "missing" };
    const visiveis = filtrarPortalLancamentosPorRemovidos(
      loc.portalLancamentosAluguel,
      loc.portalLancamentosAluguelRemovidos
    );
    const unicos = visiveis.filter((lan) => isLancUnico3108(lan, row.valor));
    const outros = visiveis.filter((lan) => !isLancUnico3108(lan, row.valor));
    const ok =
      unicos.length === 1 &&
      outros.length === 0 &&
      digits(loc.cpf).slice(0, 11) === row.cpf &&
      plateNorm(loc.placa) === row.placa &&
      unicos[0].fonteAzul === true &&
      digits(unicos[0].registradoPorCpf) === CPF_MARCIO;
    return {
      protocolo: row.protocolo,
      ok,
      unicos: unicos.length,
      outros: outros.length,
      valor: unicos[0]?.valor,
      fonteAzul: unicos[0]?.fonteAzul,
      operador: unicos[0]?.registradoPorNome,
    };
  });
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const apiLocs = await readLocacoesApi();
  const { payload, source } = await readSnapshot();
  if (!Array.isArray(payload.dk_locacoes_cadastro)) payload.dk_locacoes_cadastro = [];
  const merged = mergeLocacoesCadastro(payload.dk_locacoes_cadastro, apiLocs);
  const applied = applyLancamentosUnicos3108(merged);
  const fails = applied.report.filter((r) => !r.ok);

  console.log("Fonte:", source);
  console.log("Planilha:", ROWS.length, "protocolos · total pago R$", somaValoresPlanilha().toFixed(2));
  console.log("Aplicação:", applied.report);
  if (fails.length) {
    console.error("Falhas:", fails);
    process.exit(1);
  }
  if (dry) {
    console.log("Dry-run: nada gravado.");
    return;
  }

  await postLocacoesApi(applied.outgoing);

  const snapMerged = mergeLocacoesCadastro(payload.dk_locacoes_cadastro, applied.outgoing);
  payload.dk_locacoes_cadastro = snapMerged;
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

  const verifyApi = verifyLocacoes(await readLocacoesApi());
  const verifySnap = await fetch(`${REDIS_SNAPSHOT_URL}?n=${Date.now()}`).then((r) => r.json());
  const verifySnapRows = verifyLocacoes(verifySnap.payload?.dk_locacoes_cadastro || []);
  const apiOk = verifyApi.every((x) => x.ok);
  const snapOk = verifySnapRows.every((x) => x.ok);

  console.log("Gravado Supabase:", supaOk ? "sim" : "não");
  console.log("Gravado Redis: sim");
  console.log("Verificação API:", apiOk ? "OK" : verifyApi.filter((x) => !x.ok));
  console.log("Verificação snapshot:", snapOk ? "OK" : verifySnapRows.filter((x) => !x.ok));
  if (!apiOk || !snapOk) process.exit(1);
}

module.exports = {
  ROWS,
  CPF_MARCIO,
  NOME_MARCIO,
  DATA_UNICO,
  applyLancamentosUnicos3108,
  isLancUnico3108,
  somaValoresPlanilha,
  verifyLocacoes,
  protocoloLancamentoMarcio,
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
