/**
 * Demo: mantém só 10 clientes, 10 veículos e 10 protocolos activos (imagem Locados).
 * node grupodkempreendimentos/scripts/set-demo-cadastro-10-protocolos.mjs --confirm
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const REDIS_DEMO_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot?channel=demo";

/** Protocolos da imagem (Locados activos). */
const PROTOCOLOS_ALVO = [
  { numeroContrato: "2026031302", cpf: "06843309461", placa: "UHQ1B38", nome: "MARAGONE RIBEIRO DOS SANTOS", plano: "minha-moto", inicio: "13/03/2026" },
  { numeroContrato: "2026031303", cpf: "09505434464", placa: "UHQ1B08", nome: "JOSÉ ANTÔNIO NAZARO DOS SANTOS", plano: "minha-moto", inicio: "13/03/2026" },
  { numeroContrato: "2026031304", cpf: "11512850489", placa: "SOR1I03", nome: "TIAGO RAFAEL DE SOUZA FERREIRA", plano: "minha-moto", inicio: "13/03/2026" },
  { numeroContrato: "2026031305", cpf: "07534147409", placa: "SOU2I56", nome: "", plano: "meu-transporte", inicio: "13/03/2026" },
  { numeroContrato: "2026031601", cpf: "05705186444", placa: "UHQ1C68", nome: "ERISVALDO NASCIMENTO SILVA", plano: "minha-moto", inicio: "16/03/2026" },
  { numeroContrato: "2026031602", cpf: "03793589307", placa: "UHR0G21", nome: "FELLYPE ALISSONN BATISTA DE SOUSA COSTA", plano: "minha-moto", inicio: "16/03/2026" },
  { numeroContrato: "2026031701", cpf: "07795468497", placa: "UHQ8D58", nome: "BEIQUISON PEREIRA ALVES", plano: "minha-moto", inicio: "17/03/2026" },
  { numeroContrato: "2026031702", cpf: "07771412564", placa: "UHQ1E58", nome: "GABRIEL LEAL AMORIM", plano: "minha-moto", inicio: "17/03/2026" },
  { numeroContrato: "2026031703", cpf: "08350435410", placa: "UHR0E91", nome: "MARCOS VINICIUS DE SOUZA", plano: "minha-moto", inicio: "17/03/2026" },
  { numeroContrato: "2026031704", cpf: "70274179440", placa: "UHQ8G38", nome: "ERICK SANTOS DO NASCIMENTO", plano: "minha-moto", inicio: "17/03/2026" },
];

const MODELOS = {
  UHQ1B38: "CG 160 START",
  UHQ1B08: "CG 160 START",
  SOR1I03: "CG 160 TITAN",
  SOU2I56: "XY 150-5 JEF S EFI",
  UHQ1C68: "CG 160 START",
  UHR0G21: "CG 160 START",
  UHQ8D58: "CG 160 START",
  UHQ1E58: "CG 160 START",
  UHR0E91: "CG 160 START",
  UHQ8G38: "CG 160 START",
};

const nc = (v) => String(v || "").replace(/\D/g, "");
const nk = (v) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const dig = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);

const PLANO_LABEL = {
  "minha-moto": "DK MINHA MOTO",
  "meu-transporte": "DK MEU TRANSPORTE",
  carros: "PLANO CARRO",
};

function counts(p) {
  const locs = p.dk_locacoes_cadastro || [];
  const ativas = locs.filter((l) => {
    const fim = String(l.fim || l.dataFim || "").trim();
    return !fim || fim === "...";
  });
  return {
    clientes: (p.dk_clientes_cadastro || []).length,
    veiculos: (p.dk_veiculos_cadastro || []).length,
    locacoes: locs.length,
    locacoesAtivas: ativas.length,
    lancamentos: (p.dk_lancamentos_aluguel || []).length,
  };
}

async function supabaseFetch(pathSuffix, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathSuffix}`, {
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

async function upsertSupabaseLabel(label, payload) {
  const updatedAt = new Date().toISOString();
  const rows = await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(label)}&select=label`);
  if (rows.length) {
    await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(label)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload, updated_at: updatedAt }),
    });
  } else {
    await supabaseFetch("dk_cloud_snapshots", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ label, payload, updated_at: updatedAt }),
    });
  }
  return updatedAt;
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Resposta inválida (${url}): ${text.slice(0, 80)}`);
  }
  if (!res.ok) throw new Error(data?.error || data?.reason || `HTTP ${res.status} (${url})`);
  return data;
}

async function postRedis(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.reason || `Redis POST falhou (${url})`);
  return data;
}

function pickCliente(clientes, cpfAlvo, fallbackNome) {
  const cpf = dig(cpfAlvo);
  const found = clientes.find((c) => dig(c.cpf) === cpf);
  if (found) {
    return {
      ...found,
      cpf,
      nome: String(found.nome || fallbackNome || "").trim() || fallbackNome || found.nome,
      status: "ATIVO",
      updatedAt: Date.now(),
    };
  }
  return {
    cpf,
    nome: fallbackNome || "Cliente demo",
    codigo: cpf.slice(-4),
    dataCadastro: "23/08/2026",
    status: "ATIVO",
    origemPortal: true,
    id: Date.now() + Math.floor(Math.random() * 1000),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function pickVeiculo(veiculos, placaAlvo, modeloFallback) {
  const placa = nk(placaAlvo);
  const found = veiculos.find((v) => nk(v.placa) === placa);
  if (found) {
    return {
      ...found,
      placa,
      status: "DISPONIVEL",
      updatedAt: Date.now(),
    };
  }
  const isMoto = placa !== "SOU2I56";
  return {
    placa,
    tipo: isMoto ? "MOTO" : "MOTO",
    marca: isMoto ? "HONDA" : "SHINERAY",
    modelo: modeloFallback || "CG 160 START",
    status: "DISPONIVEL",
    origemPortal: true,
    id: Date.now() + Math.floor(Math.random() * 1000),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function pickLocacao(locs, alvo, cliente, veiculo) {
  const pr = nc(alvo.numeroContrato);
  const found = locs.find((l) => nc(l.numeroContrato) === pr);
  const planoLabel = PLANO_LABEL[alvo.plano] || PLANO_LABEL["minha-moto"];
  const base = found ? { ...found } : {};
  return {
    ...base,
    numeroContrato: alvo.numeroContrato,
    cpf: dig(alvo.cpf),
    placa: nk(alvo.placa),
    nome: String(cliente.nome || alvo.nome || "").trim(),
    inicio: base.inicio || alvo.inicio,
    fim: "",
    dataFim: "",
    statusLocacao: "ATIVO",
    plano: planoLabel,
    marcaModelo: veiculo.modelo || MODELOS[nk(alvo.placa)] || "",
    clienteCodigo: cliente.codigo || "",
    portalLancamentosAluguel: Array.isArray(base.portalLancamentosAluguel) ? base.portalLancamentosAluguel : [],
    id: base.id || Date.now() + Math.floor(Math.random() * 10000),
    createdAt: base.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

function buildDemo10Payload(demoBase) {
  const allClientes = demoBase.dk_clientes_cadastro || [];
  const allVeiculos = demoBase.dk_veiculos_cadastro || [];
  const allLocs = demoBase.dk_locacoes_cadastro || [];

  const clientes = [];
  const veiculos = [];
  const locacoes = [];
  const cpfSet = new Set();
  const placaSet = new Set();

  for (const alvo of PROTOCOLOS_ALVO) {
    const cpf = dig(alvo.cpf);
    const placa = nk(alvo.placa);
    if (!cpfSet.has(cpf)) {
      cpfSet.add(cpf);
      clientes.push(pickCliente(allClientes, cpf, alvo.nome));
    }
    if (!placaSet.has(placa)) {
      placaSet.add(placa);
      veiculos.push(pickVeiculo(allVeiculos, placa, MODELOS[placa]));
    }
    const cliente = clientes.find((c) => dig(c.cpf) === cpf);
    const veiculo = veiculos.find((v) => nk(v.placa) === placa);
    locacoes.push(pickLocacao(allLocs, alvo, cliente, veiculo));
  }

  clientes.sort((a, b) => dig(a.cpf).localeCompare(dig(b.cpf)));
  veiculos.sort((a, b) => nk(a.placa).localeCompare(nk(b.placa)));
  locacoes.sort((a, b) => nc(a.numeroContrato).localeCompare(nc(b.numeroContrato)));

  const demoPayload = {
    ...demoBase,
    dk_clientes_cadastro: clientes,
    dk_veiculos_cadastro: veiculos,
    dk_portal_clientes_cadastro: [],
    dk_portal_veiculos_cadastro: [],
    dk_veiculos_frota_planilha: veiculos,
    dk_locacoes_cadastro: locacoes,
    dk_lancamentos_aluguel: [],
    dk_lancamentos_aluguel_cadastro: [],
    dk_clientes_validacao_pendente: [],
    dk_locacoes_quadro_geral: [],
    dk_manutencoes_cadastro: [],
    dk_portal_checklist_historico_v1: [],
    dk_portal_checklist_movimentacoes_v1: [],
    dk_quadro_receita_overrides: [],
    dk_comprovantes_banco: {},
    dk_comprovantes_cliente_pendentes: [],
    dk_cliente_notificacoes: [],
    dk_comunicacao_operacao_v1: [],
    dk_locacao_documentos_v1: [],
    dk_documentos_deposito_v1: { crlv: [], contrato: [], multa: [] },
    dk_audit_log: [],
    dk_patrimonio_fotos_excluidas_v1: [],
    dk_patrimonio_crlv_v1: {},
    dk_financeiro_extratos_v1: {},
    dk_cadastro_manual_portal_v1: true,
    dk_cadastro_lock_v1: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    dk_demo_cadastro_10_v1: new Date().toISOString(),
  };
  delete demoPayload.dk_demo_full_cadastro_v1;
  return { demoPayload, clientes, veiculos, locacoes };
}

function verifyPayload(payload) {
  const c = counts(payload);
  const errors = [];
  if (c.clientes !== 10) errors.push(`clientes=${c.clientes} (esperado 10)`);
  if (c.veiculos !== 10) errors.push(`veiculos=${c.veiculos} (esperado 10)`);
  if (c.locacoes !== 10) errors.push(`locacoes=${c.locacoes} (esperado 10)`);
  if (c.locacoesAtivas !== 10) errors.push(`locacoesAtivas=${c.locacoesAtivas} (esperado 10)`);

  const locs = payload.dk_locacoes_cadastro || [];
  for (const alvo of PROTOCOLOS_ALVO) {
    const pr = nc(alvo.numeroContrato);
    const loc = locs.find((l) => nc(l.numeroContrato) === pr);
    if (!loc) errors.push(`protocolo ${alvo.numeroContrato} em falta`);
    else {
      const fim = String(loc.fim || loc.dataFim || "").trim();
      if (fim && fim !== "...") errors.push(`protocolo ${alvo.numeroContrato} não activo (fim=${fim})`);
      if (nk(loc.placa) !== nk(alvo.placa)) errors.push(`protocolo ${alvo.numeroContrato} placa errada`);
      if (dig(loc.cpf) !== dig(alvo.cpf)) errors.push(`protocolo ${alvo.numeroContrato} cpf errado`);
    }
  }

  const cpfs = new Set((payload.dk_clientes_cadastro || []).map((x) => dig(x.cpf)));
  const placas = new Set((payload.dk_veiculos_cadastro || []).map((x) => nk(x.placa)));
  for (const alvo of PROTOCOLOS_ALVO) {
    if (!cpfs.has(dig(alvo.cpf))) errors.push(`cliente CPF ${alvo.cpf} em falta`);
    if (!placas.has(nk(alvo.placa))) errors.push(`veículo ${alvo.placa} em falta`);
  }

  return { ok: errors.length === 0, counts: c, errors };
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.log(`
Demo — reduz cadastros para exactamente 10 clientes, 10 veículos e 10 protocolos activos.

Protocolos:
${PROTOCOLOS_ALVO.map((p) => `  • ${p.numeroContrato} — ${p.placa} — ${p.nome || "(sem nome)"}`).join("\n")}

Execute:
  node grupodkempreendimentos/scripts/set-demo-cadastro-10-protocolos.mjs --confirm
`);
    process.exit(1);
  }

  console.log("A ler demo na nuvem…");
  const demoRes = await fetchJson(REDIS_DEMO_URL);
  const demoBase = demoRes?.payload && typeof demoRes.payload === "object" ? demoRes.payload : {};
  const antes = counts(demoBase);
  console.log("Antes:", antes);

  const { demoPayload } = buildDemo10Payload(demoBase);
  const localVerify = verifyPayload(demoPayload);
  if (!localVerify.ok) {
    console.error("Verificação local falhou:", localVerify.errors.join("; "));
    process.exit(1);
  }
  console.log("Payload local OK:", localVerify.counts);

  const updatedAt = new Date().toISOString();
  let supaOk = false;
  try {
    await upsertSupabaseLabel("demo", demoPayload);
    supaOk = true;
    console.log("Supabase demo: OK");
  } catch (e) {
    console.warn("Supabase demo:", e.message || e);
  }

  await postRedis(REDIS_DEMO_URL, {
    payload: demoPayload,
    wipe_keys: [
      "dk_clientes_cadastro",
      "dk_clientes_validacao_pendente",
      "dk_portal_clientes_cadastro",
      "dk_veiculos_cadastro",
      "dk_portal_veiculos_cadastro",
      "dk_veiculos_frota_planilha",
      "dk_locacoes_cadastro",
      "dk_locacoes_quadro_geral",
      "dk_manutencoes_cadastro",
      "dk_portal_checklist_historico_v1",
      "dk_portal_checklist_movimentacoes_v1",
      "dk_lancamentos_aluguel",
      "dk_lancamentos_aluguel_cadastro",
      "dk_quadro_receita_overrides",
      "dk_comprovantes_banco",
      "dk_comprovantes_cliente_pendentes",
      "dk_cliente_notificacoes",
      "dk_comunicacao_operacao_v1",
      "dk_locacao_documentos_v1",
      "dk_documentos_deposito_v1",
      "dk_audit_log",
      "dk_patrimonio_fotos_excluidas_v1",
      "dk_patrimonio_crlv_v1",
      "dk_financeiro_extratos_v1",
    ],
    updated_at: updatedAt,
  });
  console.log("Redis demo: OK (wipe_keys)");

  const verifyRes = await fetchJson(REDIS_DEMO_URL);
  const depois = verifyPayload(verifyRes.payload || {});
  console.log("Depois:", depois.counts);

  if (!depois.ok) {
    console.error("Verificação na nuvem falhou:", depois.errors.join("; "));
    process.exit(1);
  }

  console.log("\nOK — demo com exactamente 10 clientes, 10 veículos e 10 protocolos activos.");
  console.log("Supabase:", supaOk ? "sincronizado" : "apenas Redis (verificar Supabase manualmente)");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
