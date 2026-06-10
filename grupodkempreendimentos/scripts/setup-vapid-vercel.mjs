/**
 * Configura VAPID (Web Push mensagens DK) na Vercel + redeploy.
 * Uso: node grupodkempreendimentos/scripts/setup-vapid-vercel.mjs
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VAPID = {
  VAPID_PUBLIC_KEY:
    "BF83WxVXaS-9OAX1k7XO5iJWne1BD6usfUoENla85i2AlWvyemDmcHffB5dGVTbXDIcXlq8Y51Pws0BcfegdQLo",
  VAPID_PRIVATE_KEY: "PhzfvFjBTuMhW4MbTCQvk5OgKJQKCX-jWb5ma0YMS6s",
  VAPID_SUBJECT: "mailto:contato@grupodkempreendimentos.com.br",
};
const CHECK_URLS = [
  "https://grupodkempreendimentos.com.br/api/dk-cliente-geo?push=1&action=vapid",
  "https://demo.grupodkempreendimentos.com.br/api/dk-cliente-geo?push=1&action=vapid",
];

const ENVS = ["production", "preview", "development"];

function run(args) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["vercel@latest", ...args], {
      cwd: ROOT,
      shell: true,
      stdio: "inherit",
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function addEnv(name, value) {
  console.log(`\n→ ${name}`);
  for (const env of ENVS) {
    const code = await run([
      "env",
      "add",
      name,
      env,
      "--value",
      value,
      "--yes",
      "--force",
      "--no-sensitive",
    ]);
    if (code !== 0) return code;
  }
  return 0;
}

async function checkVapid(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return { url, ok: res.ok && data?.configured === true && Boolean(data?.publicKey), data };
}

async function main() {
  console.log("=== DK — configurar VAPID Web Push na Vercel ===\n");
  await run(["link", "--yes", "--project=grupo-dk"]);

  for (const [name, value] of Object.entries(VAPID)) {
    const code = await addEnv(name, value);
    if (code !== 0) {
      console.error(`Falha ao adicionar ${name} (exit ${code})`);
      process.exit(1);
    }
  }

  console.log("\n→ Redeploy produção (main)…");
  await run(["deploy", "--prod", "--yes"]);

  console.log("\n→ Redeploy preview (demo)…");
  await run(["deploy", "--yes"]);

  console.log("\n→ A aguardar deploy (~75s)…");
  await sleep(75_000);

  let allOk = true;
  for (const url of CHECK_URLS) {
    const r = await checkVapid(url);
    console.log(`\n${url}`);
    console.log(JSON.stringify(r.data, null, 2));
    if (!r.ok) allOk = false;
  }

  if (allOk) {
    console.log("\nOK — VAPID activo em oficial e demo.");
    process.exit(0);
  }
  console.log("\nVariáveis guardadas; aguarde 1–2 min e teste de novo.");
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
