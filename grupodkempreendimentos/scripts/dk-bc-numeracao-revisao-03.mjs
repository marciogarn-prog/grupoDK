/**
 * COMANDO 03/10 — REVISÃO 1
 * - Numera soft-deletes (estado=excluido) sem reativar cadastros
 * - Marca BC000000000001 como técnico permanente
 * - Conferência final por categoria
 * Não altera dados operacionais. Sem deploy. Sem PII no relatório.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(process.env.LOCALAPPDATA || ROOT, "DK-BC-BACKUP", "numeracao-03-rev1");
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
    { env, encoding: "utf8" }
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

const SOFT = [
  {
    key: "clientes_excluidos",
    origem: "dk_clientes",
    categoria: "cliente",
    sql: `SELECT id::text,
            encode(digest(convert_to(
              coalesce(id::text,'') || chr(1) || 'excluido' || chr(1) ||
              coalesce(deleted_at::text,'') || chr(1) || coalesce(payload::text,'') || chr(1) ||
              coalesce(updated_at::text,'') || chr(1) || coalesce(created_at::text,''), 'UTF8'), 'sha256'), 'hex')
           FROM public.dk_clientes
           WHERE deleted_at IS NOT NULL
           ORDER BY id`,
  },
  {
    key: "pagamentos_excluidos",
    origem: "dk_pagamento_locacao",
    categoria: "pagamento_locacao",
    sql: `SELECT id::text,
            encode(digest(convert_to(
              coalesce(id::text,'') || chr(1) || 'excluido' || chr(1) ||
              coalesce(deleted_at::text,'') || chr(1) || coalesce(removido::text,'') || chr(1) ||
              coalesce(migration_key,'') || chr(1) || coalesce(protocolo_lancamento,'') || chr(1) ||
              coalesce(tipo,'') || chr(1) || coalesce(source_payload_hash,'') || chr(1) ||
              coalesce(version::text,'') || chr(1) || coalesce(updated_at::text,'') || chr(1) ||
              coalesce(created_at::text,''), 'UTF8'), 'sha256'), 'hex')
           FROM public.dk_pagamento_locacao
           WHERE deleted_at IS NOT NULL OR coalesce(removido,false)=true
           ORDER BY id`,
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
    NULL,
    NULL,
    ${esc(p.estado || "excluido")},
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
    comando: "03/10-revisao-1",
    soft: {},
    tecnico: null,
    conferencia: [],
    pending: [],
    divergences: [],
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

  // 1) Marcar BC técnico (sem novo número)
  const techOut = psqlFresh(`
    UPDATE public.dk_bc_registro
    SET categoria = 'tecnico',
        subcategoria = 'smoke_infra',
        estado = 'tecnico',
        payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
          'tecnico', true,
          'excluir_totais_negocio', true,
          'comando', '03/10-revisao-1',
          'marcado_em', now()
        )
    WHERE bc_id = 'BC000000000001'
    RETURNING bc_id, bc_no::text, categoria, subcategoria, estado, vigente::text;
  `);
  report.tecnico = { raw: techOut, ok: Boolean(techOut && techOut.includes("BC000000000001")) };

  // 2) Numerar soft-deletes
  for (const cat of SOFT) {
    const rows = parseTsv(psqlFresh(cat.sql)).map((p) => ({ id: p[0], hash: p[1] }));
    const already = new Set(
      parseTsv(
        psqlFresh(
          `SELECT registro_id FROM public.dk_bc_registro WHERE vigente AND origem='${cat.origem.replace(/'/g, "''")}'`
        )
      ).map((r) => r[0])
    );
    const snapshot = rows.filter((s) => s.id && s.hash && s.hash.length >= 32 && !already.has(s.id));
    const catRep = {
      fonte_excluidos: rows.length,
      ja_numerados: rows.filter((r) => already.has(r.id)).length,
      a_numerar: snapshot.length,
      bc_atribuidos: 0,
      idempotentes: 0,
      falhas: [],
      first_bc: null,
      last_bc: null,
    };

    for (let i = 0; i < snapshot.length; i += BATCH) {
      const batch = snapshot.slice(i, i + BATCH);
      const stmts = batch.map((item) => {
        const operation_id = uuidFromKey(`bc-init-excluido|${cat.origem}|${item.id}`);
        return confirmarSql({
          operation_id,
          categoria: cat.categoria,
          subcategoria: "numeracao_inicial_excluido",
          origem: cat.origem,
          registro_id: item.id,
          estado: "excluido",
          hash_integridade: item.hash,
          payload: {
            comando: "03/10-revisao-1",
            estado: "excluido",
            origem: cat.origem,
            registro_id: item.id,
            hash_integridade: item.hash,
          },
        });
      });
      refreshPasswordIfNeeded(i === 0 || i % (BATCH * 2) === 0);
      const out = psqlFresh(stmts.join("\n"));
      for (const r of parseTsv(out)) {
        const [ok, bc_id, , status, idempotent, reason] = r;
        if (ok === "t" && status === "confirmado") {
          catRep.bc_atribuidos += 1;
          if (idempotent === "t") catRep.idempotentes += 1;
          if (!catRep.first_bc) catRep.first_bc = bc_id;
          catRep.last_bc = bc_id;
        } else {
          catRep.falhas.push({ reason: reason || status || "fail", bc_id });
        }
      }
      console.log(`[${cat.key}] batch ${i / BATCH + 1} size=${batch.length} ok=${catRep.bc_atribuidos}`);
    }
    report.soft[cat.key] = catRep;
  }

  // 3) Conferência final (sem PII)
  const confSql = `
    WITH src AS (
      SELECT 'clientes'::text AS cat,
             (SELECT count(*) FROM public.dk_clientes) AS fisico,
             (SELECT count(*) FROM public.dk_clientes WHERE deleted_at IS NULL) AS ativos,
             (SELECT count(*) FROM public.dk_clientes WHERE deleted_at IS NOT NULL) AS excluidos
      UNION ALL
      SELECT 'veiculos',
             (SELECT count(*) FROM public.dk_veiculos),
             (SELECT count(*) FROM public.dk_veiculos WHERE deleted_at IS NULL),
             (SELECT count(*) FROM public.dk_veiculos WHERE deleted_at IS NOT NULL)
      UNION ALL
      SELECT 'locacoes',
             (SELECT count(*) FROM public.dk_locacao),
             (SELECT count(*) FROM public.dk_locacao WHERE deleted_at IS NULL),
             (SELECT count(*) FROM public.dk_locacao WHERE deleted_at IS NOT NULL)
      UNION ALL
      SELECT 'pagamentos_locacao',
             (SELECT count(*) FROM public.dk_pagamento_locacao),
             (SELECT count(*) FROM public.dk_pagamento_locacao WHERE deleted_at IS NULL AND coalesce(removido,false)=false),
             (SELECT count(*) FROM public.dk_pagamento_locacao WHERE deleted_at IS NOT NULL OR coalesce(removido,false)=true)
      UNION ALL
      SELECT 'manutencoes',
             (SELECT count(*) FROM public.dk_manutencao),
             (SELECT count(*) FROM public.dk_manutencao WHERE deleted_at IS NULL),
             (SELECT count(*) FROM public.dk_manutencao WHERE deleted_at IS NOT NULL)
    ),
    bc AS (
      SELECT
        CASE origem
          WHEN 'dk_clientes' THEN 'clientes'
          WHEN 'dk_veiculos' THEN 'veiculos'
          WHEN 'dk_locacao' THEN 'locacoes'
          WHEN 'dk_pagamento_locacao' THEN 'pagamentos_locacao'
          WHEN 'dk_manutencao' THEN 'manutencoes'
          ELSE origem
        END AS cat,
        count(*) FILTER (WHERE vigente AND estado <> 'tecnico') AS numerado,
        count(*) FILTER (WHERE vigente AND estado = 'excluido') AS numerado_excluido,
        min(bc_id) FILTER (WHERE vigente AND estado <> 'tecnico') AS first_bc,
        max(bc_id) FILTER (WHERE vigente AND estado <> 'tecnico') AS last_bc
      FROM public.dk_bc_registro
      WHERE origem IN ('dk_clientes','dk_veiculos','dk_locacao','dk_pagamento_locacao','dk_manutencao')
      GROUP BY 1
    )
    SELECT s.cat, s.fisico::text, s.ativos::text, s.excluidos::text,
           coalesce(b.numerado,0)::text,
           (s.fisico - coalesce(b.numerado,0))::text AS pendente,
           coalesce(b.first_bc,''), coalesce(b.last_bc,''),
           coalesce(b.numerado_excluido,0)::text
    FROM src s
    LEFT JOIN bc b ON b.cat = s.cat
    ORDER BY s.cat;

    SELECT 'totais',
           (SELECT last_bc_no::text FROM public.dk_bc_state WHERE id=1),
           (SELECT count(*)::text FROM public.dk_bc_registro WHERE vigente),
           (SELECT count(*)::text FROM public.dk_bc_registro WHERE vigente AND estado='tecnico'),
           (SELECT count(*)::text FROM public.dk_bc_registro WHERE vigente AND estado='excluido'),
           (SELECT count(*)::text FROM public.dk_bc_registro WHERE vigente AND estado='consolidado'),
           (SELECT count(*)::text FROM public.dk_bc_registro WHERE vigente AND estado <> 'tecnico');

    SELECT 'pos_numeracao_novos',
      (SELECT count(*)::text FROM public.dk_clientes c
         WHERE c.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM public.dk_bc_registro r WHERE r.vigente AND r.origem='dk_clientes' AND r.registro_id=c.id::text)),
      (SELECT count(*)::text FROM public.dk_veiculos v
         WHERE v.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM public.dk_bc_registro r WHERE r.vigente AND r.origem='dk_veiculos' AND r.registro_id=v.id::text)),
      (SELECT count(*)::text FROM public.dk_locacao l
         WHERE l.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM public.dk_bc_registro r WHERE r.vigente AND r.origem='dk_locacao' AND r.registro_id=l.id::text)),
      (SELECT count(*)::text FROM public.dk_pagamento_locacao p
         WHERE p.deleted_at IS NULL AND coalesce(p.removido,false)=false
           AND NOT EXISTS (SELECT 1 FROM public.dk_bc_registro r WHERE r.vigente AND r.origem='dk_pagamento_locacao' AND r.registro_id=p.id::text)),
      (SELECT count(*)::text FROM public.dk_manutencao m
         WHERE m.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM public.dk_bc_registro r WHERE r.vigente AND r.origem='dk_manutencao' AND r.registro_id=m.id::text));
  `;
  const confOut = psqlFresh(confSql);
  const confLines = confOut.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  report.conferencia_raw = confLines;
  for (const line of confLines) {
    if (line.startsWith("totais\t") || line.startsWith("pos_numeracao")) {
      report[line.split("\t")[0]] = line.split("\t").slice(1);
      continue;
    }
    const p = line.split("\t");
    if (p.length >= 8) {
      report.conferencia.push({
        categoria: p[0],
        fisico: Number(p[1]),
        ativos: Number(p[2]),
        excluidos: Number(p[3]),
        numerado: Number(p[4]),
        pendente: Number(p[5]),
        first_bc: p[6] || null,
        last_bc: p[7] || null,
        numerado_excluido: Number(p[8] || 0),
      });
    }
  }

  report.finished_at = new Date().toISOString();
  const pendCat = report.conferencia.reduce((a, c) => a + (c.pendente || 0), 0);
  const softFail = Object.values(report.soft).some((c) => c.falhas.length);
  report.status = !report.tecnico.ok || softFail || pendCat > 0 ? "PARCIAL" : "CONCLUIDA";

  const reportPath = path.join(OUT_DIR, `report-rev1-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("REPORT", reportPath);
  console.log(
    JSON.stringify(
      {
        status: report.status,
        tecnico: report.tecnico.ok,
        soft: Object.fromEntries(
          Object.entries(report.soft).map(([k, v]) => [
            k,
            { a_numerar: v.a_numerar, bc_atribuidos: v.bc_atribuidos, falhas: v.falhas.length, first_bc: v.first_bc, last_bc: v.last_bc },
          ])
        ),
        totais: report.totais,
        pos_numeracao_novos: report.pos_numeracao_novos,
        conferencia: report.conferencia,
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
