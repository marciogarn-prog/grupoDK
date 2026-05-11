/**
 * Sincronização do localStorage DK ↔ Supabase (tabela dk_cloud_snapshots).
 * Requer window.__DK_SUPABASE_CLIENT__ (supabase-init.js) e schema.sql aplicado.
 *
 * - Ao abrir o site: tenta carregar o snapshot da nuvem; se for diferente do
 *   navegador, aplica e recarrega a página uma vez.
 * - Após guardar qualquer dado DK (chaves listadas): envia snapshot para a nuvem
 *   (debounce; sem mensagem a cada tecla).
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

  const DK_CLOUD_KEYS = new Set(DK_STORAGE_KEYS);

  const CLOUD_PUSH_DEBOUNCE_MS = 1200;

  let cloudPushTimer = null;
  let suppressCloudHook = false;
  let autoPullFromCloudRan = false;

  function runAutoPullFromCloudOnce() {
    if (autoPullFromCloudRan) return;
    autoPullFromCloudRan = true;
    return autoPullFromCloudOnStartup();
  }

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

  const DK_IMMUTABLE_CADASTRO_KEYS = new Set([
    "dk_clientes_cadastro",
    "dk_veiculos_cadastro",
    "dk_locacoes_cadastro",
  ]);

  function applyPayloadToLocalStorage(payload) {
    if (!payload || typeof payload !== "object") return;
    for (const k of DK_STORAGE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(payload, k)) continue;
      const v = payload[k];
      if (v === undefined || v === null) {
        if (DK_IMMUTABLE_CADASTRO_KEYS.has(k)) continue;
        localStorage.removeItem(k);
        continue;
      }
      if (DK_IMMUTABLE_CADASTRO_KEYS.has(k) && typeof saveCadastro === "function") {
        let arr = [];
        if (Array.isArray(v)) arr = v;
        else if (typeof v === "string") {
          try {
            const p = JSON.parse(v);
            arr = Array.isArray(p) ? p : [];
          } catch {
            arr = [];
          }
        }
        saveCadastro(k, arr);
        continue;
      }
      if (typeof v === "string") {
        localStorage.setItem(k, v);
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }
  }

  function setMsg(text, tone) {
    const el = document.getElementById("portal-cloud-sync-msg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("portal-feedback--cloud-ok", "portal-feedback--cloud-muted");
    if (tone === "ok") el.classList.add("portal-feedback--cloud-ok");
    else if (tone === "muted") el.classList.add("portal-feedback--cloud-muted");
  }

  function refreshCloudBarVisibility() {
    const bar = document.getElementById("portal-cloud-sync-bar");
    if (!bar) return;
    const ok = Boolean(window.__DK_SUPABASE_CONFIGURED__);
    bar.classList.toggle("hidden", !ok);
  }

  function scheduleCloudPushDebounced() {
    if (suppressCloudHook) return;
    if (!window.__DK_SUPABASE_CONFIGURED__) return;
    clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(() => {
      cloudPushTimer = null;
      pushSnapshotQuiet().catch((e) => {
        console.error(e);
        setMsg(String(e?.message || e), null);
      });
    }, CLOUD_PUSH_DEBOUNCE_MS);
  }

  function installLocalStorageCloudHook() {
    const proto = Storage.prototype;
    if (proto.__dkCloudHookInstalled) return;
    proto.__dkCloudHookInstalled = true;

    const origSet = proto.setItem;
    const origRemove = proto.removeItem;

    proto.setItem = function dkCloudHookSetItem(key, value) {
      origSet.apply(this, arguments);
      if (this !== localStorage) return;
      if (!DK_CLOUD_KEYS.has(String(key))) return;
      scheduleCloudPushDebounced();
    };

    proto.removeItem = function dkCloudHookRemoveItem(key) {
      origRemove.apply(this, arguments);
      if (this !== localStorage) return;
      if (!DK_CLOUD_KEYS.has(String(key))) return;
      scheduleCloudPushDebounced();
    };
  }

  function isMeaningfulCloudPayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    return DK_STORAGE_KEYS.some((k) =>
      Object.prototype.hasOwnProperty.call(payload, k)
    );
  }

  function cloudPayloadDiffersFromLocal(cloudPayload) {
    const localObj = collectPayloadFromLocalStorage();
    for (const k of DK_STORAGE_KEYS) {
      const a = Object.prototype.hasOwnProperty.call(cloudPayload, k)
        ? cloudPayload[k]
        : undefined;
      const b = Object.prototype.hasOwnProperty.call(localObj, k)
        ? localObj[k]
        : undefined;
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    }
    return false;
  }

  async function upsertSnapshotRow(showUserMessages) {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client) {
      if (showUserMessages) {
        setMsg("Nuvem não configurada (URL/chave anon em falta).");
      }
      return { ok: false, error: new Error("no client") };
    }
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
      if (showUserMessages) {
        setMsg(`Erro ao guardar: ${error.message || error}`);
      }
      return { ok: false, error };
    }
    return { ok: true };
  }

  async function pushSnapshotQuiet() {
    const r = await upsertSnapshotRow(false);
    if (r.ok) {
      setMsg("Nuvem atualizada em segundo plano.", "muted");
    }
    return r;
  }

  async function pushSnapshot() {
    clearTimeout(cloudPushTimer);
    cloudPushTimer = null;
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client) {
      setMsg("Nuvem não configurada (URL/chave anon em falta).");
      return;
    }
    setMsg("A guardar na nuvem…", "muted");
    const { ok, error } = await upsertSnapshotRow(true);
    if (!ok) return;
    setMsg(
      "Dados guardados na nuvem. Noutro aparelho abra o site para sincronizar automaticamente.",
      "ok"
    );
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
    setMsg("A carregar da nuvem…", "muted");
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
    suppressCloudHook = true;
    try {
      applyPayloadToLocalStorage(data.payload);
    } finally {
      suppressCloudHook = false;
    }
    setMsg("Dados carregados. A página vai recarregar.", "ok");
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  }

  async function autoPullFromCloudOnStartup() {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client) return;

    suppressCloudHook = true;
    try {
      const { data, error } = await client
        .from("dk_cloud_snapshots")
        .select("payload")
        .eq("label", DK_SNAPSHOT_LABEL)
        .maybeSingle();

      if (error) {
        console.warn("[DK cloud] arranque: leitura", error);
        return;
      }
      if (!data || !data.payload || !isMeaningfulCloudPayload(data.payload)) {
        return;
      }
      if (!cloudPayloadDiffersFromLocal(data.payload)) {
        return;
      }

      applyPayloadToLocalStorage(data.payload);
      setMsg("A sincronizar com a nuvem…", "muted");
      window.location.reload();
    } finally {
      suppressCloudHook = false;
    }
  }

  function bind() {
    installLocalStorageCloudHook();

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
    window.addEventListener("dk-supabase-ready", () => {
      refreshCloudBarVisibility();
      runAutoPullFromCloudOnce()?.catch((e) => console.warn("[DK cloud] auto pull", e));
    });
    window.addEventListener("load", refreshCloudBarVisibility);
    setTimeout(refreshCloudBarVisibility, 800);

    if (window.__DK_SUPABASE_CONFIGURED__) {
      runAutoPullFromCloudOnce()?.catch((e) => console.warn("[DK cloud] auto pull", e));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
