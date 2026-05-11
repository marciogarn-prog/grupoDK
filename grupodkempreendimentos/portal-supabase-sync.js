/**
 * Sincronização do localStorage DK ↔ Supabase (tabela dk_cloud_snapshots).
 * Requer window.__DK_SUPABASE_CLIENT__ (supabase-init.js) e schema.sql aplicado.
 */
(function portalSupabaseSync() {
  const DK_SNAPSHOT_LABEL = "default";

  const DK_STORAGE_KEYS = [
    "dk_clientes_cadastro",
    "dk_clientes_validacao_pendente",
    "dk_veiculos_cadastro",
    "dk_locacoes_cadastro",
    "dk_locacoes_quadro_geral",
    "dk_manutencoes_cadastro",
    "dk_lancamentos_aluguel",
    "dk_quadro_receita_overrides",
    "dk_comprovantes_banco",
    "dk_audit_log",
    "dk_funcionarios_access",
  ];

  function collectPayloadFromLocalStorage() {
    const payload = {};
    for (const k of DK_STORAGE_KEYS) {
      const raw = localStorage.getItem(k);
      if (raw == null) continue;
      try {
        payload[k] = JSON.parse(raw);
      } catch {
        payload[k] = raw;
      }
    }
    return payload;
  }

  function applyPayloadToLocalStorage(payload) {
    if (!payload || typeof payload !== "object") return;
    for (const k of DK_STORAGE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(payload, k)) continue;
      const v = payload[k];
      if (v === undefined || v === null) {
        localStorage.removeItem(k);
        continue;
      }
      if (typeof v === "string") {
        localStorage.setItem(k, v);
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }
  }

  function setMsg(text) {
    const el = document.getElementById("portal-cloud-sync-msg");
    if (el) el.textContent = text || "";
  }

  function refreshCloudBarVisibility() {
    const bar = document.getElementById("portal-cloud-sync-bar");
    if (!bar) return;
    const ok = Boolean(window.__DK_SUPABASE_CONFIGURED__);
    bar.classList.toggle("hidden", !ok);
  }

  async function pushSnapshot() {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client) {
      setMsg("Nuvem não configurada (URL/chave anon em falta).");
      return;
    }
    setMsg("A guardar na nuvem…");
    const payload = collectPayloadFromLocalStorage();
    const row = {
      label: DK_SNAPSHOT_LABEL,
      payload,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from("dk_cloud_snapshots").upsert(row, {
      onConflict: "label",
    });
    if (error) {
      console.error(error);
      setMsg(`Erro ao guardar: ${error.message || error}`);
      return;
    }
    setMsg("Dados guardados na nuvem. Noutro aparelho use «Carregar da nuvem».");
  }

  async function pullSnapshot() {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client) {
      setMsg("Nuvem não configurada (URL/chave anon em falta).");
      return;
    }
    if (
      !window.confirm(
        "Isto substitui os dados deste navegador pelos dados guardados na nuvem. Continuar?"
      )
    ) {
      return;
    }
    setMsg("A carregar da nuvem…");
    const { data, error } = await client
      .from("dk_cloud_snapshots")
      .select("payload")
      .eq("label", DK_SNAPSHOT_LABEL)
      .maybeSingle();
    if (error) {
      console.error(error);
      setMsg(`Erro ao ler: ${error.message || error}`);
      return;
    }
    if (!data || !data.payload) {
      setMsg("Ainda não há dados na nuvem. Use primeiro «Guardar na nuvem» neste ou noutro PC.");
      return;
    }
    applyPayloadToLocalStorage(data.payload);
    setMsg("Dados carregados. Recarregue a página (F5) para atualizar formulários.");
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  }

  function bind() {
    document.getElementById("btn-dk-cloud-push")?.addEventListener("click", () => {
      pushSnapshot().catch((e) => {
        console.error(e);
        setMsg(String(e?.message || e));
      });
    });
    document.getElementById("btn-dk-cloud-pull")?.addEventListener("click", () => {
      pullSnapshot().catch((e) => {
        console.error(e);
        setMsg(String(e?.message || e));
      });
    });
    refreshCloudBarVisibility();
    window.addEventListener("dk-supabase-ready", refreshCloudBarVisibility);
    window.addEventListener("load", refreshCloudBarVisibility);
    setTimeout(refreshCloudBarVisibility, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
