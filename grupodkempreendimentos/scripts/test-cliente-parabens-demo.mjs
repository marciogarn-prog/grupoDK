/**
 * E2E demo: app cliente — gráfico DK Minha Moto (150 semanas).
 * Progresso = round((semanas pagas / 150) * 100). Semanas = floor(total pago / valor do plano).
 * node grupodkempreendimentos/scripts/test-cliente-parabens-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
/* cliente demo com pagamentos reais: plano R$350/semana, R$2450 pago → 7 semanas */
const CPF = "08350435410";
const PROTO = "2026031703";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const app = await ctx.newPage();
  await app.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await app.evaluate(({ cpf, proto }) => {
    localStorage.setItem(
      "dk_sessao_cliente_app",
      JSON.stringify({ cpf, nome: "Cliente Teste Parabéns", loginEm: new Date().toISOString() })
    );
    sessionStorage.setItem("dk_cliente_app_gate", JSON.stringify({ cpf, proto, ok: true, ts: Date.now() }));
  }, { cpf: CPF, proto: PROTO });
  await app.goto(`${BASE}cliente?adminPreview=1`, { waitUntil: "domcontentloaded", timeout: 90000 });

  /* sync automático ao abrir deve preencher o gráfico */
  const estado = await app
    .waitForFunction(
      () => {
        const card = document.querySelector("#cliente-resumo .cliente-premio");
        if (!card) return false;
        const img = card.querySelector("img");
        return {
          semanas: Number(card.getAttribute("data-semanas") || ""),
          pct: Number(card.getAttribute("data-pct") || ""),
          src: img?.getAttribute("src") || "",
          txt: (document.getElementById("cliente-resumo")?.textContent || "").replace(/\s+/g, " ").trim(),
        };
      },
      { timeout: 60000 }
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  record("gráfico DK Minha Moto aparece após abrir", Boolean(estado), String(estado?.txt || "").slice(0, 160));
  record(
    "imagem do motoqueiro no progresso",
    Boolean(estado?.src && /dk-minha-moto-premio/.test(estado.src)),
    String(estado?.src || "")
  );

  /* esperar o sync terminar para os valores estarem na máquina */
  await app
    .waitForFunction(
      () => /Atualizado|Usando dados locais/.test(document.getElementById("sync-msg")?.textContent || ""),
      { timeout: 45000 }
    )
    .catch(() => {});
  await app.waitForTimeout(1000);

  /* fórmula: X = floor(total pago / plano) */
  const conta = await app.evaluate(({ cpf, proto }) => {
    const dig = (s) => String(s ?? "").replace(/\D/g, "");
    const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    let locs = [];
    try { locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]"); } catch { locs = []; }
    const loc = locs.find((l) => dig(l.cpf).slice(0, 11) === cpf && norm(l.numeroContrato) === norm(proto));
    if (!loc) return { ok: false, reason: "loc_nao_encontrada" };
    const parse = (v) => {
      if (typeof v === "number") return v;
      const s = String(v ?? "").replace(/[R$\s\u00A0]/gi, "").replace(/\./g, "").replace(",", ".");
      return Number(s) || 0;
    };
    const plano = parse(loc.valorLocacao) + parse(loc.valorInvestimento);
    const lancs = typeof window.__DK_clienteGetLancamentosAluguelContrato === "function"
      ? window.__DK_clienteGetLancamentosAluguelContrato(loc)
      : [];
    const totalPago = lancs.reduce((s, p) => s + Number(p.valor || 0), 0);
    const esperadoSemanas = plano > 0 ? Math.floor(totalPago / plano) : 0;
    const esperadoPct = Math.min(100, Math.round((esperadoSemanas * 100) / 150));
    const card = document.querySelector("#cliente-resumo .cliente-premio");
    const mostradoSemanas = Number(card?.getAttribute("data-semanas") || "");
    const mostradoPct = Number(card?.getAttribute("data-pct") || "");
    const txt = (document.getElementById("cliente-resumo")?.textContent || "").replace(/\s+/g, " ");
    return {
      ok: mostradoSemanas === esperadoSemanas && mostradoPct === esperadoPct,
      plano,
      totalPago,
      esperadoSemanas,
      esperadoPct,
      mostradoSemanas,
      mostradoPct,
      txt: txt.slice(0, 160),
    };
  }, { cpf: CPF, proto: PROTO });
  record(
    "X = floor(total pago / valor do plano); barra = round(X/150*100)",
    conta.ok === true,
    `plano=${conta.plano} pago=${conta.totalPago} semanas=${conta.esperadoSemanas} pct=${conta.esperadoPct} mostrado=${conta.mostradoSemanas}/${conta.mostradoPct}`
  );
  record(
    "caso com plano e pagamentos reais (não 0/0)",
    Number(conta.plano) > 0 && Number(conta.totalPago) > 0,
    `plano=${conta.plano} pago=${conta.totalPago}`
  );

  /* nome do cliente no cabeçalho (o gráfico já não usa PARABÉNS) */
  record(
    "cabeçalho com nome do cliente",
    String(await app.locator("#cliente-nome").textContent()).toUpperCase().includes("CLIENTE TESTE PARABÉNS"),
    ""
  );
  record("texto DK MINHA MOTO e 150 semanas", String(estado?.txt || "").includes("DK MINHA MOTO") && String(estado?.txt || "").includes("150"), "");

  /* botão antigo removido + pull-to-refresh ligado */
  const ui = await app.evaluate(() => ({
    btnSync: Boolean(document.getElementById("btn-sync")),
    pullBound: document.documentElement.dataset.dkPullRefreshBound === "1",
    syncMsg: Boolean(document.getElementById("sync-msg")),
  }));
  record("botão «Atualizar da nuvem» removido", ui.btnSync === false);
  record("gesto puxar-para-baixo ligado", ui.pullBound === true, JSON.stringify(ui));

  /* simular o gesto: touch de cima para baixo no topo dispara sync */
  await app.evaluate(() => { window.scrollTo(0, 0); });
  const cdp = await ctx.newCDPSession(app);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 120 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 180, y: 260 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const pullMsg = await app
    .waitForFunction(
      () => {
        const t = document.getElementById("sync-msg")?.textContent || "";
        return /A atualizar da nuvem|Atualizado/.test(t) ? t : false;
      },
      { timeout: 30000 }
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  record("puxar para baixo dispara atualização", Boolean(pullMsg), String(pullMsg || "sem reação").slice(0, 120));

  await ctx.close();

  /* cliente sem DK Minha Moto: mesmo gráfico em 0% + convite */
  const ctxConvite = await browser.newContext();
  const appConvite = await ctxConvite.newPage();
  await appConvite.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await appConvite.evaluate(({ cpf, proto }) => {
    localStorage.setItem(
      "dk_sessao_cliente_app",
      JSON.stringify({ cpf, nome: "Cliente Teste Convite", loginEm: new Date().toISOString() })
    );
    sessionStorage.setItem("dk_cliente_app_gate", JSON.stringify({ cpf, proto, ok: true, ts: Date.now() }));
  }, { cpf: "07534147409", proto: "2026031305" });
  await appConvite.goto(`${BASE}cliente?adminPreview=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const convite = await appConvite
    .waitForFunction(
      () => {
        const card = document.querySelector("#cliente-resumo .cliente-premio");
        if (!card) return false;
        return {
          pct: Number(card.getAttribute("data-pct") || ""),
          modo: card.getAttribute("data-modo") || "",
          txt: (document.getElementById("cliente-resumo")?.textContent || "").replace(/\s+/g, " ").trim(),
        };
      },
      { timeout: 60000 }
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  record("convite DK Minha Moto para quem não tem o plano", Boolean(convite), String(convite?.txt || "").slice(0, 160));
  record("convite mostra 0%", convite?.pct === 0 && convite?.modo === "convite", JSON.stringify(convite || {}));
  record(
    "frase VENHA REALIZAR SEU SONHO",
    String(convite?.txt || "").includes("VENHA REALIZAR SEU SONHO NO PLANO DK MINHA MOTO"),
    String(convite?.txt || "").slice(0, 160)
  );
  await ctxConvite.close();
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
