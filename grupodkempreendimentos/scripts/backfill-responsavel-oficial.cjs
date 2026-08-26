/**
 * Oficial: carimba responsável Márcio Santos-030 em cadastros/lançamentos sem rastreador.
 *   node grupodkempreendimentos/scripts/backfill-responsavel-oficial.cjs
 */
const REDIS = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const DEFAULT = {
  cadastradoPorCpf: "03037897430",
  cadastradoPorNome: "Márcio Santos",
  cadastradoPorLabel: "Márcio Santos-030",
};

function stampCad(r) {
  if (!r || typeof r !== "object") return r;
  const cpf = String(r.cadastradoPorCpf || "").replace(/\D/g, "");
  if (cpf.length === 11 && String(r.cadastradoPorNome || "").trim()) {
    return {
      ...r,
      cadastradoPorLabel:
        String(r.cadastradoPorLabel || "").trim() ||
        `${String(r.cadastradoPorNome).trim()}-${cpf.slice(0, 3)}`,
    };
  }
  return { ...r, ...DEFAULT };
}

function stampLan(lan) {
  if (!lan || typeof lan !== "object") return lan;
  const cpf = String(lan.registradoPorCpf || "").replace(/\D/g, "");
  const nome = String(lan.registradoPorNome || "").trim();
  if (cpf.length >= 3 && nome) {
    return {
      ...lan,
      registradoPorLabel: String(lan.registradoPorLabel || "").trim() || `${nome}-${cpf.slice(0, 3)}`,
    };
  }
  return {
    ...lan,
    registradoPorCpf: DEFAULT.cadastradoPorCpf,
    registradoPorNome: DEFAULT.cadastradoPorNome,
    registradoPorLabel: DEFAULT.cadastradoPorLabel,
  };
}

function stampLoc(l) {
  let out = stampCad(l);
  if (!String(out.portalLocacaoExecutadoPorCpf || "").replace(/\D/g, "").slice(0, 11)) {
    out = {
      ...out,
      portalLocacaoExecutadoPorCpf: DEFAULT.cadastradoPorCpf,
      portalLocacaoExecutadoPorNome: DEFAULT.cadastradoPorNome,
    };
  }
  if (Array.isArray(out.portalLancamentosAluguel)) {
    out.portalLancamentosAluguel = out.portalLancamentosAluguel.map(stampLan);
  }
  return out;
}

async function main() {
  const redis = await fetch(`${REDIS}?n=${Date.now()}`).then((r) => r.json());
  if (!redis?.ok || redis.label !== "default") throw new Error("oficial indisponível");
  const p = { ...(redis.payload || {}) };
  const before = {
    c: (p.dk_clientes_cadastro || []).length,
    v: (p.dk_veiculos_cadastro || []).length,
    l: (p.dk_locacoes_cadastro || []).length,
  };
  p.dk_clientes_cadastro = (p.dk_clientes_cadastro || []).map(stampCad);
  p.dk_portal_clientes_cadastro = (p.dk_portal_clientes_cadastro || p.dk_clientes_cadastro || []).map(stampCad);
  p.dk_veiculos_cadastro = (p.dk_veiculos_cadastro || []).map(stampCad);
  p.dk_portal_veiculos_cadastro = (p.dk_portal_veiculos_cadastro || p.dk_veiculos_cadastro || []).map(stampCad);
  p.dk_locacoes_cadastro = (p.dk_locacoes_cadastro || []).map(stampLoc);
  if (Array.isArray(p.dk_funcionarios_access)) {
    p.dk_funcionarios_access = p.dk_funcionarios_access.map(stampCad);
  }
  const updated_at = new Date().toISOString();
  const post = await fetch(REDIS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload: p,
      updated_at,
      wipe_keys: [
        "dk_clientes_cadastro",
        "dk_portal_clientes_cadastro",
        "dk_veiculos_cadastro",
        "dk_portal_veiculos_cadastro",
        "dk_locacoes_cadastro",
        "dk_funcionarios_access",
      ],
    }),
  }).then((r) => r.json());
  if (!post?.ok) throw new Error(post?.error || post?.reason || "POST falhou");
  await fetch(`${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.${LABEL}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ payload: p, updated_at }),
  });
  const sample = (p.dk_clientes_cadastro || [])[0];
  console.log({
    ok: true,
    ...before,
    sampleCliente: sample && {
      nome: sample.nome,
      cadastradoPorLabel: sample.cadastradoPorLabel,
    },
    sampleLoc: (p.dk_locacoes_cadastro || [])[0]?.cadastradoPorLabel,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
