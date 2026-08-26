/**
 * Oficial: data de corte fixa — só valem cadastros/lançamentos criados a partir de 10/06/2026.
 * Locações: corte 23/08/2026 pelo número do protocolo (AAAAMMDD…). Os 7 protocolos
 * de 12–21/08/2026 não podem voltar pelo localStorage nem pelo merge append-only.
 * Demo: sem bloqueio.
 */
(function dkOficialCadastroGuard() {
  /** Data de corte FIXA (não rolante): registos >= esta data ficam guardados para sempre. */
  const OFICIAL_CUTOFF_YMD = "2026-06-10";
  /** Oficial virgem de protocolos: locações com protocolo anterior a esta data saem do browser. */
  const OFICIAL_LOCACOES_CUTOFF_YMD = "2026-08-23";

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
    "dk_portal_checklist_historico_v1",
    "dk_portal_checklist_movimentacoes_v1",
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

  function locacoesCutoffYmd() {
    return OFICIAL_LOCACOES_CUTOFF_YMD;
  }

  function locacaoProtocolYmd(record) {
    const n = String(record?.numeroContrato || record?.protocolo || "").replace(/\D/g, "");
    if (n.length < 8) return null;
    const ymd = `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6, 8)}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(ymd)) return null;
    return ymd;
  }

  function cutoffForKey(key) {
    const k = String(key || "");
    if (k.includes("locacoes") || k.includes("locacao")) return OFICIAL_LOCACOES_CUTOFF_YMD;
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

  function cpfDigits(record) {
    return String(record?.cpf || "").replace(/\D/g, "");
  }

  /** Placeholders 000.000.000-01 / -03 / -04 (TESTE demo) — não entram no oficial. */
  const OFICIAL_CLIENTES_CPF_EXCLUIDOS = new Set(["00000000001", "00000000003", "00000000004"]);
  /**
   * Protocolos inválidos (typo / duplicata / prefixo ≠ data início) — saem do localStorage
   * e não voltam pelo merge. Remap aponta para o protocolo canónico da mesma locação.
   * Inclui seeds da demo (caderno teste AAA/BBB/CCC).
   */
  const OFICIAL_LOCACOES_NC_EXCLUIDOS = new Set([
    "2026122501",
    "2026082801",
    "2025010101",
    "2025010102",
    "2025010103",
    "2026010101",
    "2026010102",
    "2026010104",
  ]);
  const OFICIAL_VEICULOS_PLACA_EXCLUIDOS = new Set([
    "AAA0A00",
    "AAA0A01",
    "AAA0A02",
    "BBB0B00",
    "CCC0C00",
  ]);
  const OFICIAL_LOCACOES_NC_REMAP = Object.freeze({
    "2026122501": "2025122201",
    "2026082801": "2026011601",
  });

  function locacaoNcDigits(record) {
    return String(record?.numeroContrato || record?.protocolo || "").replace(/\D/g, "");
  }

  function normalizePlateLocal(p) {
    return String(p ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  /** Seed LOC0A99 / sem CPF / placas demo AAA·BBB·CCC — nunca no oficial. */
  function isLocacaoFantasmaCadastro(record) {
    if (!record || typeof record !== "object") return true;
    const placa = normalizePlateLocal(record.placa);
    const cpf = cpfDigits(record).slice(0, 11);
    if (/^LOC\d/i.test(placa) || /^TST\d/i.test(placa)) return true;
    if (OFICIAL_VEICULOS_PLACA_EXCLUIDOS.has(placa) || /^(AAA|BBB|CCC)0[A-C]\d{2}$/i.test(placa)) {
      return true;
    }
    if (OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(cpf)) return true;
    if (/^TESTE[- ]?\d/i.test(String(record.nome || "").trim())) return true;
    if (record.__dkSeedTesteReserva === true) return true;
    if (cpf.length !== 11) {
      const nome = String(record.nome || "").trim();
      const inicio = String(record.inicio || record.dataInicio || "").trim();
      if (!nome && !inicio) return true;
    }
    return false;
  }

  /** Seeds/fantasmas que nunca existiram na planilha CADASTRO DE VEICULOS (ex.: Z1). */
  function isVeiculoFantasmaCadastro(record) {
    if (!record || typeof record !== "object") return true;
    const placa = normalizePlateLocal(record.placa);
    const tip = String(record.codigo || record.tipoPlanilha || "")
      .trim()
      .toUpperCase();
    const modelo = String(record.modelo || record.marcaModelo || "")
      .trim()
      .toUpperCase();
    if (OFICIAL_VEICULOS_PLACA_EXCLUIDOS.has(placa) || /^(AAA|BBB|CCC)0[A-C]\d{2}$/i.test(placa)) {
      return true;
    }
    if (tip === "Z1" || tip === "HR70") return true;
    if (/FERRARI|BUGATTI|PORSCHE|FUSCA/.test(modelo)) return true;
    return false;
  }

  function isRecordAllowed(record, key, cutoffYmd) {
    if (!isOficialOnly()) return true;
    if (
      record &&
      typeof record === "object" &&
      cadastroKeyFamily(key) === "cliente" &&
      OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(cpfDigits(record))
    ) {
      return false;
    }
    if (record && typeof record === "object" && cadastroKeyFamily(key) === "veiculo") {
      if (isVeiculoFantasmaCadastro(record)) return false;
    }
    if (
      record &&
      typeof record === "object" &&
      cadastroKeyFamily(key) === "veiculo" &&
      OFICIAL_VEICULOS_PLACA_EXCLUIDOS.has(normalizePlateLocal(record.placa))
    ) {
      return false;
    }
    if (
      record &&
      typeof record === "object" &&
      cadastroKeyFamily(key) === "locacao" &&
      OFICIAL_LOCACOES_NC_EXCLUIDOS.has(locacaoNcDigits(record))
    ) {
      return false;
    }
    if (
      record &&
      typeof record === "object" &&
      cadastroKeyFamily(key) === "locacao" &&
      isLocacaoFantasmaCadastro(record)
    ) {
      return false;
    }
    if (record && typeof record === "object" && record.origemPlanilha === true) return false;
    if (record && typeof record === "object" && record.cadastroRetroativo === true) return true;
    if (record && typeof record === "object" && record.origemPortal === true) return true;
    if (
      cadastroKeyFamily(key) === "locacao" &&
      ((Array.isArray(record?.portalLancamentosAluguel) && record.portalLancamentosAluguel.length) ||
        (Array.isArray(record?.portalPagamentosAuditoria) && record.portalPagamentosAuditoria.length))
    ) {
      return true;
    }
    const cutoff = cutoffYmd || cutoffForKey(key);
    const protoYmd = locacaoProtocolYmd(record);
    if (cadastroKeyFamily(key) === "locacao" && protoYmd && protoYmd < locacoesCutoffYmd()) return false;
    const ymd = protoYmd && cadastroKeyFamily(key) === "locacao" ? protoYmd : extractRecordYmd(record, key);
    if (!ymd) return false;
    return ymd >= cutoff;
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

  function readRawCadastroArray(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Corre em todos os arranques do site oficial: lê o JSON cru (não o load filtrado). */
  function purgeLocalCadastrosAntigos() {
    if (!isOficialOnly()) return { purged: false };
    let removed = 0;
    const canCadastroApi = typeof saveCadastro === "function";
    const bypass = { bypassImmutabilidadeCadastro: true, allowShrink: true };
    CADASTRO_GUARD_KEYS.forEach((k) => {
      try {
        const prev = readRawCadastroArray(k);
        if (!prev.length) return;
        const next = filterCadastroArray(k, prev);
        if (next.length === prev.length) return;
        removed += prev.length - next.length;
        if (canCadastroApi) {
          saveCadastro(k, next, bypass);
        } else {
          localStorage.setItem(k, JSON.stringify(next));
        }
        if (typeof invalidateCadastroParseCache === "function") {
          invalidateCadastroParseCache(k);
        }
      } catch {
        /* ignore */
      }
    });
    return { purged: true, removed, cutoff: OFICIAL_CUTOFF_YMD, locacoesCutoff: OFICIAL_LOCACOES_CUTOFF_YMD };
  }

  window.__DK_isOficialCadastroGuardActive = isOficialOnly;
  window.__DK_filterOficialCadastroArray = filterCadastroArray;
  window.__DK_sanitizeOficialCloudPayload = sanitizeCloudPayload;
  window.__DK_purgeOficialLocalCadastrosAntigos = purgeLocalCadastrosAntigos;
  window.__DK_oficialCadastroTodayYmd = cutoffYmdFixed;
  window.__DK_oficialLocacoesCutoffYmd = locacoesCutoffYmd;
  window.__DK_OFICIAL_CUTOFF_YMD = OFICIAL_CUTOFF_YMD;
  window.__DK_OFICIAL_LOCACOES_CUTOFF_YMD = OFICIAL_LOCACOES_CUTOFF_YMD;
  window.__DK_OFICIAL_LOCACOES_NC_EXCLUIDOS = OFICIAL_LOCACOES_NC_EXCLUIDOS;
  window.__DK_OFICIAL_LOCACOES_NC_REMAP = OFICIAL_LOCACOES_NC_REMAP;
  window.__DK_remapOficialProtocoloNc = function remapOficialProtocoloNc(raw) {
    const nc = String(raw || "").replace(/\D/g, "");
    if (!nc) return String(raw || "").trim();
    return OFICIAL_LOCACOES_NC_REMAP[nc] || String(raw || "").trim();
  };
  window.__DK_isLocacaoFantasmaCadastro = isLocacaoFantasmaCadastro;
  window.__DK_isVeiculoFantasmaCadastro = isVeiculoFantasmaCadastro;
})();
