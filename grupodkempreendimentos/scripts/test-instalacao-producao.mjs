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
    const corpManifestRes = await fetch(new URL("manifest-corporativo.webmanifest", BASE));
    const corpManifest = await corpManifestRes.json();
    record("manifest corporativo 200", corpManifestRes.ok, String(corpManifestRes.status));
    record(
      "manifest corporativo PNG + start_url app",
      corpManifest.short_name === "Grupo DK" &&
        corpManifest.start_url?.includes("app.html") &&
        corpManifest.start_url?.includes("instalar=1") &&
        (corpManifest.icons || []).some((i) => i.sizes === "192x192" && i.type === "image/png") &&
        (corpManifest.icons || []).some((i) => i.sizes === "512x512")
    );

    for (const path of ["/app", "/app.html?instalar=1"]) {
      const url = new URL(path, BASE).href;
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      const status = res?.status() ?? 0;
      const html = await page.content();
      const ok =
        status === 200 &&
        html.includes("dkAppBtnVisitante") &&
        html.includes("dkAppBtnCliente") &&
        html.includes("dkAppBtnFuncionario") &&
        html.includes("dk-pwa-update.js");
      record(`pagina ${path} app entry`, ok, `status=${status}`);
    }

    const corpSwRes = await fetch(new URL("service-worker-corporativo.js", BASE));
    const corpSwText = await corpSwRes.text();
    record("SW corporativo inclui app.html", corpSwText.includes("app.html"));
    record(
      "SW corporativo icones PNG",
      corpSwText.includes("icon-cliente-192.png") && corpSwText.includes("icon-cliente-512.png")
    );
    record(
      "SW corporativo cache atual + network-first",
      corpSwText.includes("dk-corporativo-v20260521icon") && corpSwText.includes("isNetworkFirstAsset")
    );

    const manifestRes = await fetch(new URL("manifest-cliente.webmanifest", BASE));
    const manifest = await manifestRes.json();
    record("manifest 200", manifestRes.ok, String(manifestRes.status));
    const shareAction = manifest.share_target?.action || "";
    record(
      "share_target DK Cliente",
      manifest.short_name === "DK Cliente" &&
        (shareAction === "/api/cliente-share" || shareAction === "/cliente"),
      shareAction || "sem share_target"
    );
    record(
      "icones PNG 192+512",
      (manifest.icons || []).some((i) => i.sizes === "192x192" && i.type === "image/png") &&
        (manifest.icons || []).some((i) => i.sizes === "512x512")
    );

    for (const path of ["/instalar", "/instalar.html", "/cliente?instalar=1"]) {
      const url = new URL(path, BASE).href;
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      const status = res?.status() ?? 0;
      const html = await page.content();
      const ok =
        status === 200 &&
        (html.includes("Instalar app DK Cliente") ||
          html.includes("Instalar DK Cliente") ||
          html.includes("cliente-install-panel"));
      record(`pagina ${path} carrega`, ok, `status=${status}`);
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
    const portalHtml = await page.content();
    record(
      "portal painel instalar no HTML",
      portalHtml.includes("locadora-install-done") &&
        portalHtml.includes("locadora-install-open")
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
    record(
      "SW cache cliente seguro",
      swText.includes("dk-cliente-v20260521setor-routing") && swText.includes("networkFirst")
    );

    const shareApi = await fetch(new URL("api/cliente-share", BASE), { redirect: "manual" });
    record(
      "API cliente-share deployada",
      shareApi.status === 302 || shareApi.status === 200,
      `status=${shareApi.status}`
    );
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
