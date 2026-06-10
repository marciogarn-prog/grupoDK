/**
 * Configura VAPID via API Vercel (evita CLI a bloquear no Windows).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const TEAM = "dk-empreendimentos";
const PROJECT = "grupo-dk";
const VAPID = {
  VAPID_PUBLIC_KEY:
    "BF83WxVXaS-9OAX1k7XO5iJWne1BD6usfUoENla85i2AlWvyemDmcHffB5dGVTbXDIcXlq8Y51Pws0BcfegdQLo",
  VAPID_PRIVATE_KEY: "PhzfvFjBTuMhW4MbTCQvk5OgKJQKCX-jWb5ma0YMS6s",
  VAPID_SUBJECT: "mailto:contato@grupodkempreendimentos.com.br",
};
const ENVS = ["production", "preview", "development"];
const CHECK_URLS = [
  "https://grupodkempreendimentos.com.br/api/dk-cliente-geo?push=1&action=vapid",
  "https://demo.grupodkempreendimentos.com.br/api/dk-cliente-geo?push=1&action=vapid",
];

function readToken() {
  const authPath = path.join(os.homedir(), "AppData", "Roaming", "com.vercel.cli", "Data", "auth.json");
  const raw = JSON.parse(fs.readFileSync(authPath, "utf8"));
  const token = raw?.token || raw?.credentials?.[0]?.token;
  if (!token) throw new Error("Token Vercel não encontrado — execute npx vercel login");
  return token;
}

async function api(token, method, urlPath, body) {
  const res = await fetch(`https://api.vercel.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function upsertEnv(token, projectId, key, value, target) {
  const list = await api(token, "GET", `/v9/projects/${projectId}/env?decrypt=true`);
  const existing = (list?.envs || []).find(
    (e) => e.key === key && (e.target || []).includes(target)
  );
  if (existing?.id) {
    await api(token, "PATCH", `/v9/projects/${projectId}/env/${existing.id}`, {
      value,
      target: [target],
      type: "plain",
    });
    return "updated";
  }
  await api(token, "POST", `/v10/projects/${projectId}/env`, {
    key,
    value,
    type: "plain",
    target: [target],
  });
  return "created";
}

async function checkVapid(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return { url, ok: res.ok && data?.configured === true && Boolean(data?.publicKey), data };
}

async function main() {
  const token = readToken();
  const projects = await api(token, "GET", `/v9/projects/${PROJECT}?teamId=${TEAM}`);
  const projectId = projects?.id || projects?.project?.id;
  if (!projectId) throw new Error("Project ID não encontrado");

  console.log("Project:", projectId);
  for (const [key, value] of Object.entries(VAPID)) {
    for (const target of ENVS) {
      const r = await upsertEnv(token, projectId, key, value, target);
      console.log(`${key} [${target}] → ${r}`);
    }
  }

  console.log("\nA redeployar via git push (Vercel auto-deploy)…");
  console.log("Aguardar ~90s para propagar env vars…");
  await sleep(90_000);

  let ok = true;
  for (const url of CHECK_URLS) {
    const r = await checkVapid(url);
    console.log("\n", url, JSON.stringify(r.data));
    if (!r.ok) ok = false;
  }
  if (!ok) {
    console.log("\nEnv vars guardadas. Se configured=false, force redeploy no painel Vercel.");
    process.exit(2);
  }
  console.log("\nOK — VAPID activo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
