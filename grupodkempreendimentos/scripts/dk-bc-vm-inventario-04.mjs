/**
 * COMANDO 04/10 — inventário Redis das VMs atuais (sem atribuir A–J).
 * Não numera BC. Sem PII no relatório (CPF mascarado).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "vm-04");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvFile(path.join(ROOT, ".env.vercel.local"));
loadEnvFile(path.join(ROOT, ".env.local"));

function maskCpf(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return "[cpf-invalido]";
  return `***${d.slice(3, 6)}***${d.slice(-2)}`;
}

function shaRef(cpf) {
  return crypto.createHash("sha256").update(String(cpf || ""), "utf8").digest("hex").slice(0, 16);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    started_at: new Date().toISOString(),
    comando: "04/10",
    regra: "letras_nao_atribuidas_por_login",
    redis: { ok: false },
    vms: [],
    sem_bc: [],
  };

  try {
    const { Redis } = require("@upstash/redis");
    const strip = (v) => String(v || "").trim().replace(/^["']+|["']+$/g, "");
    const url = strip(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
    const token = strip(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);
    if (!url || !token) {
      report.redis = { ok: false, reason: "redis_env_missing" };
    } else {
      const redis = new Redis({ url, token });
      const indice = await redis.hgetall("dk:portal:vms:indice:v1");
      const entries = indice && typeof indice === "object" ? Object.entries(indice) : [];
      report.redis = { ok: true, indice_count: entries.length };
      for (const [cpf, raw] of entries) {
        let meta = raw;
        if (typeof raw === "string") {
          try {
            meta = JSON.parse(raw);
          } catch {
            meta = {};
          }
        }
        const row = {
          ref: shaRef(cpf),
          cpf_mascarado: maskCpf(cpf),
          nome_len: String((meta && meta.nome) || "").trim().length,
          role: String((meta && meta.role) || ""),
          status: String((meta && meta.status) || ""),
          lastLoginAt: meta && meta.lastLoginAt ? "presente" : "ausente",
          letra_aj: null,
          motivo_sem_letra: "aguardando_vinculo_oficial_nao_por_login",
        };
        report.vms.push(row);
        report.sem_bc.push({
          tipo: "vm_redis_clone",
          ref: row.ref,
          nota: "espelho operacional Redis; sem numeracao BC nesta etapa",
        });
      }
    }
  } catch (e) {
    report.redis = { ok: false, reason: String(e.message || e).slice(0, 200) };
  }

  report.finished_at = new Date().toISOString();
  const out = path.join(OUT_DIR, `inventario-vm-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        report_path: out,
        redis_ok: report.redis.ok,
        vms: report.vms.length,
        letras_atribuidas: report.vms.filter((v) => v.letra_aj).length,
        sem_bc: report.sem_bc.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
