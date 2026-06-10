/** Redeploy Vercel (prod + preview) com timeout. */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function deploy(args) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["vercel@latest", "deploy", ...args, "--yes"], {
      cwd: ROOT,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
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
    const timer = setTimeout(() => done(out.includes("Ready") || out.includes("Production")), 180_000);
    child.stdout?.on("data", (d) => {
      out += d;
      process.stdout.write(d);
      if (out.includes("Ready!") || out.includes("Production:")) done(true);
    });
    child.stderr?.on("data", (d) => {
      out += d;
      process.stderr.write(d);
    });
    child.on("close", (code) => done(code === 0));
  });
}

async function main() {
  console.log("=== Redeploy produção ===");
  await deploy(["--prod"]);
  console.log("\n=== Redeploy preview ===");
  await deploy([]);
  console.log("\nAguardar 60s…");
  await sleep(60_000);
}

main();
