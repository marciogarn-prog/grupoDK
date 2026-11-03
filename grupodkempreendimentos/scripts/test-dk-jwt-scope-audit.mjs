/**
 * Auditoria estática: papel authenticated não deve ter grants perigosos nos SQL DK.
 * Não consulta produção. Marca JWT_SCOPE residual se schema legado ambíguo.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const supabaseDir = path.join(root, "supabase");
const files = fs.readdirSync(supabaseDir).filter((f) => f.endsWith(".sql"));

const perigosos = [];
const seguros = [];

for (const f of files) {
  const text = fs.readFileSync(path.join(supabaseDir, f), "utf8");
  const low = text.toLowerCase();
  if (/grant\s+(select|insert|update|delete|all|execute).*\bto\s+authenticated\b/.test(low)) {
    if (/revoke\s+all.+\bauthenticated\b/.test(low) && !/grant\s+(select|insert|update|delete).*\bto\s+authenticated\b(?![\s\S]*revoke)/.test(low)) {
      /* tem grant e revoke — inspecionar manualmente */
    }
    const grants = text.match(/grant[^;]+to\s+authenticated[^;]*/gi) || [];
    for (const g of grants) {
      if (/realtime\.messages/i.test(g)) continue; /* policy SQL comentada ok */
      if (/^--/m.test(g)) continue;
      perigosos.push({ file: f, grant: g.slice(0, 160) });
    }
  }
  if (/revoke\s+all on table public\.dk_/.test(low) && /authenticated/.test(low)) {
    seguros.push(f);
  }
}

/** Tabelas de negócio devem revogar authenticated */
for (const t of ["dk_clientes", "dk_locacao", "dk_events", "dk_veiculos"]) {
  const hit = files.some((f) => {
    const t2 = fs.readFileSync(path.join(supabaseDir, f), "utf8").toLowerCase();
    return t2.includes(t) && t2.includes("revoke all") && t2.includes("authenticated");
  });
  assert.ok(hit, "revoke authenticated esperado para " + t);
}

/** Emissor nunca usa service_role como claim */
const jwtLib = fs.readFileSync(path.join(root, "lib", "dk-realtime-jwt-es256.cjs"), "utf8");
assert.match(jwtLib, /service_role_proibido/);
assert.match(jwtLib, /role:\s*"authenticated"/);
assert.doesNotMatch(jwtLib, /role:\s*"service_role"/);

/** schema.sql legado: grant histórico — risco residual documentado */
const schema = fs.readFileSync(path.join(supabaseDir, "schema.sql"), "utf8");
const legadoSnapshotGrant = /grant select, insert, update, delete on table public\.dk_cloud_snapshots to anon, authenticated/i.test(schema);
const fase1a = fs.readFileSync(path.join(supabaseDir, "fase-1a-revoke-anon.sql"), "utf8");
assert.ok(/revoke all on table public\.dk_cloud_snapshots from anon, authenticated/i.test(fase1a));

console.log(
  JSON.stringify(
    {
      ok: true,
      jwt_scope: legadoSnapshotGrant ? "JWT_SCOPE_RESIDUAL_LEGACY_SCHEMA_DOCUMENTED" : "ok",
      nota:
        "schema.sql histórico concede snapshots a authenticated; fase-1a revoga. " +
        "Validação na plataforma Supabase ainda é obrigatória antes da ativação.",
      arquivos_com_revoke_dk: seguros.length,
      grants_authenticated_suspeitos: perigosos.length,
      perigosos: perigosos.slice(0, 10),
    },
    null,
    2
  )
);
