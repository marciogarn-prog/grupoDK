/**
 * Configura Redis (Upstash) na Vercel via Marketplace — um clique nos termos, o resto automático.
 *
 * Pré-requisito: `npx vercel login` (já feito neste PC como marciogarn-8982)
 *
 * Uso (na raiz do repo):
 *   node grupodkempreendimentos/scripts/setup-redis-vercel.mjs
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const TERMS_URL =
  "https://vercel.com/dk-empreendimentos/~/integrations/accept-terms/upstash?source=cli";
const PROD_API = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const MAX_WAIT_MS = 8 * 60 * 1000;
const POLL_MS = 12_000;

function runVercel(args) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["vercel@latest", ...args], {
      cwd: process.cwd(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", (d) => {
      out += d;
      process.stdout.write(d);
    });
    child.stderr?.on("data", (d) => {
      out += d;
      process.stderr.write(d);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

async function prodRedisOk() {
  try {
    const res = await fetch(PROD_API, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.ok === true && data?.reason !== "kv_not_configured";
  } catch {
    return false;
  }
}

function openBrowser(url) {
  const plat = process.platform;
  if (plat === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
  } else if (plat === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" });
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  }
}

async function main() {
  console.log("=== DK — configurar Redis (Upstash) na Vercel ===\n");

  if (await prodRedisOk()) {
    console.log("Redis já responde em produção:", PROD_API);
    process.exit(0);
  }

  console.log("1) A abrir browser para aceitar termos Upstash (obrigatório, uma vez)…");
  console.log("   ", TERMS_URL);
  openBrowser(TERMS_URL);

  console.log("\n2) A instalar Upstash for Redis no projeto grupo-dk…");
  const t0 = Date.now();
  let installed = false;

  while (Date.now() - t0 < MAX_WAIT_MS) {
    const r = await runVercel([
      "integration",
      "add",
      "upstash/upstash-kv",
      "--non-interactive",
    ]);
    if (r.code === 0 && !r.out.includes("action_required")) {
      installed = true;
      break;
    }
    if (r.out.includes("action_required")) {
      console.log(
        `\n   Aguardando aceitar termos no browser… (${Math.round((Date.now() - t0) / 1000)}s)`
      );
    } else {
      console.log("\n   Tentativa falhou, a repetir…");
    }
    await sleep(POLL_MS);
  }

  if (!installed) {
    console.error(
      "\nTempo esgotado. Abra o link acima, aceite os termos, e execute de novo:\n  node grupodkempreendimentos/scripts/setup-redis-vercel.mjs"
    );
    process.exit(1);
  }

  console.log("\n3) Variáveis de ambiente…");
  await runVercel(["env", "pull", ".env.vercel.redis", "--yes", "--environment=production"]);

  console.log("\n4) Redeploy produção…");
  await runVercel(["deploy", "--prod", "--yes"]);

  console.log("\n5) A aguardar deploy (~60s)…");
  await sleep(65_000);

  if (await prodRedisOk()) {
    console.log("\nOK — Redis ativo em produção:", PROD_API);
    process.exit(0);
  }

  console.log(
    "\nIntegração instalada, mas a API ainda não responde ok. Aguarde 1–2 min e teste:\n ",
    PROD_API
  );
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
