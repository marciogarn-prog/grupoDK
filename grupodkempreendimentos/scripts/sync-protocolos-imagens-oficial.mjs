/**
 * Oficial: frota de protocolos = exactamente as 553 linhas das imagens da planilha.
 * Remove extras; acrescenta os 27 de Jul/Ago 2026 que faltavam na nuvem.
 *
 *   node grupodkempreendimentos/scripts/sync-protocolos-imagens-oficial.mjs
 *   node grupodkempreendimentos/scripts/sync-protocolos-imagens-oficial.mjs --confirm
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const REDIS_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const LABEL = "default";
const EXPECTED = 553;

const PLACA_ANTIGA_RE = /^[A-Z]{3}[0-9]{4}$/;
const PLACA_ANTIGA_PARA_MERCOSUL = "ABCDEFGHIJ";
const MERCOSUL_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function normalizePlate(p) {
  return String(p ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function placaParaCadastro(value) {
  const raw = normalizePlate(value);
  if (!raw) return "";
  if (MERCOSUL_RE.test(raw)) return raw;
  if (PLACA_ANTIGA_RE.test(raw)) {
    const letter = PLACA_ANTIGA_PARA_MERCOSUL[parseInt(raw[4], 10)];
    if (letter) {
      const conv = raw.slice(0, 4) + letter + raw.slice(5);
      if (MERCOSUL_RE.test(conv)) return conv;
    }
  }
  return raw;
}
function padCodigo(v) {
  const d = onlyDigits(v);
  if (!d) return String(v || "").trim();
  return d.padStart(Math.max(4, d.length), "0");
}
function moneyBr(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function statusLocacao(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (s.includes("CANCEL")) return "CT CANCELADO";
  if (s.includes("FINAL")) return "FINALIZADO";
  if (s.includes("ATIVO")) return "ATIVO";
  return s || "ATIVO";
}

function loadAllowedSet() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, "_planilha-protocolos-imagens.json"), "utf8")
  );
  const set = new Set(raw.map((p) => onlyDigits(p)).filter((p) => /^\d{10}$/.test(p)));
  /* OCR confusão: 2025122801 não existe; 2025122302 está nas imagens. */
  set.delete("2025122801");
  set.add("2025122302");
  return set;
}

function rowToLocacao(row, cli, idx, total) {
  const protocolo = onlyDigits(row.protocolo);
  const status = statusLocacao(row.status);
  const inicio = String(row.dataInicio || "").trim();
  let fim = String(row.dataFim || "").trim();
  if (status === "ATIVO") fim = "";
  const locacao = Number(row.locacao) || 0;
  const investimento = Number(row.investimento) || 0;
  const parcela = Number(row.valorParcela) || locacao + investimento;
  const opcao = String(row.opcaoContrato || "").trim();
  const now = Date.now() - (total - idx) * 1000;
  return {
    id: now,
    createdAt: now,
    updatedAt: Date.now(),
    origemPortal: true,
    cadastroRetroativo: true,
    cpf: onlyDigits(cli.cpf).slice(0, 11),
    nome: String(cli.nome || "").trim(),
    clienteCodigo: padCodigo(row.codigoCliente || cli.codigo),
    placa: placaParaCadastro(row.placa),
    inicio,
    fim,
    plano: opcao,
    opcaoContrato: opcao,
    marcaModelo: String(row.marcaModelo || "").trim(),
    periodoContrato: String(row.periodoContrato || "").trim(),
    kmInicial: onlyDigits(row.kmRetirada) ? String(Number(onlyDigits(row.kmRetirada))) : "",
    valorLocacao: moneyBr(locacao),
    valorInvestimento: moneyBr(investimento),
    valorParcela: moneyBr(parcela),
    valorSemanal: moneyBr(parcela),
    numeroContrato: protocolo,
    statusLocacao: status,
    ambiente: "real",
    portalLancamentosAluguel: [],
  };
}

async function main() {
  const allowed = loadAllowedSet();
  if (allowed.size !== EXPECTED) {
    console.error("Lista canónica esperava", EXPECTED, "obtido", allowed.size);
    process.exit(1);
  }
  const faltantes = JSON.parse(
    fs.readFileSync(path.join(__dirname, "_protocolos-faltantes-oficial.json"), "utf8")
  );
  if (faltantes.length !== 27) {
    console.error("Esperado 27 faltantes, obtido", faltantes.length);
    process.exit(1);
  }

  const redis = await fetch(`${REDIS_URL}?n=${Date.now()}`).then((r) => r.json());
  if (!redis?.ok || redis.label !== "default") throw new Error("snapshot oficial indisponível");
  const payload = { ...(redis.payload || {}) };
  const clientes = payload.dk_clientes_cadastro || [];
  const byCodigo = new Map();
  for (const c of clientes) {
    const cod = padCodigo(c.codigo);
    if (cod) byCodigo.set(cod, c);
  }

  const existing = Array.isArray(payload.dk_locacoes_cadastro) ? payload.dk_locacoes_cadastro : [];
  const byNc = new Map();
  for (const l of existing) {
    const nc = onlyDigits(l.numeroContrato || l.protocolo);
    if (!nc || !allowed.has(nc)) continue;
    byNc.set(nc, l);
  }
  const removed = existing.length - byNc.size;

  const missingCli = [];
  faltantes.forEach((row, idx) => {
    const nc = onlyDigits(row.protocolo);
    if (!allowed.has(nc)) return;
    if (byNc.has(nc)) return;
    const cli = byCodigo.get(padCodigo(row.codigoCliente));
    if (!cli) {
      missingCli.push({ nc, codigo: row.codigoCliente });
      return;
    }
    byNc.set(nc, rowToLocacao(row, cli, idx, faltantes.length));
  });
  if (missingCli.length) {
    console.error("Clientes em falta para novos protocolos:", missingCli);
    process.exit(1);
  }

  const finalList = [...byNc.values()].sort((a, b) =>
    onlyDigits(a.numeroContrato).localeCompare(onlyDigits(b.numeroContrato))
  );
  const finalNcs = new Set(finalList.map((l) => onlyDigits(l.numeroContrato)));
  const stillMissing = [...allowed].filter((n) => !finalNcs.has(n)).sort();
  const stillExtra = [...finalNcs].filter((n) => !allowed.has(n)).sort();

  console.log({
    allowed: allowed.size,
    before: existing.length,
    removed,
    added: faltantes.length,
    after: finalList.length,
    stillMissing,
    stillExtra,
  });

  if (finalList.length !== EXPECTED || stillMissing.length || stillExtra.length) {
    console.error("Contagem final não bate com as 553 imagens.");
    process.exit(1);
  }

  if (!process.argv.includes("--confirm")) {
    console.log("Dry-run OK. Grave com --confirm");
    return;
  }

  const incoming = {
    ...payload,
    dk_locacoes_cadastro: finalList,
    dk_oficial_sem_protocolos_v1: false,
  };
  const updated_at = new Date().toISOString();
  const post = await fetch(REDIS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload: incoming,
      updated_at,
      wipe_keys: ["dk_locacoes_cadastro"],
    }),
  }).then((r) => r.json());
  if (!post?.ok) throw new Error(post?.error || post?.reason || "POST falhou");

  await fetch(`${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.${LABEL}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ payload: { ...payload, ...incoming }, updated_at }),
  });

  const after = await fetch(`${REDIS_URL}?n=${Date.now()}`).then((r) => r.json());
  const locs = after.payload?.dk_locacoes_cadastro || [];
  const ncs = new Set(locs.map((l) => onlyDigits(l.numeroContrato)));
  console.log({
    ok: true,
    locacoes: locs.length,
    foraDaLista: [...ncs].filter((n) => !allowed.has(n)).length,
    faltamDaLista: [...allowed].filter((n) => !ncs.has(n)).length,
    flagSemProtocolos: after.payload?.dk_oficial_sem_protocolos_v1,
  });
  if (locs.length !== EXPECTED) process.exit(1);
  console.log("OK — oficial = exactamente 553 protocolos das imagens.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
