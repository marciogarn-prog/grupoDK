/**
 * Corrige na nuvem o comprovante José 0,40 preso (cc_1779377485655_uz8i5vx).
 * node grupodkempreendimentos/scripts/fix-comprovante-jose-040-nuvem.cjs
 */
const REDIS_SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";
const TARGET_ID = "cc_1779377485655_uz8i5vx";
const CPF = "19174403400";

async function main() {
  const res = await fetch(REDIS_SNAPSHOT_URL);
  const data = await res.json().catch(() => ({}));
  const payload = data?.payload;
  if (!payload) throw new Error("Snapshot indisponível");

  const list = Array.isArray(payload.dk_comprovantes_cliente_pendentes)
    ? payload.dk_comprovantes_cliente_pendentes
    : [];
  const idx = list.findIndex((r) => r.id === TARGET_ID);
  if (idx < 0) {
    console.log("Comprovante já ausente na nuvem:", TARGET_ID);
    return;
  }
  const cur = list[idx];
  list[idx] = {
    ...cur,
    status: "rejeitado",
    valor: 40,
    reabertoParaOperadorEm: "",
    rejeitadoAutomatico: false,
    rejeitadoMotivoCliente:
      cur.rejeitadoMotivoCliente ||
      "Pagamento arquivado — cliente marcou «De acordo» com a análise da DK.",
    rejeitadoEm: cur.rejeitadoEm || cur.clienteDeAcordoEm || new Date().toISOString(),
    clienteDeAcordoEm: cur.clienteDeAcordoEm || new Date().toISOString(),
    valorCorrigidoSistemaEm: "",
  };
  payload.dk_comprovantes_cliente_pendentes = list;

  const post = await fetch(REDIS_SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload,
      updated_at: new Date().toISOString(),
      replace: true,
    }),
  });
  const out = await post.json().catch(() => ({}));
  if (!post.ok || !out?.ok) throw new Error(out?.error || out?.reason || "POST falhou");

  console.log("Corrigido na nuvem:", TARGET_ID, "CPF", CPF, "→ rejeitado + de acordo, valor 40");
  console.log("Portal: Carregar da nuvem. App José: Atualizar da nuvem.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
