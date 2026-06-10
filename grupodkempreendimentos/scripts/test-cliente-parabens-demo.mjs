/**
 * E2E demo: app cliente — mensagem PARABÉNS com semanas pagas
 * (X = floor(total pago / valor do plano)), sem botão «Atualizar da nuvem»,
 * sync automático ao abrir e gesto puxar-para-baixo ligado.
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

  /* sync automático ao abrir deve preencher os dados e a mensagem */
  const estado = await app
    .waitForFunction(
      () => {
        const resumo = document.getElementById("cliente-resumo");
        const txt = (resumo?.textContent || "").replace(/\s+/g, " ").trim();
        if (!txt.includes("PARABÉNS")) return false;
        return { txt };
      },
      { timeout: 60000 }
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  record("mensagem PARABÉNS aparece após abrir (sync automático)", Boolean(estado), String(estado?.txt || "").slice(0, 160));

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
    const esperado = plano > 0 ? Math.floor(totalPago / plano) : 0;
    const txt = (document.getElementById("cliente-resumo")?.textContent || "").replace(/\s+/g, " ");
    const m = txt.match(/PAGOU\s+(\d+)\s+SEMANA/i);
    return {
      ok: Boolean(m) && Number(m[1]) === esperado,
      plano,
      totalPago,
      esperado,
      mostrado: m ? Number(m[1]) : null,
      txt: txt.slice(0, 160),
    };
  }, { cpf: CPF, proto: PROTO });
  record(
    "X = floor(total pago / valor do plano)",
    conta.ok === true,
    `plano=${conta.plano} pago=${conta.totalPago} esperado=${conta.esperado} mostrado=${conta.mostrado}`
  );
  record(
    "caso com plano e pagamentos reais (não 0/0)",
    Number(conta.plano) > 0 && Number(conta.totalPago) > 0,
    `plano=${conta.plano} pago=${conta.totalPago}`
  );

  /* nome do cliente na mensagem */
  record("nome do cliente na mensagem", String(estado?.txt || "").includes("CLIENTE TESTE PARABÉNS"), "");
  record("texto PLANO DK MINHA MOTO presente", String(estado?.txt || "").includes("PLANO DK MINHA MOTO"), "");

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
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
