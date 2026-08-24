/**
 * Sincronização localStorage DK ↔ nuvem redundante:
 * 1) Supabase (dk_cloud_snapshots) — primário
 * 2) Redis Upstash via /api/dk-cloud-snapshot — cópia de segurança (Vercel)
 *
 * Se um falhar, o portal tenta o outro no pull/push.
 */
(function portalSupabaseSync() {
  const REDUNDANT_SNAPSHOT_API = "dk-cloud-snapshot";

  function dkSnapshotLabel() {
    if (typeof window.__DK_deploySnapshotLabel === "function") {
      return window.__DK_deploySnapshotLabel();
    }
    return window.__DK_DEPLOY_CHANNEL__ === "demo" ? "demo" : "default";
  }

  function dkCloudChannelQuery() {
    const ch = dkSnapshotLabel();
    return ch === "demo" ? "?channel=demo" : "";
  }

  function dkCloudFetchHeaders() {
    const ch = dkSnapshotLabel();
    return ch === "demo" ? { "X-DK-Deploy-Channel": "demo" } : {};
  }

  /** Merge documentos de locação — preferir PDF (arquivoBase64) e enviadoCliente. Usado no portal e no app cliente. */
  function mergeLocacaoDocumentosV1(localArr, cloudArr) {
    const byId = new Map();
    const pick = (rec) => {
      if (!rec?.id) return;
      const prev = byId.get(rec.id);
      if (!prev) {
        byId.set(rec.id, rec);
        return;
      }
      /* tombstone: doc excluído no portal não pode ressuscitar pelo merge */
      if (rec.excluido === true || prev.excluido === true) {
        const tsAct = (x) => Number(x.excluidoEm || x.enviadoClienteEm || x.createdAt) || 0;
        if (tsAct(rec) >= tsAct(prev)) byId.set(rec.id, rec);
        return;
      }
      const prevHas = Boolean(String(prev.arquivoBase64 || "").trim());
      const recHas = Boolean(String(rec.arquivoBase64 || "").trim());
      const prevTs = Number(prev.enviadoClienteEm || prev.createdAt) || 0;
      const recTs = Number(rec.enviadoClienteEm || rec.createdAt) || 0;
      if (recHas && !prevHas) {
        byId.set(rec.id, rec);
        return;
      }
      if (prevHas && !recHas) return;
      if (rec.enviadoCliente === true && prev.enviadoCliente !== true) {
        byId.set(rec.id, rec);
        return;
      }
      if (prev.enviadoCliente === true && rec.enviadoCliente !== true) return;
      if (recTs >= prevTs) byId.set(rec.id, rec);
    };
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(pick);
    (Array.isArray(localArr) ? localArr : []).forEach(pick);
    return Array.from(byId.values());
  }

  function dedupeLocacaoDocumentosStore(arr) {
    return mergeLocacaoDocumentosV1([], Array.isArray(arr) ? arr : []);
  }

  function inferDocTipoCompact(d) {
    const t = String(d?.tipo || d?.origemDepositoCategoria || "").trim().toLowerCase();
    if (t === "contrato" || t === "crlv" || t === "multa") return t;
    const nome = String(d?.nome || "");
    if (/^contrato\b|contrato\s*—/i.test(nome)) return "contrato";
    if (/crlv/i.test(nome)) return "crlv";
    if (/multa/i.test(nome)) return "multa";
    return "";
  }

  function docLocacaoScore(d) {
    const has = Boolean(String(d?.arquivoBase64 || "").trim());
    const env = d?.enviadoCliente === true;
    const ts = Number(d?.enviadoClienteEm || d?.createdAt) || 0;
    return (has ? 1e16 : 0) + (env ? 1e15 : 0) + ts;
  }

  /** App cliente: 1 contrato + 1 CRLV por protocolo/CPF; multas mantêm-se todas. */
  function compactLocacaoDocumentosClienteStore(arr) {
    const merged = dedupeLocacaoDocumentosStore(arr).filter((d) => d?.excluido !== true);
    const canonKeys = new Map();
    const rest = [];
    for (const d of merged) {
      const tipo = inferDocTipoCompact(d);
      if (tipo === "contrato" || tipo === "crlv") {
        const nc = String(d?.numeroContrato ?? "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        const dig = String(d?.cpf ?? "")
          .replace(/\D/g, "")
          .slice(0, 11);
        const key = `${nc}|${dig}|${tipo}`;
        const prev = canonKeys.get(key);
        if (!prev || docLocacaoScore(d) > docLocacaoScore(prev)) canonKeys.set(key, d);
      } else {
        rest.push(d);
      }
    }
    return [...canonKeys.values(), ...rest];
  }

  function sanitizeLocacaoDocumentosLocalStorage() {
    const arr = readLocalJsonArray("dk_locacao_documentos_v1");
    const clean = isClienteAppPage() ? compactLocacaoDocumentosClienteStore(arr) : dedupeLocacaoDocumentosStore(arr);
    if (JSON.stringify(clean) !== JSON.stringify(arr)) {
      localStorage.setItem("dk_locacao_documentos_v1", JSON.stringify(clean));
    }
    return clean;
  }

  function withCloudTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(label || "cloud_timeout")), ms);
      }),
    ]);
  }

  function fetchWithCloudTimeout(url, init, ms) {
    const timeoutMs = ms || 30000;
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl
      ? window.setTimeout(() => {
          try {
            ctrl.abort();
          } catch {
            /* ignore */
          }
        }, timeoutMs)
      : null;
    const mergedInit = ctrl ? { ...init, signal: ctrl.signal } : init;
    return fetch(url, mergedInit).finally(() => {
      if (timer) window.clearTimeout(timer);
    });
  }

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
    "dk_portal_checklist_historico_v1",
    "dk_portal_checklist_movimentacoes_v1",
    "dk_lancamentos_aluguel",
    "dk_quadro_receita_overrides",
    "dk_comprovantes_banco",
    "dk_comprovantes_cliente_pendentes",
    "dk_cliente_notificacoes",
    "dk_financeiro_extratos_v1",
    "dk_documentos_deposito_v1",
    "dk_audit_log",
    "dk_funcionarios_access",
    "dk_locacao_documentos_v1",
    "dk_pagamentos_auditoria_v1",
    "dk_comunicacao_operacao_v1",
  ];

  const DK_CLOUD_KEYS = new Set(DK_STORAGE_KEYS);
  /** Movimentações / histórico de check-list: espelham a nuvem (inclui limpar local quando cloud = []). */
  const DK_CONSULTA_SYNC_KEYS = [
    "dk_portal_checklist_movimentacoes_v1",
    "dk_portal_checklist_historico_v1",
  ];
  const DK_CLOUD_RELOAD_GUARD_KEY = "dkCloudAutopullReloadCount";
  /** Após importar backup: não sobrescrever local com nuvem/Redis antigos (ms desde epoch). */
  const DK_LOCAL_AUTHORITY_KEY = "dkLocalDataAuthorityUntil";
  const DK_LOCAL_AUTHORITY_MS = 45 * 60 * 1000;
  const DK_CLOUD_LAST_PUSH_AT_KEY = "dkCloudLastPushedAt";

  function isClienteAppPage() {
    try {
      const p = String(location.pathname || "").toLowerCase();
      return p === "/cliente" || p.endsWith("/cliente") || p.endsWith("/cliente.html");
    } catch {
      return false;
    }
  }

  function countCadastroRecordsInPayload(p) {
    if (!p || typeof p !== "object") return 0;
    const keys = [
      "dk_clientes_cadastro",
      "dk_portal_clientes_cadastro",
      "dk_veiculos_cadastro",
      "dk_portal_veiculos_cadastro",
      "dk_veiculos_frota_planilha",
      "dk_locacoes_cadastro",
      "dk_lancamentos_aluguel",
      "dk_lancamentos_aluguel_cadastro",
    ];
    return keys.reduce((n, k) => n + (Array.isArray(p[k]) ? p[k].length : 0), 0);
  }

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

  /** Demo: browser sem cadastros completos — puxar da nuvem (387 locações na demo). */
  const DEMO_MIN_LOCACOES_LOCAL = 300;

  function demoNeedsCloudCadastroBootstrap() {
    if (window.__DK_IS_DEMO_DEPLOY__ !== true) return false;
    let c = 0;
    let v = 0;
    let l = 0;
    try {
      const rawC = localStorage.getItem("dk_clientes_cadastro");
      const rawV = localStorage.getItem("dk_veiculos_cadastro");
      const rawL = localStorage.getItem("dk_locacoes_cadastro");
      if (rawC) c = (JSON.parse(rawC) || []).length;
      if (rawV) v = (JSON.parse(rawV) || []).length;
      if (rawL) l = (JSON.parse(rawL) || []).length;
    } catch {
      /* ignore */
    }
    if (c === 0 || v === 0 || l === 0) return true;
    if (l < DEMO_MIN_LOCACOES_LOCAL) return true;
    return false;
  }

  async function ensurePortalCadastrosFromCloud(opts) {
    if (isClienteAppPage()) {
      return { ok: true, skipped: true, reason: "cliente_app" };
    }
    const force = Boolean(opts && opts.force);
    const localL = readLocalJsonArray("dk_locacoes_cadastro").length;
    if (!force && window.__DK_IS_DEMO_DEPLOY__ !== true && localL > 0) {
      return { ok: true, skipped: true, reason: "oficial_local_ok" };
    }
    if (!force && !demoNeedsCloudCadastroBootstrap()) {
      return { ok: true, skipped: true, reason: "cadastros_ok" };
    }
    const data = await fetchCloudSnapshotPayload();
    if (!data?.payload) return { ok: false, reason: "no_cloud" };
    const p = data.payload;
    const hasData =
      (p.dk_clientes_cadastro || []).length > 0 ||
      (p.dk_veiculos_cadastro || []).length > 0 ||
      (p.dk_locacoes_cadastro || []).length > 0;
    if (!hasData) return { ok: false, reason: "cloud_empty" };
    suppressCloudHook = true;
    try {
      applyPayloadToLocalStorage(data.payload, { replace: false, lightSanitize: true });
    } finally {
      suppressCloudHook = false;
    }
    try {
      window.dispatchEvent(new CustomEvent("dk-locacoes-synced"));
    } catch {
      /* ignore */
    }
    if (typeof window.__DK_portalRefreshOperacaoLocal === "function") {
      window.__DK_portalRefreshOperacaoLocal();
    }
    const afterL = readLocalJsonArray("dk_locacoes_cadastro").length;
    return { ok: true, applied: true, locacoes: afterL, source: data.source || "cloud" };
  }

  async function bootstrapDemoCadastrosFromCloudIfEmpty() {
    return ensurePortalCadastrosFromCloud({ force: false });
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
    if (typeof window.__DK_sanitizeOficialCloudPayload === "function" && !isClienteAppPage()) {
      Object.assign(payload, window.__DK_sanitizeOficialCloudPayload(payload) || payload);
    }
    if (payload.dk_patrimonio_crlv_v1) {
      payload.dk_patrimonio_crlv_v1 = normalizePatrimonioPayloadForSync(
        payload.dk_patrimonio_crlv_v1,
        payload.dk_patrimonio_fotos_excluidas_v1
      );
    }
    return payload;
  }

  function parseExclusoesPatrimonioLista(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const p = JSON.parse(raw);
        return Array.isArray(p) ? p : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /** Cópia Redis: sem imagens PDF/JPEG pesadas (limite ~4,5 MB na Vercel). */
  function stripHeavyBinaryFromPayload(payload, opts) {
    const keepLocacaoPdf = Boolean(opts && opts.keepLocacaoPdf);
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
    if (Array.isArray(out.dk_locacao_documentos_v1)) {
      out.dk_locacao_documentos_v1 = out.dk_locacao_documentos_v1.map((rec) => {
        if (!rec || typeof rec !== "object") return rec;
        if (keepLocacaoPdf || !String(rec.arquivoBase64 || "").trim()) return { ...rec };
        const { arquivoBase64, ...rest } = rec;
        return { ...rest, pdfNaCopiaRedis: true };
      });
      if (!keepLocacaoPdf) {
        /* Supabase: metadados de todos; Redis shrink: só enviados ao cliente */
      }
    }
    if (out.dk_patrimonio_crlv_v1?.documentos && Array.isArray(out.dk_patrimonio_crlv_v1.documentos)) {
      const stripDocImg = (d) => {
        if (!d || typeof d !== "object") return d;
        const img = String(d.imagemRecortada || "");
        if (img.length > 350000) {
          const { imagemRecortada, ...rest } = d;
          return rest;
        }
        return d;
      };
      const stripFotoImg = (f) => {
        if (!f || typeof f !== "object") return f;
        const img = String(f.imagem || "");
        const imgOrig = String(f.imagemOriginal || "");
        if (img.length > 350000 || imgOrig.length > 350000) {
          return {
            ...f,
            imagem: img.length > 350000 ? "" : f.imagem,
            imagemOriginal: imgOrig.length > 350000 ? undefined : f.imagemOriginal,
            imagemIndisponivel: img.length > 350000,
          };
        }
        return f;
      };
      out.dk_patrimonio_crlv_v1 = {
        documentos: out.dk_patrimonio_crlv_v1.documentos.map(stripDocImg),
        fotosCapturas: Array.isArray(out.dk_patrimonio_crlv_v1.fotosCapturas)
          ? out.dk_patrimonio_crlv_v1.fotosCapturas.map(stripFotoImg)
          : [],
        fotosCapturasExcluidas: Array.isArray(out.dk_patrimonio_crlv_v1.fotosCapturasExcluidas)
          ? out.dk_patrimonio_crlv_v1.fotosCapturasExcluidas
          : [],
      };
    }
    if (Array.isArray(out.dk_patrimonio_fotos_excluidas_v1)) {
      out.dk_patrimonio_fotos_excluidas_v1 = out.dk_patrimonio_fotos_excluidas_v1.slice(-600);
    }
    return out;
  }

  /** Supabase: cadastros + metadados; PDFs de CRLV/contrato ficam na cópia Redis. */
  function shrinkPayloadForSupabaseStorage(payload) {
    return stripHeavyBinaryFromPayload(payload, { keepLocacaoPdf: false });
  }

  function shrinkPayloadForRedundantCloud(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const out = stripHeavyBinaryFromPayload(payload, { keepLocacaoPdf: true });
    if (Array.isArray(out.dk_locacao_documentos_v1)) {
      out.dk_locacao_documentos_v1 = out.dk_locacao_documentos_v1.filter(
        (rec) => rec && (rec.enviadoCliente === true || rec.excluido === true)
      );
    }
    return out;
  }

  const cloudSupabaseState = { down: false, reason: "", code: "", quietFailLogged: false };

  function describeSupabasePushError(raw) {
    const text = String(raw || "").trim();
    const lower = text.toLowerCase();
    if (
      text.includes("PGRST002") ||
      lower.includes("schema cache") ||
      lower.includes("could not query the database for the schema cache")
    ) {
      return {
        code: "PGRST002",
        userMessage:
          "Supabase REST indisponível (erro PGRST002 — cache de esquema). Os dados estão na cópia Redis. Abra o painel Supabase → reinicie o projeto ou execute NOTIFY pgrst, 'reload schema';",
        isOutage: true,
      };
    }
    if (lower.includes("supabase_upsert_timeout") || lower.includes("timeout")) {
      return {
        code: "timeout",
        userMessage:
          "Supabase demorou demais a responder (snapshot grande). Metadados vão para Redis; tente «Guardar na nuvem» de novo mais tarde.",
        isOutage: false,
      };
    }
    if (lower.includes("payload too large") || lower.includes("413")) {
      return {
        code: "payload_large",
        userMessage:
          "Snapshot demasiado grande para o Supabase neste pedido. Cadastros e metadados ficam na cópia Redis.",
        isOutage: false,
      };
    }
    if (!text) {
      return {
        code: "unknown",
        userMessage: "Supabase não respondeu — cópia Redis activa.",
        isOutage: true,
      };
    }
    return { code: "error", userMessage: `Supabase: ${text.slice(0, 180)}`, isOutage: false };
  }

  function updateSupabaseStatusBanner(supaOk, supaErr) {
    const el = document.getElementById("portal-cloud-supabase-status");
    if (!el) return;
    if (supaOk) {
      cloudSupabaseState.down = false;
      cloudSupabaseState.reason = "";
      cloudSupabaseState.code = "";
      cloudSupabaseState.quietFailLogged = false;
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    const info = describeSupabasePushError(supaErr);
    cloudSupabaseState.down = true;
    cloudSupabaseState.reason = info.userMessage;
    cloudSupabaseState.code = info.code;
    el.textContent = info.userMessage;
    el.classList.remove("hidden");
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
    let winner;
    let loser;
    if (comprovanteClienteRank(rec) >= comprovanteClienteRank(prev)) {
      winner = rec;
      loser = prev;
    } else {
      winner = prev;
      loser = rec;
    }
    let out = attachComprovanteMediaFromSecondary(winner, loser);
    const inv = prev?.pagamentoInvalidado ? prev : rec?.pagamentoInvalidado ? rec : null;
    if (inv) {
      out = {
        ...out,
        pagamentoInvalidado: true,
        pagamentoInvalidadoEm: inv.pagamentoInvalidadoEm || inv.rejeitadoEm,
        pagamentoInvalidadoPor: inv.pagamentoInvalidadoPor || inv.rejeitadoPorNome,
        status: "rejeitado",
        rejeitadoEm: inv.rejeitadoEm || inv.pagamentoInvalidadoEm,
        rejeitadoAutomatico: false,
        rejeitadoMotivo: inv.rejeitadoMotivo,
        rejeitadoMotivoCliente: inv.rejeitadoMotivoCliente,
        rejeitadoPorNome: inv.rejeitadoPorNome,
        rejeitadoPorCpf: inv.rejeitadoPorCpf,
      };
    }
    const deAcordoA = String(prev?.clienteDeAcordoEm || "").trim();
    const deAcordoB = String(rec?.clienteDeAcordoEm || "").trim();
    if (deAcordoA || deAcordoB) {
      const tsA = Date.parse(deAcordoA) || 0;
      const tsB = Date.parse(deAcordoB) || 0;
      out = { ...out, clienteDeAcordoEm: tsB >= tsA ? deAcordoB || deAcordoA : deAcordoA || deAcordoB };
    }
    return out;
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
      const cpf = clienteAppSessaoCpf();
      if (cpf && isClienteAppPage()) {
        const raw = localStorage.getItem("dk_locacoes_cadastro");
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;
        let changed = false;
        const next = arr.map((loc) => {
          if (!loc || typeof loc !== "object") return loc;
          if (String(loc.cpf || "").replace(/\D/g, "").slice(0, 11) !== cpf) return loc;
          const normalized = normalizeLocacoesContratoAtivoList([loc])[0];
          if (JSON.stringify(normalized) !== JSON.stringify(loc)) changed = true;
          return normalized;
        });
        if (changed) localStorage.setItem("dk_locacoes_cadastro", JSON.stringify(next));
        return;
      }
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

  function clienteAppSessaoCpf() {
    if (!isClienteAppPage()) return "";
    try {
      if (typeof window.__DK_getClienteSessaoCpf === "function") {
        const cpfFn = String(window.__DK_getClienteSessaoCpf() || "")
          .replace(/\D/g, "")
          .slice(0, 11);
        if (cpfFn.length === 11) return cpfFn;
      }
      const raw = localStorage.getItem("dk_sessao_cliente_app");
      const s = raw ? JSON.parse(raw) : null;
      return String(s?.cpf || "")
        .replace(/\D/g, "")
        .slice(0, 11);
    } catch {
      /* ignore */
    }
    return "";
  }

  function filterCloudLocacoesForCliente(cpf, cloudArr, proto) {
    const dig = String(cpf || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    const protoFull = String(proto || "").replace(/\D/g, "");
    if ((!dig || dig.length !== 11) && !protoFull) return [];
    if (!Array.isArray(cloudArr)) return [];
    return cloudArr.filter((l) => {
      const c = String(l?.cpf || "")
        .replace(/\D/g, "")
        .slice(0, 11);
      if (dig.length === 11 && c === dig) return true;
      const nc = String(l?.numeroContrato || l?.protocolo || "").replace(/\D/g, "");
      if (protoFull && nc === protoFull) return true;
      return false;
    });
  }

  function clienteAppSessaoProto() {
    if (!isClienteAppPage()) return "";
    try {
      const raw =
        sessionStorage.getItem("dk_cliente_app_gate") ||
        localStorage.getItem("dk_cliente_gate_persist");
      const g = raw ? JSON.parse(raw) : null;
      return String(g?.proto || g?.protocolo || "").replace(/\D/g, "");
    } catch {
      return "";
    }
  }

  /** App cliente: não baixar frota inteira da demo — só dados do CPF logado. */
  function filterCloudPayloadForClienteApp(payload, cpf) {
    if (!payload || typeof payload !== "object") return payload;
    const dig = String(cpf || clienteAppSessaoCpf() || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    if (!dig) return payload;
    const out = { ...payload };
    if (Array.isArray(out.dk_locacoes_cadastro)) {
      out.dk_locacoes_cadastro = filterCloudLocacoesForCliente(
        dig,
        out.dk_locacoes_cadastro,
        clienteAppSessaoProto()
      );
    }
    if (Array.isArray(out.dk_comunicacao_operacao_v1)) {
      out.dk_comunicacao_operacao_v1 = out.dk_comunicacao_operacao_v1.filter(
        (m) => String(m?.cpf || "").replace(/\D/g, "").slice(0, 11) === dig
      );
    }
    if (Array.isArray(out.dk_cliente_notificacoes)) {
      out.dk_cliente_notificacoes = out.dk_cliente_notificacoes.filter(
        (n) => String(n?.cpf || "").replace(/\D/g, "").slice(0, 11) === dig
      );
    }
    if (Array.isArray(out.dk_comprovantes_cliente_pendentes)) {
      out.dk_comprovantes_cliente_pendentes = out.dk_comprovantes_cliente_pendentes.filter(
        (r) => String(r?.cpf || "").replace(/\D/g, "").slice(0, 11) === dig
      );
    }
    if (Array.isArray(out.dk_locacao_documentos_v1)) {
      /* enviados + tombstones (excluído) — o tombstone remove o doc antigo do app */
      out.dk_locacao_documentos_v1 = out.dk_locacao_documentos_v1.filter(
        (d) =>
          (d?.enviadoCliente === true || d?.excluido === true) &&
          String(d?.cpf || "")
            .replace(/\D/g, "")
            .slice(0, 11) === dig
      );
    }
    if (Array.isArray(out.dk_clientes_cadastro)) {
      out.dk_clientes_cadastro = out.dk_clientes_cadastro.filter(
        (c) =>
          String(c?.cpf || "")
            .replace(/\D/g, "")
            .slice(0, 11) === dig
      );
    } else {
      delete out.dk_clientes_cadastro;
    }
    delete out.dk_portal_clientes_cadastro;
    delete out.dk_veiculos_cadastro;
    delete out.dk_portal_veiculos_cadastro;
    delete out.dk_veiculos_frota_planilha;
    return out;
  }

  const CLIENTE_CLOUD_PULL_KEYS = new Set([
    "dk_clientes_cadastro",
    "dk_locacoes_cadastro",
    "dk_locacao_documentos_v1",
    "dk_comunicacao_operacao_v1",
    "dk_cliente_notificacoes",
    "dk_comprovantes_cliente_pendentes",
  ]);

  /** App cliente: nunca consolidar no pull — o filtro estrito do oficial apagava pagamentos sem protocolo. */
  function shouldSkipConsolidateLocacoesOnApply() {
    return isClienteAppPage();
  }

  function consolidateLocacoesPagamentosInPlace(arr, opts) {
    if (!Array.isArray(arr) || typeof window.__DK_consolidarLancamentosAluguelLoc !== "function") return arr;
    if (shouldSkipConsolidateLocacoesOnApply(opts)) return arr;
    const cpfFilter = String(opts?.cpfFilter || clienteAppSessaoCpf() || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    for (const loc of arr) {
      if (!loc || typeof loc !== "object") continue;
      if (cpfFilter && String(loc.cpf || "").replace(/\D/g, "").slice(0, 11) !== cpfFilter) continue;
      window.__DK_consolidarLancamentosAluguelLoc(loc, { mutate: true });
    }
    return arr;
  }

  function applyPayloadToLocalStorage(payload, opts) {
    if (!payload || typeof payload !== "object") return;
    if (typeof window.__DK_sanitizeOficialCloudPayload === "function" && !isClienteAppPage()) {
      payload = window.__DK_sanitizeOficialCloudPayload(payload);
    }
    const lightSanitize = Boolean(opts && opts.lightSanitize);
    const clientePage = lightSanitize && isClienteAppPage();
    const cpfCliente = clientePage ? clienteAppSessaoCpf() : "";
    if (clientePage && cpfCliente) {
      payload = filterCloudPayloadForClienteApp(payload, cpfCliente);
    }
    if (payload.dk_cadastro_manual_portal_v1 === true && typeof window.__DK_enableCadastroManualPortalMode === "function") {
      try {
        window.__DK_enableCadastroManualPortalMode();
      } catch {
        /* ignore */
      }
    }
    const replace =
      Boolean(opts && opts.replace) ||
      Boolean(payload.dk_demo_cadastro_10_v1) ||
      Boolean(payload.dk_oficial_sem_protocolos_v1);
    const demoTenReplace = Boolean(payload.dk_demo_cadastro_10_v1);

    for (const k of DK_STORAGE_KEYS) {
      if (clientePage && !CLIENTE_CLOUD_PULL_KEYS.has(k)) continue;
      if (replace && !Object.prototype.hasOwnProperty.call(payload, k)) {
        if (DK_IMMUTABLE_CADASTRO_KEYS.has(k) && !demoTenReplace) continue;
        localStorage.removeItem(k);
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(payload, k)) continue;
      const v = payload[k];
      if (v === undefined || v === null) {
        if (DK_IMMUTABLE_CADASTRO_KEYS.has(k) && !demoTenReplace) continue;
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
          if (isClienteAppPage() && !arr.length) continue;
          arr = normalizeLocacoesContratoAtivoList(arr);
          const localArr = readLocalJsonArray(k);
          const mergeFn =
            typeof window.__DK_mergeLocacoesCadastroCliente === "function"
              ? window.__DK_mergeLocacoesCadastroCliente
              : mergeLocacoesCadastroBeforePush;
          arr = mergeFn(localArr, arr);
          consolidateLocacoesPagamentosInPlace(arr, opts);
        } else if (typeof mergeCadastroHistoricoImutavel === "function") {
          arr = mergeCadastroHistoricoImutavel(k, readLocalJsonArray(k), arr);
        }
        if (demoTenReplace) {
          saveCadastro(k, arr, { bypassImmutabilidadeCadastro: true, allowShrink: true });
        } else {
          saveCadastro(k, arr);
        }
        continue;
      }
      if (DK_IMMUTABLE_CADASTRO_KEYS.has(k)) {
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
        if (k === "dk_locacoes_cadastro") {
          if (isClienteAppPage() && !cloudArr.length) continue;
          cloudArr = normalizeLocacoesContratoAtivoList(cloudArr);
          const localArr = readLocalJsonArray(k);
          const mergeFn =
            typeof window.__DK_mergeLocacoesCadastroCliente === "function"
              ? window.__DK_mergeLocacoesCadastroCliente
              : mergeLocacoesCadastroBeforePush;
          cloudArr = mergeFn(localArr, cloudArr);
          consolidateLocacoesPagamentosInPlace(cloudArr, opts);
        } else if (typeof mergeCadastroHistoricoImutavel === "function") {
          cloudArr = mergeCadastroHistoricoImutavel(k, readLocalJsonArray(k), cloudArr);
        }
        if (demoTenReplace) {
          localStorage.setItem(k, JSON.stringify(cloudArr));
        } else if (k === "dk_locacoes_cadastro") {
          localStorage.setItem(k, JSON.stringify(cloudArr));
        } else {
          const localArr = readLocalJsonArray(k);
          const mergedCli =
            typeof mergeCadastroHistoricoImutavel === "function"
              ? mergeCadastroHistoricoImutavel(k, localArr, cloudArr)
              : [...(localArr || []), ...cloudArr];
          localStorage.setItem(k, JSON.stringify(mergedCli));
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
      if (k === "dk_comunicacao_operacao_v1") {
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
        const mergeFn =
          typeof window.__DK_comunicacaoOperacaoMerge === "function"
            ? window.__DK_comunicacaoOperacaoMerge
            : (localArr, inc) => [...(localArr || []), ...(inc || [])];
        if (replace) {
          localStorage.setItem(k, JSON.stringify(cloudArr));
        } else {
          const localArr = readLocalJsonArray(k);
          localStorage.setItem(k, JSON.stringify(mergeFn(localArr, cloudArr)));
        }
        continue;
      }
      if (k === "dk_pagamentos_auditoria_v1") {
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
        const localArr = readLocalJsonArray(k);
        localStorage.setItem(k, JSON.stringify(mergePagamentosAuditoriaArrays(localArr, cloudArr)));
        continue;
      }
      if (k === "dk_financeiro_extratos_v1") {
        let cloudObj = v;
        if (typeof v === "string") {
          try {
            cloudObj = JSON.parse(v);
          } catch {
            cloudObj = null;
          }
        }
        let localObj = null;
        try {
          const raw = localStorage.getItem(k);
          localObj = raw ? JSON.parse(raw) : null;
        } catch {
          localObj = null;
        }
        const merged = replace
          ? parseFinanceiroStore(cloudObj)
          : mergeFinanceiroExtratos(localObj, cloudObj);
        localStorage.setItem(k, JSON.stringify(merged));
        continue;
      }
      if (k === "dk_patrimonio_crlv_v1" || k === "dk_patrimonio_fotos_excluidas_v1") continue;
      if (k === "dk_documentos_deposito_v1") {
        let cloudDep = v;
        if (typeof v === "string") {
          try {
            cloudDep = JSON.parse(v);
          } catch {
            cloudDep = null;
          }
        }
        let localDep = null;
        try {
          const raw = localStorage.getItem(k);
          localDep = raw ? JSON.parse(raw) : null;
        } catch {
          localDep = null;
        }
        const mergeFn =
          typeof window.__DK_documentosMergeDeposit === "function"
            ? window.__DK_documentosMergeDeposit
            : (_, c) => c;
        const merged = replace ? cloudDep : mergeFn(localDep, cloudDep);
        if (merged && typeof merged === "object") {
          localStorage.setItem(k, JSON.stringify(merged));
        }
        continue;
      }
      if (k === "dk_locacao_documentos_v1") {
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
          localStorage.setItem(k, JSON.stringify(dedupeLocacaoDocumentosStore(cloudArr)));
        } else {
          const localArr = readLocalJsonArray(k);
          localStorage.setItem(
            k,
            JSON.stringify(mergeLocacaoDocumentosV1(localArr, cloudArr))
          );
        }
        continue;
      }
      if (k === "dk_patrimonio_crlv_v1") {
        let cloudObj = v;
        if (typeof v === "string") {
          try {
            cloudObj = JSON.parse(v);
          } catch {
            cloudObj = null;
          }
        }
        let localObj = null;
        try {
          const raw = localStorage.getItem(k);
          localObj = raw ? JSON.parse(raw) : null;
        } catch {
          localObj = null;
        }
        const merged = mergePatrimonioCrlv(
          localObj,
          cloudObj,
          payload.dk_patrimonio_fotos_excluidas_v1
        );
        localStorage.setItem(k, JSON.stringify(merged));
        localStorage.setItem(
          "dk_patrimonio_fotos_excluidas_v1",
          JSON.stringify(merged.fotosCapturasExcluidas || [])
        );
        continue;
      }
      if (k === "dk_patrimonio_fotos_excluidas_v1") {
        let cloudArr = [];
        if (Array.isArray(v)) cloudArr = v;
        else if (typeof v === "string") {
          cloudArr = parseExclusoesPatrimonioLista(v);
        }
        const localArr = parseExclusoesPatrimonioLista(
          localStorage.getItem("dk_patrimonio_fotos_excluidas_v1")
        );
        localStorage.setItem(
          "dk_patrimonio_fotos_excluidas_v1",
          JSON.stringify(mergeFotosCapturasExcluidas(localArr, cloudArr))
        );
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
    if (typeof window.__DK_capDemoCadastro10LocalArrays === "function") {
      try {
        window.__DK_capDemoCadastro10LocalArrays();
      } catch {
        /* ignore */
      }
    }
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
    if (typeof window.__DK_portalRefreshOperacaoDeferred === "function") {
      try {
        window.__DK_portalRefreshOperacaoDeferred(["locacao", "aluguel"]);
      } catch {
        /* ignore */
      }
    }
    if (Object.prototype.hasOwnProperty.call(payload, "dk_funcionarios_access")) {
      try {
        window.__DK_hydrateFuncionariosAccess?.();
      } catch {
        /* ignore */
      }
    }
    if (window.__DK_IS_DEMO_DEPLOY__ !== true && typeof window.__DK_purgeGlobalLancamentoKeysOficial === "function") {
      try {
        window.__DK_purgeGlobalLancamentoKeysOficial();
      } catch {
        /* ignore */
      }
    }
  }

  function runLocacoesSanitizeAfterCloudApply(opts) {
    const light = Boolean(opts && opts.light);
    if (typeof window.__DK_isCadastroManualPortalMode === "function" && window.__DK_isCadastroManualPortalMode()) {
      if (typeof window.__DK_sanitizeLocacoesCadastro === "function") {
        try {
          window.__DK_sanitizeLocacoesCadastro({ pushCloud: false });
        } catch (e) {
          console.warn("[DK cloud] sanitize locações", e);
        }
      }
      return;
    }
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
    refreshLastBackupPanel().catch((e) => console.warn("[DK backup] panel", e));
    probeSupabaseCloudHealth().catch((e) => console.warn("[DK cloud] health", e));
  }

  async function probeSupabaseCloudHealth() {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client || !window.__DK_SUPABASE_CONFIGURED__) return { ok: false, reason: "not_configured" };
    try {
      const { error } = await withCloudTimeout(
        client.from("dk_cloud_snapshots").select("label").eq("label", dkSnapshotLabel()).limit(1),
        8000,
        "supabase_health_timeout"
      );
      if (error) {
        updateSupabaseStatusBanner(false, error.message || String(error));
        return { ok: false, reason: error.message };
      }
      updateSupabaseStatusBanner(true, "");
      return { ok: true };
    } catch (e) {
      updateSupabaseStatusBanner(false, String(e?.message || e));
      return { ok: false, reason: String(e?.message || e) };
    }
  }

  function resolveRedundantSnapshotApiUrls() {
    const meta = document
      .querySelector('meta[name="dk-cadastro-sync-origin"]')
      ?.getAttribute("content")
      ?.trim()
      .replace(/\/$/, "");
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1";
    const q = dkCloudChannelQuery();
    const localUrl = `${window.location.origin}/api/${REDUNDANT_SNAPSHOT_API}${q}`;
    if (isLocal && meta) return [localUrl, `${meta}/api/${REDUNDANT_SNAPSHOT_API}${q}`];
    return [localUrl];
  }

  async function fetchRedundantSnapshotPayload() {
    const urls = resolveRedundantSnapshotApiUrls();
    for (let i = 0; i < urls.length; i += 1) {
      try {
        const res = await fetchWithCloudTimeout(
          urls[i],
          {
            method: "GET",
            headers: dkCloudFetchHeaders(),
          },
          15000
        );
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
    const fullReplaceComprovantes = Boolean(opts && opts.fullReplaceComprovantes);
    const urls = resolveRedundantSnapshotApiUrls();
    let anyOk = false;
    let lastErr = null;
    const bodyPayload =
      opts && opts.skipShrink ? payload : shrinkPayloadForRedundantCloud(payload);
    if (replace) {
      bodyPayload._dkFullReplaceKeys = [
        "dk_comprovantes_cliente_pendentes",
        "dk_cliente_notificacoes",
        "dk_lancamentos_aluguel",
        "dk_lancamentos_aluguel_cadastro",
        "dk_comprovantes_banco_assinaturas",
        "dk_comprovantes_banco",
        "dk_cliente_comprovantes_enviados",
      ];
    } else if (fullReplaceComprovantes) {
      bodyPayload._dkFullReplaceKeys = ["dk_comprovantes_cliente_pendentes"];
    }
    const postTimeoutMs = opts && opts.skipShrink ? 90000 : 45000;
    for (let i = 0; i < urls.length; i += 1) {
      try {
        const res = await fetchWithCloudTimeout(
          urls[i],
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...dkCloudFetchHeaders() },
            body: JSON.stringify({
              payload: bodyPayload,
              updated_at: updatedAt,
              replace,
            }),
          },
          postTimeoutMs
        );
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

  async function pushLocacaoDocumentoSupabaseBackground(doc, updatedAt) {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client || !window.__DK_SUPABASE_CONFIGURED__ || !doc?.id) return false;
    try {
      const [supaRow, redisRow] = await Promise.all([
        withCloudTimeout(fetchSupabaseSnapshotPayload(), 7000, "supabase_timeout").catch(() => null),
        fetchRedundantSnapshotPayload(),
      ]);
      const cloudPayload = mergeRemoteSnapshotsBeforePush(supaRow, redisRow) || {};
      const merged = mergeLocacaoDocumentosV1(
        [{ ...doc, enviadoCliente: true }],
        cloudPayload.dk_locacao_documentos_v1
      );
      const fullPayload = { ...cloudPayload, dk_locacao_documentos_v1: merged };
      const supabasePayload = shrinkPayloadForSupabaseStorage(fullPayload);
      const { error } = await withCloudTimeout(
        client.from("dk_cloud_snapshots").upsert(
          { label: dkSnapshotLabel(), payload: supabasePayload, updated_at: updatedAt },
          { onConflict: "label" }
        ),
        45000,
        "supabase_upsert_timeout"
      );
      return !error;
    } catch (e) {
      console.warn("[DK docs locação] push Supabase", e);
      return false;
    }
  }

  /** Push parcial: só o documento enviado (PDF incluído) — evita falha do snapshot completo. */
  async function pushLocacaoDocumentoNuvem(doc) {
    if (!doc || typeof doc !== "object" || !doc.id) {
      return { ok: false, error: "doc_invalid" };
    }
    if (!String(doc.arquivoBase64 || "").trim()) {
      return { ok: false, error: "doc_sem_pdf" };
    }
    const updatedAt = new Date().toISOString();
    const patch = {
      dk_locacao_documentos_v1: [{ ...doc, enviadoCliente: true }],
    };
    let redisOk = false;
    let lastErr = null;
    for (let attempt = 0; attempt < 3 && !redisOk; attempt += 1) {
      const red = await pushRedundantSnapshotPayload(patch, updatedAt, { skipShrink: true });
      redisOk = red.ok;
      lastErr = red.error || null;
      if (!redisOk && attempt < 2) {
        await new Promise((r) => window.setTimeout(r, 450 * (attempt + 1)));
      }
    }
    if (redisOk) {
      noteCloudPushTimestamp(updatedAt);
      void pushLocacaoDocumentoSupabaseBackground(doc, updatedAt).catch((e) =>
        console.warn("[DK docs locação] Supabase background", e)
      );
      return { ok: true, redisOk: true, supaOk: false, supaPending: true, error: null };
    }
    const supaOk = await pushLocacaoDocumentoSupabaseBackground(doc, updatedAt);
    if (supaOk) noteCloudPushTimestamp(updatedAt);
    return { ok: supaOk, redisOk: false, supaOk, error: lastErr };
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
      .eq("label", dkSnapshotLabel())
      .maybeSingle();
    if (error || !data?.payload) return null;
    return { ...data, source: "supabase" };
  }

  let clienteSnapshotCache = { at: 0, data: null };

  function mergeRemoteSnapshotsForClienteApp(supa, redis) {
    const a = supa?.payload;
    const b = redis?.payload;
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    const out = { ...a, ...b };
    const mergeFn =
      typeof window.__DK_mergeLocacoesCadastroCliente === "function"
        ? window.__DK_mergeLocacoesCadastroCliente
        : mergeLocacoesCadastroBeforePush;
    out.dk_locacoes_cadastro = mergeFn(
      Array.isArray(a.dk_locacoes_cadastro) ? a.dk_locacoes_cadastro : [],
      Array.isArray(b.dk_locacoes_cadastro) ? b.dk_locacoes_cadastro : []
    );
    return out;
  }

  async function fetchCloudSnapshotPayloadClienteApp() {
    if (clienteSnapshotCache.data && Date.now() - clienteSnapshotCache.at < 30000) {
      return clienteSnapshotCache.data;
    }
    const redisP = fetchRedundantSnapshotPayload();
    const supaP = withCloudTimeout(fetchSupabaseSnapshotPayload(), 8000, "supabase_timeout").catch(() => null);
    const redis = await redisP;
    let supa = null;
    try {
      supa = await supaP;
    } catch {
      supa = null;
    }
    const payload = mergeRemoteSnapshotsForClienteApp(supa, redis);
    if (!payload) return null;
    const newest = pickNewestCloudRow([supa, redis].filter(Boolean));
    const data = {
      payload,
      updated_at: newest?.updated_at || redis?.updated_at || supa?.updated_at || null,
      source: redis ? "redis+cliente" : "supabase+cliente",
    };
    clienteSnapshotCache = { at: Date.now(), data };
    return data;
  }

  async function fetchCloudSnapshotPayload() {
    if (isClienteAppPage()) {
      return fetchCloudSnapshotPayloadClienteApp();
    }
    const supa = await fetchSupabaseSnapshotPayload();
    const redis = await fetchRedundantSnapshotPayload();
    const mergedPayload = mergeRemoteSnapshotsBeforePush(supa, redis);
    if (!mergedPayload) return null;
    const newest = pickNewestCloudRow([supa, redis]);
    return {
      payload: mergedPayload,
      updated_at: newest?.updated_at || supa?.updated_at || redis?.updated_at || null,
      source: newest?.source || "merged",
    };
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
    if (isLocalDataAuthorityActive()) {
      return mergePayloadWithCloudBeforePush(localPayload, cloudMeta.payload);
    }
    if (!cloudSnapshotIsNewerThanLastPush(cloudMeta.updated_at)) {
      return mergePayloadWithCloudBeforePush(localPayload, cloudMeta.payload);
    }
    const out = { ...localPayload };
    if (Object.prototype.hasOwnProperty.call(cloudMeta.payload, "dk_comprovantes_cliente_pendentes")) {
      const localArr = Array.isArray(localPayload.dk_comprovantes_cliente_pendentes)
        ? localPayload.dk_comprovantes_cliente_pendentes
        : [];
      const cloudArr = Array.isArray(cloudMeta.payload.dk_comprovantes_cliente_pendentes)
        ? cloudMeta.payload.dk_comprovantes_cliente_pendentes
        : [];
      out.dk_comprovantes_cliente_pendentes = mergeComprovantesClientePendentes(localArr, cloudArr);
    }
    if (Object.prototype.hasOwnProperty.call(cloudMeta.payload, "dk_cliente_notificacoes")) {
      out.dk_cliente_notificacoes = mergeClienteNotificacoes(
        localPayload.dk_cliente_notificacoes,
        cloudMeta.payload.dk_cliente_notificacoes
      );
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
      const info = describeSupabasePushError(supaErr);
      return {
        text: info.userMessage,
        tone: info.isOutage ? null : "muted",
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

  function locacoesCloudMergeWouldChangeLocal(cloudPayload) {
    if (!cloudPayload || typeof cloudPayload !== "object") return false;
    let cloudArr = Array.isArray(cloudPayload.dk_locacoes_cadastro) ? cloudPayload.dk_locacoes_cadastro : [];
    if (!cloudArr.length) return false;
    const cpf = isClienteAppPage() ? clienteAppSessaoCpf() : "";
    if (cpf) cloudArr = filterCloudLocacoesForCliente(cpf, cloudArr);
    if (!cloudArr.length) return false;
    const localArr = readLocalJsonArray("dk_locacoes_cadastro");
    const mergeFn =
      typeof window.__DK_mergeLocacoesCadastroCliente === "function"
        ? window.__DK_mergeLocacoesCadastroCliente
        : mergeLocacoesCadastroBeforePush;
    const merged = mergeFn(localArr, cloudArr);
    if (JSON.stringify(merged) !== JSON.stringify(localArr)) return true;
    const lancCountByNc = (arr) => {
      const m = new Map();
      for (const loc of arr || []) {
        if (!loc || typeof loc !== "object") continue;
        const nc = String(loc.numeroContrato || "")
          .replace(/\D/g, "")
          .trim();
        if (!nc) continue;
        const n = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel.length : 0;
        m.set(nc, Math.max(m.get(nc) || 0, n));
      }
      return m;
    };
    const localCounts = lancCountByNc(localArr);
    const cloudCounts = lancCountByNc(cloudArr);
    for (const [nc, cloudN] of cloudCounts) {
      if (cloudN > (localCounts.get(nc) || 0)) return true;
    }
    return false;
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
      if (k === "dk_locacoes_cadastro") {
        if (locacoesCloudMergeWouldChangeLocal(cloudPayload)) return true;
        continue;
      }
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
      if (k === "dk_comunicacao_operacao_v1") {
        const mergeCom =
          typeof window.__DK_comunicacaoOperacaoMerge === "function"
            ? window.__DK_comunicacaoOperacaoMerge
            : (localArr, cloudArr) => [...(localArr || []), ...(cloudArr || [])];
        const merged = mergeCom(Array.isArray(b) ? b : [], Array.isArray(a) ? a : []);
        if (JSON.stringify(merged) !== JSON.stringify(Array.isArray(b) ? b : [])) return true;
        continue;
      }
      if (k === "dk_locacao_documentos_v1") {
        const merged = mergeLocacaoDocumentosV1(Array.isArray(b) ? b : [], Array.isArray(a) ? a : []);
        if (JSON.stringify(merged) !== JSON.stringify(Array.isArray(b) ? b : [])) return true;
        continue;
      }
      if (k === "dk_financeiro_extratos_v1") {
        let localObj = b;
        if (typeof b === "string") {
          try {
            localObj = JSON.parse(b);
          } catch {
            localObj = null;
          }
        }
        const merged = mergeFinanceiroExtratos(localObj, a);
        const prev = parseFinanceiroStore(localObj);
        if (JSON.stringify(merged) !== JSON.stringify(prev)) return true;
        continue;
      }
      if (k === "dk_patrimonio_crlv_v1") {
        const merged = mergePatrimonioCrlv(b, a, cloudPayload.dk_patrimonio_fotos_excluidas_v1);
        const prev = parsePatrimonioStore(b);
        if (JSON.stringify(merged) !== JSON.stringify(prev)) return true;
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

  function mergeClienteNotificacaoRecord(prev, next) {
    if (!prev) return next;
    if (!next) return prev;
    const lido = Boolean(prev.lido) || Boolean(next.lido);
    const base = Date.parse(next.criadoEm || 0) >= Date.parse(prev.criadoEm || 0) ? next : prev;
    const older = base === next ? prev : next;
    return {
      ...older,
      ...base,
      id: prev.id || next.id,
      cpf: base.cpf || older.cpf,
      lido,
      lidaEm:
        prev.lidaEm ||
        next.lidaEm ||
        (lido ? new Date().toISOString() : ""),
      criadoEm: prev.criadoEm || next.criadoEm,
      mensagem: base.mensagem || older.mensagem,
      protocolo: base.protocolo || older.protocolo,
    };
  }

  function mergeClienteNotificacoes(localArr, cloudArr) {
    const byId = new Map();
    const push = (n) => {
      if (!n || typeof n !== "object" || !n.id) return;
      byId.set(n.id, mergeClienteNotificacaoRecord(byId.get(n.id), n));
    };
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(push);
    (Array.isArray(localArr) ? localArr : []).forEach(push);
    return Array.from(byId.values())
      .sort((a, b) => (Date.parse(b.criadoEm || 0) || 0) - (Date.parse(a.criadoEm || 0) || 0))
      .slice(0, 500);
  }

  function normFinanceiroBucket(b) {
    if (Array.isArray(b)) return { uploads: b };
    if (b && Array.isArray(b.uploads)) return { uploads: b.uploads };
    return { uploads: [] };
  }

  function parseFinanceiroStore(raw) {
    if (!raw) return { santander: { uploads: [] }, sicredi: { uploads: [] } };
    let o = raw;
    if (typeof raw === "string") {
      try {
        o = JSON.parse(raw);
      } catch {
        return { santander: { uploads: [] }, sicredi: { uploads: [] } };
      }
    }
    if (!o || typeof o !== "object") return { santander: { uploads: [] }, sicredi: { uploads: [] } };
    return {
      santander: normFinanceiroBucket(o.santander),
      sicredi: normFinanceiroBucket(o.sicredi),
    };
  }

  function financeiroNormDesc(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\b(PIX|TED|DOC|TEF|TRANSF)\b/g, " ")
      .replace(/\d{2}:\d{2}(:\d{2})?/g, " ")
      .replace(/\bE\d{10,}\b/g, " ")
      .replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function financeiroMovFp(m) {
    const desc = financeiroNormDesc(m?.descricao);
    const data = String(m?.data || "").trim();
    const tipo = String(m?.tipo || "").toLowerCase();
    const valor = Number(m?.valor);
    const cpf = String(m?.pagadorCpf || m?.cpfPagador || "").replace(/\D/g, "");
    return `${data}|${tipo}|${Number.isFinite(valor) ? valor.toFixed(2) : "0"}|${desc.slice(0, 80)}|${cpf}`;
  }

  function financeiroMovFpLoose(m) {
    const data = String(m?.data || "").trim();
    const tipo = String(m?.tipo || "").toLowerCase();
    const valor = Number(m?.valor);
    const base = `${data}|${tipo}|${Number.isFinite(valor) ? valor.toFixed(2) : "0"}`;
    const cpf = String(m?.pagadorCpf || m?.cpfPagador || "").replace(/\D/g, "");
    if (cpf.length === 11) return `${base}|cpf:${cpf}`;
    const nome = financeiroNormDesc(m?.pagadorNome || m?.nomePagador).slice(0, 36);
    if (nome.length >= 4) return `${base}|nome:${nome}`;
    return `${base}|d:${financeiroNormDesc(m?.descricao).slice(0, 40)}`;
  }

  function dedupeMovimentosUpload(movs) {
    const seenExact = new Set();
    const seenLoose = new Set();
    const out = [];
    for (const m of movs || []) {
      const ex = financeiroMovFp(m);
      const lo = financeiroMovFpLoose(m);
      if (seenExact.has(ex) || seenLoose.has(lo)) continue;
      seenExact.add(ex);
      seenLoose.add(lo);
      out.push(m);
    }
    return out;
  }

  function mergeFinanceiroUploadList(localList, cloudList) {
    const byId = new Map();
    const push = (u) => {
      if (!u || typeof u !== "object" || !u.id) return;
      const prev = byId.get(u.id);
      if (!prev) {
        byId.set(u.id, { ...u, movimentos: dedupeMovimentosUpload(u.movimentos) });
        return;
      }
      const movs = [...(prev.movimentos || []), ...(u.movimentos || [])];
      byId.set(u.id, {
        ...prev,
        ...u,
        movimentos: dedupeMovimentosUpload(movs),
      });
    };
    (Array.isArray(cloudList) ? cloudList : []).forEach(push);
    (Array.isArray(localList) ? localList : []).forEach(push);
    return Array.from(byId.values()).sort(
      (a, b) => (Date.parse(b.processadoEm || 0) || 0) - (Date.parse(a.processadoEm || 0) || 0)
    );
  }

  /** Acumula extratos financeiros (Santander/Sicredi) — nunca descarta uploads antigos. */
  function mergeFinanceiroExtratos(localRaw, cloudRaw) {
    const local = parseFinanceiroStore(localRaw);
    const cloud = parseFinanceiroStore(cloudRaw);
    return {
      santander: {
        uploads: mergeFinanceiroUploadList(local.santander.uploads, cloud.santander.uploads),
      },
      sicredi: {
        uploads: mergeFinanceiroUploadList(local.sicredi.uploads, cloud.sicredi.uploads),
      },
    };
  }

  function parsePatrimonioStore(raw) {
    if (!raw) return { documentos: [], fotosCapturas: [] };
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return { documentos: [] };
      }
    }
    if (Array.isArray(raw?.documentos)) {
      return {
        documentos: raw.documentos,
        fotosCapturas: raw.fotosCapturas || [],
        fotosCapturasExcluidas: raw.fotosCapturasExcluidas || [],
      };
    }
    if (Array.isArray(raw)) return { documentos: raw, fotosCapturas: [], fotosCapturasExcluidas: [] };
    return { documentos: [], fotosCapturas: [], fotosCapturasExcluidas: [] };
  }

  function mergeFotosCapturasExcluidas(localList, cloudList) {
    const map = new Map();
    for (const item of [...(cloudList || []), ...(localList || [])]) {
      const id = String(item?.id || item || "").trim();
      if (!id) continue;
      const excluidoEm = String(item?.excluidoEm || new Date().toISOString());
      const prev = map.get(id);
      if (!prev || Date.parse(excluidoEm) >= Date.parse(prev.excluidoEm || 0)) {
        map.set(id, { id, excluidoEm });
      }
    }
    return [...map.values()].slice(-400);
  }

  function aplicarExclusoesFotosCapturas(fotos, exclusoes) {
    const ids = new Set();
    const tags = new Set();
    for (const e of exclusoes || []) {
      const id = String(e?.id || "").trim();
      if (id) ids.add(id);
      const tag = String(e?.tag || "").trim();
      if (tag) tags.add(tag);
    }
    return (fotos || []).filter((f) => {
      if (!f?.id) return false;
      if (ids.has(f.id)) return false;
      const tag = String(f.tag || "").trim();
      if (tag && tags.has(tag)) return false;
      return true;
    });
  }

  /** Fila pendente na nuvem sem imagem, com leitura consumida ou antiga — não ressuscitar no cliente. */
  function patrimonioFotoFilaOrfaSync(f) {
    if (!f || typeof f !== "object") return false;
    const st = String(f.statusIa || "").toLowerCase();
    if (st === "ok") return false;
    const pendente = st === "fila" || st === "processando" || st === "pendente" || st === "falhou";
    if (!pendente) return false;
    if (st === "falhou") return true;
    if (Number(f.leiturasIa) >= 1 || Number(f.tentativasIa) >= 1) return true;
    const img = String(f.imagem || "");
    if (f.imagemIndisponivel && !img.startsWith("data:image/")) return true;
    const ms = Date.parse(String(f.atualizadoEm || f.registradoEm || "")) || 0;
    if (ms && Date.now() - ms >= 15 * 60 * 1000) return true;
    return false;
  }

  function expurgarFotosCapturasOrfaosSync(fotosCapturas, exclusoes) {
    const agora = new Date().toISOString();
    let exclusoesOut = mergeFotosCapturasExcluidas(exclusoes, []);
    const orfaos = (fotosCapturas || []).filter(patrimonioFotoFilaOrfaSync);
    for (const f of orfaos) {
      const id = String(f.id || "").trim();
      if (!id) continue;
      exclusoesOut = mergeFotosCapturasExcluidas(exclusoesOut, [
        {
          id,
          tag: String(f.tag || "").trim() || undefined,
          excluidoEm: agora,
          motivo: "Fila órfã removida na sincronização.",
        },
      ]);
    }
    return {
      fotosCapturas: aplicarExclusoesFotosCapturas(fotosCapturas, exclusoesOut),
      fotosCapturasExcluidas: exclusoesOut,
    };
  }

  function normalizePatrimonioPayloadForSync(raw, exclusoesExtra) {
    const parsed = parsePatrimonioStore(raw);
    const exclusoes = mergeFotosCapturasExcluidas(
      parsed.fotosCapturasExcluidas,
      parseExclusoesPatrimonioLista(exclusoesExtra)
    );
    let fotosCapturas = mergeFotosCapturasPatrimonio([], parsed.fotosCapturas);
    const expurgado = expurgarFotosCapturasOrfaosSync(fotosCapturas, exclusoes);
    fotosCapturas = expurgado.fotosCapturas;
    fotosCapturas = aplicarExclusoesFotosCapturas(fotosCapturas, expurgado.fotosCapturasExcluidas);
    return {
      documentos: parsed.documentos,
      fotosCapturas,
      fotosCapturasExcluidas: expurgado.fotosCapturasExcluidas,
      depositoLote: Array.isArray(raw?.depositoLote) ? raw.depositoLote : [],
    };
  }

  function mergeFotoCapturaPar(a, b) {
    const msA = Date.parse(String(a?.atualizadoEm || a?.registradoEm || "")) || 0;
    const msB = Date.parse(String(b?.atualizadoEm || b?.registradoEm || "")) || 0;
    const winner = msB >= msA ? b : a;
    const loser = msB >= msA ? a : b;
    const imgW = String(winner?.imagem || "");
    const imgL = String(loser?.imagem || "");
    return {
      ...loser,
      ...winner,
      imagem: imgW.startsWith("data:image/") ? winner.imagem : loser.imagem || "",
      imagemOriginal: winner.imagemOriginal || loser.imagemOriginal,
      imagemIndisponivel: !imgW.startsWith("data:image/") && !imgL.startsWith("data:image/"),
    };
  }

  function mergeFotosCapturasPatrimonio(localList, cloudList, exclusoes) {
    const map = new Map();
    for (const f of [...(cloudList || []), ...(localList || [])]) {
      if (!f || typeof f !== "object") continue;
      const id = String(f.id || "").trim();
      if (!id) continue;
      const prev = map.get(id);
      map.set(id, prev ? mergeFotoCapturaPar(prev, f) : f);
    }
    let fotos = [...map.values()];
    if (exclusoes) fotos = aplicarExclusoesFotosCapturas(fotos, exclusoes);
    return fotos.sort((a, b) => {
      const msA = Date.parse(String(a.registradoEm || "")) || 0;
      const msB = Date.parse(String(b.registradoEm || "")) || 0;
      return msB - msA;
    });
  }

  function normPatrimonioPlaca(s) {
    return String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function patrimonioEnvioMs(d) {
    for (const k of ["atualizadoEm", "processadoEm", "cadastradoEm"]) {
      const t = Date.parse(String(d?.[k] || ""));
      if (Number.isFinite(t)) return t;
    }
    return 0;
  }

  function normPatrimonioRenavam(s) {
    return String(s || "").replace(/\D/g, "").slice(0, 11);
  }

  function normPatrimonioChassi(s) {
    return String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function normPatrimonioMotor(s) {
    return String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function chavesIdentidadePatrimonioSync(d) {
    const placa = normPatrimonioPlaca(d.placaNorm || d.placa);
    return placa ? [`placa:${placa}`] : [];
  }

  function deduplicarPatrimonioUnionFind(documentos, pickWinner) {
    const docs = (documentos || []).filter((d) => d && typeof d === "object");
    if (docs.length <= 1) return docs;

    const parent = docs.map((_, i) => i);
    function find(i) {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    }
    function union(i, j) {
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[rj] = ri;
    }

    const keyToIdx = new Map();
    for (let i = 0; i < docs.length; i++) {
      for (const k of chavesIdentidadePatrimonioSync(docs[i])) {
        if (keyToIdx.has(k)) union(i, keyToIdx.get(k));
        else keyToIdx.set(k, i);
      }
    }

    const groups = new Map();
    for (let i = 0; i < docs.length; i++) {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(docs[i]);
    }

    const choose =
      pickWinner ||
      ((group) =>
        group.reduce((best, d) => (patrimonioEnvioMs(d) >= patrimonioEnvioMs(best) ? d : best)));

    return Array.from(groups.values()).map((group) => {
      const winner = choose(group);
      const placa = normPatrimonioPlaca(winner.placaNorm || winner.placa);
      return placa ? { ...winner, placa, placaNorm: placa } : winner;
    });
  }

  function deduplicarDocumentosPatrimonio(documentos) {
    return deduplicarPatrimonioUnionFind(documentos);
  }

  /** Mescla dois registros — registro mais recente substitui foto e campos. */
  function mergePatrimonioPar(antigo, novo, preferirNovoEmEmpate) {
    const placa = normPatrimonioPlaca(novo.placaNorm || novo.placa || antigo.placa);
    const msAntigo = patrimonioEnvioMs(antigo);
    const msNovo = patrimonioEnvioMs(novo);
    let winner;
    let loser;
    if (msNovo > msAntigo) {
      winner = novo;
      loser = antigo;
    } else if (msAntigo > msNovo) {
      winner = antigo;
      loser = novo;
    } else {
      winner = preferirNovoEmEmpate ? novo : antigo;
      loser = preferirNovoEmEmpate ? antigo : novo;
    }
    const out = {
      ...loser,
      ...winner,
      placa,
      placaNorm: placa,
      id: winner.id || loser.id,
    };
    if (patrimonioEnvioMs(winner) >= patrimonioEnvioMs(loser)) {
      out.imagemRecortada = String(winner.imagemRecortada || "");
      if (winner.imagemAtualizadaEm) out.imagemAtualizadaEm = winner.imagemAtualizadaEm;
    } else {
      out.imagemRecortada = String(winner.imagemRecortada || loser.imagemRecortada || "");
    }
    return out;
  }

  /** Uma entrada por placa Mercosul — prevalece o envio mais recente. */
  function mergePatrimonioCrlv(localRaw, cloudRaw, cloudExclusoesStandalone) {
    const cloudDocs = parsePatrimonioStore(cloudRaw).documentos.map((d) => ({ ...d, _dkSyncLocal: false }));
    const localDocs = parsePatrimonioStore(localRaw).documentos.map((d) => ({ ...d, _dkSyncLocal: true }));
    const all = [...cloudDocs, ...localDocs];

    const merged = deduplicarPatrimonioUnionFind(all, (group) =>
      group.reduce((best, d) => {
        const msD = patrimonioEnvioMs(d);
        const msB = patrimonioEnvioMs(best);
        if (msD !== msB) return msD > msB ? d : best;
        if (d._dkSyncLocal && !best._dkSyncLocal) return d;
        if (!d._dkSyncLocal && best._dkSyncLocal) return best;
        return d;
      })
    );

    const localP = parsePatrimonioStore(localRaw);
    const cloudP = parsePatrimonioStore(cloudRaw);
    let exLocalStandalone = [];
    try {
      exLocalStandalone = parseExclusoesPatrimonioLista(
        localStorage.getItem("dk_patrimonio_fotos_excluidas_v1")
      );
    } catch {
      exLocalStandalone = [];
    }
    const exclusoes = mergeFotosCapturasExcluidas(
      localP.fotosCapturasExcluidas,
      cloudP.fotosCapturasExcluidas,
      exLocalStandalone,
      parseExclusoesPatrimonioLista(cloudExclusoesStandalone)
    );
    let fotosCapturas = mergeFotosCapturasPatrimonio(localP.fotosCapturas, cloudP.fotosCapturas, exclusoes);
    fotosCapturas = aplicarExclusoesFotosCapturas(fotosCapturas, exclusoes);

    const depositoLote = Array.isArray(localRaw?.depositoLote) ? localRaw.depositoLote : [];
    return {
      ...normalizePatrimonioPayloadForSync({
        documentos: merged.map(({ _dkSyncLocal, ...rest }) => rest),
        fotosCapturas,
        fotosCapturasExcluidas: exclusoes,
        depositoLote,
      }),
      depositoLote,
    };
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

  /** Antes do push: copia `dk_lancamentos_*` para `portalLancamentosAluguel` em cada locação (app cliente lê da locação). */
  function hydrateLocacoesCadastroPagamentosParaNuvem(payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (window.__DK_IS_DEMO_DEPLOY__ !== true) {
      return typeof window.__DK_sanitizeCloudPayloadLancamentosOficial === "function"
        ? window.__DK_sanitizeCloudPayloadLancamentosOficial(payload)
        : payload;
    }
    const locs = payload.dk_locacoes_cadastro;
    if (!Array.isArray(locs) || !locs.length) return payload;
    const globalPools = [
      payload.dk_lancamentos_aluguel,
      payload.dk_lancamentos_aluguel_cadastro,
      payload.dk_lancamento_aluguel,
      payload.dk_lancamento_aluguel_cadastro,
    ].filter((a) => Array.isArray(a) && a.length);
    if (!globalPools.length) return payload;
    const dig = (s) => String(s ?? "").replace(/\D/g, "");
    const normPlate = (p) =>
      String(p ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const normNc = (v) =>
      String(v ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const rowsForLoc = (loc) => {
      const cpf = dig(loc.cpf).slice(0, 11);
      const nc = normNc(loc.numeroContrato);
      const placa = normPlate(loc.placa);
      if (cpf.length !== 11 || !nc || !placa) return [];
      const out = [];
      for (const pool of globalPools) {
        for (const item of pool) {
          if (!item || typeof item !== "object") continue;
          if (dig(item.cpf).slice(0, 11) !== cpf) continue;
          if (normNc(item.numeroContrato) !== nc) continue;
          if (normPlate(item.placa) !== placa) continue;
          const data = String(item.data || item.dataPagamento || item.semanaInicio || "").trim();
          if (!data) continue;
          let valor = typeof item.valor === "number" ? item.valor : Number(item.valorPago);
          const MEIOS = ["valorEspecie", "valorPix", "valorCartao"];
          if (MEIOS.some((k) => Object.prototype.hasOwnProperty.call(item, k))) {
            const sum = MEIOS.reduce((s, k) => s + (Number(item[k]) || 0), 0);
            if (sum > 0) valor = sum;
          }
          if (!Number.isFinite(valor) || valor <= 0) continue;
    const row = {
            data,
            valor,
            createdAt: Number(item.createdAt || item.id || 0) || Date.now(),
            registradoPorCpf: dig(item.registradoPorCpf).slice(0, 11),
            registradoPorNome: String(item.registradoPorNome || "").trim(),
          };
          if (MEIOS.some((k) => Object.prototype.hasOwnProperty.call(item, k))) {
            row.valorEspecie = Number(item.valorEspecie) || 0;
            row.valorPix = Number(item.valorPix) || 0;
            row.valorCartao = Number(item.valorCartao) || 0;
          }
          out.push(row);
        }
      }
      return out;
    };
    const outLocs = locs.map((loc) => {
      if (!loc || typeof loc !== "object") return loc;
      const globalRows = rowsForLoc(loc);
      const embedded = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
      if (!globalRows.length && !embedded.length) return loc;
      const mergedPl = mergeLancamentosAluguelLocacaoPar([embedded, globalRows]);
      if (!mergedPl.length) return loc;
      return { ...loc, portalLancamentosAluguel: mergedPl };
    });
    return { ...payload, dk_locacoes_cadastro: outLocs };
  }

  function mergeLancamentosAluguelLocacaoPar(arrays) {
    if (typeof window.__DK_mergePortalLancamentosAluguelEmbutidos === "function") {
      return window.__DK_mergePortalLancamentosAluguelEmbutidos(arrays);
    }
    if (typeof window.__DK_mergeLocacoesCadastroCliente === "function") {
      const fakeA = { numeroContrato: "__dk__", portalLancamentosAluguel: arrays?.[0] };
      const fakeB = { numeroContrato: "__dk__", portalLancamentosAluguel: arrays?.[1] };
      const merged = window.__DK_mergeLocacoesCadastroCliente([fakeA], [fakeB])[0];
      return Array.isArray(merged?.portalLancamentosAluguel) ? merged.portalLancamentosAluguel : [];
    }
    const out = [];
    for (const arr of arrays || []) {
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (row && typeof row === "object") out.push(row);
      }
    }
    return out;
  }

  function mergeLocacaoCadastroParSync(ex, incoming) {
    const mergedPl = mergeLancamentosAluguelLocacaoPar([
      ex?.portalLancamentosAluguel,
      incoming?.portalLancamentosAluguel,
    ]);
    const score = (l) => Number(l?.updatedAt || l?.createdAt || l?.id || 0);
    const keepIncoming = score(incoming) >= score(ex);
    const merged = keepIncoming
      ? { ...ex, ...incoming, numeroContrato: ex?.numeroContrato || incoming?.numeroContrato }
      : { ...incoming, ...ex, numeroContrato: ex?.numeroContrato || incoming?.numeroContrato };
    if (typeof window.__DK_anexarLancamentosMergeNaLocacao === "function") {
      window.__DK_anexarLancamentosMergeNaLocacao(merged, ex, incoming, mergedPl);
    } else if (mergedPl.length) {
      merged.portalLancamentosAluguel = mergedPl;
    }
    if (!isClienteAppPage() && typeof window.__DK_consolidarLancamentosAluguelLoc === "function") {
      window.__DK_consolidarLancamentosAluguelLoc(merged, { mutate: true });
    }
    return merged;
  }

  function mergePagamentosAuditoriaArrays(localArr, cloudArr) {
    if (typeof window.__DK_mergePagamentosAuditoria === "function") {
      return window.__DK_mergePagamentosAuditoria([localArr, cloudArr]);
    }
    const byId = new Map();
    for (const arr of [localArr, cloudArr]) {
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (!row || typeof row !== "object") continue;
        const id = String(row.id || [row.at, row.acao, row.protocoloLancamento, row.numeroContrato].join("|"));
        if (!id || byId.has(id)) continue;
        byId.set(id, row);
      }
    }
    return Array.from(byId.values()).sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  }

  function mergeLocacoesCadastroBeforePush(localArr, cloudArr) {
    if (typeof window.__DK_mergeLocacoesCadastroCliente === "function") {
      return window.__DK_mergeLocacoesCadastroCliente(localArr, cloudArr);
    }
    const byNc = new Map();
    const noNc = [];
    const normNc = (v) =>
      String(v ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const add = (loc) => {
      if (!loc || typeof loc !== "object") return;
      const nc = normNc(loc.numeroContrato);
      if (!nc) {
        noNc.push({ ...loc });
        return;
      }
      const prev = byNc.get(nc);
      byNc.set(
        nc,
        prev
          ? mergeLocacaoCadastroParSync(prev, loc)
          : { ...loc, numeroContrato: loc.numeroContrato || nc }
      );
    };
    (Array.isArray(localArr) ? localArr : []).forEach(add);
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(add);
    return [...byNc.values(), ...noNc];
  }

  function isCloudCadastroLockedEmpty(cloudPayload) {
    if (!cloudPayload || typeof cloudPayload !== "object") return false;
    const lockUntil = Date.parse(String(cloudPayload.dk_cadastro_lock_v1 || "")) || 0;
    if (!lockUntil || Date.now() >= lockUntil) return false;
    if (cloudPayload.dk_cadastro_manual_portal_v1 !== true) return false;
    return ["dk_clientes_cadastro", "dk_veiculos_cadastro", "dk_locacoes_cadastro"].every(
      (k) => !Array.isArray(cloudPayload[k]) || cloudPayload[k].length === 0
    );
  }

  function mergePayloadWithCloudBeforePush(localPayload, cloudPayload) {
    const out = { ...localPayload };
    if (!cloudPayload || typeof cloudPayload !== "object") return out;
    if (isCloudCadastroLockedEmpty(cloudPayload)) {
      out.dk_cadastro_manual_portal_v1 = true;
      out.dk_cadastro_lock_v1 = cloudPayload.dk_cadastro_lock_v1;
    }
    if (cloudPayload.dk_demo_cadastro_10_v1) {
      for (const k of DK_STORAGE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(cloudPayload, k)) continue;
        const v = cloudPayload[k];
        out[k] = Array.isArray(v) ? [...v] : v && typeof v === "object" ? { ...v } : v;
      }
      out.dk_demo_cadastro_10_v1 = cloudPayload.dk_demo_cadastro_10_v1;
      out.dk_cadastro_manual_portal_v1 = true;
      if (cloudPayload.dk_cadastro_lock_v1) out.dk_cadastro_lock_v1 = cloudPayload.dk_cadastro_lock_v1;
      delete out.dk_patrimonio_crlv_v1;
      delete out.dk_patrimonio_fotos_excluidas_v1;
      return out;
    }
    const oficialVirgin = cloudPayload.dk_oficial_sem_protocolos_v1 === true;
    if (Object.prototype.hasOwnProperty.call(cloudPayload, "dk_oficial_sem_protocolos_v1")) {
      out.dk_oficial_sem_protocolos_v1 = cloudPayload.dk_oficial_sem_protocolos_v1 === true;
    }
    if (oficialVirgin) {
      const localLocs = Array.isArray(localPayload.dk_locacoes_cadastro)
        ? localPayload.dk_locacoes_cadastro
        : [];
      const cloudLocs = Array.isArray(cloudPayload.dk_locacoes_cadastro)
        ? cloudPayload.dk_locacoes_cadastro
        : [];
      const filterFn =
        typeof window.__DK_filterOficialCadastroArray === "function"
          ? window.__DK_filterOficialCadastroArray
          : (_k, a) => a;
      out.dk_locacoes_cadastro = mergeLocacoesCadastroBeforePush(
        filterFn("dk_locacoes_cadastro", localLocs),
        cloudLocs
      );
      out.dk_lancamentos_aluguel = [];
      out.dk_lancamentos_aluguel_cadastro = [];
      out.dk_locacoes_quadro_geral = [];
      out.dk_oficial_sem_protocolos_v1 = true;
      out.dk_cadastro_manual_portal_v1 = true;
      const lock = cloudPayload.dk_cadastro_lock_v1 || localPayload.dk_cadastro_lock_v1;
      if (lock) out.dk_cadastro_lock_v1 = lock;
    } else if (
      Object.prototype.hasOwnProperty.call(localPayload, "dk_locacoes_cadastro") ||
      Object.prototype.hasOwnProperty.call(cloudPayload, "dk_locacoes_cadastro")
    ) {
      out.dk_locacoes_cadastro = mergeLocacoesCadastroBeforePush(
        localPayload.dk_locacoes_cadastro,
        cloudPayload.dk_locacoes_cadastro
      );
    }
    if (!cloudPayload.dk_demo_cadastro_10_v1 && typeof mergeCadastroHistoricoImutavel === "function") {
      for (const k of DK_IMMUTABLE_CADASTRO_KEYS) {
        if (k === "dk_locacoes_cadastro") continue;
        if (
          !Object.prototype.hasOwnProperty.call(localPayload, k) &&
          !Object.prototype.hasOwnProperty.call(cloudPayload, k)
        ) {
          continue;
        }
        out[k] = mergeCadastroHistoricoImutavel(k, localPayload[k], cloudPayload[k]);
      }
    }
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
    if (
      Object.prototype.hasOwnProperty.call(localPayload, "dk_comunicacao_operacao_v1") ||
      Object.prototype.hasOwnProperty.call(cloudPayload, "dk_comunicacao_operacao_v1")
    ) {
      out.dk_comunicacao_operacao_v1 = mergeComunicacaoOperacaoArrays(
        localPayload.dk_comunicacao_operacao_v1,
        cloudPayload.dk_comunicacao_operacao_v1
      );
    }
    if (Object.prototype.hasOwnProperty.call(cloudPayload, "dk_financeiro_extratos_v1")) {
      out.dk_financeiro_extratos_v1 = mergeFinanceiroExtratos(
        localPayload.dk_financeiro_extratos_v1,
        cloudPayload.dk_financeiro_extratos_v1
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(localPayload, "dk_documentos_deposito_v1") ||
      Object.prototype.hasOwnProperty.call(cloudPayload, "dk_documentos_deposito_v1")
    ) {
      const mergeFn =
        typeof window.__DK_documentosMergeDeposit === "function"
          ? window.__DK_documentosMergeDeposit
          : (_, c) => c;
      out.dk_documentos_deposito_v1 = mergeFn(
        localPayload.dk_documentos_deposito_v1,
        cloudPayload.dk_documentos_deposito_v1
      );
    }
    if (
      !oficialVirgin &&
      (Object.prototype.hasOwnProperty.call(localPayload, "dk_locacao_documentos_v1") ||
        Object.prototype.hasOwnProperty.call(cloudPayload, "dk_locacao_documentos_v1"))
    ) {
      out.dk_locacao_documentos_v1 = mergeLocacaoDocumentosV1(
        localPayload.dk_locacao_documentos_v1,
        cloudPayload.dk_locacao_documentos_v1
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(localPayload, "dk_pagamentos_auditoria_v1") ||
      Object.prototype.hasOwnProperty.call(cloudPayload, "dk_pagamentos_auditoria_v1")
    ) {
      out.dk_pagamentos_auditoria_v1 = mergePagamentosAuditoriaArrays(
        localPayload.dk_pagamentos_auditoria_v1,
        cloudPayload.dk_pagamentos_auditoria_v1
      );
    }
    delete out.dk_patrimonio_crlv_v1;
    delete out.dk_patrimonio_fotos_excluidas_v1;
    out.dk_dados_seguros_v1 = true;
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
      if (mergedPayload.dk_comunicacao_operacao_v1) {
        localStorage.setItem(
          "dk_comunicacao_operacao_v1",
          JSON.stringify(mergedPayload.dk_comunicacao_operacao_v1)
        );
      }
      if (mergedPayload.dk_pagamentos_auditoria_v1) {
        const atual = readLocalJsonArray("dk_pagamentos_auditoria_v1");
        localStorage.setItem(
          "dk_pagamentos_auditoria_v1",
          JSON.stringify(mergePagamentosAuditoriaArrays(atual, mergedPayload.dk_pagamentos_auditoria_v1))
        );
      }
      if (mergedPayload.dk_financeiro_extratos_v1) {
        localStorage.setItem(
          "dk_financeiro_extratos_v1",
          JSON.stringify(mergedPayload.dk_financeiro_extratos_v1)
        );
      }
      if (mergedPayload.dk_documentos_deposito_v1) {
        /* merge com o estado ACTUAL — ficheiros depositados durante o push não podem desaparecer */
        const mergeDepFn =
          typeof window.__DK_documentosMergeDeposit === "function"
            ? window.__DK_documentosMergeDeposit
            : (_, c) => c;
        let depAtual = null;
        try {
          depAtual = JSON.parse(localStorage.getItem("dk_documentos_deposito_v1") || "null");
        } catch {
          depAtual = null;
        }
        localStorage.setItem(
          "dk_documentos_deposito_v1",
          JSON.stringify(mergeDepFn(depAtual, mergedPayload.dk_documentos_deposito_v1))
        );
      }
      if (mergedPayload.dk_locacao_documentos_v1) {
        /* merge com o estado ACTUAL — docs importados durante o push (ex.: multas) não podem desaparecer */
        const docsAtuais = readLocalJsonArray("dk_locacao_documentos_v1");
        localStorage.setItem(
          "dk_locacao_documentos_v1",
          JSON.stringify(mergeLocacaoDocumentosV1(docsAtuais, mergedPayload.dk_locacao_documentos_v1))
        );
      }
      localStorage.removeItem("dk_patrimonio_crlv_v1");
      localStorage.removeItem("dk_patrimonio_fotos_excluidas_v1");
    } finally {
      suppressCloudHook = false;
    }
    if (typeof window.__DK_financeiroRefreshFromStorage === "function") {
      try {
        window.__DK_financeiroRefreshFromStorage();
      } catch {
        /* ignore */
      }
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

  function mergeComunicacaoOperacaoArrays(localArr, cloudArr) {
    if (typeof window.__DK_comunicacaoOperacaoMerge === "function") {
      return window.__DK_comunicacaoOperacaoMerge(localArr, cloudArr);
    }
    const byId = new Map();
    const push = (m) => {
      if (!m || typeof m !== "object" || !m.id) return;
      byId.set(m.id, m);
    };
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(push);
    (Array.isArray(localArr) ? localArr : []).forEach(push);
    return Array.from(byId.values());
  }

  async function pushComunicacaoSupabaseBackground(arr, updatedAt) {
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client || !window.__DK_SUPABASE_CONFIGURED__) return false;
    try {
      const [supaRow, redisRow] = await Promise.all([
        withCloudTimeout(fetchSupabaseSnapshotPayload(), 7000, "supabase_timeout").catch(() => null),
        fetchRedundantSnapshotPayload(),
      ]);
      const cloudPayload = mergeRemoteSnapshotsBeforePush(supaRow, redisRow) || {};
      const merged = mergeComunicacaoOperacaoArrays(arr, cloudPayload.dk_comunicacao_operacao_v1);
      const fullPayload = { ...cloudPayload, dk_comunicacao_operacao_v1: merged };
      const { error } = await withCloudTimeout(
        client.from("dk_cloud_snapshots").upsert(
          { label: dkSnapshotLabel(), payload: fullPayload, updated_at: updatedAt },
          { onConflict: "label" }
        ),
        8000,
        "supabase_upsert_timeout"
      );
      return !error;
    } catch (e) {
      console.warn("[DK comunicacao] push Supabase", e);
      return false;
    }
  }

  /** Push leve: uma ou todas as mensagens cliente↔operação. */
  async function pushComunicacaoMensagemNow(recOrArr) {
    const arr = Array.isArray(recOrArr) ? recOrArr.filter(Boolean) : recOrArr ? [recOrArr] : [];
    if (!arr.length) return pushComunicacaoSnapshotNow();
    const patch = { dk_comunicacao_operacao_v1: arr };
    const updatedAt = new Date().toISOString();
    let redisOk = false;
    let lastErr = null;
    for (let attempt = 0; attempt < 3 && !redisOk; attempt += 1) {
      const red = await pushRedundantSnapshotPayload(patch, updatedAt);
      redisOk = red.ok;
      lastErr = red.error || null;
      if (!redisOk && attempt < 2) {
        await new Promise((r) => window.setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (redisOk) {
      noteCloudPushTimestamp(updatedAt);
      void pushComunicacaoSupabaseBackground(arr, updatedAt);
      return { ok: true, supaOk: false, redisOk: true, count: arr.length, error: null };
    }
    const supaOk = await pushComunicacaoSupabaseBackground(arr, updatedAt);
    if (supaOk) noteCloudPushTimestamp(updatedAt);
    else console.warn("[DK comunicacao] push mensagem falhou", lastErr);
    return { ok: supaOk, supaOk, redisOk: false, count: arr.length, error: lastErr };
  }

  /** Push leve: só mensagens cliente↔operação (app cliente não envia snapshot gigante). */
  async function pushComunicacaoSnapshotNow() {
    const localArr = readLocalJsonArray("dk_comunicacao_operacao_v1");
    if (!localArr.length) return { ok: true, skipped: true, reason: "empty_local" };
    const patch = { dk_comunicacao_operacao_v1: localArr };
    const updatedAt = new Date().toISOString();
    let redisOk = false;
    for (let attempt = 0; attempt < 3 && !redisOk; attempt += 1) {
      const red = await pushRedundantSnapshotPayload(patch, updatedAt);
      redisOk = red.ok;
      if (!redisOk && attempt < 2) {
        await new Promise((r) => window.setTimeout(r, 350 * (attempt + 1)));
      }
    }
    if (redisOk) {
      noteCloudPushTimestamp(updatedAt);
      void pushComunicacaoSupabaseBackground(localArr, updatedAt);
      return { ok: true, supaOk: false, redisOk: true, count: localArr.length };
    }
    const supaOk = await pushComunicacaoSupabaseBackground(localArr, updatedAt);
    if (supaOk) noteCloudPushTimestamp(updatedAt);
    else console.warn("[DK comunicacao] push falhou — mensagem só neste telemóvel");
    return { ok: supaOk, supaOk, redisOk: false, count: localArr.length };
  }

  function comunicacaoStorageFingerprint(arr) {
    if (!Array.isArray(arr) || !arr.length) return "0";
    let maxTs = 0;
    let maxId = "";
    let unreadCliente = 0;
    for (const m of arr) {
      if (!m || typeof m !== "object") continue;
      const ts = Date.parse(m.criadoEm || "") || 0;
      if (ts >= maxTs) {
        maxTs = ts;
        maxId = String(m.id || "");
      }
      if (m.autor === "cliente" && !m.lidaOperacaoEm) unreadCliente += 1;
    }
    return `${arr.length}|${maxTs}|${maxId}|u${unreadCliente}`;
  }

  /** Portal com autoridade local: ainda assim traz mensagens novas da nuvem. */
  const COM_PULL_MIN_INTERVAL_MS = 20_000;
  let comPullLastAt = 0;

  async function pullComunicacaoOperacaoFromCloudMerge(opts) {
    const force = Boolean(opts && opts.force);
    const now = Date.now();
    if (!force && now - comPullLastAt < COM_PULL_MIN_INTERVAL_MS) {
      return { ok: true, skipped: true, reason: "throttled" };
    }
    comPullLastAt = now;
    let cloudArr = [];
    const redisRow = await fetchRedundantSnapshotPayload();
    if (Array.isArray(redisRow?.payload?.dk_comunicacao_operacao_v1)) {
      cloudArr = redisRow.payload.dk_comunicacao_operacao_v1;
    }
    const localArr = readLocalJsonArray("dk_comunicacao_operacao_v1");
    let mergedFromRedis = mergeComunicacaoOperacaoArrays(localArr, cloudArr);
    const fpLocal = comunicacaoStorageFingerprint(localArr);
    const fpRedisMerged = comunicacaoStorageFingerprint(mergedFromRedis);
    const redisTs = Date.parse(String(redisRow?.updated_at || "")) || 0;
    let lastPush = 0;
    try {
      lastPush = Date.parse(localStorage.getItem(DK_CLOUD_LAST_PUSH_AT_KEY) || "") || 0;
    } catch {
      lastPush = 0;
    }
    const redisFreshEnough = !redisTs || redisTs <= lastPush + 500;
    if (
      !force &&
      fpLocal === fpRedisMerged &&
      localArr.length === mergedFromRedis.length &&
      cloudArr.length > 0 &&
      redisFreshEnough
    ) {
      return { ok: true, unchanged: true, count: mergedFromRedis.length, source: "redis" };
    }
    try {
      const data = await withCloudTimeout(fetchCloudSnapshotPayload(), 8000, "cloud_snapshot_timeout");
      const mergedCloud = data?.payload?.dk_comunicacao_operacao_v1;
      if (Array.isArray(mergedCloud) && mergedCloud.length) {
        cloudArr = mergeComunicacaoOperacaoArrays(cloudArr, mergedCloud);
      }
    } catch (e) {
      console.warn("[DK comunicacao] pull cloud timeout — usando Redis", e?.message || e);
    }
    if (!Array.isArray(cloudArr) || !cloudArr.length) {
      return { ok: true, skipped: true, reason: "no_cloud_comunicacao" };
    }
    const merged = mergeComunicacaoOperacaoArrays(localArr, cloudArr);
    const fpMerged = comunicacaoStorageFingerprint(merged);
    if (fpLocal === fpMerged && localArr.length === merged.length) {
      return { ok: true, unchanged: true, count: merged.length };
    }
    suppressCloudHook = true;
    try {
      localStorage.setItem("dk_comunicacao_operacao_v1", JSON.stringify(merged));
    } finally {
      suppressCloudHook = false;
    }
    try {
      window.dispatchEvent(new CustomEvent("dk-comunicacao-operacao-changed"));
    } catch {
      /* ignore */
    }
    return { ok: true, applied: true, count: merged.length };
  }

  async function pullAppendOnlyKeysFromCloud() {
    const com = await pullComunicacaoOperacaoFromCloudMerge();
    return com;
  }

  function preserveCloudCadastrosWhenLocalEmpty(localPayload, cloudPayload) {
    if (!cloudPayload || typeof cloudPayload !== "object") return localPayload;
    if (window.__DK_IS_DEMO_DEPLOY__ !== true) return localPayload;
    const out = { ...localPayload };
    for (const k of DK_IMMUTABLE_CADASTRO_KEYS) {
      const localArr = Array.isArray(out[k]) ? out[k] : [];
      const cloudArr = Array.isArray(cloudPayload[k]) ? cloudPayload[k] : [];
      if (localArr.length === 0 && cloudArr.length > 0) out[k] = cloudArr;
    }
    return out;
  }

  /** Demo: arrays vazios no local não entram no POST (evita merge na API apagar a nuvem). */
  function omitEmptyDemoCadastroKeysForPush(payload) {
    if (window.__DK_IS_DEMO_DEPLOY__ !== true || !payload || typeof payload !== "object") return payload;
    const out = { ...payload };
    for (const k of DK_IMMUTABLE_CADASTRO_KEYS) {
      if (Array.isArray(out[k]) && out[k].length === 0) delete out[k];
    }
    return out;
  }

  function parseDepositForPush(raw) {
    if (!raw) return { crlv: [], contrato: [], multa: [] };
    if (typeof raw === "string") {
      try {
        const p = JSON.parse(raw);
        return p && typeof p === "object" ? p : { crlv: [], contrato: [], multa: [] };
      } catch {
        return { crlv: [], contrato: [], multa: [] };
      }
    }
    return raw && typeof raw === "object" ? raw : { crlv: [], contrato: [], multa: [] };
  }

  function depositoStatsForPush(dep) {
    const p = parseDepositForPush(dep);
    let total = 0;
    let visible = 0;
    let tombstones = 0;
    for (const cat of ["crlv", "contrato", "multa"]) {
      for (const e of p[cat] || []) {
        if (!e?.id) continue;
        total += 1;
        if (e.excluido === true) tombstones += 1;
        else visible += 1;
      }
    }
    return { total, visible, tombstones };
  }

  /** Fase 3: push nunca apaga tombstones nem encolhe o catálogo da nuvem. */
  function applyDepositPushGuard(payload, cloudPayload) {
    if (!payload || typeof payload !== "object") return payload;
    const out = { ...payload };
    const mergeFn =
      typeof window.__DK_documentosMergeDeposit === "function"
        ? window.__DK_documentosMergeDeposit
        : null;
    const cloudDep = cloudPayload?.dk_documentos_deposito_v1;
    const localDep = out.dk_documentos_deposito_v1;
    if (!cloudDep && !localDep) return out;
    if (mergeFn) {
      out.dk_documentos_deposito_v1 = mergeFn(localDep, cloudDep);
      return out;
    }
    const lc = depositoStatsForPush(localDep);
    const cc = depositoStatsForPush(cloudDep);
    if (cc.total > lc.total || cc.tombstones > lc.tombstones) {
      out.dk_documentos_deposito_v1 = cloudDep;
    }
    return out;
  }

  /** Local sem depósito não envia chave vazia que substituiria a nuvem. */
  function omitEmptyDepositForPush(payload, cloudPayload) {
    if (!payload || typeof payload !== "object" || !cloudPayload?.dk_documentos_deposito_v1) {
      return payload;
    }
    const lc = depositoStatsForPush(payload.dk_documentos_deposito_v1);
    const cc = depositoStatsForPush(cloudPayload.dk_documentos_deposito_v1);
    const out = { ...payload };
    if (lc.total === 0 && cc.total > 0) {
      delete out.dk_documentos_deposito_v1;
    }
    return out;
  }

  function scheduleDepositoSyncAfterCloudPull(reason) {
    if (isClienteAppPage()) return;
    if (typeof window.__DK_documentosSyncBidireccional !== "function") return;
    void window.__DK_documentosSyncBidireccional().then((r) => {
      if (!r || r.skipped) return;
      if (r.baixados > 0 || r.enviados > 0) {
        try {
          window.dispatchEvent(new CustomEvent("dk-documentos-synced", { detail: { reason, ...r } }));
        } catch {
          /* ignore */
        }
      }
      const el = document.getElementById("documentosSyncStatus");
      if (el && typeof window.__DK_documentosSyncStatusResumo === "function") {
        el.textContent = window.__DK_documentosSyncStatusResumo(r);
      }
    });
  }

  async function upsertSnapshotRow(showUserMessages, opts) {
    const forceReplace = Boolean(opts && opts.replace);
    const fullReplaceComprovantes = Boolean(opts && opts.fullReplaceComprovantes);
    let payload = collectPayloadFromLocalStorage();
    if (
      typeof window.__DK_isCadastroManualPortalMode === "function" &&
      window.__DK_isCadastroManualPortalMode()
    ) {
      payload.dk_cadastro_manual_portal_v1 = true;
    }
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
    const cloudPayloadMerged = mergeRemoteSnapshotsBeforePush(supaRow, redisRow);
    const cloudMeta = cloudPayloadMerged
      ? {
          payload: cloudPayloadMerged,
          updated_at: pickNewestCloudRow([supaRow, redisRow])?.updated_at || null,
        }
      : pickNewestCloudPayloadWithMeta(supaRow, redisRow);
    const localComprovantesBeforeMerge = Array.isArray(payload.dk_comprovantes_cliente_pendentes)
      ? payload.dk_comprovantes_cliente_pendentes
      : readLocalJsonArray("dk_comprovantes_cliente_pendentes");
    if (cloudMeta?.payload && !forceReplace) {
      const localComprovantes = localComprovantesBeforeMerge;
      if (fullReplaceComprovantes || isLocalDataAuthorityActive()) {
        payload = mergePayloadWithCloudBeforePush(payload, cloudMeta.payload);
        payload.dk_comprovantes_cliente_pendentes = localComprovantes;
      } else if (cloudSnapshotIsNewerThanLastPush(cloudMeta.updated_at)) {
        payload = applyCloudComprovantesIfNewer(payload, cloudMeta);
      } else {
        payload = mergePayloadWithCloudBeforePush(payload, cloudMeta.payload);
      }
      if (!isLocalDataAuthorityActive() && !fullReplaceComprovantes) {
        persistMergedPayloadToLocal(payload);
      }
    }
    payload = preserveCloudCadastrosWhenLocalEmpty(payload, cloudMeta?.payload || cloudPayloadMerged);
    payload = applyDepositPushGuard(payload, cloudMeta?.payload || cloudPayloadMerged);
    payload = omitEmptyDepositForPush(payload, cloudMeta?.payload || cloudPayloadMerged);
    payload =
      window.__DK_IS_DEMO_DEPLOY__ === true
        ? hydrateLocacoesCadastroPagamentosParaNuvem(payload)
        : typeof window.__DK_sanitizeCloudPayloadLancamentosOficial === "function"
          ? window.__DK_sanitizeCloudPayloadLancamentosOficial(payload)
          : payload;
    payload = omitEmptyDemoCadastroKeysForPush(payload);
    if (payload.dk_patrimonio_crlv_v1) {
      payload.dk_patrimonio_crlv_v1 = normalizePatrimonioPayloadForSync(
        payload.dk_patrimonio_crlv_v1,
        payload.dk_patrimonio_fotos_excluidas_v1
      );
      payload.dk_patrimonio_fotos_excluidas_v1 =
        payload.dk_patrimonio_crlv_v1.fotosCapturasExcluidas || [];
    }
    const updatedAt = new Date().toISOString();
    let supaOk = false;
    let redisOk = false;
    let supaErr = "";
    let redisErr = "";

    const client = window.__DK_SUPABASE_CLIENT__;
    if (client && window.__DK_SUPABASE_CONFIGURED__) {
      const row = {
        label: dkSnapshotLabel(),
        payload: shrinkPayloadForSupabaseStorage(payload),
        updated_at: updatedAt,
      };
      try {
        const { error } = await withCloudTimeout(
          client.from("dk_cloud_snapshots").upsert(row, { onConflict: "label" }),
          45000,
          "supabase_upsert_timeout"
        );
        if (error) {
          supaErr = error.message || String(error);
          if (error.code) supaErr = `${error.code}: ${supaErr}`;
          console.error("[DK cloud] Supabase push", error);
        } else {
          supaOk = true;
        }
      } catch (e) {
        supaErr = String(e?.message || e);
        console.warn("[DK cloud] Supabase push timeout", e);
      }
    } else {
      supaErr = "Supabase não configurado";
    }

    const red = await pushRedundantSnapshotPayload(payload, updatedAt, {
      replace: forceReplace,
      fullReplaceComprovantes,
    });
    redisOk = red.ok;
    if (!redisOk) redisErr = String(red.error || "Redis indisponível");

    updateSupabaseStatusBanner(supaOk, supaErr);

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
    if (!r.ok) return r;
    if (r.supaOk && r.redisOk) {
      setMsg("Nuvem actualizada (Supabase + Redis).", "ok");
      return r;
    }
    if (r.redisOk && !r.supaOk) {
      if (!cloudSupabaseState.quietFailLogged) {
        cloudSupabaseState.quietFailLogged = true;
        const info = describeSupabasePushError(cloudSupabaseState.reason || cloudSupabaseState.code);
        console.warn("[DK cloud] Supabase em falha; Redis OK.", cloudSupabaseState.reason || info.userMessage);
      }
      return r;
    }
    if (r.supaOk && !r.redisOk) {
      setMsg("Nuvem actualizada (Supabase; cópia Redis indisponível).", "muted");
    }
    return r;
  }

  /** Cancela o debounce do hook e envia o snapshot já (útil após ações explícitas «Guardar»). */
  async function pushCloudSnapshotNow(opts) {
    if (window.__DK_IS_DEMO_DEPLOY__ === true && !(opts && opts.force)) {
      if (typeof loadCadastro === "function") {
        const c = (loadCadastro("dk_clientes_cadastro") || []).length;
        const v = (loadCadastro("dk_veiculos_cadastro") || []).length;
        if (c === 0 && v === 0) {
          return { ok: true, skipped: true, reason: "demo_empty_clientes_veiculos_no_push" };
        }
      }
    }
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
  function trimLocalLocacoesToClienteCpf() {
    const cpf = clienteAppSessaoCpf();
    if (!cpf || !isClienteAppPage()) return false;
    const arr = readLocalJsonArray("dk_locacoes_cadastro");
    if (!arr.length) return false;
    const proto = clienteAppSessaoProto();
    const kept = arr.filter((l) => {
      const c = String(l?.cpf || "")
        .replace(/\D/g, "")
        .slice(0, 11);
      if (c === cpf) return true;
      const nc = String(l?.numeroContrato || l?.protocolo || "").replace(/\D/g, "");
      if (proto && nc === proto) return true;
      return false;
    });
    if (kept.length === arr.length) return false;
    localStorage.setItem("dk_locacoes_cadastro", JSON.stringify(kept));
    return true;
  }

  /**
   * App cliente: pull leve — só locação/comunicação/notificações do CPF logado (evita travar com frota demo).
   */
  async function pullClienteCloudSnapshotLight(opts) {
    const force = Boolean(opts && opts.force);
    const cpf = clienteAppSessaoCpf();
    if (!cpf) return { ok: true, skipped: true, reason: "no_sessao" };
    trimLocalLocacoesToClienteCpf();
    const data = await fetchCloudSnapshotPayload();
    if (!data?.payload) return { ok: false, skipped: true, reason: "no_cloud_snapshot" };
    const filtered = filterCloudPayloadForClienteApp(data.payload, cpf);
    const mini = {};
    for (const k of CLIENTE_CLOUD_PULL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(filtered, k)) mini[k] = filtered[k];
    }
    if (!Object.keys(mini).length) return { ok: true, skipped: true, reason: "empty_filtered" };
    suppressCloudHook = true;
    try {
      applyPayloadToLocalStorage(mini, { replace: false, lightSanitize: true });
      sanitizeLocacaoDocumentosLocalStorage();
      trimLocalLocacoesToClienteCpf();
    } finally {
      suppressCloudHook = false;
    }
    try {
      window.dispatchEvent(new CustomEvent("dk-comunicacao-operacao-changed"));
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("dk-locacoes-synced"));
    } catch {
      /* ignore */
    }
    return { ok: true, applied: true, source: data.source || "cloud" };
  }

  function syncConsultaKeysFromCloudPayload(cloudPayload) {
    if (!cloudPayload || typeof cloudPayload !== "object") return false;
    let changed = false;
    for (const k of DK_CONSULTA_SYNC_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(cloudPayload, k)) continue;
      const next = Array.isArray(cloudPayload[k]) ? cloudPayload[k] : [];
      const cur = readLocalJsonArray(k);
      if (JSON.stringify(cur) !== JSON.stringify(next)) {
        if (typeof saveCadastro === "function") {
          saveCadastro(k, next, { bypassImmutabilidadeCadastro: true });
        } else {
          localStorage.setItem(k, JSON.stringify(next));
        }
        changed = true;
      }
    }
    return changed;
  }

  async function pullConsultaKeysFromCloud() {
    const data = await fetchCloudSnapshotPayload();
    if (!data?.payload) return { ok: false, skipped: true, reason: "no_cloud_snapshot" };
    const changed = syncConsultaKeysFromCloudPayload(data.payload);
    return { ok: true, changed, source: data.source || "cloud" };
  }

  async function pullCloudSnapshotSilentMerge(opts) {
    const force = Boolean(opts && opts.force);
    const clientePage = isClienteAppPage();
    if (clientePage) {
      return pullClienteCloudSnapshotLight(opts);
    }
    const consultaSync = await pullConsultaKeysFromCloud();
    if (isLocalDataAuthorityActive() && !clientePage) {
      const com = await pullAppendOnlyKeysFromCloud();
      return { ...com, consultaSync };
    }
    const data = await fetchCloudSnapshotPayload();
    if (!data || !data.payload || !isMeaningfulCloudPayload(data.payload)) {
      return { ok: false, skipped: true, reason: "no_cloud_snapshot" };
    }
    let mergeNeeded = cloudPullWouldChangeAnything(data.payload);
    if (!force && !isCloudSnapshotNewerThanLocal(data.updated_at) && !mergeNeeded) {
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
    try {
      window.dispatchEvent(new CustomEvent("dk-comunicacao-operacao-changed"));
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("dk-documentos-synced"));
    } catch {
      /* ignore */
    }
    if (!clientePage) {
      scheduleDepositoSyncAfterCloudPull("pull");
    }
    if (clientePage) {
      try {
        window.dispatchEvent(new CustomEvent("dk-locacoes-synced"));
      } catch {
        /* ignore */
      }
    }
    if (
      !clientePage &&
      typeof window.__DK_comprovantesClienteRepararHistorico === "function"
    ) {
      void Promise.resolve(window.__DK_comprovantesClienteRepararHistorico());
    }
    if (
      !clientePage &&
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
    if (isLocalDataAuthorityActive() && !isClienteAppPage()) {
      return pullComunicacaoOperacaoFromCloudMerge();
    }
    const forceDemoBootstrap = demoNeedsCloudCadastroBootstrap();
    const now = Date.now();
    if (!forceDemoBootstrap && now - backgroundPullLastAt < BACKGROUND_PULL_MIN_INTERVAL_MS) {
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
    return window.__DK_pushCloudSnapshotNow({ force: true }).catch((e) => {
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

  async function upsertClienteCadastroFromCloud(cpf, proto) {
    const dig = String(cpf || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    if (dig.length !== 11) return { ok: false, reason: "cpf" };
    const data = await fetchCloudSnapshotPayload();
    const list = Array.isArray(data?.payload?.dk_clientes_cadastro) ? data.payload.dk_clientes_cadastro : [];
    const row = list.find((c) => String(c?.cpf || "").replace(/\D/g, "").slice(0, 11) === dig);
    if (!row || typeof row !== "object") return { ok: false, reason: "not_found" };
    let local = [];
    try {
      const raw = localStorage.getItem("dk_clientes_cadastro");
      local = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(local)) local = [];
    } catch {
      local = [];
    }
    const idx = local.findIndex((c) => String(c?.cpf || "").replace(/\D/g, "").slice(0, 11) === dig);
    const next = { ...(idx >= 0 ? local[idx] : {}), ...row };
    if (idx >= 0) local[idx] = next;
    else local.push(next);
    if (typeof saveCadastro === "function") {
      saveCadastro("dk_clientes_cadastro", local);
    } else {
      localStorage.setItem("dk_clientes_cadastro", JSON.stringify(local));
    }
    const locs = filterCloudLocacoesForCliente(
      dig,
      data?.payload?.dk_locacoes_cadastro,
      proto || clienteAppSessaoProto()
    );
    const localLocs = readLocalJsonArray("dk_locacoes_cadastro");
    const mergedLocs = mergeLocacoesCadastroBeforePush(localLocs, locs);
    if (mergedLocs.length) {
      if (typeof saveCadastro === "function") {
        saveCadastro("dk_locacoes_cadastro", mergedLocs);
      } else {
        localStorage.setItem("dk_locacoes_cadastro", JSON.stringify(mergedLocs));
      }
    }
    return { ok: true, locacoes: mergedLocs.length };
  }

  try {
    window.__DK_pullCloudSnapshotSilentMerge = pullCloudSnapshotSilentMerge;
    window.__DK_pullClienteCloudSnapshotLight = pullClienteCloudSnapshotLight;
    window.__DK_ensurePortalCadastrosFromCloud = ensurePortalCadastrosFromCloud;
    window.__DK_trimClienteLocacoesLocal = trimLocalLocacoesToClienteCpf;
    window.__DK_pullFromCloudOnScreenChange = pullFromCloudOnScreenChange;
    window.__DK_scheduleBackgroundCloudPull = scheduleBackgroundCloudPullIfStale;
    window.__DK_pushToCloudAfterSave = pushToCloudAfterSave;
    window.__DK_pullComunicacaoOperacaoFromCloudMerge = pullComunicacaoOperacaoFromCloudMerge;
    window.__DK_pushComunicacaoSnapshotNow = pushComunicacaoSnapshotNow;
    window.__DK_pushComunicacaoMensagemNow = pushComunicacaoMensagemNow;
    window.__DK_markLocalDataAuthority = markLocalDataAuthority;
    window.__DK_isLocalDataAuthorityActive = isLocalDataAuthorityActive;
    window.__DK_normalizeLocacoesContratoAtivoStore = normalizeLocacoesContratoAtivoStore;
    window.__DK_fetchCloudSnapshotPayload = fetchCloudSnapshotPayload;
    window.__DK_upsertClienteCadastroFromCloud = upsertClienteCadastroFromCloud;
    window.__DK_fetchRedundantSnapshotPayload = fetchRedundantSnapshotPayload;
    window.__DK_pushLocacaoDocumentoNuvem = pushLocacaoDocumentoNuvem;
    window.__DK_docsLocacaoMerge = mergeLocacaoDocumentosV1;
    window.__DK_bootstrapDemoCadastrosFromCloud = bootstrapDemoCadastrosFromCloudIfEmpty;
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

  function resolveBackupLatestApiUrl(full) {
    const origin = String(window.location.origin || "").replace(/\/$/, "");
    const base = origin && origin !== "null" ? origin : "";
    const params = new URLSearchParams();
    if (dkSnapshotLabel() === "demo") params.set("channel", "demo");
    if (full) params.set("full", "1");
    const qs = params.toString();
    return `${base}/api/dk-backup-latest${qs ? `?${qs}` : ""}`;
  }

  function formatBackupBrDateTime(isoOrBr) {
    if (!isoOrBr) return "—";
    const s = String(isoOrBr);
    /* ISO (UTC) → hora do Brasil; sem isto o painel mostrava hora "no futuro" */
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        try {
          return new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
            .format(d)
            .replace(",", "");
        } catch {
          /* fallback abaixo */
        }
      }
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
    }
    return s.slice(0, 16).replace("T", " ");
  }

  function summarizeBackupCounts(counts) {
    if (!counts || typeof counts !== "object") return "";
    const loc = counts.dk_locacoes_cadastro ?? counts.dk_portal_locacoes_cadastro;
    const cli = counts.dk_clientes_cadastro ?? counts.dk_portal_clientes_cadastro;
    const vei = counts.dk_veiculos_cadastro ?? counts.dk_portal_veiculos_cadastro;
    const parts = [];
    if (loc != null) parts.push(`${loc} locações`);
    if (cli != null) parts.push(`${cli} clientes`);
    if (vei != null) parts.push(`${vei} veículos`);
    return parts.length ? parts.join(" · ") : Object.keys(counts).length ? "dados na nuvem" : "";
  }

  let lastBackupMetaCache = null;

  async function refreshLastBackupPanel() {
    const panel = document.getElementById("dk-backup-last-info");
    const textEl = document.getElementById("dk-backup-last-info-text");
    if (!panel || !textEl) return;
    textEl.textContent = "A carregar…";
    panel.classList.remove("dk-backup-last-info--ok", "dk-backup-last-info--empty");
    try {
      const res = await fetch(resolveBackupLatestApiUrl(false), {
        method: "GET",
        headers: dkCloudFetchHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.hasBackup || !data.meta) {
        lastBackupMetaCache = null;
        panel.classList.add("dk-backup-last-info--empty");
        textEl.textContent =
          "Ainda não há backup guardado neste ambiente. Use «Gerar backup» ou aguarde o envio diário (02:00).";
        return;
      }
      lastBackupMetaCache = data.meta;
      const when = formatBackupBrDateTime(data.meta.emailSentAt || data.meta.exportedAtBr);
      const counts = summarizeBackupCounts(data.meta.counts);
      const envLabel = dkSnapshotLabel() === "demo" ? "Demo" : "Oficial";
      const to = data.meta.emailTo
        ? Array.isArray(data.meta.emailTo)
          ? data.meta.emailTo.join(", ")
          : String(data.meta.emailTo)
        : "marciogarn@gmail.com";
      panel.classList.add("dk-backup-last-info--ok");
      textEl.innerHTML = `<strong>${when}</strong> (${envLabel})<br>Enviado para ${to}${counts ? `<br>${counts}` : ""}`;
    } catch (e) {
      console.warn("[DK backup] último backup", e);
      lastBackupMetaCache = null;
      panel.classList.add("dk-backup-last-info--empty");
      textEl.textContent = "Não foi possível carregar o último backup.";
    }
  }

  function openBackupImportChoiceModal() {
    const modal = document.getElementById("portalBackupImportChoiceModal");
    if (!modal) {
      promptImportBackupFile();
      return;
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeBackupImportChoiceModal() {
    const modal = document.getElementById("portalBackupImportChoiceModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function promptImportBackupChoice() {
    if (lastBackupMetaCache) {
      openBackupImportChoiceModal();
      return;
    }
    refreshLastBackupPanel().then(() => {
      if (lastBackupMetaCache) openBackupImportChoiceModal();
      else promptImportBackupFile();
    });
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
    closeBackupImportChoiceModal();
    const input = document.getElementById("dk-backup-import-input");
    if (!input) {
      setMsg("Importação não disponível (input em falta).", null);
      return;
    }
    input.value = "";
    input.click();
  }

  async function applyImportedBackupParsed(parsed) {
    let payload = normalizeBackupFileToCloudPayload(parsed);
    if (!payload) {
      setMsg(
        "Ficheiro inválido. Use o JSON anexo do e-mail «DK Backup» (ou exportado por «Gerar backup»).",
        null
      );
      return false;
    }
    if (typeof window.__DK_sanitizeOficialCloudPayload === "function") {
      const before = countCadastroRecordsInPayload(payload);
      payload = window.__DK_sanitizeOficialCloudPayload(payload);
      const after = countCadastroRecordsInPayload(payload);
      if (
        window.__DK_isOficialCadastroGuardActive &&
        window.__DK_isOficialCadastroGuardActive() &&
        before > 0 &&
        after === 0
      ) {
        setMsg(
          "No site oficial só entram cadastros com data de hoje. Este backup tem apenas registos antigos.",
          null
        );
        return false;
      }
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
      return true;
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
    return true;
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
      await applyImportedBackupParsed(parsed);
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

  async function importLastStoredBackup() {
    closeBackupImportChoiceModal();
    const secret = readBackupSendSecret();
    if (!secret) {
      setMsg(
        "Importação do último backup não configurada: defina DK_BACKUP_SEND_SECRET na Vercel e faça redeploy.",
        null
      );
      return;
    }
    if (
      !window.confirm(
        "Isto substitui os dados deste navegador pelo último backup guardado no servidor. Continuar?"
      )
    ) {
      return;
    }
    const btn = document.getElementById("btn-dk-backup-import");
    const ultimoBtn = document.getElementById("portalBackupImportUltimoBtn");
    if (btn) btn.disabled = true;
    if (ultimoBtn) ultimoBtn.disabled = true;
    setMsg("A importar último backup…", "muted");
    try {
      const res = await fetch(resolveBackupLatestApiUrl(true), {
        method: "GET",
        headers: {
          ...dkCloudFetchHeaders(),
          "x-dk-backup-secret": secret,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.payload) {
        const detail = data.reason || data.error || res.statusText || "erro";
        setMsg(`Não foi possível obter o último backup: ${detail}`, null);
        return;
      }
      await applyImportedBackupParsed(data.payload);
    } catch (e) {
      console.error(e);
      setMsg(`Erro ao importar último backup: ${String(e?.message || e)}`, null);
    } finally {
      if (btn) btn.disabled = false;
      if (ultimoBtn) ultimoBtn.disabled = false;
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
          ...dkCloudFetchHeaders(),
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
      refreshLastBackupPanel().catch((e) => console.warn("[DK backup] refresh panel", e));
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
    if (isClienteAppPage() && clienteAppSessaoCpf()) {
      return pullClienteCloudSnapshotLight().catch((e) => {
        console.warn("[DK cloud] cliente pull leve", e);
        return { ok: false, error: e };
      });
    }
    window.setTimeout(() => {
      pullConsultaKeysFromCloud().catch((e) => {
        console.warn("[DK cloud] consulta sync arranque", e);
      });
    }, 800);
    if (isLocalDataAuthorityActive()) return;
    if (window.__DK_IS_DEMO_DEPLOY__ === true) {
      return bootstrapDemoCadastrosFromCloudIfEmpty()
        .catch((e) => {
          console.warn("[DK cloud] demo bootstrap", e);
          return { ok: false, error: e };
        })
        .then(() => {
          window.setTimeout(() => {
            pullCloudSnapshotSilentMerge({ force: true })
              .then((r) => {
                if (r && r.applied && typeof window.__DK_portalRefreshOperacaoLocal === "function") {
                  window.__DK_portalRefreshOperacaoLocal();
                }
              })
              .catch((e) => console.warn("[DK cloud] demo startup pull", e));
          }, 2000);
        });
    }
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client) return;
    try {
      sessionStorage.removeItem(DK_CLOUD_RELOAD_GUARD_KEY);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      scheduleBackgroundCloudPullIfStale()
        .then((r) => {
          if (r && r.applied) {
            try {
              window.__DK_hydrateFuncionariosAccess?.();
            } catch {
              /* ignore */
            }
            scheduleDepositoSyncAfterCloudPull("startup");
          }
          if (typeof window.__DK_portalRefreshOperacaoLocal === "function") {
            window.__DK_portalRefreshOperacaoLocal();
          }
        })
        .catch((e) => console.warn("[DK cloud] arranque pull", e));
    }, 1500);
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
      promptImportBackupChoice();
    });
    document.getElementById("portalBackupImportUltimoBtn")?.addEventListener("click", () => {
      importLastStoredBackup().catch((e) => {
        console.error(e);
        setMsg(String(e?.message || e));
      });
    });
    document.getElementById("portalBackupImportFileBtn")?.addEventListener("click", () => {
      promptImportBackupFile();
    });
    document.getElementById("portalBackupImportCancelBtn")?.addEventListener("click", () => {
      closeBackupImportChoiceModal();
    });
    document
      .querySelectorAll("[data-close-backup-import-choice]")
      .forEach((el) => el.addEventListener("click", closeBackupImportChoiceModal));
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
