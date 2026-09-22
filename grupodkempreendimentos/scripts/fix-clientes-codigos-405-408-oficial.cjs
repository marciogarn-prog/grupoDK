/**
 * Corrige códigos 0405–0408 conforme consulta DK LOCADORA (espelho de tela).
 * 405=Anderson, 406=Luzinaldo, 407=Alexandre, 408=Maria Edjane.
 * Grava em pedidos pequenos (merge por CPF / protocolo) para evitar HTTP 413.
 *
 * node grupodkempreendimentos/scripts/fix-clientes-codigos-405-408-oficial.cjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const BASE = "https://grupodkempreendimentos.com.br/";
const SNAP_URL = BASE + "api/dk-cloud-snapshot";
const SENHA = process.env.DK_OWNER_SENHA || "110499@Gb";

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function padCod(s) {
  const d = onlyDigits(s);
  return d ? d.padStart(4, "0").slice(-4) : "";
}

function nomeKey(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Fonte: CONSULTA DE STATUS DE CLIENTE / VEÍCULO (espelho de tela). */
const CORRECOES = [
  {
    codigo: "0405",
    cpf: "05843781577",
    nome: "ANDERSON NASCIMENTO SANTOS",
    dataCadastro: "15/09/2026",
    celular: "(87) 98869-7783",
    recado1: "(87) 98802-1203",
    recado2: "(87) 99174-4929",
    cnh: "5963825150",
    categoria: "AB",
    ear: "SIM",
    vencimento: "02/04/2034",
    cep: "56317-478",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA PAVOA, 24 - PEDRA LINDA",
  },
  {
    codigo: "0406",
    cpf: "99742500568",
    nome: "LUZINALDO BISPO DE FRANÇA",
    dataCadastro: "16/09/2026",
    celular: "(67) 98161-1656",
    recado1: "(74) 98156-4486",
    recado2: "(74) 99100-4618",
    cnh: "7066794754",
    categoria: "AB",
    ear: "SIM",
    vencimento: "28/07/2032",
    cep: "48900-150",
    municipioUf: "JUAZEIRO/BA",
    endereco: "LOTEAMENTO NOVO HORIZONTE - AV. GIUSEPPE MUCCINI, 04 - APTO 04 - QD B - LT 01",
  },
  {
    codigo: "0407",
    cpf: "12713772419",
    nome: "ALEXANDRE FERREIRA MOTA",
    dataCadastro: "19/09/2026",
    celular: "(87) 98101-6561",
    recado1: "(87) 99664-1002",
    recado2: "(87) 98147-3660",
    cnh: "7282890559",
    categoria: "A",
    ear: "NÃO",
    vencimento: "19/06/2034",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA SETE, 120 - VILA MARCELA",
  },
  {
    codigo: "0408",
    cpf: "05544133450",
    nome: "MARIA EDJANE DE OLIVEIRA MELO",
    dataCadastro: "19/09/2026",
    celular: "(87) 98813-1395",
    recado1: "(87) 98863-0915",
    recado2: "(87) 99174-0193",
    cnh: "8883378900",
    categoria: "AB",
    ear: "NÃO",
    vencimento: "30/04/2034",
    cep: "56300-000",
    municipioUf: "PETROLINA/PE",
    endereco: "RUA DEZ, 138 - QD I - LT 17 - CACHEADO",
  },
];

const byCpf = new Map(CORRECOES.map((r) => [r.cpf, r]));
const byNome = new Map(CORRECOES.map((r) => [nomeKey(r.nome), r]));

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

async function portalAuth() {
  const auth = await fetch(BASE + "api/dk-portal-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo: "equipa",
      cpf: "03037897430",
      senha: SENHA,
      confirmarUnico: true,
      deviceId: "dk-fix-cli-405-408",
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

function resolveCorrecao(row) {
  const cpf = onlyDigits(row?.cpf).slice(0, 11);
  if (byCpf.has(cpf)) return byCpf.get(cpf);
  const nk = nomeKey(row?.nome);
  if (byNome.has(nk)) return byNome.get(nk);
  if (nk.includes("LUZINALDO") && nk.includes("FRANCA")) return byNome.get(nomeKey("LUZINALDO BISPO DE FRANÇA"));
  if (nk.includes("ANDERSON NASCIMENTO")) return byNome.get(nomeKey("ANDERSON NASCIMENTO SANTOS"));
  if (nk.includes("ALEXANDRE FERREIRA MOTA")) return byNome.get(nomeKey("ALEXANDRE FERREIRA MOTA"));
  if (nk.includes("MARIA EDJANE")) return byNome.get(nomeKey("MARIA EDJANE DE OLIVEIRA MELO"));
  return null;
}

function applyClientePatch(row, bumpTs) {
  const fix = resolveCorrecao(row);
  if (!fix) return null;
  return {
    ...row,
    codigo: fix.codigo,
    cpf: fix.cpf,
    nome: fix.nome,
    dataCadastro: fix.dataCadastro,
    celular: fix.celular,
    recado1: fix.recado1,
    recado2: fix.recado2,
    cnh: fix.cnh,
    categoria: fix.categoria,
    ear: fix.ear,
    vencimento: fix.vencimento,
    cep: fix.cep,
    municipioUf: fix.municipioUf,
    endereco: fix.endereco,
    createdAt: bumpTs,
    updatedAt: bumpTs,
    id: Number(row.id) || bumpTs,
  };
}

function assertFinal(clientes) {
  const errors = [];
  for (const fix of CORRECOES) {
    const c = clientes.find((x) => onlyDigits(x.cpf) === fix.cpf);
    if (!c) {
      errors.push(`Falta CPF ${fix.cpf}`);
      continue;
    }
    if (padCod(c.codigo) !== fix.codigo) errors.push(`${fix.nome}: código ${padCod(c.codigo)} ≠ ${fix.codigo}`);
    if (nomeKey(c.nome) !== nomeKey(fix.nome)) errors.push(`${fix.codigo} nome "${c.nome}"`);
  }
  const c409 = clientes.find((c) => padCod(c.codigo) === "0409");
  if (c409 && nomeKey(c409.nome).includes("MARIA EDJANE")) errors.push("0409 ainda é Maria Edjane");
  const c405 = clientes.find((c) => padCod(c.codigo) === "0405");
  if (c405 && !nomeKey(c405.nome).includes("ANDERSON")) errors.push("0405 não é Anderson");
  const c406 = clientes.find((c) => padCod(c.codigo) === "0406");
  if (!c406) errors.push("0406 ausente");
  else if (!nomeKey(c406.nome).includes("LUZINALDO")) errors.push("0406 não é Luzinaldo");
  return errors;
}

async function postPartial(headers, partialPayload) {
  const res = await fetch(SNAP_URL, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      payload: partialPayload,
      updated_at: new Date().toISOString(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok && data?.ok, data };
}

async function main() {
  const headers = await portalAuth();
  const bumpTs = Date.now() + 60_000;

  const snap = await fetch(SNAP_URL + "?nocache=" + Date.now(), { headers }).then((r) => r.json());
  const clientes = Array.isArray(snap?.payload?.dk_clientes_cadastro) ? snap.payload.dk_clientes_cadastro : [];
  const locacoes = Array.isArray(snap?.payload?.dk_locacoes_cadastro) ? snap.payload.dk_locacoes_cadastro : [];
  const portalCli = Array.isArray(snap?.payload?.dk_portal_clientes_cadastro)
    ? snap.payload.dk_portal_clientes_cadastro
    : [];

  const patchedClientes = [];
  const beforeAfter = [];
  for (const c of clientes) {
    const next = applyClientePatch(c, bumpTs);
    if (!next) continue;
    beforeAfter.push({
      before: { codigo: padCod(c.codigo), cpf: onlyDigits(c.cpf), nome: c.nome },
      after: { codigo: next.codigo, cpf: next.cpf, nome: next.nome },
    });
    patchedClientes.push(next);
  }
  if (patchedClientes.length !== 4) {
    console.error("Esperava 4 clientes; achei", patchedClientes.length, beforeAfter);
    process.exit(1);
  }

  const patchedPortal = [];
  for (const c of portalCli) {
    const next = applyClientePatch(c, bumpTs);
    if (next) patchedPortal.push(next);
  }

  const patchedLocs = [];
  for (const l of locacoes) {
    const fix = resolveCorrecao(l);
    if (!fix) continue;
    patchedLocs.push({
      ...l,
      cpf: fix.cpf,
      nome: fix.nome,
      clienteCodigo: fix.codigo,
      updatedAt: bumpTs,
      createdAt: Number(l.createdAt) || bumpTs,
    });
  }

  console.log("Clientes a corrigir:", beforeAfter);
  console.log(
    "Locações a corrigir:",
    patchedLocs.map((l) => ({
      p: l.numeroContrato,
      codigo: l.clienteCodigo,
      cpf: onlyDigits(l.cpf),
    }))
  );

  const r1 = await postPartial(headers, {
    dk_clientes_cadastro: patchedClientes,
    dk_cadastro_manual_portal_v1: true,
  });
  console.log("POST clientes:", r1.status, r1.ok ? "ok" : r1.data);

  if (patchedPortal.length) {
    const r1b = await postPartial(headers, { dk_portal_clientes_cadastro: patchedPortal });
    console.log("POST portal_clientes:", r1b.status, r1b.ok ? "ok" : r1b.data);
  }

  for (const loc of patchedLocs) {
    const slim = {
      id: loc.id,
      createdAt: loc.createdAt,
      updatedAt: loc.updatedAt,
      cpf: loc.cpf,
      nome: loc.nome,
      placa: loc.placa,
      numeroContrato: loc.numeroContrato,
      clienteCodigo: loc.clienteCodigo,
      inicio: loc.inicio,
      fim: loc.fim || "",
      statusLocacao: loc.statusLocacao || "ATIVO",
      plano: loc.plano,
      valorLocacao: loc.valorLocacao,
      valorInvestimento: loc.valorInvestimento,
      valorSemanal: loc.valorSemanal,
      modalidade: loc.modalidade,
      origemPortal: true,
      portalLancamentosAluguel: Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [],
    };
    const r2 = await postPartial(headers, { dk_locacoes_cadastro: [slim] });
    console.log("POST locação", loc.numeroContrato, r2.status, r2.ok ? "ok" : r2.data);
    if (!r2.ok) process.exit(1);
  }

  if (!r1.ok) process.exit(1);

  try {
    const rows = await supabaseFetch(
      `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=payload`
    );
    const payload = rows[0]?.payload;
    if (payload && Array.isArray(payload.dk_clientes_cadastro)) {
      const mapCpf = new Map(patchedClientes.map((c) => [onlyDigits(c.cpf), c]));
      payload.dk_clientes_cadastro = payload.dk_clientes_cadastro.map((c) => {
        const p = mapCpf.get(onlyDigits(c.cpf));
        return p ? { ...c, ...p } : c;
      });
      if (Array.isArray(payload.dk_locacoes_cadastro)) {
        const mapNc = new Map(patchedLocs.map((l) => [String(l.numeroContrato), l]));
        payload.dk_locacoes_cadastro = payload.dk_locacoes_cadastro.map((l) => {
          const p = mapNc.get(String(l.numeroContrato));
          return p
            ? { ...l, clienteCodigo: p.clienteCodigo, cpf: p.cpf, nome: p.nome, updatedAt: p.updatedAt }
            : l;
        });
      }
      await supabaseFetch(`dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ payload, updated_at: new Date().toISOString() }),
      });
      console.log("Supabase: ok");
    }
  } catch (e) {
    console.warn("Supabase (ignorado):", e.message || e);
  }

  const verify = await fetch(SNAP_URL + "?nocache=" + Date.now(), { headers }).then((r) => r.json());
  const vCli = verify?.payload?.dk_clientes_cadastro || [];
  const vLoc = verify?.payload?.dk_locacoes_cadastro || [];
  const postErrors = assertFinal(vCli);
  const map = {};
  for (const fix of CORRECOES) {
    const c = vCli.find((x) => onlyDigits(x.cpf) === fix.cpf);
    map[fix.codigo] = c ? `${padCod(c.codigo)} | ${c.nome} | ${onlyDigits(c.cpf)}` : "AUSENTE";
  }
  console.log("Verificação:", map);
  console.log(
    "Locações:",
    vLoc
      .filter((l) => byCpf.has(onlyDigits(l.cpf)))
      .map((l) => `${l.numeroContrato} codigo=${padCod(l.clienteCodigo)}`)
  );
  if (postErrors.length) {
    console.error("ERRO pós-gravação:", postErrors);
    process.exit(1);
  }
  console.log("OK — códigos 0405–0408 alinhados à consulta.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
