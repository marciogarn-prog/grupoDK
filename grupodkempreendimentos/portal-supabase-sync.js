/**
 * Sincronização do localStorage DK ↔ Supabase (tabela dk_cloud_snapshots).
 * Requer window.__DK_SUPABASE_CLIENT__ (supabase-init.js) e schema.sql aplicado.
 *
 * - Ao abrir o site: tenta carregar o snapshot da nuvem; se for diferente do
 *   navegador, aplica e recarrega a página uma vez.
 * - Após guardar qualquer dado DK (chaves listadas): envia snapshot para a nuvem
 *   (debounce; sem mensagem a cada tecla).
 * - `window.__DK_pushCloudSnapshotNow()` — envio imediato (ex.: após «Guardar cliente»).
 * - `window.__DK_pushToCloudAfterSave()` — alias para push após qualquer gravação.
 * - `window.__DK_pullCloudSnapshotSilentMerge()` — merge do snapshot sem recarregar.
 * - `window.__DK_pullFromCloudOnScreenChange()` — pull completo ao mudar de ecrã (portal-locadora-ui reforça).
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
  const DK_CLOUD_RELOAD_GUARD_KEY = "dkCloudAutopullReloadCount";

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

  function applyPayloadToLocalStorage(payload, opts) {
    if (!payload || typeof payload !== "object") return;
    const replace = Boolean(opts && opts.replace);

    for (const k of DK_STORAGE_KEYS) {
      if (replace && !Object.prototype.hasOwnProperty.call(payload, k)) {
        localStorage.removeItem(k);
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(payload, k)) continue;
      const v = payload[k];
      if (v === undefined || v === null) {
        if (DK_IMMUTABLE_CADASTRO_KEYS.has(k) && !replace) continue;
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
        if (replace) {
          saveCadastro(k, arr, { bypassImmutabilidadeCadastro: true });
        } else {
          saveCadastro(k, arr);
        }
        continue;
      }
      if (typeof v === "string") {
        localStorage.setItem(k, v);
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }
    runLocacoesSanitizeAfterCloudApply();
  }

  function runLocacoesSanitizeAfterCloudApply() {
    if (typeof window.__DK_forceLocacoesFromExcelReceita2026 === "function") {
      try {
        window.__DK_forceLocacoesFromExcelReceita2026();
      } catch (e) {
        console.warn("[DK cloud] force Excel locações", e);
      }
    }
    if (typeof window.__DK_reconcileLocacoesCadastro === "function") {
      try {
        window.__DK_reconcileLocacoesCadastro();
      } catch (e) {
        console.warn("[DK cloud] reconcile locações", e);
      }
    }
    if (typeof window.__DK_sanitizeLocacoesCadastro === "function") {
      try {
        window.__DK_sanitizeLocacoesCadastro({ pushCloud: false });
      } catch (e) {
        console.warn("[DK cloud] sanitize locações", e);
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

  function cloudPullWouldChangeAnything(cloudPayload) {
    if (typeof window.__DK_cloudSnapshotWouldMutateLocal === "function") {
      return window.__DK_cloudSnapshotWouldMutateLocal(cloudPayload);
    }
    const localObj = collectPayloadFromLocalStorage();
    for (const k of Object.keys(cloudPayload)) {
      if (!DK_CLOUD_KEYS.has(k)) continue;
      const a = cloudPayload[k];
      const b = Object.prototype.hasOwnProperty.call(localObj, k) ? localObj[k] : undefined;
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

  /** Cancela o debounce do hook e envia o snapshot já (útil após ações explícitas «Guardar»). */
  async function pushCloudSnapshotNow() {
    clearTimeout(cloudPushTimer);
    cloudPushTimer = null;
    return pushSnapshotQuiet();
  }

  try {
    window.__DK_pushCloudSnapshotNow = pushCloudSnapshotNow;
  } catch {
    /* ignore */
  }

  /**
   * Lê o snapshot na nuvem e aplica ao localStorage (merge nos cadastros imutáveis) sem recarregar a página.
   * Usado ao mudar de ecrã na Operação; não substitui «Carregar da nuvem» (que pede confirmação e dá F5).
   */
  async function pullCloudSnapshotSilentMerge() {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client || !window.__DK_SUPABASE_CONFIGURED__) return { ok: false, skipped: true };
    const { data, error } = await client
      .from("dk_cloud_snapshots")
      .select("payload")
      .eq("label", DK_SNAPSHOT_LABEL)
      .maybeSingle();
    if (error) {
      console.warn("[DK cloud] pull silencioso", error);
      return { ok: false, error };
    }
    if (!data || !data.payload || !isMeaningfulCloudPayload(data.payload)) {
      return { ok: false, skipped: true };
    }
    if (!cloudPullWouldChangeAnything(data.payload)) {
      return { ok: true, unchanged: true };
    }
    suppressCloudHook = true;
    try {
      applyPayloadToLocalStorage(data.payload, { replace: true });
    } finally {
      suppressCloudHook = false;
    }
    return { ok: true, applied: true };
  }

  async function pullFromCloudOnScreenChange() {
    if (typeof window.__DK_portalPullCadastroFromCloud === "function") {
      try {
        await window.__DK_portalPullCadastroFromCloud();
      } catch (e) {
        console.warn("[DK cloud] pull cadastro API", e);
      }
    }
    return pullCloudSnapshotSilentMerge();
  }

  function pushToCloudAfterSave() {
    if (typeof window.__DK_pushCloudSnapshotNow !== "function") return Promise.resolve();
    return window.__DK_pushCloudSnapshotNow().catch((e) => {
      console.warn("[DK cloud] push após guardar", e);
    });
  }

  try {
    window.__DK_pullCloudSnapshotSilentMerge = pullCloudSnapshotSilentMerge;
    window.__DK_pullFromCloudOnScreenChange = pullFromCloudOnScreenChange;
    window.__DK_pushToCloudAfterSave = pushToCloudAfterSave;
  } catch {
    /* ignore */
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

  function readBackupSendSecret() {
    return String(document.querySelector('meta[name="dk-backup-send-secret"]')?.getAttribute("content") || "").trim();
  }

  function resolveBackupEmailApiUrl() {
    const origin = String(window.location.origin || "").replace(/\/$/, "");
    if (origin && origin !== "null") return `${origin}/api/dk-backup-email`;
    return "/api/dk-backup-email";
  }

  function normalizeBackupFileToCloudPayload(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    let data = null;
    if (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
      data = parsed.data;
    } else if (Object.keys(parsed).some((k) => DK_CLOUD_KEYS.has(k))) {
      data = parsed;
    }
    if (!data) return null;
    const out = {};
    for (const k of DK_STORAGE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      out[k] = data[k];
    }
    for (const k of Object.keys(data)) {
      if (k.startsWith("dk_") && !Object.prototype.hasOwnProperty.call(out, k)) {
        out[k] = data[k];
      }
    }
    return Object.keys(out).length ? out : null;
  }

  function countBackupPayloadKeys(payload) {
    if (!payload) return 0;
    return DK_STORAGE_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(payload, k)).length;
  }

  async function readBackupJsonFile(file) {
    const name = String(file?.name || "").toLowerCase();
    if (name.endsWith(".gz")) {
      if (typeof DecompressionStream === "undefined") {
        throw new Error(
          "Este navegador não abre .json.gz. Extraia o ficheiro no PC ou use o .json sem compactar."
        );
      }
      const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
      const text = await new Response(stream).text();
      return JSON.parse(text);
    }
    const text = await file.text();
    return JSON.parse(text);
  }

  function promptImportBackupFile() {
    const input = document.getElementById("dk-backup-import-input");
    if (!input) {
      setMsg("Importação não disponível (input em falta).", null);
      return;
    }
    input.value = "";
    input.click();
  }

  async function applyImportedBackupFile(file) {
    if (!file) return;
    if (
      !window.confirm(
        "Isto substitui os dados deste navegador pelo conteúdo do ficheiro de backup. Continuar?"
      )
    ) {
      return;
    }
    const btn = document.getElementById("btn-dk-backup-import");
    if (btn) btn.disabled = true;
    setMsg("A importar backup…", "muted");
    try {
      const parsed = await readBackupJsonFile(file);
      const payload = normalizeBackupFileToCloudPayload(parsed);
      if (!payload) {
        setMsg(
          "Ficheiro inválido. Use o JSON anexo do e-mail «DK Backup» (ou exportado por «Gerar backup»).",
          null
        );
        return;
      }
      const nKeys = countBackupPayloadKeys(payload);
      suppressCloudHook = true;
      try {
        applyPayloadToLocalStorage(payload, { replace: true });
      } finally {
        suppressCloudHook = false;
      }
      try {
        sessionStorage.removeItem(DK_CLOUD_RELOAD_GUARD_KEY);
      } catch {
        /* ignore */
      }
      const src =
        parsed && typeof parsed === "object" && parsed.exportedAtBr
          ? String(parsed.exportedAtBr).slice(0, 10)
          : "";
      setMsg(
        `Backup importado (${nKeys} blocos de dados${src ? `, de ${src}` : ""}). Pagamentos e outros dados que não estavam no ficheiro foram removidos deste navegador. A página vai recarregar.`,
        "ok"
      );
      setTimeout(() => {
        try {
          window.location.reload();
        } catch {
          /* ignore */
        }
      }, 600);
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e);
      if (msg.includes("JSON")) {
        setMsg("Ficheiro JSON inválido. Confirme que é o anexo do e-mail de backup.", null);
      } else {
        setMsg(`Erro ao importar: ${msg}`, null);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function sendBackupEmailFromBrowser() {
    const secret = readBackupSendSecret();
    if (!secret) {
      setMsg(
        "Backup por e-mail não configurado: na Vercel defina DK_BACKUP_SEND_SECRET (ou CRON_SECRET) e faça redeploy.",
        null
      );
      return;
    }
    if (
      !window.confirm(
        "Gerar backup dos dados deste navegador e enviar por e-mail para marciogarn@gmail.com?"
      )
    ) {
      return;
    }
    const btn = document.getElementById("btn-dk-backup-email");
    if (btn) btn.disabled = true;
    setMsg("A gerar backup e a enviar por e-mail…", "muted");
    try {
      const browserData = collectPayloadFromLocalStorage();
      const res = await fetch(resolveBackupEmailApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dk-backup-secret": secret,
        },
        body: JSON.stringify({ browserData }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const detail = data.reason || data.error || res.statusText || "erro";
        setMsg(`Não foi possível enviar o backup: ${detail}`, null);
        return;
      }
      const toList = Array.isArray(data.to) ? data.to.join(", ") : data.to || "marciogarn@gmail.com";
      setMsg(`Backup enviado por e-mail para ${toList}.`, "ok");
    } catch (e) {
      console.error(e);
      setMsg(`Erro ao enviar backup: ${String(e?.message || e)}`, null);
    } finally {
      if (btn) btn.disabled = false;
    }
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
      applyPayloadToLocalStorage(data.payload, { replace: true });
    } finally {
      suppressCloudHook = false;
    }
    try {
      sessionStorage.removeItem(DK_CLOUD_RELOAD_GUARD_KEY);
    } catch {
      /* ignore */
    }
    setMsg("Dados carregados (substituição total). A página vai recarregar.", "ok");
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  }

  async function waitForLocacoesSanitizeReady(maxMs = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      if (typeof window.__DK_sanitizeLocacoesCadastro === "function") return true;
      await new Promise((r) => setTimeout(r, 40));
    }
    return typeof window.__DK_sanitizeLocacoesCadastro === "function";
  }

  async function autoPullFromCloudOnStartup() {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client) return;

    await waitForLocacoesSanitizeReady();

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
        try {
          sessionStorage.removeItem(DK_CLOUD_RELOAD_GUARD_KEY);
        } catch {
          /* ignore */
        }
        return;
      }
      if (!cloudPullWouldChangeAnything(data.payload)) {
        try {
          sessionStorage.removeItem(DK_CLOUD_RELOAD_GUARD_KEY);
        } catch {
          /* ignore */
        }
        return;
      }

      let reloadCount = 0;
      try {
        reloadCount = parseInt(sessionStorage.getItem(DK_CLOUD_RELOAD_GUARD_KEY) || "0", 10) || 0;
      } catch {
        reloadCount = 0;
      }
      if (reloadCount >= 2) {
        console.warn(
          "[DK cloud] Auto-pull: limite de recarregamentos seguros atingido. Use «Carregar da nuvem» se precisar sincronizar."
        );
        setMsg(
          "Sincronização automática em pausa (evitar loop). Recarregue com F5 ou use «Carregar da nuvem».",
          "muted"
        );
        return;
      }
      try {
        sessionStorage.setItem(DK_CLOUD_RELOAD_GUARD_KEY, String(reloadCount + 1));
      } catch {
        /* ignore */
      }

      applyPayloadToLocalStorage(data.payload, { replace: true });
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
    document.getElementById("btn-dk-backup-email")?.addEventListener("click", () => {
      sendBackupEmailFromBrowser().catch((e) => {
        console.error(e);
        setMsg(String(e?.message || e));
      });
    });
    document.getElementById("btn-dk-backup-import")?.addEventListener("click", () => {
      promptImportBackupFile();
    });
    document.getElementById("dk-backup-import-input")?.addEventListener("change", (ev) => {
      const file = ev.target?.files?.[0];
      applyImportedBackupFile(file).catch((e) => {
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
