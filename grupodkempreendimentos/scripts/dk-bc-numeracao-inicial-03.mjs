/**
 * COMANDO 03/10 — conciliação e numeração inicial BC (oficial).
 * Não altera tabelas operacionais. Não faz deploy. Sem PII no relatório.
 *
 * Uso:
 *   node scripts/dk-bc-numeracao-inicial-03.mjs
 *
 * Credenciais: SUPABASE_SERVICE_ROLE_KEY (RPC) ou login role via dry-run + pg.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "numeracao-03");
const PG_BIN = process.env.DK_PG_BIN || "C:\\dk-pgsql\\pgsql\\bin";
const BATCH = Number(process.env.DK_BC_BATCH || 100);

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

function sha256(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function uuidFromKey(key) {
  const h = crypto.createHash("sha256").update(String(key), "utf8").digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function getLoginPassword() {
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "supabase", "db", "dump", "--remote", "--dry-run", "-f", "NUL"],
    { cwd: ROOT, encoding: "utf8", shell: true }
  );
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  const m = out.match(/PGPASSWORD="([^"]+)"/);
  if (!m) throw new Error("login_role_password_unavailable");
  return m[1];
}

function psql(sql, password) {
  const env = {
    ...process.env,
    PGPASSWORD: password,
    PGHOST: "db.ppxtwqvzgujllfzarpuz.supabase.co",
    PGPORT: "5432",
    PGUSER: "cli_login_postgres",
    PGDATABASE: "postgres",
  };
  const wrapped = `SET ROLE postgres;\nSET search_path TO public, extensions;\n${sql}`;
  const tmp = path.join(OUT_DIR, `q-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.sql`);
  fs.writeFileSync(tmp, wrapped, "utf8");
  const r = spawnSync(
    path.join(PG_BIN, "psql.exe"),
    ["-v", "ON_ERROR_STOP=1", "-f", tmp, "-A", "-F", "\t", "-t", "-q"],
    {
      env,
      encoding: "utf8",
    }
  );
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.status !== 0) {
    const err = String(r.stderr || r.stdout || "")
      .replace(/\d{11}/g, "[cpf]")
      .replace(/[A-Z]{3}\d[A-Z0-9]\d{2}/gi, "[placa]")
      .slice(0, 400);
    throw new Error(`psql_failed: ${err}`);
  }
  return String(r.stdout || "").trim();
}

function parseTsv(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .map((l) => l.split("\t"));
}

async function redisCompare() {
  const out = { ok: false, keys: {} };
  try {
    const { Redis } = require("@upstash/redis");
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return { ...out, reason: "redis_env_missing" };
    const redis = new Redis({ url, token });
    const candidates = [
      "dk:clientes",
      "dk:veiculos",
      "dk:locacao",
      "dk:locacoes",
      "dk:pagamento_locacao",
      "dk:pagamentos",
      "portal:clientes",
      "portal:veiculos",
    ];
    for (const k of candidates) {
      const t = await redis.type(k);
      let n = null;
      if (t === "none") n = 0;
      else if (t === "string") {
        const v = await redis.get(k);
        try {
          const j = typeof v === "string" ? JSON.parse(v) : v;
          n = Array.isArray(j) ? j.length : j && typeof j === "object" ? Object.keys(j).length : null;
        } catch {
          n = null;
        }
      } else if (t === "hash") n = await redis.hlen(k);
      else if (t === "list") n = await redis.llen(k);
      else if (t === "zset") n = await redis.zcard(k);
      out.keys[k] = { type: t, count: n };
    }
    out.ok = true;
    return out;
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  }
}

// Snapshot só devolve id + hash (sem PII / sem JSON operacional no Node).
const CATEGORIES = [
  {
    key: "clientes",
    origem: "dk_clientes",
    categoria: "cliente",
    sqlLive: `SELECT id::text,
              encode(digest(
                convert_to(coalesce(id::text,'') || chr(1) || coalesce(payload::text,'') || chr(1) || coalesce(updated_at::text,'') || chr(1) || coalesce(created_at::text,''), 'UTF8'),
                'sha256'), 'hex')
              FROM public.dk_clientes WHERE deleted_at IS NULL ORDER BY id`,
  },
  {
    key: "veiculos",
    origem: "dk_veiculos",
    categoria: "veiculo",
    sqlLive: `SELECT id::text,
              encode(digest(
                convert_to(coalesce(id::text,'') || chr(1) || coalesce(placa,'') || chr(1) || coalesce(payload::text,'') || chr(1) || coalesce(updated_at::text,'') || chr(1) || coalesce(created_at::text,''), 'UTF8'),
                'sha256'), 'hex')
              FROM public.dk_veiculos WHERE deleted_at IS NULL ORDER BY id`,
  },
  {
    key: "locacoes",
    origem: "dk_locacao",
    categoria: "locacao",
    sqlLive: `SELECT id::text,
              encode(digest(
                convert_to(coalesce(id::text,'') || chr(1) || coalesce(numero_contrato,'') || chr(1) || coalesce(status_locacao,'') || chr(1) || coalesce(campos::text,'') || chr(1) || coalesce(version::text,'') || chr(1) || coalesce(updated_at::text,'') || chr(1) || coalesce(created_at::text,''), 'UTF8'),
                'sha256'), 'hex')
              FROM public.dk_locacao WHERE deleted_at IS NULL ORDER BY id`,
  },
  {
    key: "pagamentos_locacao",
    origem: "dk_pagamento_locacao",
    categoria: "pagamento_locacao",
    sqlLive: `SELECT id::text,
              encode(digest(
                convert_to(coalesce(id::text,'') || chr(1) || coalesce(migration_key,'') || chr(1) || coalesce(protocolo_lancamento,'') || chr(1) || coalesce(tipo,'') || chr(1) || coalesce(source_payload_hash,'') || chr(1) || coalesce(version::text,'') || chr(1) || coalesce(updated_at::text,'') || chr(1) || coalesce(created_at::text,''), 'UTF8'),
                'sha256'), 'hex')
              FROM public.dk_pagamento_locacao
              WHERE deleted_at IS NULL AND coalesce(removido,false)=false
              ORDER BY id`,
  },
  {
    key: "manutencoes",
    origem: "dk_manutencao",
    categoria: "manutencao",
    sqlLive: `SELECT id::text,
              encode(digest(
                convert_to(coalesce(id::text,'') || chr(1) || coalesce(source_kind,'') || chr(1) || coalesce(source_id,'') || chr(1) || coalesce(placa,'') || chr(1) || coalesce(status,'') || chr(1) || coalesce(payload::text,'') || chr(1) || coalesce(record_version::text,'') || chr(1) || coalesce(updated_at::text,'') || chr(1) || coalesce(created_at::text,''), 'UTF8'),
                'sha256'), 'hex')
              FROM public.dk_manutencao WHERE deleted_at IS NULL ORDER BY id`,
  },
];

function confirmarSql(p) {
  const payload = JSON.stringify(p.payload || {}).replace(/'/g, "''");
  const esc = (v) => (v == null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
  return `SELECT ok, bc_id, bc_no, status, idempotent, reason FROM public.dk_bc_confirmar(
    '${p.operation_id}'::uuid,
    NULL,
    ${esc(p.categoria)},
    ${esc(p.subcategoria || "")},
    ${esc(p.origem)},
    ${esc(p.registro_id)},
    ${esc(p.empresa_id || null)},
    ${esc(p.filial_id || null)},
    ${esc(p.estado || "consolidado")},
    NULL,
    ${esc(p.hash_integridade)},
    NULL,
    '${payload}'::jsonb
  );`;
}

async function main() {
  ensureDir(OUT_DIR);
  const report = {
    started_at: new Date().toISOString(),
    project: "ppxtwqvzgujllfzarpuz",
    categories: {},
    first_bc: null,
    last_bc: null,
    counter_end: null,
    divergences: [],
    pending: [],
    redis: null,
    smoke: null,
  };

  let password = getLoginPassword();
  let passwordAt = Date.now();
  function refreshPasswordIfNeeded(force = false) {
    if (force || Date.now() - passwordAt > 4 * 60 * 1000) {
      password = getLoginPassword();
      passwordAt = Date.now();
    }
  }
  function psqlFresh(sql) {
    try {
      refreshPasswordIfNeeded(false);
      return psql(sql, password);
    } catch (e) {
      const msg = String(e.message || e);
      if (/password authentication failed|SSL connection|timeout|terminat/i.test(msg)) {
        refreshPasswordIfNeeded(true);
        return psql(sql, password);
      }
      throw e;
    }
  }

  // Ambiente
  const envOut = psqlFresh(
    `SELECT 'tables', coalesce(to_regclass('public.dk_bc_registro')::text,'null'), coalesce(to_regclass('public.dk_bc_state')::text,'null'), coalesce(to_regclass('public.dk_bc_operacao')::text,'null');
     SELECT 'last_bc_no', last_bc_no::text FROM public.dk_bc_state WHERE id=1;
     SELECT 'regs', count(*)::text FROM public.dk_bc_registro;
     SELECT 'ops', count(*)::text FROM public.dk_bc_operacao;`,
    password
  );
  const envLines = envOut.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  report.env = { raw: envLines };
  const lastLine = envLines.find((l) => l.startsWith("last_bc_no\t") || l.startsWith("last_bc_no "));
  const regsLine = envLines.find((l) => l.startsWith("regs\t") || l.startsWith("regs "));
  const opsLine = envLines.find((l) => l.startsWith("ops\t") || l.startsWith("ops "));
  const lastBcStart = Number((lastLine || "last_bc_no\t0").split(/\t| /)[1] || 0);
  const regsStart = Number((regsLine || "regs\t0").split(/\t| /)[1] || 0);
  const opsStart = Number((opsLine || "ops\t0").split(/\t| /)[1] || 0);
  report.env.parsed = { lastBcStart, regsStart, opsStart };
  if (!Number.isFinite(lastBcStart) || lastBcStart < 0) {
    report.status = "BLOQUEADA";
    report.reason = `precondicao_falhou:last=${lastBcStart},regs=${regsStart},ops=${opsStart}`;
    fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  // Permite retomar após smoke técnico (BC000000000001) autorizado pela análise 02/10.
  report.smoke_preexistente = lastBcStart > 0;

  report.redis = await redisCompare();

  // Snapshot inicial + numeração por categoria
  for (const cat of CATEGORIES) {
    const rows = parseTsv(psqlFresh(cat.sqlLive));
    const snapshotAll = rows.map((parts) => {
      const id = parts[0];
      const hash = parts[1];
      if (!id || !hash || hash.length < 32) throw new Error(`snapshot_invalido:${cat.key}`);
      return { id, hash };
    });
    const already = new Set(
      parseTsv(
        psqlFresh(
          `SELECT registro_id FROM public.dk_bc_registro WHERE vigente AND origem='${cat.origem.replace(/'/g, "''")}'`
        )
      ).map((r) => r[0])
    );
    const snapshot = snapshotAll.filter((s) => !already.has(s.id));
    const snapPath = path.join(OUT_DIR, `snapshot-${cat.key}.json`);
    fs.writeFileSync(
      snapPath,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          count_fonte: snapshotAll.length,
          count_ja_numerados: already.size,
          count_a_numerar: snapshot.length,
          items: snapshot,
        },
        null,
        2
      )
    );

    const catRep = {
      fonte: "postgresql:" + cat.origem,
      fonte_oficial_count: snapshotAll.length,
      ja_numerados: already.size,
      a_numerar: snapshot.length,
      logicos_distintos: new Set(snapshotAll.map((s) => s.id)).size,
      bc_atribuidos: 0,
      duplicidades: 0,
      divergencias: 0,
      pendentes: 0,
      idempotentes: 0,
      falhas: [],
      first_bc: null,
      last_bc: null,
    };
    if (catRep.logicos_distintos !== snapshot.length) {
      catRep.duplicidades = snapshot.length - catRep.logicos_distintos;
    }

    for (let i = 0; i < snapshot.length; i += BATCH) {
      const batch = snapshot.slice(i, i + BATCH);
      const stmts = batch.map((item) => {
        const operation_id = uuidFromKey(`bc-init|${cat.origem}|${item.id}`);
        return confirmarSql({
          operation_id,
          categoria: cat.categoria,
          subcategoria: "numeracao_inicial",
          origem: cat.origem,
          registro_id: item.id,
          estado: "consolidado",
          hash_integridade: item.hash,
          payload: {
            comando: "03/10",
            origem: cat.origem,
            registro_id: item.id,
            hash_integridade: item.hash,
          },
        });
      });
      refreshPasswordIfNeeded(i === 0 || i % (BATCH * 2) === 0);
      const out = psqlFresh(stmts.join("\n"));
      const results = parseTsv(out);
      for (const r of results) {
        // ok bc_id bc_no status idempotent reason
        const [ok, bc_id, bc_no, status, idempotent, reason] = r;
        if (ok === "t" && status === "confirmado") {
          catRep.bc_atribuidos += 1;
          if (idempotent === "t") catRep.idempotentes += 1;
          if (!catRep.first_bc) catRep.first_bc = bc_id;
          catRep.last_bc = bc_id;
          if (!report.first_bc) report.first_bc = bc_id;
          report.last_bc = bc_id;
        } else {
          catRep.falhas.push({ reason: reason || status || "fail", bc_id });
        }
      }
      console.log(`[${cat.key}] batch ${i / BATCH + 1} size=${batch.length} ok_so_far=${catRep.bc_atribuidos}`);
    }

    // Releitura pós-lote: novos / removidos / hash mudou
    const after = parseTsv(psqlFresh(cat.sqlLive)).map((parts) => ({ id: parts[0], hash: parts[1] }));
    const beforeMap = new Map(snapshot.map((s) => [s.id, s.hash]));
    const afterMap = new Map(after.map((s) => [s.id, s.hash]));
    for (const [id, hash] of afterMap) {
      if (!beforeMap.has(id)) {
        catRep.pendentes += 1;
        report.pending.push({ categoria: cat.key, id, tipo: "criado_durante_janela" });
      } else if (beforeMap.get(id) !== hash) {
        catRep.divergencias += 1;
        report.divergences.push({ categoria: cat.key, id, tipo: "modificado_durante_janela" });
      }
    }
    for (const id of beforeMap.keys()) {
      if (!afterMap.has(id)) {
        catRep.pendentes += 1;
        report.pending.push({ categoria: cat.key, id, tipo: "removido_durante_janela" });
      }
    }

    report.categories[cat.key] = catRep;
  }

  const endState = parseTsv(
    psqlFresh(
      `SELECT last_bc_no::text, (SELECT count(*)::text FROM public.dk_bc_registro WHERE vigente); SELECT min(bc_id), max(bc_id) FROM public.dk_bc_registro WHERE vigente;`
    )
  );
  report.counter_end = Number(endState[0]?.[0] || 0);
  report.vigentes = Number(endState[0]?.[1] || 0);
  report.min_max = endState[1] || [];
  report.finished_at = new Date().toISOString();
  report.status =
    report.pending.length || report.divergences.length || Object.values(report.categories).some((c) => c.falhas.length)
      ? "PARCIAL"
      : "CONCLUIDA";

  const reportPath = path.join(OUT_DIR, `report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("REPORT", reportPath);
  console.log(
    JSON.stringify(
      {
        status: report.status,
        first_bc: report.first_bc,
        last_bc: report.last_bc,
        counter_end: report.counter_end,
        vigentes: report.vigentes,
        pending: report.pending.length,
        divergences: report.divergences.length,
        categories: Object.fromEntries(
          Object.entries(report.categories).map(([k, v]) => [
            k,
            {
              fonte_oficial_count: v.fonte_oficial_count,
              bc_atribuidos: v.bc_atribuidos,
              divergencias: v.divergencias,
              pendentes: v.pendentes,
              falhas: v.falhas.length,
              first_bc: v.first_bc,
              last_bc: v.last_bc,
            },
          ])
        ),
        redis_ok: report.redis?.ok,
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
