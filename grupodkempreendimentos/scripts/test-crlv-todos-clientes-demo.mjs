/**
 * E2E demo: CRLV de todos os protocolos com documento enviado → app cliente
 * node grupodkempreendimentos/scripts/test-crlv-todos-clientes-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CASOS = [
  { cpf: "06523244440", proto: "2026010102", placa: "UHQ9B08" },
  { cpf: "10455403406", proto: "2025111301", placa: "UHK6J56" },
  { cpf: "09888264451", proto: "2025111403", placa: "UHK7A75" },
  { cpf: "11377158802", proto: "2025102801", placa: "UHO5I86" },
];

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });

for (const caso of CASOS) {
  const ctx = await browser.newContext({
    geolocation: { latitude: -9.39, longitude: -40.5 },
    permissions: ["geolocation"],
  });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.evaluate(({ cpf, proto }) => {
      localStorage.setItem(
        "dk_sessao_cliente_app",
        JSON.stringify({ cpf, nome: "Teste", loginEm: new Date().toISOString() })
      );
      sessionStorage.setItem(
        "dk_cliente_app_gate",
        JSON.stringify({ cpf, proto, ok: true, ts: Date.now() })
      );
    }, caso);

    await page.goto(`${BASE}cliente?adminPreview=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);

    const pullRes = await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge !== "function") {
        return { ok: false, reason: "no_pull_fn" };
      }
      return window.__DK_pullCloudSnapshotSilentMerge({ force: true });
    });

    const state = await page.evaluate(
      ({ cpf, proto }) => {
        const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");
        const normNc = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        let docs = [];
        try {
          docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]");
        } catch {
          docs = [];
        }
        const dig = onlyDigits(cpf).slice(0, 11);
        const nc = normNc(proto);
        const crlv = docs.filter(
          (d) =>
            normNc(d.numeroContrato) === nc &&
            onlyDigits(d.cpf).slice(0, 11) === dig &&
            d.enviadoCliente === true &&
            /crlv/i.test(String(d.tipo || d.origemDepositoCategoria || d.nome || ""))
        );
        return {
          total: docs.length,
          crlv: crlv.length,
          b64: crlv[0] ? String(crlv[0].arquivoBase64 || "").length : 0,
          countFn:
            typeof window.__DK_clienteDocsLocacaoCount === "function"
              ? window.__DK_clienteDocsLocacaoCount(proto, cpf, "crlv")
              : -1,
        };
      },
      caso
    );

    record(
      `CRLV ${caso.proto} (${caso.placa}) no app cliente`,
      pullRes?.ok === true && state.crlv >= 1 && state.b64 > 1000 && state.countFn >= 1,
      `pull=${pullRes?.ok} src=${pullRes?.source || pullRes?.reason || "-"} crlv=${state.crlv} b64=${state.b64} count=${state.countFn}`
    );
  } catch (e) {
    record(`CRLV ${caso.proto} (${caso.placa}) no app cliente`, false, String(e?.message || e).slice(0, 120));
  } finally {
    await ctx.close();
  }
}

await browser.close();

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
