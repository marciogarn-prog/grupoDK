/**
 * Oficial: impede carregar cadastros com data anterior a hoje (nuvem, backup, merge local).
 * Demo: sem bloqueio.
 */
(function dkOficialCadastroGuard() {
  const CADASTRO_GUARD_KEYS = [
    "dk_clientes_cadastro",
    "dk_portal_clientes_cadastro",
    "dk_veiculos_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
    "dk_locacoes_cadastro",
    "dk_lancamentos_aluguel",
    "dk_lancamentos_aluguel_cadastro",
  ];

  function isOficialOnly() {
    return window.__DK_IS_DEMO_DEPLOY__ !== true;
  }

  function todayCutoffYmd() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  }

  function parseAnyDateToYmd(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
      }
      return null;
    }
    const s = String(value).trim();
    if (!s) return null;
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const ms = Date.parse(s);
    if (Number.isFinite(ms)) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));
    }
    return null;
  }

  function cadastroKeyFamily(key) {
    if (String(key).includes("cliente")) return "cliente";
    if (String(key).includes("veiculo") || String(key).includes("frota")) return "veiculo";
    if (String(key).includes("locacoes")) return "locacao";
    if (String(key).includes("lancamento")) return "lancamento";
    return "generic";
  }

  const DATE_FIELDS = {
    cliente: ["dataCadastro", "createdAt", "updatedAt"],
    veiculo: ["dataCadastro", "createdAt", "updatedAt"],
    locacao: ["dataCadastro", "createdAt", "updatedAt", "inicio", "dataInicio"],
    lancamento: ["dataCadastro", "data", "dataPagamento", "dataLancamento", "createdAt"],
    generic: ["dataCadastro", "createdAt"],
  };

  function extractRecordYmd(record, key) {
    if (!record || typeof record !== "object") return null;
    const family = cadastroKeyFamily(key);
    const fields = DATE_FIELDS[family] || DATE_FIELDS.generic;
    for (const f of fields) {
      const ymd = parseAnyDateToYmd(record[f]);
      if (ymd) return ymd;
    }
    return null;
  }

  function isRecordAllowed(record, key, cutoffYmd) {
    if (!isOficialOnly()) return true;
    const ymd = extractRecordYmd(record, key);
    if (!ymd) return false;
    return ymd >= (cutoffYmd || todayCutoffYmd());
  }

  function filterCadastroArray(key, arr, cutoffYmd) {
    if (!isOficialOnly()) return Array.isArray(arr) ? arr : [];
    return (Array.isArray(arr) ? arr : []).filter((r) => isRecordAllowed(r, key, cutoffYmd));
  }

  function sanitizeCloudPayload(payload, cutoffYmd) {
    if (!isOficialOnly() || !payload || typeof payload !== "object") return payload;
    const out = { ...payload };
    for (const k of CADASTRO_GUARD_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(out, k)) continue;
      out[k] = filterCadastroArray(k, out[k], cutoffYmd);
    }
    out.dk_oficial_cadastro_guard_v1 = cutoffYmd || todayCutoffYmd();
    return out;
  }

  function purgeLocalCadastrosAntigos() {
    if (!isOficialOnly()) return { purged: false };
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function") {
      return { purged: false, reason: "cadastro_api_unavailable" };
    }
    const bypass = { bypassImmutabilidadeCadastro: true };
    const keys = [
      typeof CAD_CLIENTES_KEY !== "undefined" ? CAD_CLIENTES_KEY : "dk_clientes_cadastro",
      typeof CAD_VEICULOS_KEY !== "undefined" ? CAD_VEICULOS_KEY : "dk_veiculos_cadastro",
      typeof CAD_LOCACOES_KEY !== "undefined" ? CAD_LOCACOES_KEY : "dk_locacoes_cadastro",
      "dk_portal_clientes_cadastro",
      "dk_portal_veiculos_cadastro",
      "dk_veiculos_frota_planilha",
      "dk_lancamentos_aluguel",
      "dk_lancamentos_aluguel_cadastro",
    ];
    let removed = 0;
    keys.forEach((k) => {
      const prev = loadCadastro(k);
      const next = filterCadastroArray(k, prev);
      if (next.length !== prev.length) removed += prev.length - next.length;
      saveCadastro(k, next, bypass);
    });
    return { purged: true, removed };
  }

  window.__DK_isOficialCadastroGuardActive = isOficialOnly;
  window.__DK_filterOficialCadastroArray = filterCadastroArray;
  window.__DK_sanitizeOficialCloudPayload = sanitizeCloudPayload;
  window.__DK_purgeOficialLocalCadastrosAntigos = purgeLocalCadastrosAntigos;
  window.__DK_oficialCadastroTodayYmd = todayCutoffYmd;
})();
