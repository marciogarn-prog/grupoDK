/**
 * E2E demo: cliente abre o app (sem ações manuais) → auto-sync entrega o CRLV.
 * node grupodkempreendimentos/scripts/test-crlv-auto-sync-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF = "09888264451";
const PROTO = "2025111403";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  geolocation: { latitude: -9.39, longitude: -40.5 },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();
let ok = false;

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(
    ({ cpf, proto }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(
        "dk_sessao_cliente_app",
        JSON.stringify({ cpf, nome: "Teste Auto", loginEm: new Date().toISOString() })
      );
      sessionStorage.setItem(
        "dk_cliente_app_gate",
        JSON.stringify({ cpf, proto, ok: true, ts: Date.now() })
      );
    },
    { cpf: CPF, proto: PROTO }
  );

  await page.goto(`${BASE}cliente?adminPreview=1`, { waitUntil: "domcontentloaded", timeout: 90000 });

  await page.waitForFunction(
    (proto) => {
      try {
        const docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]");
        return docs.some(
          (d) =>
            String(d.numeroContrato) === proto &&
            d.enviadoCliente === true &&
            String(d.arquivoBase64 || "").length > 1000
        );
      } catch {
        return false;
      }
    },
    PROTO,
    { timeout: 45000 }
  );
  ok = true;
  console.log("PASS | auto-sync entregou CRLV sem ação manual");
} catch {
  const st = await page.evaluate(() => {
    try {
      const docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]");
      return docs.map((d) => ({
        nc: d.numeroContrato,
        env: d.enviadoCliente,
        b64: String(d.arquivoBase64 || "").length,
      }));
    } catch {
      return "erro";
    }
  });
  console.log("FAIL | auto-sync", JSON.stringify(st));
} finally {
  await browser.close();
}

process.exit(ok ? 0 : 1);
