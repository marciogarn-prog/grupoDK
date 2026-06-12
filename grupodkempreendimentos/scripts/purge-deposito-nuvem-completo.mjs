/**
 * Apaga TODOS os documentos visíveis do depósito (CRLV, contratos, multas)
 * na nuvem demo e oficial — tombstone + blobs Supabase.
 * node grupodkempreendimentos/scripts/purge-deposito-nuvem-completo.mjs
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";

const CANAIS = [
  { nome: "demo", base: "https://demo.grupodkempreendimentos.com.br", channel: "demo", blobChannel: "demo" },
  { nome: "oficial", base: "https://grupodkempreendimentos.com.br", channel: "default", blobChannel: "default" },
];

function parseDep(payload) {
  const raw = payload?.dk_documentos_deposito_v1;
  if (!raw) return { crlv: [], contrato: [], multa: [] };
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return { crlv: [], contrato: [], multa: [] };
    }
  }
  return raw;
}

async function purgeCanal(cfg) {
  const snapUrl = `${cfg.base}/api/dk-cloud-snapshot?channel=${cfg.channel}`;
  const snap = await fetch(snapUrl).then((r) => r.json());
  if (!snap?.ok) throw new Error(`${cfg.nome}: snapshot GET falhou`);

  const dep = parseDep(snap.payload);
  const now = new Date().toISOString();
  const ids = [];
  let marcados = 0;

  for (const cat of ["crlv", "contrato", "multa"]) {
    dep[cat] = (Array.isArray(dep[cat]) ? dep[cat] : []).map((e) => {
      if (!e || e.excluido === true) return e;
      if (e.id) ids.push(String(e.id));
      marcados += 1;
      return {
        ...e,
        excluido: true,
        excluidoEm: now,
        excluidoPor: { nome: "Limpeza administrativa", cpf: "", tipo: "sistema", role: "admin" },
      };
    });
  }

  console.log(`\n[${cfg.nome}] ${marcados} documento(s) a marcar como excluído(s)`);
  if (!marcados) {
    console.log(`[${cfg.nome}] já vazio — nada a fazer`);
    return { marcados: 0, blobs: 0, visiveis: 0 };
  }

  const post = await fetch(snapUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload: { dk_documentos_deposito_v1: dep },
      updated_at: now,
    }),
  }).then((r) => r.json());

  if (!post?.ok) throw new Error(`${cfg.nome}: snapshot POST falhou — ${JSON.stringify(post)}`);

  let blobsOk = 0;
  for (const id of ids) {
    const label = `docblob:${cfg.blobChannel}:${id}`;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/dk_cloud_snapshots?label=eq.${encodeURIComponent(label)}`,
      {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }
    );
    if (res.ok) blobsOk += 1;
  }

  await new Promise((r) => setTimeout(r, 1500));
  const ver = await fetch(snapUrl).then((r) => r.json());
  const depVer = parseDep(ver.payload);
  const visiveis = ["crlv", "contrato", "multa"].reduce(
    (n, cat) => n + (depVer[cat] || []).filter((e) => e?.excluido !== true).length,
    0
  );

  console.log(`[${cfg.nome}] POST ok · blobs apagados: ${blobsOk}/${ids.length} · visíveis restantes: ${visiveis}`);
  if (visiveis > 0) throw new Error(`${cfg.nome}: ainda há ${visiveis} documento(s) visível(is)`);
  return { marcados, blobs: blobsOk, visiveis };
}

try {
  for (const cfg of CANAIS) {
    await purgeCanal(cfg);
  }
  console.log("\nLimpeza completa demo + oficial concluída.");
} catch (e) {
  console.error("Erro:", e?.message || e);
  process.exit(1);
}
