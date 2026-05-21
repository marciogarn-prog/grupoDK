/**
 * Smoke test instalação + share_target em produção.
 * node grupodkempreendimentos/scripts/test-instalacao-producao.mjs
 */
import { chromium } from "playwright";

const BASE = "https://grupodkempreendimentos.com.br/";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const manifestRes = await fetch(new URL("manifest-cliente.webmanifest", BASE));
    const manifest = await manifestRes.json();
    record("manifest 200", manifestRes.ok, String(manifestRes.status));
    record(
      "share_target DK Cliente",
      manifest.share_target?.action === "/api/cliente-share" &&
        manifest.short_name === "DK Cliente",
      manifest.share_target?.action || "sem share_target"
    );
    record(
      "icones PNG 192+512",
      (manifest.icons || []).some((i) => i.sizes === "192x192" && i.type === "image/png") &&
        (manifest.icons || []).some((i) => i.sizes === "512x512")
    );

    for (const path of ["/instalar", "/instalar.html"]) {
      const url = new URL(path, BASE).href;
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      const status = res?.status() ?? 0;
      const html = await page.content();
      record(
        `pagina ${path} carrega`,
        status === 200 && html.includes("Instalar app DK Cliente"),
        `status=${status}`
      );
    }

    await page.goto(new URL("#locadora/cliente", BASE).href, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    record(
      "portal area cliente",
      (await page.locator("#form-locadora-app-download").isVisible()),
      page.url()
    );
    record(
      "portal texto partilhar DK Cliente",
      (await page.content()).includes("DK Cliente") &&
        (await page.content()).match(/partilhar|Partilhar/i)
    );
    record(
      "portal script instalar atualizado",
      (await page.content()).includes("portal-locadora-ui.js?v=20260526instalar") ||
        (await page.content()).includes("instalar.html")
    );

    const clienteRes = await fetch(new URL("cliente", BASE));
    record("pagina /cliente 200", clienteRes.ok);
    const clienteHtml = await clienteRes.text();
    record(
      "cliente manifest + SW",
      clienteHtml.includes("manifest-cliente.webmanifest") &&
        clienteHtml.includes("service-worker-cliente.js")
    );

    const swRes = await fetch(new URL("service-worker-cliente.js", BASE));
    const swText = await swRes.text();
    record("SW inclui instalar.html", swText.includes("instalar.html"));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) {
    console.log("Falhas:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
