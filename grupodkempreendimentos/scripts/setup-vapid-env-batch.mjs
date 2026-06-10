/** Adiciona env vars Vercel com timeout (CLI no Windows fica pendurada). */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VAPID = {
  VAPID_PUBLIC_KEY:
    "BF83WxVXaS-9OAX1k7XO5iJWne1BD6usfUoENla85i2AlWvyemDmcHffB5dGVTbXDIcXlq8Y51Pws0BcfegdQLo",
  VAPID_PRIVATE_KEY: "PhzfvFjBTuMhW4MbTCQvk5OgKJQKCX-jWb5ma0YMS6s",
  VAPID_SUBJECT: "mailto:contato@grupodkempreendimentos.com.br",
};
const ENVS = ["production", "preview", "development"];

function addOne(name, value, env, gitBranch) {
  return new Promise((resolve) => {
    const args = [
      "vercel@latest",
      "env",
      "add",
      name,
      env,
      ...(gitBranch ? [gitBranch] : []),
      "--value",
      value,
      "--yes",
      "--force",
      "--no-sensitive",
    ];
    const child = spawn("npx", args, { cwd: ROOT, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const done = (ok) => {
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve({ ok, out });
    };
    const timer = setTimeout(() => done(out.includes("Saving") || out.includes("Overrode")), 25_000);
    child.stdout?.on("data", (d) => {
      out += d;
      if (out.includes("Saving") || out.includes("Overrode")) done(true);
    });
    child.stderr?.on("data", (d) => {
      out += d;
    });
    child.on("close", (code) => done(code === 0 || out.includes("Overrode")));
  });
}

async function main() {
  for (const env of ENVS) {
    for (const [name, value] of Object.entries(VAPID)) {
      const branch = env === "preview" ? "demo" : null;
      process.stdout.write(`${name} [${env}${branch ? `/${branch}` : ""}]… `);
      const r = await addOne(name, value, env, branch);
      console.log(r.ok ? "ok" : "FAIL");
      if (!r.ok) console.log(r.out.slice(-400));
    }
  }
}

main();
