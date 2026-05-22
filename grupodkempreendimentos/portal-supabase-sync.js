/**
 * Sincronização localStorage DK ↔ nuvem redundante:
 * 1) Supabase (dk_cloud_snapshots) — primário
 * 2) Redis Upstash via /api/dk-cloud-snapshot — cópia de segurança (Vercel)
 *
 * Se um falhar, o portal tenta o outro no pull/push.
 */
(function portalSupabaseSync() {
  const DK_SNAPSHOT_LABEL = "default";
  const REDUNDANT_SNAPSHOT_API = "dk-cloud-snapshot";

  const DK_STORAGE_KEYS = [
    "dk_clientes_cadastro",
    "dk_clientes_validacao_pendente",
    "dk_veiculos_cadastro",
    "dk_portal_clientes_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
    "dk_locacoes_cadastro",
    "dk_locacoes_quadro_geral",
    "dk_manutencoes_cadastro",
    "dk_lancamentos_aluguel",
    "dk_quadro_receita_overrides",
    "dk_comprovantes_banco",
    "dk_comprovantes_cliente_pendentes",
    "dk_cliente_notificacoes",
    "dk_audit_log",
    "dk_funcionarios_access",
  ];

  const DK_CLOUD_KEYS = new Set(DK_STORAGE_KEYS);
  const DK_CLOUD_RELOAD_GUARD_KEY = "dkCloudAutopullReloadCount";
  /** Após importar backup: não sobrescrever local com nuvem/Redis antigos (ms desde epoch). */
  const DK_LOCAL_AUTHORITY_KEY = "dkLocalDataAuthorityUntil";
  const DK_LOCAL_AUTHORITY_MS = 45 * 60 * 1000;
  const DK_CLOUD_LAST_PUSH_AT_KEY = "dkCloudLastPushedAt";

  const CLOUD_PUSH_DEBOUNCE_MS = 2500;
  const BACKGROUND_PULL_MIN_INTERVAL_MS = 5 * 60 * 1000;

  let backgroundPullLastAt = 0;
  let backgroundPullInFlight = null;

  let cloudPushTimer = null;
  let suppressCloudHook = false;
  let autoPullFromCloudRan = false;

  function runAutoPullFromCloudOnce() {
    if (autoPullFromCloudRan) return;
    autoPullFromCloudRan = true;
    return autoPullFromCloudOnStartup();
  }

  function markLocalDataAuthority(ms = DK_LOCAL_AUTHORITY_MS) {
    try {
      sessionStorage.setItem(DK_LOCAL_AUTHORITY_KEY, String(Date.now() + ms));
    } catch {
      /* ignore */
    }
  }

  function isLocalDataAuthorityActive() {
    try {
      const until = parseInt(sessionStorage.getItem(DK_LOCAL_AUTHORITY_KEY) || "0", 10) || 0;
      return until > Date.now();
    } catch {
      return false;
    }
  }

  function noteCloudPushTimestamp(iso) {
    try {
      localStorage.setItem(DK_CLOUD_LAST_PUSH_AT_KEY, iso || new Date().toISOString());
    } catch {
      /* ignore */
    }
  }

  function readCloudPushTimestamp() {
    try {
      return String(localStorage.getItem(DK_CLOUD_LAST_PUSH_AT_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function isCloudSnapshotNewerThanLocal(cloudUpdatedAt) {
    const cloudTs = Date.parse(String(cloudUpdatedAt || ""));
    const localTs = Date.parse(readCloudPushTimestamp());
    if (!Number.isFinite(cloudTs)) return true;
    if (!Number.isFinite(localTs)) return true;
    return cloudTs > localTs + 500;
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

  /** Cópia Redis: sem imagens PDF/JPEG em base64 (limite ~4,5 MB na Vercel). Metadados e assinaturas mantêm-se. */
  function shrinkPayloadForRedundantCloud(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const out = { ...payload };
    if (Array.isArray(out.dk_comprovantes_cliente_pendentes)) {
      out.dk_comprovantes_cliente_pendentes = out.dk_comprovantes_cliente_pendentes.map((rec) => {
        if (!rec || typeof rec !== "object") return rec;
        if (!rec.arquivoBase64) return rec;
        const { arquivoBase64, ...rest } = rec;
        return rest;
      });
    }
    return out;
  }

  function attachComprovanteMediaFromSecondary(primary, secondary) {
    const out = { ...primary };
    if (
      secondary &&
      !String(out.arquivoBase64 || "").trim() &&
      String(secondary.arquivoBase64 || "").trim()
    ) {
      out.arquivoBase64 = secondary.arquivoBase64;
      if (!out.mimeType && secondary.mimeType) out.mimeType = secondary.mimeType;
    }
    return out;
  }

  function mergeComprovanteClienteRecords(prev, rec) {
    if (!prev) return rec;
    if (!rec) return prev;
    if (comprovanteClienteRank(rec) >= comprovanteClienteRank(prev)) {
      return attachComprovanteMediaFromSecondary(rec, prev);
    }
    return attachComprovanteMediaFromSecondary(prev, rec);
  }

  const DK_IMMUTABLE_CADASTRO_KEYS = new Set([
    "dk_clientes_cadastro",
    "dk_portal_clientes_cadastro",
    "dk_veiculos_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
    "dk_locacoes_cadastro",
  ]);

  function normalizeLocacoesContratoAtivoList(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((loc) => {
      if (!loc || typeof loc !== "object") return loc;
      const fim = String(loc.fim || loc.dataFim || "").trim();
      if (!fim || fim === "...") {
        return { ...loc, fim: "", statusLocacao: "ATIVO" };
      }
      return { ...loc, statusLocacao: "FINALIZADO", fim };
    });
  }

  function normalizeLocacoesContratoAtivoStore() {
    try {
      const raw = localStorage.getItem("dk_locacoes_cadastro");
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      const next = normalizeLocacoesContratoAtivoList(arr);
      if (JSON.stringify(next) !== JSON.stringify(arr)) {
        localStorage.setItem("dk_locacoes_cadastro", JSON.stringify(next));
      }
    } catch {
      /* ignore */
    }
  }

  function applyPayloadToLocalStorage(payload, opts) {
    if (!payload || typeof payload !== "object") return;
    const replace = Boolean(opts && opts.replace);
    const lightSanitize = Boolean(opts && opts.lightSanitize);

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
        if (k === "dk_locacoes_cadastro") {
          arr = normalizeLocacoesContratoAtivoList(arr);
        }
        if (replace) {
          saveCadastro(k, arr, { bypassImmutabilidadeCadastro: true });
        } else {
          saveCadastro(k, arr);
        }
        continue;
      }
      if (k === "dk_comprovantes_cliente_pendentes") {
        let cloudArr = [];
        if (Array.isArray(v)) cloudArr = v;
        else if (typeof v === "string") {
          try {
            const p = JSON.parse(v);
            cloudArr = Array.isArray(p) ? p : [];
          } catch {
            cloudArr = [];
          }
        }
        if (replace) {
          localStorage.setItem(k, JSON.stringify(cloudArr));
        } else {
          const localArr = readLocalJsonArray(k);
          localStorage.setItem(k, JSON.stringify(mergeComprovantesClientePendentes(localArr, cloudArr)));
        }
        continue;
      }
      if (k === "dk_cliente_notificacoes") {
        let cloudArr = [];
        if (Array.isArray(v)) cloudArr = v;
        else if (typeof v === "string") {
          try {
            const p = JSON.parse(v);
            cloudArr = Array.isArray(p) ? p : [];
          } catch {
            cloudArr = [];
          }
        }
        if (replace) {
          localStorage.setItem(k, JSON.stringify(cloudArr));
        } else {
          const localArr = readLocalJsonArray(k);
          localStorage.setItem(k, JSON.stringify(mergeClienteNotificacoes(localArr, cloudArr)));
        }
        continue;
      }
      if (typeof v === "string") {
        localStorage.setItem(k, v);
      } else {
        let stored = v;
        if (k === "dk_locacoes_cadastro" && Array.isArray(v)) {
          stored = normalizeLocacoesContratoAtivoList(v);
        }
        localStorage.setItem(k, JSON.stringify(stored));
      }
    }
    normalizeLocacoesContratoAtivoStore();
    runLocacoesSanitizeAfterCloudApply({ light: lightSanitize });
    if (typeof window.__DK_invalidatePesquisaLinhasCache === "function") {
      try {
        window.__DK_invalidatePesquisaLinhasCache();
      } catch {
        /* ignore */
      }
    }
    if (typeof window.__DK_invalidateCadastroParseCache === "function") {
      try {
        window.__DK_invalidateCadastroParseCache();
      } catch {
        /* ignore */
      }
    }
  }

  function runLocacoesSanitizeAfterCloudApply(opts) {
    const light = Boolean(opts && opts.light);
    if (light) {
      if (typeof window.__DK_sanitizeLocacoesCadastro === "function") {
        try {
          window.__DK_sanitizeLocacoesCadastro({ pushCloud: false });
        } catch (e) {
          console.warn("[DK cloud] sanitize locações", e);
        }
      }
      return;
    }
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
    bar.classList.remove("hidden");
  }

  function resolveRedundantSnapshotApiUrls() {
    const meta = document
      .querySelector('meta[name="dk-cadastro-sync-origin"]')
      ?.getAttribute("content")
      ?.trim()
      .replace(/\/$/, "");
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1";
    const localUrl = `${window.location.origin}/api/${REDUNDANT_SNAPSHOT_API}`;
    if (isLocal && meta) return [localUrl, `${meta}/api/${REDUNDANT_SNAPSHOT_API}`];
    return [localUrl];
  }

  async function fetchRedundantSnapshotPayload() {
    const urls = resolveRedundantSnapshotApiUrls();
    for (let i = 0; i < urls.length; i += 1) {
      try {
        const res = await fetch(urls[i], { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) continue;
        if (!data.payload || typeof data.payload !== "object") return null;
        return {
          payload: data.payload,
          updated_at: data.updated_at || null,
          source: "redis",
        };
      } catch (e) {
        if (i === urls.length - 1) console.warn("[DK cloud] Redis snapshot GET", e);
      }
    }
    return null;
  }

  async function pushRedundantSnapshotPayload(payload, updatedAt, opts) {
    const replace = Boolean(opts && opts.replace);
    const urls = resolveRedundantSnapshotApiUrls();
    let anyOk = false;
    let lastErr = null;
    const bodyPayload = shrinkPayloadForRedundantCloud(payload);
    if (replace) {
      bodyPayload._dkFullReplaceKeys = [
        "dk_comprovantes_cliente_pendentes",
        "dk_cliente_notificacoes",
        "dk_locacoes_cadastro",
        "dk_lancamentos_aluguel",
        "dk_lancamentos_aluguel_cadastro",
        "dk_comprovantes_banco_assinaturas",
        "dk_comprovantes_banco",
        "dk_cliente_comprovantes_enviados",
      ];
    }
    for (let i = 0; i < urls.length; i += 1) {
      try {
        const res = await fetch(urls[i], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: bodyPayload,
            updated_at: updatedAt,
            replace,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          anyOk = true;
        } else {
          lastErr = data?.reason || data?.error || res.statusText;
        }
      } catch (e) {
        lastErr = e;
        if (i === urls.length - 1) console.warn("[DK cloud] Redis snapshot POST", e);
      }
    }
    return { ok: anyOk, error: lastErr };
  }

  function pickNewestCloudRow(rows) {
    const list = (rows || []).filter((r) => r?.payload && typeof r.payload === "object");
    if (!list.length) return null;
    list.sort((a, b) => {
      const ta = Date.parse(a.updated_at || "") || 0;
      const tb = Date.parse(b.updated_at || "") || 0;
      return tb - ta;
    });
    return list[0];
  }

  async function fetchSupabaseSnapshotPayload() {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client || !window.__DK_SUPABASE_CONFIGURED__) return null;
    const { data, error } = await client
      .from("dk_cloud_snapshots")
      .select("payload, updated_at")
      .eq("label", DK_SNAPSHOT_LABEL)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return { ...data, source: "supabase" };
  }

  async function fetchCloudSnapshotPayload() {
    const supa = await fetchSupabaseSnapshotPayload();
    const redis = await fetchRedundantSnapshotPayload();
    return pickNewestCloudRow([supa, redis]);
  }

  function mergeRemoteSnapshotsBeforePush(supa, redis) {
    let cloudMerged = null;
    if (supa?.payload) cloudMerged = supa.payload;
    if (redis?.payload) {
      cloudMerged = cloudMerged
        ? mergePayloadWithCloudBeforePush(cloudMerged, redis.payload)
        : redis.payload;
    }
    return cloudMerged;
  }

  function pickNewestCloudPayloadWithMeta(supa, redis) {
    const row = pickNewestCloudRow([supa, redis]);
    if (!row?.payload) return null;
    return { payload: row.payload, updated_at: row.updated_at || null };
  }

  function cloudSnapshotIsNewerThanLastPush(cloudUpdatedAt) {
    const cloudTs = Date.parse(String(cloudUpdatedAt || "")) || 0;
    if (!cloudTs) return false;
    let lastPush = 0;
    try {
      lastPush = Date.parse(localStorage.getItem(DK_CLOUD_LAST_PUSH_AT_KEY) || "") || 0;
    } catch {
      lastPush = 0;
    }
    return cloudTs > lastPush + 500;
  }

  function applyCloudComprovantesIfNewer(localPayload, cloudMeta) {
    if (!cloudMeta?.payload) return localPayload;
    if (!cloudSnapshotIsNewerThanLastPush(cloudMeta.updated_at)) {
      return mergePayloadWithCloudBeforePush(localPayload, cloudMeta.payload);
    }
    const out = { ...localPayload };
    if (Object.prototype.hasOwnProperty.call(cloudMeta.payload, "dk_comprovantes_cliente_pendentes")) {
      out.dk_comprovantes_cliente_pendentes = Array.isArray(
        cloudMeta.payload.dk_comprovantes_cliente_pendentes
      )
        ? cloudMeta.payload.dk_comprovantes_cliente_pendentes
        : [];
    }
    if (Object.prototype.hasOwnProperty.call(cloudMeta.payload, "dk_cliente_notificacoes")) {
      out.dk_cliente_notificacoes = Array.isArray(cloudMeta.payload.dk_cliente_notificacoes)
        ? cloudMeta.payload.dk_cliente_notificacoes
        : [];
    }
    return out;
  }

  function formatPushResultMessage(supaOk, redisOk, supaErr, redisErr) {
    if (supaOk && redisOk) {
      return { text: "Dados guardados na nuvem (Supabase + cópia Redis).", tone: "ok" };
    }
    if (supaOk && !redisOk) {
      return {
        text: `Guardado no Supabase. Cópia Redis indisponível${redisErr ? `: ${redisErr}` : ""}.`,
        tone: "muted",
      };
    }
    if (!supaOk && redisOk) {
      return {
        text:
          "Supabase indisponível — cadastros e comprovantes (metadados/assinaturas) guardados na cópia Redis. As imagens dos comprovantes ficam neste PC até o Supabase voltar.",
        tone: "ok",
      };
    }
    const parts = [];
    if (supaErr) parts.push(`Supabase: ${supaErr}`);
    if (redisErr) parts.push(`Redis: ${redisErr}`);
    const detail = parts.length ? parts.join(" · ") : "ambos falharam";
    return { text: `Erro ao guardar na nuvem: ${detail}`, tone: null };
  }

  function scheduleCloudPushDebounced() {
    if (suppressCloudHook) return;
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
      if (k === "dk_comprovantes_cliente_pendentes") {
        const merged = mergeComprovantesClientePendentes(b, a);
        if (JSON.stringify(merged) !== JSON.stringify(Array.isArray(b) ? b : [])) return true;
        continue;
      }
      if (k === "dk_cliente_notificacoes") {
        const merged = mergeClienteNotificacoes(b, a);
        if (JSON.stringify(merged) !== JSON.stringify(Array.isArray(b) ? b : [])) return true;
        continue;
      }
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    }
    return false;
  }

  const CC_STATUS_RANK = { confirmado: 40, ia_validado: 30, pendente: 20, rejeitado: 10 };

  function comprovanteClienteDecisiveTs(rec) {
    const st = String(rec?.status || "").trim();
    if (st === "confirmado") return Date.parse(rec.confirmadoEm || 0) || 0;
    if (st === "rejeitado") return Date.parse(rec.rejeitadoEm || 0) || 0;
    if (st === "ia_validado") {
      return (
        Date.parse(rec.reabertoParaOperadorEm || rec.iaValidacao?.validadoEm || rec.enviadoEm || 0) || 0
      );
    }
    return Date.parse(rec.enviadoEm || 0) || 0;
  }

  function comprovanteClienteRank(rec) {
    if (rec?.pagamentoInvalidado) {
      return 1e18 + (Date.parse(rec.pagamentoInvalidadoEm || rec.rejeitadoEm || 0) || 0);
    }
    const st = String(rec?.status || "").trim();
    const ts = comprovanteClienteDecisiveTs(rec);
    if (st === "rejeitado" && rec.rejeitadoAutomatico === false) {
      return 5e16 + ts;
    }
    if (st === "confirmado") {
      return 4e16 + ts;
    }
    const base = CC_STATUS_RANK[st] || 0;
    return base * 1e15 + ts;
  }

  function mergeComprovantesClientePendentes(localArr, cloudArr) {
    const byId = new Map();
    const push = (rec) => {
      if (!rec || typeof rec !== "object" || !rec.id) return;
      const prev = byId.get(rec.id);
      byId.set(rec.id, mergeComprovanteClienteRecords(prev, rec));
    };
    (Array.isArray(localArr) ? localArr : []).forEach(push);
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(push);
    let list = Array.from(byId.values());
    const porFp = new Map();
    for (const r of list) {
      const fp = String(r.comprovanteFp || "").trim();
      if (!fp) continue;
      if (!porFp.has(fp)) porFp.set(fp, []);
      porFp.get(fp).push(r);
    }
    for (const grupo of porFp.values()) {
      if (grupo.length <= 1) continue;
      grupo.sort((a, b) => comprovanteClienteRank(b) - comprovanteClienteRank(a));
      const winner = grupo[0];
      for (let i = 1; i < grupo.length; i++) {
        const loser = grupo[i];
        if (comprovanteClienteRank(loser) >= comprovanteClienteRank(winner)) continue;
        const idx = list.findIndex((x) => x.id === loser.id);
        if (idx < 0) continue;
        list[idx] = {
          ...list[idx],
          status: "rejeitado",
          rejeitadoAutomatico: true,
          rejeitadoMotivoCliente:
            "Esta imagem de comprovante já foi enviada ao sistema. Envie outra captura ou comprovante diferente.",
          rejeitadoMotivo: `Comprovante duplicado — mesma imagem (mantido ${winner.id}).`,
          rejeitadoEm: new Date().toISOString(),
        };
      }
    }
    const confirmados = list.filter((r) => String(r.status) === "confirmado");
    const rest = list.filter((r) => String(r.status) !== "confirmado");
    return [...confirmados, ...rest]
      .sort((a, b) => (Date.parse(b.enviadoEm || 0) || 0) - (Date.parse(a.enviadoEm || 0) || 0))
      .slice(0, 500);
  }

  function mergeClienteNotificacoes(localArr, cloudArr) {
    const byId = new Map();
    const push = (n) => {
      if (!n || typeof n !== "object" || !n.id) return;
      const prev = byId.get(n.id);
      const ts = Date.parse(n.criadoEm || n.lidaEm || 0) || 0;
      const prevTs = prev ? Date.parse(prev.criadoEm || prev.lidaEm || 0) || 0 : 0;
      if (!prev || ts >= prevTs) byId.set(n.id, n);
    };
    (Array.isArray(localArr) ? localArr : []).forEach(push);
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(push);
    return Array.from(byId.values())
      .sort((a, b) => (Date.parse(b.criadoEm || 0) || 0) - (Date.parse(a.criadoEm || 0) || 0))
      .slice(0, 500);
  }

  function readLocalJsonArray(key) {
    try {
      const raw = localStorage.getItem(key);
      const p = raw ? JSON.parse(raw) : [];
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }

  function mergePayloadWithCloudBeforePush(localPayload, cloudPayload) {
    const out = { ...localPayload };
    if (!cloudPayload || typeof cloudPayload !== "object") return out;
    if (Object.prototype.hasOwnProperty.call(cloudPayload, "dk_comprovantes_cliente_pendentes")) {
      out.dk_comprovantes_cliente_pendentes = mergeComprovantesClientePendentes(
        localPayload.dk_comprovantes_cliente_pendentes,
        cloudPayload.dk_comprovantes_cliente_pendentes
      );
    }
    if (Object.prototype.hasOwnProperty.call(cloudPayload, "dk_cliente_notificacoes")) {
      out.dk_cliente_notificacoes = mergeClienteNotificacoes(
        localPayload.dk_cliente_notificacoes,
        cloudPayload.dk_cliente_notificacoes
      );
    }
    return out;
  }

  function persistMergedPayloadToLocal(mergedPayload) {
    suppressCloudHook = true;
    try {
      if (mergedPayload.dk_comprovantes_cliente_pendentes) {
        localStorage.setItem(
          "dk_comprovantes_cliente_pendentes",
          JSON.stringify(mergedPayload.dk_comprovantes_cliente_pendentes)
        );
      }
      if (mergedPayload.dk_cliente_notificacoes) {
        localStorage.setItem(
          "dk_cliente_notificacoes",
          JSON.stringify(mergedPayload.dk_cliente_notificacoes)
        );
      }
    } finally {
      suppressCloudHook = false;
    }
    if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
      window.__DK_comprovantesClienteInvalidateCache();
    }
    try {
      window.dispatchEvent(new CustomEvent("dk-comprovantes-synced"));
    } catch {
      /* ignore */
    }
  }

  async function upsertSnapshotRow(showUserMessages, opts) {
    const forceReplace = Boolean(opts && opts.replace);
    let payload = collectPayloadFromLocalStorage();
    if (
      typeof window.__DK_comprovantesClientePayloadParaNuvem === "function" &&
      payload.dk_comprovantes_cliente_pendentes
    ) {
      try {
        payload.dk_comprovantes_cliente_pendentes = await window.__DK_comprovantesClientePayloadParaNuvem(
          payload.dk_comprovantes_cliente_pendentes
        );
      } catch (e) {
        console.warn("[DK cloud] hydrate comprovantes para nuvem", e);
      }
    }
    const [supaRow, redisRow] = await Promise.all([
      fetchSupabaseSnapshotPayload(),
      fetchRedundantSnapshotPayload(),
    ]);
    const cloudMeta = pickNewestCloudPayloadWithMeta(supaRow, redisRow);
    if (cloudMeta?.payload && !forceReplace) {
      if (cloudSnapshotIsNewerThanLastPush(cloudMeta.updated_at)) {
        payload = applyCloudComprovantesIfNewer(payload, cloudMeta);
      } else {
        payload = mergePayloadWithCloudBeforePush(payload, cloudMeta.payload);
      }
      persistMergedPayloadToLocal(payload);
    }
    const updatedAt = new Date().toISOString();
    let supaOk = false;
    let redisOk = false;
    let supaErr = "";
    let redisErr = "";

    const client = window.__DK_SUPABASE_CLIENT__;
    if (client && window.__DK_SUPABASE_CONFIGURED__) {
      const row = { label: DK_SNAPSHOT_LABEL, payload, updated_at: updatedAt };
      const { error } = await client.from("dk_cloud_snapshots").upsert(row, {
        onConflict: "label",
      });
      if (error) {
        supaErr = error.message || String(error);
        console.error("[DK cloud] Supabase push", error);
      } else {
        supaOk = true;
      }
    } else {
      supaErr = "Supabase não configurado";
    }

    const red = await pushRedundantSnapshotPayload(payload, updatedAt, { replace: forceReplace });
    redisOk = red.ok;
    if (!redisOk) redisErr = String(red.error || "Redis indisponível");

    if (!supaOk && !redisOk) {
      const msg = formatPushResultMessage(supaOk, redisOk, supaErr, redisErr);
      if (showUserMessages) setMsg(msg.text, msg.tone);
      return { ok: false, error: new Error(msg.text), supaOk, redisOk };
    }

    noteCloudPushTimestamp(updatedAt);
    const msg = formatPushResultMessage(supaOk, redisOk, supaErr, redisErr);
    if (showUserMessages) setMsg(msg.text, msg.tone);
    return {
      ok: true,
      updatedAt,
      supaOk,
      redisOk,
      source: supaOk && redisOk ? "both" : supaOk ? "supabase" : "redis",
    };
  }

  async function pushSnapshotQuiet(opts) {
    const r = await upsertSnapshotRow(false, opts);
    if (r.ok) {
      const src =
        r.source === "both"
          ? "Supabase + Redis"
          : r.source === "redis"
            ? "cópia Redis (Supabase em falha)"
            : "Supabase";
      setMsg(`Nuvem atualizada (${src}).`, "muted");
    }
    return r;
  }

  /** Cancela o debounce do hook e envia o snapshot já (útil após ações explícitas «Guardar»). */
  async function pushCloudSnapshotNow(opts) {
    clearTimeout(cloudPushTimer);
    cloudPushTimer = null;
    return pushSnapshotQuiet(opts);
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
    if (isLocalDataAuthorityActive()) {
      return { ok: true, skipped: true, reason: "local_authority" };
    }
    const data = await fetchCloudSnapshotPayload();
    if (!data || !data.payload || !isMeaningfulCloudPayload(data.payload)) {
      return { ok: false, skipped: true, reason: "no_cloud_snapshot" };
    }
    const mergeNeeded = cloudPullWouldChangeAnything(data.payload);
    if (!isCloudSnapshotNewerThanLocal(data.updated_at) && !mergeNeeded) {
      return { ok: true, skipped: true, reason: "cloud_not_newer" };
    }
    if (!mergeNeeded) {
      return { ok: true, unchanged: true };
    }
    suppressCloudHook = true;
    try {
      applyPayloadToLocalStorage(data.payload, { replace: false, lightSanitize: true });
    } finally {
      suppressCloudHook = false;
    }
    if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
      window.__DK_comprovantesClienteInvalidateCache();
    }
    try {
      window.dispatchEvent(new CustomEvent("dk-comprovantes-synced"));
    } catch {
      /* ignore */
    }
    const clienteAppPage = (() => {
      try {
        const p = String(location.pathname || "").toLowerCase();
        return p === "/cliente" || p.endsWith("/cliente") || p.endsWith("/cliente.html");
      } catch {
        return false;
      }
    })();
    if (typeof window.__DK_comprovantesClienteRepararHistorico === "function") {
      if (clienteAppPage) {
        window.setTimeout(() => {
          void Promise.resolve(window.__DK_comprovantesClienteRepararHistorico({ leve: true }));
        }, 1200);
      } else {
        void Promise.resolve(window.__DK_comprovantesClienteRepararHistorico());
      }
    }
    if (
      !clienteAppPage &&
      typeof window.__DK_comprovantesClienteProcessarFilaAutomatica === "function"
    ) {
      void window.__DK_comprovantesClienteProcessarFilaAutomatica().then(() => {
        if (typeof window.__DK_comprovantesClienteRepararHistorico === "function") {
          void Promise.resolve(window.__DK_comprovantesClienteRepararHistorico());
        }
        if (typeof window.__DK_refreshComprovantesClienteLista === "function") {
          void window.__DK_refreshComprovantesClienteLista();
        }
      });
    }
    return { ok: true, applied: true, source: data.source || "cloud" };
  }

  /** Não bloqueia a UI — mudança de ecrã usa só localStorage. */
  function pullFromCloudOnScreenChange() {
    return Promise.resolve({ ok: true, skipped: true, reason: "instant_local_ui" });
  }

  /** Supabase em segundo plano (máx. 1× / 5 min), sem Redis nem recarregar página. */
  async function scheduleBackgroundCloudPullIfStale() {
    if (isLocalDataAuthorityActive()) {
      return { ok: true, skipped: true, reason: "local_authority" };
    }
    const now = Date.now();
    if (now - backgroundPullLastAt < BACKGROUND_PULL_MIN_INTERVAL_MS) {
      return backgroundPullInFlight || { ok: true, skipped: true, reason: "throttled" };
    }
    if (backgroundPullInFlight) return backgroundPullInFlight;
    backgroundPullLastAt = now;
    backgroundPullInFlight = pullCloudSnapshotSilentMerge()
      .catch((e) => {
        console.warn("[DK cloud] pull em segundo plano", e);
        return { ok: false, error: e };
      })
      .finally(() => {
        backgroundPullInFlight = null;
      });
    return backgroundPullInFlight;
  }

  function pushToCloudAfterSave() {
    if (typeof window.__DK_pushCloudSnapshotNow !== "function") return Promise.resolve();
    return window.__DK_pushCloudSnapshotNow().catch((e) => {
      console.warn("[DK cloud] push após guardar", e);
    });
  }

  async function pushLocalSnapshotAfterImport() {
    if (typeof window.__DK_portalPushCadastroToCloud === "function") {
      try {
        await window.__DK_portalPushCadastroToCloud();
      } catch (e) {
        console.warn("[DK cloud] push Redis após import", e);
      }
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      await window.__DK_pushCloudSnapshotNow();
    }
  }

  try {
    window.__DK_pullCloudSnapshotSilentMerge = pullCloudSnapshotSilentMerge;
    window.__DK_pullFromCloudOnScreenChange = pullFromCloudOnScreenChange;
    window.__DK_scheduleBackgroundCloudPull = scheduleBackgroundCloudPullIfStale;
    window.__DK_pushToCloudAfterSave = pushToCloudAfterSave;
    window.__DK_markLocalDataAuthority = markLocalDataAuthority;
    window.__DK_isLocalDataAuthorityActive = isLocalDataAuthorityActive;
    window.__DK_normalizeLocacoesContratoAtivoStore = normalizeLocacoesContratoAtivoStore;
    window.__DK_fetchCloudSnapshotPayload = fetchCloudSnapshotPayload;
  } catch {
    /* ignore */
  }

  async function pushSnapshot() {
    clearTimeout(cloudPushTimer);
    cloudPushTimer = null;
    setMsg("A guardar na nuvem (Supabase + cópia Redis)…", "muted");
    const r = await upsertSnapshotRow(true);
    if (!r.ok) return;
    if (r.supaOk && r.redisOk) {
      setMsg(
        "Dados guardados. Noutro aparelho abra o site ou use «Carregar da nuvem» — se o Supabase falhar, a cópia Redis atende.",
        "ok"
      );
    }
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
      markLocalDataAuthority();
      setMsg("Backup importado. A guardar na nuvem…", "muted");
      try {
        await pushLocalSnapshotAfterImport();
        noteCloudPushTimestamp(new Date().toISOString());
      } catch (e) {
        console.warn("[DK cloud] push após import", e);
        setMsg(
          "Backup importado localmente, mas falhou guardar na nuvem. Use «Guardar na nuvem» antes de mudar de ecrã.",
          null
        );
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
        `Backup importado (${nKeys} blocos${src ? `, de ${src}` : ""}) e enviado à nuvem. A página vai recarregar.`,
        "ok"
      );
      setTimeout(() => {
        try {
          window.location.reload();
        } catch {
          /* ignore */
        }
      }, 800);
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
    if (
      !window.confirm(
        "Isto substitui os dados deste navegador pelos dados guardados na nuvem. Continuar?"
      )
    ) {
      return;
    }
    setMsg("A carregar da nuvem (Supabase ou cópia Redis)…", "muted");
    const data = await fetchCloudSnapshotPayload();
    if (!data || !data.payload) {
      setMsg(
        "Ainda não há dados na nuvem (Supabase e Redis vazios ou indisponíveis). Use «Guardar na nuvem» neste ou noutro PC.",
        null
      );
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

  function autoPullFromCloudOnStartup() {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client || isLocalDataAuthorityActive()) return;
    try {
      sessionStorage.removeItem(DK_CLOUD_RELOAD_GUARD_KEY);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      scheduleBackgroundCloudPullIfStale()
        .then((r) => {
          if (r && r.applied && typeof window.__DK_portalRefreshOperacaoLocal === "function") {
            window.__DK_portalRefreshOperacaoLocal();
          }
        })
        .catch((e) => console.warn("[DK cloud] arranque pull", e));
    }, 6000);
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
