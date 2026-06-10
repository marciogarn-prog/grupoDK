/**
 * Oficial: data de corte fixa — só valem cadastros/lançamentos criados a partir de 10/06/2026.
 * Bloqueia qualquer recarga de dados antigos (nuvem, backup, merge local, seeds de planilha).
 * Demo: sem bloqueio.
 */
(function dkOficialCadastroGuard() {
  /** Data de corte FIXA (não rolante): registos >= esta data ficam guardados para sempre. */
  const OFICIAL_CUTOFF_YMD = "2026-06-10";

  const CADASTRO_GUARD_KEYS = [
    "dk_clientes_cadastro",
    "dk_clientes_validacao_pendente",
    "dk_portal_clientes_cadastro",
    "dk_veiculos_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
    "dk_locacoes_cadastro",
    "dk_locacoes_quadro_geral",
    "dk_manutencoes_cadastro",
    "dk_lancamentos_aluguel",
    "dk_lancamentos_aluguel_cadastro",
    "dk_comprovantes_banco",
    "dk_comprovantes_cliente_pendentes",
    "dk_documentos_deposito_v1",
    "dk_locacao_documentos_v1",
    "dk_cliente_notificacoes",
    "dk_comunicacao_operacao_v1",
  ];

  function isOficialOnly() {
    return window.__DK_IS_DEMO_DEPLOY__ !== true;
  }

  function cutoffYmdFixed() {
    return OFICIAL_CUTOFF_YMD;
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
    /* aceita prefixo de dia da semana, ex.: "sex 09/01/2026" */
    const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
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
    if (String(key).includes("manutencoes")) return "lancamento";
    if (String(key).includes("comprovante")) return "comprovante";
    if (String(key).includes("documento")) return "documento";
    return "generic";
  }

  const DATE_FIELDS = {
    cliente: ["dataCadastro", "createdAt", "updatedAt"],
    veiculo: ["dataCadastro", "createdAt", "updatedAt"],
    locacao: ["dataCadastro", "createdAt", "updatedAt", "inicio", "dataInicio"],
    lancamento: ["dataCadastro", "data", "dataPagamento", "dataLancamento", "createdAt"],
    comprovante: ["createdAt", "criadoEm", "enviadoEm", "data", "dataPagamento"],
    documento: ["createdAt", "criadoEm", "enviadoClienteEm", "updatedAt"],
    generic: ["dataCadastro", "createdAt", "criadoEm", "updatedAt"],
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
    if (record && typeof record === "object" && record.origemPlanilha === true) return false;
    const ymd = extractRecordYmd(record, key);
    if (!ymd) return false;
    return ymd >= (cutoffYmd || OFICIAL_CUTOFF_YMD);
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
      if (!Array.isArray(out[k])) continue;
      out[k] = filterCadastroArray(k, out[k], cutoffYmd);
    }
    out.dk_oficial_cadastro_guard_v1 = cutoffYmd || OFICIAL_CUTOFF_YMD;
    return out;
  }

  /** Corre em todos os arranques do site oficial: remove do navegador tudo anterior ao corte. */
  function purgeLocalCadastrosAntigos() {
    if (!isOficialOnly()) return { purged: false };
    let removed = 0;
    const canCadastroApi = typeof loadCadastro === "function" && typeof saveCadastro === "function";
    const bypass = { bypassImmutabilidadeCadastro: true };
    CADASTRO_GUARD_KEYS.forEach((k) => {
      try {
        let prev;
        if (canCadastroApi) {
          prev = loadCadastro(k);
        } else {
          const raw = localStorage.getItem(k);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          prev = parsed;
        }
        if (!Array.isArray(prev) || !prev.length) return;
        const next = filterCadastroArray(k, prev);
        if (next.length === prev.length) return;
        removed += prev.length - next.length;
        if (canCadastroApi) {
          saveCadastro(k, next, bypass);
        } else {
          localStorage.setItem(k, JSON.stringify(next));
        }
      } catch {
        /* ignore */
      }
    });
    return { purged: true, removed, cutoff: OFICIAL_CUTOFF_YMD };
  }

  window.__DK_isOficialCadastroGuardActive = isOficialOnly;
  window.__DK_filterOficialCadastroArray = filterCadastroArray;
  window.__DK_sanitizeOficialCloudPayload = sanitizeCloudPayload;
  window.__DK_purgeOficialLocalCadastrosAntigos = purgeLocalCadastrosAntigos;
  window.__DK_oficialCadastroTodayYmd = cutoffYmdFixed;
  window.__DK_OFICIAL_CUTOFF_YMD = OFICIAL_CUTOFF_YMD;
})();
