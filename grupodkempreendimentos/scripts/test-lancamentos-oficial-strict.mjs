/**
 * Oficial: garante que erros de lançamento da demo NÃO se aplicam ao oficial.
 * node grupodkempreendimentos/scripts/test-lancamentos-oficial-strict.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE_URL || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });

    const staticChecks = await page.evaluate(() => ({
      isDemo: window.__DK_IS_DEMO_DEPLOY__ === true,
      strictFn: typeof window.__DK_isOficialLancamentosStrict === "function",
      strictActive: window.__DK_IS_DEMO_DEPLOY__ !== true,
      purgeFn: typeof window.__DK_purgeGlobalLancamentoKeysOficial === "function",
      sanitizeFn: typeof window.__DK_sanitizeCloudPayloadLancamentosOficial === "function",
    }));
    record("oficial: não é ambiente demo", !staticChecks.isDemo);
    record("oficial: modo estrito activo", staticChecks.strictActive && staticChecks.strictFn);
    record("oficial: purge chaves globais disponível", staticChecks.purgeFn);
    record("oficial: sanitize nuvem disponível", staticChecks.sanitizeFn);

    const runtime = await page.evaluate(() => {
      const GLOBAL_KEYS = [
        "dk_lancamentos_aluguel",
        "dk_lancamento_aluguel",
        "dk_lancamentos_aluguel_cadastro",
        "dk_lancamento_aluguel_cadastro",
      ];
      const globalCounts = GLOBAL_KEYS.map((k) => {
        try {
          const raw = localStorage.getItem(k);
          const arr = raw ? JSON.parse(raw) : [];
          return Array.isArray(arr) ? arr.length : 0;
        } catch {
          return -1;
        }
      });
      const locsRaw = localStorage.getItem("dk_locacoes_cadastro");
      const locs = locsRaw ? JSON.parse(locsRaw) : [];
      let ghostFromLegacy = 0;
      let invalidOficial = 0;
      let validOficial = 0;
      const getCanon =
        typeof window.__DK_getLancamentosAluguelCanonico === "function"
          ? window.__DK_getLancamentosAluguelCanonico
          : null;
      const isAceite =
        typeof window.__DK_isLancamentoOficialAceite === "function"
          ? window.__DK_isLancamentoOficialAceite
          : () => true;
      for (const loc of Array.isArray(locs) ? locs : []) {
        if (!loc || typeof loc !== "object") continue;
        if (Array.isArray(loc.lancamentosAluguel) && loc.lancamentosAluguel.length) ghostFromLegacy += 1;
        if (Array.isArray(loc.lancamentos) && loc.lancamentos.length) ghostFromLegacy += 1;
        const canon = getCanon ? getCanon(loc) : [];
        for (const row of canon) {
          if (isAceite(row)) validOficial += 1;
          else invalidOficial += 1;
        }
      }
      const fakeLoc = {
        cpf: "12345678901",
        numeroContrato: "2099010101",
        placa: "ZZZ9Z99",
        portalLancamentosAluguel: [],
        lancamentosAluguel: [{ data: "01/01/2099", valor: 99999, createdAt: Date.now() }],
        totalPagoAno2025: "99999,00",
      };
      const canonFake = getCanon ? getCanon(fakeLoc) : [{ valor: 99999 }];
      const protoTest = window.__DK_gerarProtocoloLancamento
        ? window.__DK_gerarProtocoloLancamento("39039039039", new Date())
        : "";
      return {
        globalCounts,
        ghostFromLegacy,
        invalidOficial,
        validOficial,
        canonFakeLen: canonFake.length,
        protoTest,
      };
    });

    record(
      "oficial: chaves globais dk_lancamentos_* vazias",
      runtime.globalCounts.every((n) => n === 0),
      runtime.globalCounts.join(",")
    );
    record(
      "oficial: legado lancamentosAluguel/lancamentos ignorado",
      runtime.canonFakeLen === 0,
      `fantasma simulado → ${runtime.canonFakeLen} linha(s)`
    );
    record(
      "oficial: lançamentos canónicos válidos",
      runtime.invalidOficial === 0,
      `válidos=${runtime.validOficial} inválidos=${runtime.invalidOficial}`
    );
    record(
      "oficial: protocolo gerado com CPF operador",
      /^\d{14}-390$/.test(String(runtime.protoTest || "")),
      runtime.protoTest
    );
    record(
      "oficial: sem arrays legados embutidos após consolidação",
      runtime.ghostFromLegacy === 0,
      `locações c/ legado=${runtime.ghostFromLegacy}`
    );
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- ${ok}/${results.length} testes oficial estrito ---\n`);
  process.exit(ok === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
