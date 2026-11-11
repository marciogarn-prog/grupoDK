/**
 * Recupera lançamentos da fila/entity (Lucelina e restantes) para dk_pagamento_locacao.
 * node grupodkempreendimentos/scripts/recuperar-fila-lucelina-para-pg.mjs
 */
import crypto from "crypto";

const BASE = (process.env.DK_TEST_BASE_URL || "https://grupodkempreendimentos.com.br/").replace(/\/?$/, "/");
const NC_FOCO = String(process.env.DK_RECOVER_NC || "2025100803").trim();

function dig(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function opId(proto) {
  const h = crypto.createHash("sha256").update(`dk-pag-reconcile:${proto}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function login() {
  const r = await fetch(BASE + "api/dk-portal-auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DK-Client-Protocol": "20260913",
      "X-DK-User-Active": "1",
    },
    body: JSON.stringify({
      tipo: "equipa",
      cpf: "03037897430",
      senha: process.env.DK_OWNER_SENHA || "12345678",
      confirmarUnico: true,
      deviceId: "dk-recover-fila-pg",
    }),
  });
  const j = await r.json();
  if (!j.token) throw new Error("login fail " + JSON.stringify(j).slice(0, 240));
  return {
    Authorization: "Bearer " + j.token,
    "X-DK-Portal-Token": j.token,
    "X-DK-Client-Protocol": "20260913",
    "X-DK-User-Active": "1",
    "Content-Type": "application/json",
  };
}

async function main() {
  const headers = await login();
  const fila = await fetch(BASE + "api/dk-lancamento-nuvem?nocache=" + Date.now(), {
    headers,
    cache: "no-store",
  }).then((r) => r.json());
  const itens = Array.isArray(fila?.itens) ? fila.itens : [];
  const alvo = NC_FOCO
    ? itens.filter((it) => dig(it.nc) === dig(NC_FOCO))
    : itens;
  console.log(JSON.stringify({ filaTotal: itens.length, alvo: alvo.length, nc: NC_FOCO || "*", reconcileGet: fila?.reconcile || null }, null, 2));

  const pg = await fetch(BASE + "api/dk-pagamento-locacao?numeroContrato=" + encodeURIComponent(NC_FOCO || dig(alvo[0]?.nc)), {
    headers,
    cache: "no-store",
  }).then((r) => r.json());
  const ja = new Set(
    (pg.pagamentos || []).map((p) => String(p.protocoloLancamento || "").trim()).filter(Boolean)
  );
  console.log("pgAntes", (pg.pagamentos || []).length);

  const results = [];
  for (const it of alvo) {
    const pag = it.pagamento;
    const proto = String(pag?.protocoloLancamento || "").trim();
    if (!proto) {
      results.push({ ok: false, reason: "sem_proto" });
      continue;
    }
    if (ja.has(proto)) {
      results.push({ ok: true, skipped: true, proto });
      continue;
    }
    const body = {
      operacao: "create",
      numeroContrato: dig(it.nc),
      operation_id: opId(proto),
      pagamento: pag,
    };
    const r = await fetch(BASE + "api/dk-pagamento-locacao", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    const ok = Boolean(r.ok && (data.ok || data.success));
    results.push({
      ok,
      status: r.status,
      proto,
      valor: pag?.valor,
      data: pag?.data,
      reason: data.reason || null,
      idempotent: data.idempotent || false,
    });
    if (ok) ja.add(proto);
    await new Promise((res) => setTimeout(res, 120));
  }

  const pg2 = await fetch(BASE + "api/dk-pagamento-locacao?numeroContrato=" + encodeURIComponent(NC_FOCO), {
    headers,
    cache: "no-store",
  }).then((r) => r.json());
  const total = (pg2.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const luc = (pg2.pagamentos || []).filter(
    (p) => dig(p.registradoPorCpf) === "05780277478" || String(p.registradoPorNome || "").toUpperCase().includes("LUCELINA")
  );
  console.log(
    JSON.stringify(
      {
        gravados: results.filter((x) => x.ok && !x.skipped).length,
        skipped: results.filter((x) => x.skipped).length,
        falhas: results.filter((x) => !x.ok),
        pgDepois: (pg2.pagamentos || []).length,
        totalPago: total,
        lucelina: luc.length,
        lucelinaSoma: luc.reduce((s, p) => s + (Number(p.valor) || 0), 0),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
