/**
 * Comprovantes enviados pelo App Cliente → nuvem → conferência automática (IA) e confirmação manual pelo operador.
 * Duplicata: mesma imagem (hash) ou mesma assinatura lógica (protocolo+data+hora+valor+ID lidos na imagem).
 */
(function portalComprovantesCliente() {
  const STORAGE_KEY = "dk_comprovantes_cliente_pendentes";
  const BANCO_ASSINATURAS_KEY = "dk_comprovantes_banco_assinaturas";
  const STORAGE_MAX_COMPROVANTES = 500;
  const OPENAI_KEY_STORAGE = "dk_openai_api_key";

  const STATUS = {
    PENDENTE: "pendente",
    IA_OK: "ia_validado",
    CONFIRMADO: "confirmado",
    REJEITADO: "rejeitado",
  };

  const HORAS_RECUSADOS_OPERADOR = 72;
  const OPERADOR_AUTO = { cpf: "", nome: "Sistema DK (automático)", role: "sistema" };

  let filaAutoEmCurso = false;
  let _ccNormalizing = false;
  let _ccLoadAllCache = null;
  let _ccPushDeferredTimer = null;

  function isClienteAppContext() {
    if (window.__DK_CLIENTE_APP === true) return true;
    try {
      const p = String(location.pathname || "").toLowerCase();
      return p === "/cliente" || p.endsWith("/cliente") || p.endsWith("/cliente.html");
    } catch {
      return false;
    }
  }

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normProto(x) {
    return typeof normalizeNumeroContratoKey === "function"
      ? normalizeNumeroContratoKey(x || "")
      : String(x || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function currencyBRL(n) {
    if (typeof window.currencyBRL === "function") return window.currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parseCurrencyBR(v) {
    if (typeof window.parseCurrencyBR === "function" && window.parseCurrencyBR !== parseCurrencyBR) {
      return window.parseCurrencyBR(v);
    }
    if (typeof v === "number" && Number.isFinite(v)) return v;
    let s = String(v ?? "").trim();
    if (!s) return 0;
    s = s.replace(/[R$\s\u00A0]/gi, "");
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      if (lastComma > lastDot) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (hasComma) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (hasDot) {
      const parts = s.split(".");
      const dec = parts[parts.length - 1];
      if (!(parts.length === 2 && dec.length > 0 && dec.length <= 2)) {
        s = s.replace(/\./g, "");
      }
    }
    const n = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function parseBrDate(s) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(s);
    const raw = String(s || "").trim();
    if (!raw || !raw.includes("/")) return null;
    const [day, month, year] = raw.split("/").map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  }

  const MIG_HISTORICO_V = "20260522hist-v4-banco";
  const CC_ARQUIVOS_DB = "dk_comprovantes_arquivos_v1";
  const CC_ARQUIVOS_STORE = "arquivos";
  /** Cache em memória (sessão) — evita reler IndexedDB a cada IA/visualização. */
  const ccArquivoMemoria = new Map();

  function isStorageQuotaError(e) {
    const name = String(e?.name || "");
    const msg = String(e?.message || e || "");
    return name === "QuotaExceededError" || /quota/i.test(msg);
  }

  function openComprovantesArquivosDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("indexedDB_indisponivel"));
        return;
      }
      const req = indexedDB.open(CC_ARQUIVOS_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CC_ARQUIVOS_STORE)) {
          db.createObjectStore(CC_ARQUIVOS_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function salvarArquivoComprovanteIdb(id, dataUrl, mimeType) {
    const rid = String(id || "").trim();
    if (!rid || !dataUrl) return false;
    try {
      const db = await openComprovantesArquivosDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(CC_ARQUIVOS_STORE, "readwrite");
        tx.objectStore(CC_ARQUIVOS_STORE).put({
          id: rid,
          dataUrl: String(dataUrl),
          mimeType: String(mimeType || "").trim() || "image/jpeg",
          updatedAt: new Date().toISOString(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return true;
    } catch (e) {
      console.warn("[DK comprovantes] IndexedDB gravar", e);
      return false;
    }
  }

  async function lerArquivoComprovanteIdb(id) {
    const rid = String(id || "").trim();
    if (!rid) return null;
    try {
      const db = await openComprovantesArquivosDb();
      const row = await new Promise((resolve, reject) => {
        const tx = db.transaction(CC_ARQUIVOS_STORE, "readonly");
        const req = tx.objectStore(CC_ARQUIVOS_STORE).get(rid);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (!row?.dataUrl) return null;
      return { dataUrl: String(row.dataUrl), mimeType: String(row.mimeType || "").trim() };
    } catch (e) {
      console.warn("[DK comprovantes] IndexedDB ler", e);
      return null;
    }
  }

  async function removerArquivoComprovanteIdb(id) {
    const rid = String(id || "").trim();
    if (!rid) return;
    ccArquivoMemoria.delete(rid);
    try {
      const db = await openComprovantesArquivosDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(CC_ARQUIVOS_STORE, "readwrite");
        tx.objectStore(CC_ARQUIVOS_STORE).delete(rid);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      /* ignore */
    }
  }

  async function comprimirComprovanteDataUrl(dataUrl, mimeType) {
    const raw = String(dataUrl || "").trim();
    const mime = String(mimeType || "").toLowerCase();
    if (!raw || mime.includes("pdf") || raw.includes("application/pdf")) return raw;
    const p = parseDataUrl(raw);
    if (!p.base64 || p.base64.length < 350000) return raw;
    if (typeof document === "undefined") return raw;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 1400;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) {
            resolve(raw);
            return;
          }
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(raw);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch {
          resolve(raw);
        }
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    });
  }

  function stripArquivoInline(rec) {
    if (!rec || typeof rec !== "object") return rec;
    const { arquivoBase64, ...rest } = rec;
    return rest;
  }

  async function prepareRecParaArmazenamento(rec) {
    if (!rec || typeof rec !== "object") return rec;
    const id = String(rec.id || "").trim();
    const podeApagarArquivo =
      rec.status === STATUS.CONFIRMADO || (rec.status === STATUS.REJEITADO && rec.clienteDeAcordoEm);
    if (podeApagarArquivo) {
      if (id) await removerArquivoComprovanteIdb(id);
      return stripArquivoInline(rec);
    }
    const inline = String(rec.arquivoBase64 || "").trim();
    if (inline && id) {
      ccArquivoMemoria.set(id, inline);
      await salvarArquivoComprovanteIdb(id, inline, rec.mimeType);
      return { ...stripArquivoInline(rec), arquivoArmazenado: "idb" };
    }
    if (rec.arquivoArmazenado === "idb" && id) {
      return stripArquivoInline(rec);
    }
    return rec;
  }

  async function prepareListaParaArmazenamento(list) {
    const out = [];
    for (const r of list) {
      out.push(await prepareRecParaArmazenamento(r));
    }
    return out;
  }

  function safeSetComprovantesJson(list) {
    let payload = sliceComprovantesPreservandoConfirmados(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      if (!isStorageQuotaError(e)) throw e;
      payload = sliceComprovantesPreservandoConfirmados(
        list.map((r) => {
          const x = stripArquivoInline(r);
          delete x.arquivoArmazenado;
          return x;
        })
      ).slice(0, 120);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        return true;
      } catch (e2) {
        console.error("[DK comprovantes] quota localStorage", e2);
        return false;
      }
    }
  }

  async function getByIdComArquivo(id) {
    const rec = getById(id);
    if (!rec) return null;
    if (String(rec.arquivoBase64 || "").trim()) return rec;
    const rid = String(rec.id || "").trim();
    const mem = ccArquivoMemoria.get(rid);
    if (mem) return { ...rec, arquivoBase64: mem };
    if (rec.arquivoArmazenado === "idb" && rid) {
      const arq = await lerArquivoComprovanteIdb(rid);
      if (arq?.dataUrl) {
        ccArquivoMemoria.set(rid, arq.dataUrl);
        return { ...rec, arquivoBase64: arq.dataUrl, mimeType: arq.mimeType || rec.mimeType };
      }
    }
    return rec;
  }

  function loadAllRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function chaveAgrupamentoEnvioCliente(rec) {
    const cpf = onlyDigits(rec?.cpf).slice(0, 11);
    const proto = normProto(rec?.protocolo);
    const data = normDataPagamentoBr(rec?.dataPagamento);
    const valor = roundCentavos(rec?.valor);
    if (!cpf || !proto || !data || !Number.isFinite(valor) || valor <= 0) return "";
    return `${cpf}|${proto}|${data}|${valor.toFixed(2)}`;
  }

  function corrigirValorCentavosGravado(rec) {
    if (!rec || rec.status === STATUS.CONFIRMADO) return rec;
    let v = roundCentavos(rec.valor);
    const ia = rec.iaValidacao;
    if (!(v >= 1 && v < 100)) return rec;
    const candidato = roundCentavos(v / 100);
    if (candidato <= 0 || candidato >= 1) return rec;
    if (ia && Number.isFinite(Number(ia.valor))) {
      const valorIa = normalizarValorLidoIa(ia.valor, candidato);
      if (valoresIguaisCentavos(valorIa, candidato)) {
        return { ...rec, valor: candidato, valorCorrigidoSistemaEm: new Date().toISOString() };
      }
    }
    if (candidato <= 0.99) {
      return { ...rec, valor: candidato, valorCorrigidoSistemaEm: new Date().toISOString() };
    }
    return rec;
  }

  function eraRejeicaoValorIndevida(rec) {
    if (rec.status !== STATUS.REJEITADO || !rec.rejeitadoAutomatico) return false;
    const idxPag = indicePagamentosProtocoloPorComprovante();
    if (comprovanteRegistadoNoProtocolo(rec, idxPag)) return false;
    if (rec.valorCorrigidoSistemaEm) return true;
    const mot = String(rec.rejeitadoMotivo || rec.rejeitadoMotivoCliente || "").toLowerCase();
    if (!mot.includes("valor")) return false;
    const valorDecl = roundCentavos(rec.valor);
    const ia = rec.iaValidacao;
    if (!ia || !(valorDecl > 0)) return false;
    const valorIaRaw = roundCentavos(parseCurrencyBR(ia.valorBruto ?? ia.valor));
    const valorIaNorm = normalizarValorLidoIa(ia.valor, valorDecl);
    if (!(valorDecl < 1 && valorIaRaw >= 1 && valorIaRaw < 100)) return false;
    return (
      valorIaNorm > 0 &&
      valoresIguaisCentavos(valorIaNorm, valorDecl) &&
      !valoresIguaisCentavos(valorIaRaw, valorDecl)
    );
  }

  function corrigirReaberturaConfereValor(rec) {
    if (rec.status !== STATUS.IA_OK || !rec.reabertoParaOperadorEm) return rec;
    const ia = rec.iaValidacao;
    if (!ia || typeof ia !== "object") return rec;
    const decl = roundCentavos(rec.valor);
    const raw = roundCentavos(parseCurrencyBR(ia.valorBruto ?? ia.valor));
    const norm = normalizarValorLidoIa(ia.valor, decl);
    const confere = valoresIguaisCentavos(norm, decl) || valoresIguaisCentavos(raw, decl);
    if (ia.confereValor === confere) return rec;
    return {
      ...rec,
      iaValidacao: {
        ...ia,
        confereValor: confere,
        valor: norm,
        valorBruto: Number.isFinite(raw) ? raw : ia.valorBruto,
        observacoes: String(ia.observacoes || "").trim()
          ? `${ia.observacoes} Valor: rever imagem antes de confirmar.`
          : "Valor: rever imagem do comprovante antes de confirmar.",
      },
    };
  }

  function reabrirComprovanteParaOperador(rec) {
    const ia = rec.iaValidacao && typeof rec.iaValidacao === "object" ? { ...rec.iaValidacao } : {};
    const decl = roundCentavos(rec.valor);
    const norm = normalizarValorLidoIa(ia.valor, decl);
    const raw = roundCentavos(parseCurrencyBR(ia.valorBruto ?? ia.valor));
    ia.valor = norm;
    ia.valorBruto = Number.isFinite(raw) ? raw : ia.valorBruto;
    ia.confereValor = valoresIguaisCentavos(norm, decl) || valoresIguaisCentavos(raw, decl);
    ia.observacoes = String(ia.observacoes || "").trim()
      ? `${ia.observacoes} Reaberto para confirmação do operador (correção de histórico).`
      : "Reaberto para confirmação do operador (correção de histórico).";
    ia.processamentoAutomatico = true;
    const eventos = Array.isArray(rec.historicoEventos) ? rec.historicoEventos.slice() : [];
    eventos.push({
      tipo: "reabertura_operador",
      em: new Date().toISOString(),
      motivoAnterior: rec.rejeitadoMotivoCliente || rec.rejeitadoMotivo || "",
    });
    return {
      ...rec,
      status: STATUS.IA_OK,
      reabertoParaOperadorEm: new Date().toISOString(),
      iaValidacao: ia,
      rejeitadoMotivoCliente: "",
      rejeitadoMotivo: "",
      rejeitadoAutomatico: false,
      historicoEventos: eventos,
      migracaoHistoricoV: MIG_HISTORICO_V,
    };
  }

  function rejeitarDuplicataMesmaImagem(rec, idMantido) {
    const eventos = Array.isArray(rec.historicoEventos) ? rec.historicoEventos.slice() : [];
    eventos.push({ tipo: "imagem_duplicada", em: new Date().toISOString(), referencia: idMantido });
    return {
      ...rec,
      status: STATUS.REJEITADO,
      rejeitadoAutomatico: true,
      rejeitadoMotivoCliente: MSG_DUP_IMAGEM_CLIENTE,
      rejeitadoMotivo: `Comprovante duplicado — mesma imagem (mantido ${idMantido}).`,
      rejeitadoPorNome: OPERADOR_AUTO.nome,
      rejeitadoEm: new Date().toISOString(),
      historicoEventos: eventos,
      migracaoHistoricoV: MIG_HISTORICO_V,
    };
  }

  function rejeitarDuplicataAssinaturaLogica(rec, idMantido, sig) {
    const eventos = Array.isArray(rec.historicoEventos) ? rec.historicoEventos.slice() : [];
    eventos.push({
      tipo: "assinatura_logica_duplicada",
      em: new Date().toISOString(),
      referencia: idMantido,
      chave: chaveBancoAssinatura(sig),
    });
    const msgCliente = motivoDuplicataCliente(sig);
    return {
      ...rec,
      status: STATUS.REJEITADO,
      rejeitadoAutomatico: true,
      rejeitadoMotivoCliente: msgCliente,
      rejeitadoMotivo: `Comprovante duplicado — ${textoAssinaturaDup(sig)} (mantido ${idMantido}).`,
      rejeitadoPorNome: OPERADOR_AUTO.nome,
      rejeitadoEm: new Date().toISOString(),
      assinaturaDupChave: chaveBancoAssinatura(sig),
      historicoEventos: eventos,
      migracaoHistoricoV: MIG_HISTORICO_V,
    };
  }

  function rejeitarEnvioExcedente(rec, idMantido) {
    const eventos = Array.isArray(rec.historicoEventos) ? rec.historicoEventos.slice() : [];
    eventos.push({ tipo: "excedente_arquivado", em: new Date().toISOString(), referencia: idMantido });
    const msgCliente =
      "Já existe outro comprovante seu deste pagamento em análise. Este envio em duplicidade foi arquivado — utilize apenas o comprovante que permanece na fila.";
    return {
      ...rec,
      status: STATUS.REJEITADO,
      rejeitadoAutomatico: true,
      rejeitadoMotivoCliente: msgCliente,
      rejeitadoMotivo: `Envio em duplicidade — mantido comprovante ${idMantido}.`,
      rejeitadoPorNome: OPERADOR_AUTO.nome,
      rejeitadoEm: new Date().toISOString(),
      historicoEventos: eventos,
      migracaoHistoricoV: MIG_HISTORICO_V,
    };
  }

  /** Preserva confirmados; corrige centavos; reabre recusas indevidas; arquiva reenvios excedentes. */
  function normalizarHistoricoComprovantes(arr, opts) {
    const silencioso = Boolean(opts?.silencioso);
    let list = arr.map((r) => ({ ...r }));
    let changed = false;
    const idxPag = indicePagamentosProtocoloPorComprovante();

    list = list.map((r) => {
      const pag = comprovanteRegistadoNoProtocolo(r, idxPag);
      if (!pag) return r;
      if (r.status === STATUS.CONFIRMADO && roundCentavos(r.valorRegistadoProtocolo ?? r.valor) === roundCentavos(pag.valor)) {
        return r;
      }
      changed = true;
      return alinharComprovanteConfirmadoComProtocolo(r, pag);
    });

    list = list.map((r) => {
      const c = corrigirValorCentavosGravado(r);
      if (c.valor !== r.valor || c.valorCorrigidoSistemaEm) changed = true;
      return c;
    });

    list = list.map((r) => {
      if (!eraRejeicaoValorIndevida(r)) return r;
      changed = true;
      return reabrirComprovanteParaOperador(r);
    });

    list = list.map((r) => {
      const c = corrigirReaberturaConfereValor(r);
      if (c !== r) changed = true;
      return c;
    });

    const porImagemPosSync = new Map();
    for (const r of list) {
      const fp = String(r.comprovanteFp || "").trim();
      if (!fp) continue;
      if (!porImagemPosSync.has(fp)) porImagemPosSync.set(fp, []);
      porImagemPosSync.get(fp).push(r);
    }
    for (const grupo of porImagemPosSync.values()) {
      if (grupo.length <= 1) continue;
      const confirmados = grupo.filter((r) => r.status === STATUS.CONFIRMADO);
      if (!confirmados.length) continue;
      const idRef = confirmados[0].id;
      for (const r of grupo) {
        if (r.status === STATUS.CONFIRMADO) continue;
        const idx = list.findIndex((x) => x.id === r.id);
        if (idx < 0 || list[idx].status === STATUS.REJEITADO) continue;
        list[idx] = rejeitarDuplicataMesmaImagem(list[idx], idRef);
        if (!silencioso) {
          notificarClienteComprovanteRejeitado(list[idx], list[idx].rejeitadoMotivoCliente);
        }
        changed = true;
      }
    }

    const porImagem = new Map();
    for (const r of list) {
      const fp = String(r.comprovanteFp || "").trim();
      if (!fp) continue;
      if (!porImagem.has(fp)) porImagem.set(fp, []);
      porImagem.get(fp).push(r);
    }
    for (const grupo of porImagem.values()) {
      if (grupo.length <= 1) continue;
      const confirmados = grupo.filter((r) => r.status === STATUS.CONFIRMADO);
      if (confirmados.length) {
        const idRef = confirmados[0].id;
        for (const r of grupo) {
          if (r.status === STATUS.CONFIRMADO) continue;
          const idx = list.findIndex((x) => x.id === r.id);
          if (idx < 0 || list[idx].status === STATUS.REJEITADO) continue;
          list[idx] = rejeitarDuplicataMesmaImagem(list[idx], idRef);
          if (!silencioso) {
            notificarClienteComprovanteRejeitado(list[idx], list[idx].rejeitadoMotivoCliente);
          }
          changed = true;
        }
        continue;
      }
      const fila = grupo.filter((r) => r.status === STATUS.IA_OK || r.status === STATUS.PENDENTE);
      if (fila.length <= 1) continue;
      fila.sort((a, b) => {
        if (a.status === STATUS.IA_OK && b.status !== STATUS.IA_OK) return -1;
        if (b.status === STATUS.IA_OK && a.status !== STATUS.IA_OK) return 1;
        return Date.parse(b.enviadoEm || 0) - Date.parse(a.enviadoEm || 0);
      });
      const manter = fila[0];
      for (let i = 1; i < fila.length; i++) {
        const ex = fila[i];
        const idx = list.findIndex((x) => x.id === ex.id);
        if (idx < 0 || list[idx].status === STATUS.REJEITADO) continue;
        list[idx] = rejeitarDuplicataMesmaImagem(list[idx], manter.id);
        if (!silencioso) {
          notificarClienteComprovanteRejeitado(list[idx], list[idx].rejeitadoMotivoCliente);
        }
        changed = true;
      }
    }

    const porAssinatura = new Map();
    for (const r of list) {
      const sig = assinaturaDupDeRec(r);
      const k = chaveBancoAssinatura(sig);
      if (!k) continue;
      if (!porAssinatura.has(k)) porAssinatura.set(k, []);
      porAssinatura.get(k).push(r);
    }
    for (const grupo of porAssinatura.values()) {
      if (grupo.length <= 1) continue;
      const confirmados = grupo.filter((r) => r.status === STATUS.CONFIRMADO);
      const sigRef = assinaturaDupDeRec(grupo[0]);
      if (confirmados.length) {
        const idRef = confirmados[0].id;
        for (const r of grupo) {
          if (r.status === STATUS.CONFIRMADO) continue;
          const idx = list.findIndex((x) => x.id === r.id);
          if (idx < 0 || list[idx].status === STATUS.REJEITADO) continue;
          list[idx] = rejeitarDuplicataAssinaturaLogica(list[idx], idRef, sigRef);
          if (!silencioso) {
            notificarClienteComprovanteRejeitado(list[idx], list[idx].rejeitadoMotivoCliente);
          }
          changed = true;
        }
        continue;
      }
      const fila = grupo.filter((r) => r.status === STATUS.IA_OK || r.status === STATUS.PENDENTE);
      if (fila.length <= 1) continue;
      fila.sort((a, b) => {
        if (a.status === STATUS.IA_OK && b.status !== STATUS.IA_OK) return -1;
        if (b.status === STATUS.IA_OK && a.status !== STATUS.IA_OK) return 1;
        return Date.parse(b.enviadoEm || 0) - Date.parse(a.enviadoEm || 0);
      });
      const manter = fila[0];
      for (let i = 1; i < fila.length; i++) {
        const ex = fila[i];
        const idx = list.findIndex((x) => x.id === ex.id);
        if (idx < 0 || list[idx].status === STATUS.REJEITADO) continue;
        list[idx] = rejeitarDuplicataAssinaturaLogica(list[idx], manter.id, sigRef);
        if (!silencioso) {
          notificarClienteComprovanteRejeitado(list[idx], list[idx].rejeitadoMotivoCliente);
        }
        changed = true;
      }
    }

    const grupos = new Map();
    for (const r of list) {
      const k = chaveAgrupamentoEnvioCliente(r);
      if (!k) continue;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(r);
    }

    for (const grupo of grupos.values()) {
      if (grupo.length <= 1) continue;
      const confirmados = grupo.filter((r) => r.status === STATUS.CONFIRMADO);
      if (confirmados.length) {
        for (const r of grupo) {
          if (r.status === STATUS.CONFIRMADO) continue;
          if (r.status === STATUS.REJEITADO && String(r.rejeitadoMotivo || "").includes("duplicidade")) continue;
          const idRef = confirmados[0].id;
          const idx = list.findIndex((x) => x.id === r.id);
          if (idx >= 0 && list[idx].status !== STATUS.REJEITADO) {
            list[idx] = rejeitarEnvioExcedente(list[idx], idRef);
            if (!silencioso) {
              notificarClienteComprovanteRejeitado(list[idx], list[idx].rejeitadoMotivoCliente);
            }
            changed = true;
          }
        }
        continue;
      }

      const ativos = grupo.filter((r) => r.status === STATUS.IA_OK || r.status === STATUS.PENDENTE);
      if (ativos.length <= 1) continue;

      ativos.sort((a, b) => {
        if (a.status === STATUS.IA_OK && b.status !== STATUS.IA_OK) return -1;
        if (b.status === STATUS.IA_OK && a.status !== STATUS.IA_OK) return 1;
        return Date.parse(b.enviadoEm || 0) - Date.parse(a.enviadoEm || 0);
      });
      const manter = ativos[0];
      for (let i = 1; i < ativos.length; i++) {
        const ex = ativos[i];
        const idx = list.findIndex((x) => x.id === ex.id);
        if (idx < 0 || list[idx].status === STATUS.REJEITADO) continue;
        list[idx] = rejeitarEnvioExcedente(list[idx], manter.id);
        if (!silencioso) {
          notificarClienteComprovanteRejeitado(list[idx], list[idx].rejeitadoMotivoCliente);
        }
        changed = true;
      }
    }

    list = list.map((r) => {
      const sn = String(r.syncNuvem || "").trim();
      if (sn === "ok" || sn === "pendente") return r;
      changed = true;
      const inferred = r.status === STATUS.CONFIRMADO ? "ok" : "pendente";
      return {
        ...r,
        syncNuvem: inferred,
        syncNuvemEm:
          inferred === "ok" ? String(r.syncNuvemEm || r.confirmadoEm || r.enviadoEm || "").trim() || null : null,
      };
    });

    return { list, changed };
  }

  async function writeComprovantesLocal(arr, opts) {
    const skipPush = Boolean(opts?.skipPush);
    const skipNormalize = Boolean(opts?.skipNormalize);
    let final = arr;
    if (!skipNormalize) {
      const { list, changed } = normalizarHistoricoComprovantes(arr);
      final = changed ? list : arr;
    }
    const stored = await prepareListaParaArmazenamento(final);
    if (!safeSetComprovantesJson(stored)) {
      throw new Error("quota_excedida");
    }
    _ccLoadAllCache = stored;
    sincronizarBancoAssinaturas();
    if (!skipPush) pushNuvem();
    return stored;
  }

  function marcarComprovantesSyncNuvemOk(updatedAt) {
    const raw = loadAllRaw();
    const ts = String(updatedAt || new Date().toISOString());
    let changed = false;
    const next = raw.map((r) => {
      if (r.syncNuvem === "ok") return r;
      if (r.syncNuvem !== "pendente") return r;
      changed = true;
      return { ...r, syncNuvem: "ok", syncNuvemEm: ts };
    });
    if (!changed) return false;
    writeComprovantesLocal(next, { skipPush: true });
    try {
      window.dispatchEvent(
        new CustomEvent("dk-comprovantes-sync-nuvem", { detail: { ok: true, updatedAt: ts } })
      );
    } catch {
      /* ignore */
    }
    return true;
  }

  let _ccPushInFlight = null;

  function agendarPushNuvemAdiado() {
    if (_ccPushDeferredTimer) clearTimeout(_ccPushDeferredTimer);
    _ccPushDeferredTimer = setTimeout(() => {
      _ccPushDeferredTimer = null;
      pushNuvem();
    }, 2500);
  }

  async function garantirFingerprintsComprovantes(arr) {
    let changed = false;
    const list = [];
    for (const r of arr) {
      let rec = { ...r };
      if (!String(rec.comprovanteFp || "").trim() && rec.arquivoBase64) {
        rec.comprovanteFp = await computeComprovanteFingerprint(rec.arquivoBase64, rec.mimeType);
        changed = true;
      }
      list.push(rec);
    }
    return { list, changed };
  }

  const CC_MIG_IDB_KEY = "dk_cc_arquivos_idb_v1";

  async function migrarArquivosInlineParaIdbSeNecessario() {
    try {
      if (localStorage.getItem(CC_MIG_IDB_KEY) === "1") return;
    } catch {
      return;
    }
    const raw = loadAllRaw();
    let changed = false;
    const next = [];
    for (const r of raw) {
      if (String(r.arquivoBase64 || "").trim() && r.id) {
        await salvarArquivoComprovanteIdb(r.id, r.arquivoBase64, r.mimeType);
        next.push({ ...stripArquivoInline(r), arquivoArmazenado: "idb" });
        changed = true;
      } else {
        next.push(r);
      }
    }
    if (changed) {
      safeSetComprovantesJson(sliceComprovantesPreservandoConfirmados(next));
      _ccLoadAllCache = next;
    }
    try {
      localStorage.setItem(CC_MIG_IDB_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function payloadComprovantesParaNuvem(arr) {
    const base = Array.isArray(arr) ? arr : loadAllRaw();
    const out = [];
    for (const r of base) {
      if (!r?.id) {
        out.push(r);
        continue;
      }
      const h = await getByIdComArquivo(r.id);
      out.push(h || r);
    }
    return out;
  }

  async function repararHistoricoComprovantesNuvem(opts) {
    const leve = Boolean(opts?.leve) || isClienteAppContext();
    if (!leve) invalidateComprovantesCache();
    await migrarArquivosInlineParaIdbSeNecessario();
    let raw = loadAllRaw();
    let changed = false;
    if (!leve) {
      const fpPack = await garantirFingerprintsComprovantes(raw);
      raw = fpPack.list;
      changed = fpPack.changed;
    }
    const { list, changed: normChanged } = normalizarHistoricoComprovantes(raw, { silencioso: leve });
    changed = changed || normChanged;
    if (changed) {
      try {
        const stored = await prepareListaParaArmazenamento(list);
        if (safeSetComprovantesJson(stored)) {
          _ccLoadAllCache = stored;
          if (leve) agendarPushNuvemAdiado();
          else pushNuvem();
        }
      } catch (e) {
        console.warn("[DK comprovantes] reparar persist", e);
      }
    }
    sincronizarBancoAssinaturas();
    const aguardam = list.filter((r) => r.status === STATUS.IA_OK).length;
    const confirmados = list.filter((r) => r.status === STATUS.CONFIRMADO).length;
    return { ok: true, changed, aguardam, confirmados, total: list.length };
  }

  function loadAll(opts) {
    if (_ccNormalizing) return _ccLoadAllCache || loadAllRaw();
    const leitura = Boolean(opts?.leitura) || isClienteAppContext();
    const forceReload = Boolean(opts?.forceReload);
    if (!forceReload && !leitura && Array.isArray(_ccLoadAllCache)) {
      return _ccLoadAllCache;
    }
    _ccNormalizing = true;
    try {
      const raw = loadAllRaw();
      const { list, changed } = normalizarHistoricoComprovantes(raw, { silencioso: leitura });
      _ccLoadAllCache = list;
      if (changed) {
        void (async () => {
          try {
            const stored = await prepareListaParaArmazenamento(list);
            if (safeSetComprovantesJson(stored)) {
              _ccLoadAllCache = stored;
              if (leitura) agendarPushNuvemAdiado();
              else pushNuvem();
            }
          } catch (e) {
            console.warn("[DK comprovantes] loadAll persist", e);
          }
        })();
      }
      return list;
    } finally {
      _ccNormalizing = false;
    }
  }

  function saveAll(arr) {
    const { list, changed } = normalizarHistoricoComprovantes(arr);
    const final = changed ? list : arr;
    _ccLoadAllCache = final;
    void writeComprovantesLocal(final, { skipNormalize: true }).catch((e) => {
      console.error("[DK comprovantes] saveAll", e);
    });
  }

  async function pushNuvem() {
    if (_ccPushInFlight) return _ccPushInFlight;
    _ccPushInFlight = (async () => {
      try {
        if (typeof window.__DK_pushCloudSnapshotNow === "function") {
          const r = await window.__DK_pushCloudSnapshotNow();
          if (r?.ok) marcarComprovantesSyncNuvemOk(r.updatedAt);
          else {
            try {
              window.dispatchEvent(
                new CustomEvent("dk-comprovantes-sync-nuvem", {
                  detail: { ok: false, error: r?.error || r },
                })
              );
            } catch {
              /* ignore */
            }
          }
          return r;
        }
        if (typeof window.__DK_pushToCloudAfterSave === "function") {
          window.__DK_pushToCloudAfterSave();
        }
        return { ok: false };
      } finally {
        _ccPushInFlight = null;
      }
    })();
    return _ccPushInFlight;
  }

  function newId() {
    return `cc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function getById(id) {
    return loadAll().find((r) => r.id === id) || null;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
      fr.readAsDataURL(file);
    });
  }

  function parseDataUrl(dataUrl) {
    const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return { mime: "application/octet-stream", base64: "" };
    return { mime: m[1], base64: m[2] };
  }

  function fingerprintComprovanteSync(str) {
    let h = 2166136261 >>> 0;
    const s = String(str);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fnv|${(h >>> 0).toString(16)}|${s.length}`;
  }

  async function sha256ComprovantePayload(str) {
    const s = String(str);
    if (!globalThis.crypto?.subtle) return fingerprintComprovanteSync(s);
    try {
      const enc = new TextEncoder().encode(s);
      const max = 9 * 1024 * 1024;
      if (enc.byteLength > max) {
        return fingerprintComprovanteSync(`large|${s.length}|${s.slice(0, 8000)}|${s.slice(-8000)}`);
      }
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return fingerprintComprovanteSync(s);
    }
  }

  async function computeComprovanteFingerprint(arquivoBase64, mimeType) {
    const raw = String(arquivoBase64 || "").trim();
    if (!raw) return "";
    const p = parseDataUrl(raw);
    if (p.base64) return sha256ComprovantePayload(`img|${p.mime || mimeType || "octet"}|${p.base64}`);
    return sha256ComprovantePayload(`raw|${raw}`);
  }

  function loadLocacoesCadastro() {
    if (typeof loadCadastro !== "function") return [];
    const CAD_LOC =
      typeof CAD_LOCACOES_KEY !== "undefined" ? CAD_LOCACOES_KEY : "dk_locacoes_cadastro";
    return loadCadastro(CAD_LOC);
  }

  function sliceComprovantesPreservandoConfirmados(arr) {
    const list = Array.isArray(arr) ? arr : [];
    const confirmados = list.filter((r) => r.status === STATUS.CONFIRMADO);
    const rest = list.filter((r) => r.status !== STATUS.CONFIRMADO);
    return [...confirmados, ...rest].slice(0, STORAGE_MAX_COMPROVANTES);
  }

  /** Índice de pagamentos já lançados no protocolo (fonte do relatório «validados»). */
  function indicePagamentosProtocoloPorComprovante() {
    const porId = new Map();
    const porFp = new Map();
    for (const loc of loadLocacoesCadastro()) {
      const push = (p) => {
        if (!p || typeof p !== "object" || !p.confirmadoViaAppCliente) return;
        const oid = String(p.origemComprovanteClienteId || "").trim();
        if (oid && !porId.has(oid)) porId.set(oid, p);
        const fp = String(p.comprovanteFp || "").trim();
        if (fp && !porFp.has(fp)) porFp.set(fp, p);
      };
      (loc.portalLancamentosAluguel || []).forEach(push);
      (loc.portalMultasTransito || []).forEach(push);
      (loc.portalManutencoesRegistro || []).forEach(push);
    }
    return { porId, porFp };
  }

  function comprovanteRegistadoNoProtocolo(rec, idx) {
    if (!rec) return null;
    const id = String(rec.id || "").trim();
    if (id && idx.porId.has(id)) return idx.porId.get(id);
    const fp = String(rec.comprovanteFp || "").trim();
    if (fp && idx.porFp.has(fp)) return idx.porFp.get(fp);
    return null;
  }

  function alinharComprovanteConfirmadoComProtocolo(rec, pag) {
    const valorPag = roundCentavos(pag?.valor ?? rec.valorRegistadoProtocolo ?? rec.valor);
    return {
      ...rec,
      status: STATUS.CONFIRMADO,
      confirmadoEm:
        rec.confirmadoEm || pag?.comprovanteClienteConfirmadoEm || new Date().toISOString(),
      confirmadoPorNome:
        String(rec.confirmadoPorNome || pag?.comprovanteValidadoPorNome || pag?.registradoPorNome || "").trim() ||
        rec.confirmadoPorNome,
      confirmadoPorCpf:
        String(rec.confirmadoPorCpf || pag?.comprovanteValidadoPorCpf || pag?.registradoPorCpf || "").trim() ||
        rec.confirmadoPorCpf,
      valorRegistadoProtocolo: valorPag,
      rejeitadoMotivoCliente: "",
      rejeitadoMotivo: "",
      reabertoParaOperadorEm: "",
      sincronizadoComProtocoloEm: new Date().toISOString(),
    };
  }

  function comprovanteElegivelFilaOperador(rec, idxPag) {
    if (!rec || rec.status !== STATUS.IA_OK) return false;
    if (rec.rejeitadoAutomatico === false && String(rec.rejeitadoEm || "").trim()) return false;
    if (comprovanteRegistadoNoProtocolo(rec, idxPag)) return false;
    return true;
  }

  function pagamentosProtocoloComComprovante(cpf, proto) {
    const cpfDig = onlyDigits(cpf).slice(0, 11);
    const nc = normProto(proto);
    const loc = loadLocacoesCadastro().find(
      (l) => onlyDigits(l.cpf) === cpfDig && normProto(l.numeroContrato) === nc
    );
    if (!loc) return [];
    const rows = [];
    const pushArr = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((p) => {
        if (!p || typeof p !== "object") return;
        rows.push(p);
      });
    };
    pushArr(loc.portalLancamentosAluguel);
    pushArr(loc.lancamentosAluguel);
    pushArr(loc.lancamentos);
    return rows;
  }

  function normDataPagamentoBr(s) {
    const raw = String(s || "").trim();
    const d = parseBrDate(raw);
    if (!d || Number.isNaN(d.getTime())) return raw;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function formatIsoPt(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR");
    } catch {
      return String(iso);
    }
  }

  function roundCentavos(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100 + Number.EPSILON) / 100;
  }

  /** ID Pix (E2E), autenticação ou código único do comprovante. */
  function normIdTransacao(raw) {
    const s0 = String(raw ?? "").trim();
    if (!s0) return "";
    const e2e = s0.match(/\b(E[0-9A-Z]{31,35})\b/i);
    if (e2e) return e2e[1].toUpperCase();
    const cleaned = s0.replace(/\s+/g, "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (cleaned.length >= 10 && cleaned.length <= 64) return cleaned;
    return "";
  }

  function idTransacaoDoRec(r) {
    if (!r || typeof r !== "object") return "";
    const ia = r.iaValidacao;
    return normIdTransacao(r.idTransacao || ia?.idTransacao || "");
  }

  function idTransacaoDoPagamento(p) {
    if (!p || typeof p !== "object") return "";
    return normIdTransacao(p.idTransacaoComprovante || p.idTransacao || p.comprovanteIdTransacao || "");
  }

  function pad2(n) {
    return String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, "0");
  }

  /** Data + hora (do comprovante ou envio) para comparar duplicata. */
  function normInstantePagamento(enviadoEm, dataBr, horaBr) {
    const data = normDataPagamentoBr(dataBr);
    const hora = String(horaBr || "").trim();
    if (data && hora) {
      const m = hora.match(/(\d{1,2})[:h](\d{2})(?:[:h](\d{2}))?/i);
      if (m) {
        return `${data} ${pad2(m[1])}:${pad2(m[2])}:${pad2(m[3] || 0)}`;
      }
    }
    if (enviadoEm) {
      try {
        const d = new Date(enviadoEm);
        if (!Number.isNaN(d.getTime())) {
          return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
        }
      } catch {
        /* ignore */
      }
    }
    return "";
  }

  function buildAssinaturaDup(source) {
    const s = source || {};
    return {
      protocolo: normProto(s.protocolo),
      data: normDataPagamentoBr(s.dataPagamento),
      hora: normInstantePagamento(s.enviadoEm, s.dataPagamento, s.horaPagamento),
      valor: roundCentavos(s.valor),
      idTransacao: normIdTransacao(s.idTransacao),
    };
  }

  /** Assinatura só com dados lidos na imagem do comprovante (nunca o que o cliente digitou). */
  function assinaturaDupDoComprovanteIa(ia, protocolo) {
    if (!ia || typeof ia !== "object") return null;
    const data = normDataPagamentoBr(ia.dataPagamento);
    const hora = String(ia.horaPagamento || "").trim();
    const valor = roundCentavos(ia.valor);
    const idTransacao = normIdTransacao(ia.idTransacao);
    if (!data || !hora || !idTransacao || !Number.isFinite(valor) || valor <= 0) return null;
    return buildAssinaturaDup({
      protocolo,
      dataPagamento: data,
      horaPagamento: hora,
      enviadoEm: null,
      valor,
      idTransacao,
    });
  }

  function assinaturaDupDeRec(r) {
    if (!r) return null;
    const ia = r.iaValidacao;
    if (ia?.dataPagamento && ia?.horaPagamento && ia?.idTransacao) {
      return assinaturaDupDoComprovanteIa(ia, r.protocolo);
    }
    const horaLida = String(r.horaPagamentoLida || "").trim();
    const id = idTransacaoDoRec(r);
    const valor = ia && Number.isFinite(Number(ia.valor)) && ia.valor > 0 ? ia.valor : null;
    if (!horaLida || !id || valor == null) return null;
    return assinaturaDupDoComprovanteIa(
      {
        dataPagamento: ia?.dataPagamento || r.dataPagamento,
        horaPagamento: horaLida,
        valor,
        idTransacao: id,
      },
      r.protocolo
    );
  }

  function assinaturaDupDePagamento(p, proto) {
    const horaP = String(p?.horaPagamentoComprovante || "").trim();
    const data = normDataPagamentoBr(p?.data);
    const valor = roundCentavos(parseCurrencyBR(p?.valor));
    const id = idTransacaoDoPagamento(p);
    if (!horaP || !data || !id || !Number.isFinite(valor) || valor <= 0) return null;
    return buildAssinaturaDup({
      protocolo: proto,
      dataPagamento: data,
      horaPagamento: horaP,
      enviadoEm: null,
      valor,
      idTransacao: id,
    });
  }

  /** Duplicata só se protocolo, data, hora, valor (centavo) e ID transação forem todos iguais. */
  function assinaturasPagamentoIguais(a, b) {
    if (!a?.protocolo || !b?.protocolo || a.protocolo !== b.protocolo) return false;
    if (!a.data || !b.data || a.data !== b.data) return false;
    if (!a.hora || !b.hora || a.hora !== b.hora) return false;
    if (!valoresIguaisCentavos(a.valor, b.valor)) return false;
    if (!a.idTransacao || !b.idTransacao || a.idTransacao !== b.idTransacao) return false;
    return true;
  }

  function textoAssinaturaDup(sig) {
    if (!sig?.protocolo) return "";
    const horaTxt = sig.hora ? sig.hora.replace(/^\d{2}\/\d{2}\/\d{4}\s/, "") : "—";
    return `protocolo ${sig.protocolo} | data ${sig.data || "—"} | hora ${horaTxt} | ${currencyBRL(sig.valor)} | ID ${sig.idTransacao || "—"}`;
  }

  /** Chave única no banco: protocolo + data + hora + valor + ID (todos lidos na imagem). */
  function chaveBancoAssinatura(sig) {
    if (!sig?.protocolo || !sig.data || !sig.hora || !sig.idTransacao) return "";
    if (!Number.isFinite(sig.valor) || sig.valor <= 0) return "";
    return `${sig.protocolo}|${sig.data}|${sig.hora}|${sig.valor.toFixed(2)}|${sig.idTransacao}`;
  }

  function loadBancoAssinaturasRaw() {
    try {
      const raw = localStorage.getItem(BANCO_ASSINATURAS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveBancoAssinaturasRaw(arr) {
    try {
      localStorage.setItem(BANCO_ASSINATURAS_KEY, JSON.stringify(Array.isArray(arr) ? arr.slice(0, 2000) : []));
    } catch {
      /* ignore */
    }
  }

  function pagamentosDoProtocoloGlobal(proto) {
    const nc = normProto(proto);
    if (!nc) return [];
    const rows = [];
    const pushArr = (arr, loc) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((p) => {
        if (!p || typeof p !== "object") return;
        if (!p.confirmadoViaAppCliente && !p.origemComprovanteClienteId && !p.idTransacaoComprovante) return;
        rows.push({ pagamento: p, protocolo: nc, cpfLocacao: onlyDigits(loc.cpf).slice(0, 11) });
      });
    };
    for (const loc of loadLocacoesCadastro()) {
      if (normProto(loc.numeroContrato) !== nc) continue;
      pushArr(loc.portalLancamentosAluguel, loc);
      pushArr(loc.portalMultasTransito, loc);
      pushArr(loc.portalManutencoesRegistro, loc);
    }
    return rows;
  }

  function coletarEntradasBancoAssinaturas() {
    const porChave = new Map();
    const add = (chave, meta) => {
      if (!chave) return;
      if (!porChave.has(chave)) porChave.set(chave, meta);
    };

    for (const r of loadAllRaw()) {
      if (r.status === STATUS.REJEITADO) continue;
      const sig = assinaturaDupDeRec(r);
      const chave = chaveBancoAssinatura(sig);
      if (!chave) continue;
      if (r.status !== STATUS.CONFIRMADO && r.status !== STATUS.IA_OK) continue;
      add(chave, {
        chave,
        protocolo: sig.protocolo,
        cpf: onlyDigits(r.cpf).slice(0, 11),
        comprovanteId: String(r.id || "").trim(),
        status: r.status,
        enviadoEm: r.enviadoEm || "",
        fonte: "comprovante",
      });
    }

    for (const loc of loadLocacoesCadastro()) {
      const nc = normProto(loc.numeroContrato);
      const cpfLoc = onlyDigits(loc.cpf).slice(0, 11);
      const scan = (arr) => {
        if (!Array.isArray(arr)) return;
        for (const p of arr) {
          const sig = assinaturaDupDePagamento(p, nc);
          const chave = chaveBancoAssinatura(sig);
          if (!chave) continue;
          add(chave, {
            chave,
            protocolo: nc,
            cpf: cpfLoc,
            comprovanteId: String(p.origemComprovanteClienteId || "").trim(),
            status: "pagamento_protocolo",
            enviadoEm: p.comprovanteClienteEnviadoEm || "",
            fonte: "pagamento",
          });
        }
      };
      scan(loc.portalLancamentosAluguel);
      scan(loc.portalMultasTransito);
      scan(loc.portalManutencoesRegistro);
    }

    return Array.from(porChave.values());
  }

  function sincronizarBancoAssinaturas() {
    const entradas = coletarEntradasBancoAssinaturas();
    saveBancoAssinaturasRaw(entradas);
    return entradas;
  }

  function indiceBancoAssinaturas() {
    const entradas = coletarEntradasBancoAssinaturas();
    const porChave = new Map();
    for (const e of entradas) {
      if (!e.chave) continue;
      if (!porChave.has(e.chave)) porChave.set(e.chave, []);
      porChave.get(e.chave).push(e);
    }
    return porChave;
  }

  function chavePagamentoLogica(cpf, proto, dataBr, valor, idTx, horaPagamento, enviadoEm) {
    const sig = buildAssinaturaDup({
      protocolo: proto,
      dataPagamento: dataBr,
      horaPagamento,
      enviadoEm,
      valor,
      idTransacao: idTx,
    });
    return `${onlyDigits(cpf).slice(0, 11)}|${sig.protocolo}|${sig.data}|${sig.hora}|${Number.isFinite(sig.valor) ? sig.valor.toFixed(2) : ""}|${sig.idTransacao}`;
  }

  /** Histórico de comprovantes/pagamentos já tratados neste CPF+protocolo (protocolo anti-duplicata). */
  function buildHistoricoAntiDuplicataTexto(cpf, proto, excludeId) {
    const cpfDig = onlyDigits(cpf).slice(0, 11);
    const nc = normProto(proto);
    const linhas = [];
    for (const r of loadAll()) {
      if (excludeId && r.id === excludeId) continue;
      if (onlyDigits(r.cpf) !== cpfDig || normProto(r.protocolo) !== nc) continue;
      if (r.status === STATUS.REJEITADO) continue;
      if (r.status === STATUS.CONFIRMADO || r.status === STATUS.IA_OK) {
        const sig = assinaturaDupDeRec(r);
        linhas.push(
          `- ${textoAssinaturaDup(sig)} | ${statusLabel(r.status)}${r.confirmadoEm ? ` | confirmação ${formatIsoPt(r.confirmadoEm)}` : ""}`
        );
      }
    }
    for (const p of pagamentosProtocoloComComprovante(cpfDig, nc)) {
      const oid = String(p.origemComprovanteClienteId || "").trim();
      if (excludeId && oid === excludeId) continue;
      const sig = assinaturaDupDePagamento(p, nc);
      linhas.push(`- ${textoAssinaturaDup(sig)} | pagamento registado no protocolo`);
    }
    return linhas.length
      ? linhas.join("\n")
      : "(nenhum pagamento com protocolo+data+hora+valor+ID completo neste contrato)";
  }

  function motivoDuplicataCliente(sig) {
    const horaTxt = sig?.hora ? sig.hora.replace(/^\d{2}\/\d{2}\/\d{4}\s/, "") : "—";
    return `Este comprovante já foi registado (data ${sig?.data || "—"}, hora ${horaTxt}, valor ${currencyBRL(sig?.valor)}, mesma transação). Não envie o mesmo comprovante outra vez.`;
  }

  function compararDuplicataComReferencia(sigNovo, sigRef, refLabel, extra) {
    if (!sigNovo || !sigRef) return null;
    if (!assinaturasPagamentoIguais(sigNovo, sigRef)) return null;
    return {
      duplicado: true,
      reprovar: true,
      motivo: "comprovante_igual_no_sistema",
      msgCliente: motivoDuplicataCliente(sigNovo),
      msg: `Comprovante duplicado (dados do comprovante iguais) ${refLabel}: ${textoAssinaturaDup(sigRef)}.`,
      ...extra,
    };
  }

  /**
   * Duplicata: protocolo + data + hora + valor + ID (lidos na imagem) já existem no banco / histórico.
   */
  function detectarDuplicidadeLogica(opts) {
    const proto = normProto(opts?.protocolo);
    const excludeId = String(opts?.excludeId || "").trim();
    if (!proto) return { duplicado: false };

    const sigNovo = opts.assinaturaComprovante || null;
    if (!sigNovo) return { duplicado: false, incompleto: true };

    const chave = chaveBancoAssinatura(sigNovo);
    if (chave) {
      const idx = indiceBancoAssinaturas();
      const hits = (idx.get(chave) || []).filter(
        (e) => !excludeId || String(e.comprovanteId || "") !== excludeId
      );
      if (hits.length) {
        const ref = hits[0];
        const sigRef = { ...sigNovo };
        return {
          duplicado: true,
          reprovar: true,
          motivo: "comprovante_igual_no_sistema",
          msgCliente: motivoDuplicataCliente(sigNovo),
          msg: `Comprovante duplicado (protocolo+data+hora+valor+ID): ${textoAssinaturaDup(sigRef)} — ${ref.fonte === "pagamento" ? "pagamento no protocolo" : "comprovante " + formatIsoPt(ref.enviadoEm)}.`,
          banco: ref,
        };
      }
    }

    for (const r of loadAll()) {
      if (excludeId && r.id === excludeId) continue;
      if (normProto(r.protocolo) !== proto) continue;
      if (r.status === STATUS.REJEITADO) continue;
      if (r.status !== STATUS.CONFIRMADO && r.status !== STATUS.IA_OK) continue;
      const sigRef = assinaturaDupDeRec(r);
      const hit = compararDuplicataComReferencia(sigNovo, sigRef, `no comprovante ${formatIsoPt(r.enviadoEm)}`, {
        rec: r,
      });
      if (hit) return hit;
    }

    for (const row of pagamentosDoProtocoloGlobal(proto)) {
      const p = row.pagamento;
      const oid = String(p.origemComprovanteClienteId || "").trim();
      if (excludeId && oid === excludeId) continue;
      const sigRef = assinaturaDupDePagamento(p, proto);
      const hit = compararDuplicataComReferencia(
        sigNovo,
        sigRef,
        `no pagamento ${normDataPagamentoBr(p.data)} · ${currencyBRL(p.valor)}`,
        { pagamento: p }
      );
      if (hit) return hit;
    }

    return { duplicado: false };
  }

  function notificarClienteComprovanteRejeitado(rec, mensagemCliente) {
    const msg = String(mensagemCliente || "").trim();
    if (!msg || !rec) return;
    if (typeof window.__DK_clienteNotificacaoComprovanteRejeitado === "function") {
      window.__DK_clienteNotificacaoComprovanteRejeitado({
        cpf: rec.cpf,
        protocolo: rec.protocolo,
        valor: rec.valor,
        dataPagamento: rec.dataPagamento,
        comprovanteId: rec.id,
        mensagem: msg,
      });
    }
  }

  function aplicarRejeicaoComprovanteCliente(id, motivoCliente, operador, iaExtra, opts) {
    const all = loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const msgCliente = String(motivoCliente || "").trim();
    const prevIa = all[idx].iaValidacao && typeof all[idx].iaValidacao === "object" ? all[idx].iaValidacao : {};
    all[idx].status = STATUS.REJEITADO;
    all[idx].rejeitadoMotivoCliente = msgCliente;
    all[idx].rejeitadoMotivo = String(opts?.motivoInterno || msgCliente).trim();
    all[idx].rejeitadoPorCpf = operador?.cpf || "";
    const nomeOp = String(operador?.nome || "").trim();
    all[idx].rejeitadoPorNome =
      nomeOp && operador?.role === "sistema"
        ? nomeOp
        : nomeOp && opts?.manual
          ? nomeOp
          : nomeOp
            ? `${nomeOp} (IA)`
            : "Sistema DK";
    all[idx].rejeitadoEm = new Date().toISOString();
    all[idx].rejeitadoAutomatico = !opts?.manual;
    all[idx].iaValidacao = {
      ...prevIa,
      ...(iaExtra || {}),
      jaProcessado: Boolean(opts?.duplicata),
      observacoes: all[idx].rejeitadoMotivo,
    };
    all[idx].reabertoParaOperadorEm = "";
    saveAll(all);
    if (typeof window.__DK_markLocalDataAuthority === "function") {
      window.__DK_markLocalDataAuthority(15 * 60 * 1000);
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      void window.__DK_pushCloudSnapshotNow();
    }
    notificarClienteComprovanteRejeitado(all[idx], msgCliente);
    return all[idx];
  }

  const MSG_DUP_IMAGEM_CLIENTE =
    "Esta imagem de comprovante já foi enviada ao sistema. Envie outra captura ou comprovante diferente.";

  /** Duplicata = mesma imagem/ficheiro (hash) já existente no sistema — não compara data/hora/ID. */
  function detectarImagemComprovanteDuplicada(fp, excludeId, opts) {
    const hash = String(fp || "").trim();
    if (!hash) return { duplicado: false, semFingerprint: true };
    const paraEnvio = Boolean(opts?.paraEnvio);

    for (const r of loadAllRaw()) {
      if (excludeId && r.id === excludeId) continue;
      if (!paraEnvio && r.status === STATUS.REJEITADO) continue;
      if (paraEnvio && r.status === STATUS.REJEITADO) {
        const mot = String(r.rejeitadoMotivo || r.rejeitadoMotivoCliente || "").toLowerCase();
        if (mot.includes("mesma imagem")) continue;
      }
      if (String(r.comprovanteFp || "") !== hash) continue;
      const st = statusLabel(r.status);
      return {
        duplicado: true,
        reprovar: true,
        msgCliente: MSG_DUP_IMAGEM_CLIENTE,
        msg: `Comprovante duplicado — mesma imagem já enviada em ${formatIsoPt(r.enviadoEm)} (${st}).`,
        rec: r,
        motivo: "mesma_imagem",
      };
    }

    for (const loc of loadLocacoesCadastro()) {
      for (const p of loc.portalLancamentosAluguel || []) {
        if (String(p.comprovanteFp || "") !== hash) continue;
        const oid = String(p.origemComprovanteClienteId || "").trim();
        if (excludeId && oid === excludeId) continue;
        return {
          duplicado: true,
          reprovar: true,
          msgCliente: MSG_DUP_IMAGEM_CLIENTE,
          msg: `Mesma imagem já registada como pagamento (${String(p.data || "")} · ${currencyBRL(p.valor)} · protocolo ${normProto(loc.numeroContrato)}).`,
          motivo: "mesma_imagem_pagamento",
          pagamento: p,
        };
      }
    }

    return { duplicado: false };
  }

  async function detectarComprovanteDuplicado(opts) {
    const excludeId = String(opts?.excludeId || "").trim();
    let fp = String(opts?.comprovanteFp || "").trim();
    if (!fp && opts?.arquivoBase64) {
      fp = await computeComprovanteFingerprint(opts.arquivoBase64, opts?.mimeType);
    }
    if (!fp && opts?.file) {
      const dataUrl = await fileToBase64(opts.file);
      fp = await computeComprovanteFingerprint(dataUrl, opts.file.type);
    }
    return detectarImagemComprovanteDuplicada(fp, excludeId, opts);
  }

  async function adicionarComprovanteCliente(payload) {
    const cpf = onlyDigits(payload.cpf).slice(0, 11);
    const proto = normProto(payload.protocolo);
    const valor = roundCentavos(
      typeof payload.valor === "number" && Number.isFinite(payload.valor)
        ? payload.valor
        : parseCurrencyBR(payload.valor)
    );
    const data = String(payload.dataPagamento || "").trim();
    if (cpf.length !== 11 || !proto || !Number.isFinite(valor) || valor <= 0 || !parseBrDate(data)) {
      return { ok: false, msg: "Dados inválidos (CPF, protocolo, data ou valor)." };
    }
    let arquivoBase64 = "";
    let mimeType = String(payload.mimeType || "").trim();
    if (payload.arquivoBase64) {
      arquivoBase64 = String(payload.arquivoBase64);
    } else if (payload.file) {
      const dataUrl = await fileToBase64(payload.file);
      const p = parseDataUrl(dataUrl);
      arquivoBase64 = dataUrl;
      mimeType = p.mime || payload.file.type || mimeType;
    }
    if (!arquivoBase64) return { ok: false, msg: "Anexe o comprovante (imagem ou PDF)." };

    try {
      arquivoBase64 = await comprimirComprovanteDataUrl(arquivoBase64, mimeType);
      const pComp = parseDataUrl(arquivoBase64);
      if (pComp.mime) mimeType = pComp.mime;
    } catch {
      /* mantém original */
    }

    const comprovanteFp = await computeComprovanteFingerprint(arquivoBase64, mimeType);

    const idxPagEntrada = indicePagamentosProtocoloPorComprovante();
    const dupEntrada = await detectarComprovanteDuplicado({
      comprovanteFp,
      arquivoBase64,
      mimeType,
      paraEnvio: true,
    });
    if (dupEntrada.duplicado && dupEntrada.reprovar) {
      return {
        ok: false,
        duplicata: true,
        msg: dupEntrada.msgCliente || MSG_DUP_IMAGEM_CLIENTE,
      };
    }
    if (comprovanteFp && idxPagEntrada.porFp.has(comprovanteFp)) {
      return {
        ok: false,
        duplicata: true,
        msg: MSG_DUP_IMAGEM_CLIENTE,
      };
    }

    const recId = newId();
    ccArquivoMemoria.set(recId, arquivoBase64);
    await salvarArquivoComprovanteIdb(recId, arquivoBase64, mimeType);

    const rec = {
      id: recId,
      status: STATUS.PENDENTE,
      cpf,
      nomeCliente: String(payload.nomeCliente || "").trim(),
      protocolo: proto,
      dataPagamento: data,
      valor,
      nomeArquivo: String(payload.nomeArquivo || "comprovante"),
      mimeType,
      comprovanteFp,
      arquivoArmazenado: "idb",
      enviadoEm: new Date().toISOString(),
      iaValidacao: null,
      confirmadoPorCpf: "",
      confirmadoPorNome: "",
      confirmadoEm: "",
      origem: "app_cliente",
      syncNuvem: "pendente",
      syncNuvemEm: null,
    };
    const all = loadAll();
    all.unshift(rec);
    try {
      await writeComprovantesLocal(all);
    } catch (e) {
      if (isStorageQuotaError(e) || String(e?.message || e) === "quota_excedida") {
        return {
          ok: false,
          msg: "Memória do telemóvel cheia. Feche outros separadores, limpe dados do site DK no browser ou peça à DK para arquivar comprovantes antigos.",
        };
      }
      return { ok: false, msg: e?.message || "Não foi possível guardar no telemóvel." };
    }
    void processarComprovanteAutomatico(rec.id);
    return { ok: true, id: rec.id, rec: { ...rec, arquivoBase64 } };
  }

  function listarPorStatus(statusFilter) {
    const all = loadAll();
    if (!statusFilter) return all.filter((r) => r.status !== STATUS.REJEITADO);
    return all.filter((r) => r.status === statusFilter);
  }

  /** Aguardam confirmação manual do operador (passaram na IA automática). */
  function listarAguardandoConfirmacaoOperador() {
    const idxPag = indicePagamentosProtocoloPorComprovante();
    return loadAll()
      .filter((r) => comprovanteElegivelFilaOperador(r, idxPag))
      .sort((a, b) => {
        if (a.reabertoParaOperadorEm && !b.reabertoParaOperadorEm) return -1;
        if (b.reabertoParaOperadorEm && !a.reabertoParaOperadorEm) return 1;
        return Date.parse(b.enviadoEm || 0) - Date.parse(a.enviadoEm || 0);
      });
  }

  function listarPendentesOperador() {
    return listarAguardandoConfirmacaoOperador();
  }

  function listarRecusadosUltimas72h() {
    const limite = Date.now() - HORAS_RECUSADOS_OPERADOR * 60 * 60 * 1000;
    return loadAll()
      .filter((r) => {
        if (r.status !== STATUS.REJEITADO) return false;
        const t = Date.parse(r.rejeitadoEm || r.enviadoEm || 0);
        return t >= limite;
      })
      .sort((a, b) => Date.parse(b.rejeitadoEm || 0) - Date.parse(a.rejeitadoEm || 0));
  }

  function contarPendentesAutoProcessamento() {
    return loadAll().filter((r) => r.status === STATUS.PENDENTE && !r.autoProcessadoEm).length;
  }

  function listarPorCliente(cpfDigits) {
    const cpf = onlyDigits(cpfDigits).slice(0, 11);
    return loadAll({ leitura: true }).filter((r) => onlyDigits(r.cpf) === cpf);
  }

  function invalidateComprovantesCache() {
    _ccLoadAllCache = null;
  }

  /** Cliente reconhece recusa da DK — deixa de aparecer na lista de pagamentos do app. */
  function marcarClienteDeAcordoComRecusa(id) {
    const rid = String(id || "").trim();
    if (!rid) return { ok: false, msg: "Registo inválido." };
    const all = loadAll();
    const idx = all.findIndex((r) => r.id === rid);
    if (idx < 0) return { ok: false, msg: "Comprovante não encontrado." };
    const rec = all[idx];
    if (rec.status !== STATUS.REJEITADO) {
      return { ok: false, msg: "Apenas comprovantes recusados podem ser marcados como de acordo." };
    }
    if (rec.clienteDeAcordoEm) return { ok: true, msg: "Já registado." };
    all[idx] = { ...rec, clienteDeAcordoEm: new Date().toISOString() };
    saveAll(all);
    return { ok: true };
  }

  function getStoredOpenAIKey() {
    return String(localStorage.getItem(OPENAI_KEY_STORAGE) || "").trim();
  }

  let openaiServerDisponivel = null;

  async function probeOpenAIServer() {
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true }),
      });
      const data = await res.json();
      openaiServerDisponivel = Boolean(data?.ok && data?.mode === "server");
      return openaiServerDisponivel;
    } catch {
      openaiServerDisponivel = false;
      return false;
    }
  }

  async function refreshOpenAIStatusUi() {
    const el = document.getElementById("portalComprovanteOpenAIStatus");
    if (!el) return;
    el.textContent = "A verificar configuração da IA…";
    const server = await probeOpenAIServer();
    const local = getStoredOpenAIKey();
    if (server) {
      el.innerHTML =
        "✓ <strong>IA automática</strong> — chave no servidor (Vercel). Pode usar <strong>Conferir comprovante (IA)</strong>.";
      return;
    }
    if (local) {
      el.textContent =
        "✓ Chave guardada neste navegador. Pode usar Conferir comprovante (IA). (Para todos os PCs: configure OPENAI_API_KEY na Vercel.)";
      return;
    }
    el.innerHTML =
      'IA ainda não configurada. Na <strong>Vercel</strong> → Environment Variables → <code>OPENAI_API_KEY</code> → <strong>Redeploy</strong>. Ou expanda «Chave OpenAI só neste navegador» abaixo.';
  }

  function bindOpenAIKeyUi() {
    const saveBtn = document.getElementById("portalComprovanteOpenAIKeySave");
    const clearBtn = document.getElementById("portalComprovanteOpenAIKeyClear");
    const input = document.getElementById("portalComprovanteOpenAIKey");
    if (!saveBtn || saveBtn.dataset.bound === "1") return;
    saveBtn.dataset.bound = "1";

    saveBtn.addEventListener("click", () => {
      const k = String(input?.value || "").trim();
      if (!k) {
        refreshOpenAIStatusUi();
        return;
      }
      localStorage.setItem(OPENAI_KEY_STORAGE, k);
      if (input) input.value = "";
      refreshOpenAIStatusUi();
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      if (fb) fb.textContent = "Chave OpenAI guardada neste navegador.";
    });

    clearBtn?.addEventListener("click", () => {
      localStorage.removeItem(OPENAI_KEY_STORAGE);
      if (input) input.value = "";
      refreshOpenAIStatusUi();
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      if (fb) fb.textContent = "Chave removida deste navegador.";
    });
  }

  async function chamarOpenAIComprovante(content) {
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.parsed) {
        return { ok: true, parsed: data.parsed, via: "server" };
      }
      if (data?.reason !== "openai_not_configured" && !res.ok) {
        const errMsg = String(data?.error || data?.reason || res.status);
        return { ok: false, msg: `Servidor IA: ${errMsg}` };
      }
    } catch (err) {
      /* tenta chave local */
    }

    const key = getStoredOpenAIKey();
    if (!key) {
      return {
        ok: false,
        msg: "IA não configurada. Defina OPENAI_API_KEY na Vercel (redeploy) ou guarde a chave no bloco «Chave OpenAI só neste navegador».",
      };
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
          max_tokens: 900,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 200) || String(res.status));
      }
      const data = await res.json();
      let raw = String(data.choices?.[0]?.message?.content || "").trim();
      const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
      if (fence) raw = fence[1].trim();
      return { ok: true, parsed: JSON.parse(raw), via: "browser" };
    } catch (err) {
      return { ok: false, msg: err?.message || "Falha na chamada OpenAI." };
    }
  }

  function exigirOperadorConferencia() {
    if (typeof window.__DK_portalOperadorPodeConferirComprovanteCliente === "function") {
      return window.__DK_portalOperadorPodeConferirComprovanteCliente();
    }
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) {
        return {
          ok: false,
          msg: "Inicie sessão na Área da Empresa com colaborador ou administrador cadastrado.",
        };
      }
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin") {
        return { ok: false, msg: "A conferência só pode ser feita por funcionário com sessão ativa." };
      }
      const cpf = onlyDigits(s.cpf).slice(0, 11);
      const nome = String(s.nome || "").trim();
      if (cpf.length !== 11 || !nome) {
        return { ok: false, msg: "Sessão do operador inválida. Entre novamente." };
      }
      return { ok: true, operador: { cpf, nome, role: String(s.role || "operacao").trim() } };
    } catch {
      return { ok: false, msg: "Sessão não encontrada." };
    }
  }

  function valoresProximos(a, b, tol = 0.02) {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return Math.abs(x - y) <= Math.max(tol, y * 0.01);
  }

  /** IA às vezes devolve 9 em vez de 0.09 quando o pagamento é em centavos. */
  function normalizarValorLidoIa(valorIa, valorDeclarado) {
    const ia = roundCentavos(parseCurrencyBR(valorIa));
    const decl = roundCentavos(valorDeclarado);
    if (!(ia > 0) || !(decl > 0)) return ia;
    if (valoresIguaisCentavos(ia, decl)) return ia;
    if (decl < 1 && ia >= 1 && valoresIguaisCentavos(ia / 100, decl)) {
      return roundCentavos(ia / 100);
    }
    return ia;
  }

  /** Duplicata de pagamento: valor tem de ser igual ao centavo (0,05 ≠ 0,06). */
  function valoresIguaisCentavos(a, b) {
    const x = roundCentavos(a);
    const y = roundCentavos(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return x === y;
  }

  function valorIaBrutoRec(rec) {
    const ia = rec?.iaValidacao;
    if (!ia) return 0;
    return roundCentavos(parseCurrencyBR(ia.valorBruto ?? ia.valor));
  }

  function valorIaEfetivoRec(rec) {
    const ia = rec?.iaValidacao;
    if (!ia) return 0;
    return normalizarValorLidoIa(ia.valor, rec.valor);
  }

  function valorInformadoDivergeDaIA(rec) {
    const ia = rec?.iaValidacao;
    if (!ia) return false;
    if (ia.confereValor === false) return true;
    const decl = roundCentavos(rec.valor);
    const norm = valorIaEfetivoRec(rec);
    const raw = valorIaBrutoRec(rec);
    return !(
      valoresIguaisCentavos(norm, decl) ||
      valoresIguaisCentavos(raw, decl)
    );
  }

  function operadorEhAdministradorTitular() {
    return (
      typeof window.__DK_isPortalTitularAdministrador === "function" &&
      window.__DK_isPortalTitularAdministrador()
    );
  }

  function validarSenhaAdministradorPortal(senha) {
    if (typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess)) {
      return false;
    }
    const s = String(senha || "").trim();
    if (!s) return false;
    return funcionariosAccess.some(
      (f) => String(f.role || "").trim() === "owner" && String(f.senha || "").trim() === s
    );
  }

  function autorizarConfirmacaoComDivergencia(rec, adminSenha) {
    if (!valorInformadoDivergeDaIA(rec)) return { ok: true };
    if (operadorEhAdministradorTitular()) return { ok: true };
    if (validarSenhaAdministradorPortal(adminSenha)) return { ok: true };
    return {
      ok: false,
      msg: "Valor do cliente difere do comprovante (IA). Informe a senha do administrador para registar o pagamento com o valor lido na imagem.",
    };
  }

  /** Valor que entra no protocolo: se divergiu e foi autorizado, usa o lido na imagem (valor bruto IA). */
  function valorParaRegistoPagamento(rec) {
    const ia = rec?.iaValidacao;
    if (!valorInformadoDivergeDaIA(rec) || !ia) return Number(rec.valor);
    const raw = valorIaBrutoRec(rec);
    if (raw > 0) return raw;
    const norm = valorIaEfetivoRec(rec);
    if (norm > 0) return norm;
    return Number(rec.valor);
  }

  async function processarComprovanteAutomatico(id) {
    const rid = String(id || "").trim();
    if (!rid) return { ok: false, msg: "ID inválido." };
    const rec = getById(rid);
    if (!rec || rec.status !== STATUS.PENDENTE) return { ok: false, skipped: true };
    if (rec.autoProcessadoEm) return { ok: false, skipped: true };

    const res = await validarComprovanteComIA(rid, { automatico: true });
    const concluiu = Boolean(res.ok || res.rejeitado);
    if (concluiu) {
      const all = loadAll();
      const idx = all.findIndex((r) => r.id === rid);
      if (idx >= 0) {
        all[idx].autoProcessadoEm = new Date().toISOString();
        saveAll(all);
      }
      if (typeof window.__DK_pushToCloudAfterSave === "function") {
        window.__DK_pushToCloudAfterSave();
      }
    }
    return res;
  }

  async function processarFilaComprovantesAutomaticos() {
    if (filaAutoEmCurso) return { ok: true, emCurso: true };
    filaAutoEmCurso = true;
    try {
      const ids = loadAll()
        .filter((r) => r.status === STATUS.PENDENTE && !r.autoProcessadoEm)
        .map((r) => r.id);
      for (const id of ids) {
        await processarComprovanteAutomatico(id);
      }
      return { ok: true, processados: ids.length };
    } finally {
      filaAutoEmCurso = false;
    }
  }

  function refreshAdminSenhaUi(rec) {
    const wrap = document.getElementById("portalComprovanteAdminSenhaWrap");
    const inp = document.getElementById("portalComprovanteAdminSenha");
    const diverge = valorInformadoDivergeDaIA(rec);
    if (wrap) wrap.classList.toggle("hidden", !diverge);
    if (inp) {
      if (!diverge) inp.value = "";
      inp.required = diverge && !operadorEhAdministradorTitular();
    }
  }

  async function validarComprovanteComIA(id, opts) {
    const automatico = Boolean(opts?.automatico);
    const gate = automatico
      ? { ok: true, operador: OPERADOR_AUTO }
      : exigirOperadorConferencia();
    if (!gate.ok) return { ok: false, msg: gate.msg };
    const operador = gate.operador;

    const rec = await getByIdComArquivo(id);
    if (!rec) return { ok: false, msg: "Registo não encontrado." };
    const idxPag = indicePagamentosProtocoloPorComprovante();
    const pagProto = comprovanteRegistadoNoProtocolo(rec, idxPag);
    if (pagProto) {
      const all = loadAll();
      const iSync = all.findIndex((r) => r.id === id);
      if (iSync >= 0) {
        all[iSync] = alinharComprovanteConfirmadoComProtocolo(all[iSync], pagProto);
        saveAll(all);
      }
      return {
        ok: false,
        skipped: true,
        msg: "Pagamento já registado no protocolo (relatório). Comprovante alinhado — não fica na fila do operador.",
      };
    }
    if (rec.status === STATUS.CONFIRMADO) {
      return { ok: false, msg: "Pagamento já confirmado." };
    }
    if (rec.status === STATUS.REJEITADO) {
      return { ok: false, msg: "Comprovante já recusado." };
    }
    if (!automatico && rec.status !== STATUS.PENDENTE && rec.status !== STATUS.IA_OK) {
      return { ok: false, msg: "Estado inválido para conferência." };
    }
    if (automatico && rec.status !== STATUS.PENDENTE) {
      return { ok: false, skipped: true, msg: "Já processado automaticamente." };
    }
    if (!rec.comprovanteFp && rec.arquivoBase64) {
      rec.comprovanteFp = await computeComprovanteFingerprint(rec.arquivoBase64, rec.mimeType);
      const all0 = loadAll();
      const i0 = all0.findIndex((r) => r.id === id);
      if (i0 >= 0) {
        all0[i0].comprovanteFp = rec.comprovanteFp;
        saveAll(all0);
      }
    }

    const dupAntesIa = await detectarComprovanteDuplicado({
      comprovanteFp: rec.comprovanteFp,
      arquivoBase64: rec.arquivoBase64,
      mimeType: rec.mimeType,
      excludeId: rec.id,
      paraEnvio: false,
    });
    if (dupAntesIa.duplicado && dupAntesIa.reprovar) {
      const msgCliente = dupAntesIa.msgCliente || MSG_DUP_IMAGEM_CLIENTE;
      const rej = aplicarRejeicaoComprovanteCliente(id, msgCliente, operador, rec.iaValidacao, {
        motivoInterno: dupAntesIa.msg,
        duplicata: true,
      });
      return {
        ok: false,
        duplicata: true,
        rejeitado: true,
        msg: msgCliente,
        ia: rej?.iaValidacao,
        rec: rej,
      };
    }

    const schema =
      '{"nomeClienteOuBeneficiario":string|null,"nomePagador":string|null,"cpf":string|null,"placaVeiculo":string|null,"dataPagamento":string|null,"horaPagamento":string|null,"valor":number|null,"idTransacao":string|null,"pagamentoPorTerceiro":boolean,"comprovanteAutentico":boolean,"riscoColagemOuEdicao":"baixo"|"medio"|"alto","observacoesAutenticidade":string|null,"duplicataProvavel":boolean}';
    const instr = `Leitor de comprovante PIX/TED/boleto (português). Analise APENAS a imagem. Responda APENAS JSON: ${schema}.

Valor declarado pelo cliente no app (NÃO reinterpretar): ${roundCentavos(rec.valor).toFixed(2)} reais (${currencyBRL(rec.valor)}). Protocolo ${rec.protocolo}.
CRÍTICO centavos: 0.09 = nove centavos; 9.00 = nove reais. Compare a imagem com ${roundCentavos(rec.valor).toFixed(2)}.

LEITURA NA IMAGEM:
- valor: número JSON com 2 decimais (0.09 para nove centavos, NÃO use 9 para 0,09)
- dataPagamento, horaPagamento, idTransacao: copie o que aparecer; null se não existir

AUTENTICIDADE (visual — colagem, edição, fontes, cortes):
- comprovanteAutentico, riscoColagemOuEdicao, observacoesAutenticidade

DUPLICATA: o sistema compara também protocolo+data+hora+valor+ID da imagem com o banco de comprovantes. Sempre duplicataProvavel: false.

O sistema rejeita automaticamente se o valor lido na imagem for diferente do valor declarado (${currencyBRL(rec.valor)}).`;

    const content = [{ type: "text", text: instr }];
    const { mime, base64 } = parseDataUrl(rec.arquivoBase64);
    if (mime.startsWith("image/") && base64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${base64}` },
      });
    } else {
      content.push({
        type: "text",
        text: `Comprovante em PDF (${rec.nomeArquivo}). Valide com os dados declarados: valor ${currencyBRL(rec.valor)}, data ${rec.dataPagamento}, cliente CPF ${rec.cpf}, protocolo ${rec.protocolo}.`,
      });
    }

    try {
      const oai = await chamarOpenAIComprovante(content);
      if (!oai.ok) return { ok: false, msg: oai.msg };
      const extr = oai.parsed;
      const valorIaRaw = roundCentavos(parseCurrencyBR(extr.valor));
      const valorIa = normalizarValorLidoIa(extr.valor, rec.valor);
      const cpfIa = onlyDigits(extr.cpf).slice(0, 11);
      const idTxIa = normIdTransacao(extr.idTransacao);
      const horaIa = String(extr.horaPagamento || "").trim();
      const riscoEd = String(extr.riscoColagemOuEdicao || "baixo").toLowerCase();
      const autentico = extr.comprovanteAutentico !== false && riscoEd !== "alto";
      const ia = {
        validadoEm: new Date().toISOString(),
        nomeClienteOuBeneficiario: String(extr.nomeClienteOuBeneficiario || "").trim(),
        nomePagador: String(extr.nomePagador || "").trim(),
        cpf: cpfIa,
        placaVeiculo: String(extr.placaVeiculo || "").trim(),
        dataPagamento: String(extr.dataPagamento || "").trim(),
        horaPagamento: horaIa,
        valor: valorIa,
        valorBruto: valorIaRaw,
        idTransacao: idTxIa,
        pagamentoPorTerceiro: Boolean(extr.pagamentoPorTerceiro),
        comprovanteAutentico: autentico,
        riscoColagemOuEdicao: riscoEd === "medio" || riscoEd === "alto" ? riscoEd : "baixo",
        observacoesAutenticidade: String(extr.observacoesAutenticidade || "").trim(),
        confereValor:
          valoresIguaisCentavos(valorIa, rec.valor) || valoresIguaisCentavos(valorIaRaw, rec.valor),
        revisaoValorManual:
          !valoresIguaisCentavos(valorIaRaw, rec.valor) &&
          rec.valor < 1 &&
          valorIaRaw >= 1 &&
          valorIaRaw < 100 &&
          valoresIguaisCentavos(valorIaRaw / 100, rec.valor),
        confereData:
          !extr.dataPagamento ||
          String(extr.dataPagamento).trim() === rec.dataPagamento ||
          parseBrDate(extr.dataPagamento)?.getTime() === parseBrDate(rec.dataPagamento)?.getTime(),
        confereCpf: !cpfIa || cpfIa === rec.cpf,
        observacoes: "",
      };
      if (!ia.confereValor) {
        ia.observacoes += `Valor do comprovante (${currencyBRL(valorIa)}) difere do informado (${currencyBRL(rec.valor)}). `;
      }
      if (!ia.confereData) ia.observacoes += "Data difere. ";
      if (!ia.confereCpf) ia.observacoes += "CPF no comprovante difere. ";
      if (!idTxIa) ia.observacoes += "ID da transação não identificado na imagem. ";
      if (!horaIa) ia.observacoes += "Hora do pagamento não identificada na imagem. ";
      if (!autentico || riscoEd === "alto") {
        ia.observacoes += `Risco de colagem/edição: ${riscoEd}. ${ia.observacoesAutenticidade} `;
      } else if (riscoEd === "medio") {
        ia.observacoes += `Rever autenticidade do comprovante (${ia.observacoesAutenticidade || "sinais moderados"}). `;
      }

      if (!(valorIa > 0)) {
        ia.observacoes += "Valor não identificado na imagem — conferência manual do valor. ";
      } else if (!ia.confereValor && !ia.revisaoValorManual) {
        const msgCliente = `O valor no comprovante (${currencyBRL(valorIaRaw)}) é diferente do valor que você indicou (${currencyBRL(rec.valor)}). Corrija o valor no app ou envie o comprovante correto. Consulte «Pagamentos recusados (72 h)» no portal se a DK já analisou.`;
        const rej = aplicarRejeicaoComprovanteCliente(id, msgCliente, operador, ia, {
          motivoInterno: `Valor comprovante ${currencyBRL(valorIaRaw)} ≠ declarado ${currencyBRL(rec.valor)}.`,
        });
        return {
          ok: false,
          rejeitado: true,
          msg: msgCliente,
          ia: rej?.iaValidacao,
          rec: rej,
        };
      }
      if (ia.revisaoValorManual) {
        ia.confereValor = false;
        ia.observacoes += `Valor ambíguo: imagem sugere ${currencyBRL(valorIaRaw)} e o cliente indicou ${currencyBRL(rec.valor)} — confirmação manual. `;
      }

      if (!autentico || riscoEd === "alto") {
        const msgCliente =
          "O comprovante não passou na verificação de autenticidade. Envie captura original do app do banco, sem edição.";
        const rej = aplicarRejeicaoComprovanteCliente(id, msgCliente, operador, ia, {
          motivoInterno: ia.observacoesAutenticidade || "Risco alto de colagem/edição.",
        });
        return {
          ok: false,
          rejeitado: true,
          msg: msgCliente,
          ia: rej?.iaValidacao,
          rec: rej,
        };
      }

      const sigNovo = assinaturaDupDoComprovanteIa(ia, rec.protocolo);
      const dupLog = detectarDuplicidadeLogica({
        cpf: rec.cpf,
        protocolo: rec.protocolo,
        excludeId: rec.id,
        assinaturaComprovante: sigNovo,
      });
      if (dupLog.duplicado && dupLog.reprovar) {
        ia.jaProcessado = true;
        ia.protocoloAntiDuplicata = "protocolo_data_hora_valor_id_v5";
        const rej = aplicarRejeicaoComprovanteCliente(id, dupLog.msgCliente, operador, ia, {
          motivoInterno: dupLog.msg,
          duplicata: true,
        });
        if (sigNovo) {
          const allDup = loadAll();
          const iDup = allDup.findIndex((r) => r.id === id);
          if (iDup >= 0) allDup[iDup].assinaturaDupChave = chaveBancoAssinatura(sigNovo);
          saveAll(allDup);
        }
        return {
          ok: false,
          duplicata: true,
          rejeitado: true,
          msg: dupLog.msgCliente,
          ia: rej?.iaValidacao,
          rec: rej,
        };
      }

      ia.jaProcessado = false;
      ia.confereValor = true;
      ia.confereData = Boolean(
        extr.dataPagamento &&
          normDataPagamentoBr(extr.dataPagamento) === normDataPagamentoBr(rec.dataPagamento)
      );
      if (!ia.observacoes.trim()) {
        ia.observacoes = "Conferência IA: dados do comprovante lidos e válidos.";
      }
      const dataRef = normDataPagamentoBr(ia.dataPagamento);
      ia.chavePagamentoLogica = chavePagamentoLogica(
        rec.cpf,
        rec.protocolo,
        dataRef,
        valorIa,
        idTxIa,
        horaIa,
        null
      );
      ia.protocoloAntiDuplicata = "protocolo_data_hora_valor_id_v5";

      ia.conferidoPorCpf = operador.cpf || "";
      ia.conferidoPorNome = operador.nome || OPERADOR_AUTO.nome;
      ia.conferidoPorRole = operador.role || "";
      ia.processamentoAutomatico = automatico;

      const all = loadAll();
      const idx = all.findIndex((r) => r.id === id);
      if (idx === -1) return { ok: false, msg: "Registo removido." };
      all[idx].iaValidacao = ia;
      if (idTxIa) all[idx].idTransacao = idTxIa;
      if (horaIa) all[idx].horaPagamentoLida = horaIa;
      if (sigNovo) all[idx].assinaturaDupChave = chaveBancoAssinatura(sigNovo);
      all[idx].status = STATUS.IA_OK;
      saveAll(all);
      return { ok: true, ia, rec: all[idx] };
    } catch (err) {
      return { ok: false, msg: err?.message || "Falha na validação com IA." };
    }
  }

  const RECEITA_TIPOS = [
    { key: "aluguel", label: "Aluguel", checkId: "portalCcRecAluguel", valorId: "portalCcRecValorAluguel" },
    { key: "manutencao", label: "Manutenção", checkId: "portalCcRecManutencao", valorId: "portalCcRecValorManutencao" },
    { key: "multas", label: "Multas", checkId: "portalCcRecMultas", valorId: "portalCcRecValorMultas" },
    { key: "outros", label: "Outros", checkId: "portalCcRecOutros", valorId: "portalCcRecValorOutros" },
  ];

  let receitaTiposBound = false;
  let receitaTiposRecId = "";

  function getValorTotalComprovanteRec(rec) {
    return Number(valorParaRegistoPagamento(rec));
  }

  function tiposReceitaSelecionados() {
    return RECEITA_TIPOS.filter((t) => document.getElementById(t.checkId)?.checked);
  }

  function renderReceitaValorInputs(rec) {
    const wrap = document.getElementById("portalCcRecValoresWrap");
    if (!wrap) return;
    const sel = tiposReceitaSelecionados();
    const total = getValorTotalComprovanteRec(rec);
    const unico = sel.length === 1;
    wrap.innerHTML = sel
      .map((t) => {
        const autoVal = unico ? currencyBRL(total) : "";
        const ro = unico ? "readonly" : "";
        return `<label class="portal-field portal-field--wide portal-cc-receita-valor-lbl" data-rec-tipo="${t.key}">
          <span>Valor — ${escapeHtml(t.label)}</span>
          <input type="text" id="${t.valorId}" inputmode="numeric" maxlength="32" autocomplete="off" value="${escapeHtml(autoVal)}" ${ro} placeholder="R$ 0,00">
        </label>`;
      })
      .join("");
    atualizarReceitaSomaMsg(rec);
  }

  function atualizarReceitaSomaMsg(rec) {
    const msg = document.getElementById("portalComprovanteReceitaSomaMsg");
    if (!msg) return;
    const total = getValorTotalComprovanteRec(rec);
    const sel = tiposReceitaSelecionados();
    if (!sel.length) {
      msg.textContent = "Marque pelo menos um tipo de receita.";
      msg.className = "subtext portal-cc-receita-soma portal-cc-receita-soma--erro";
      return;
    }
    let soma = 0;
    for (const t of sel) {
      soma += parseCurrencyBR(document.getElementById(t.valorId)?.value);
    }
    const ok = valoresProximos(soma, total);
    msg.textContent = ok
      ? `Soma ${currencyBRL(soma)} = total do comprovante ${currencyBRL(total)}.`
      : `Soma ${currencyBRL(soma)} — falta ${currencyBRL(Math.max(0, total - soma))} para fechar ${currencyBRL(total)}.`;
    msg.className = `subtext portal-cc-receita-soma ${ok ? "portal-cc-receita-soma--ok" : "portal-cc-receita-soma--erro"}`;
  }

  function syncReceitaOutrosDescVisibility() {
    const outrosOn = document.getElementById("portalCcRecOutros")?.checked;
    const wrap = document.getElementById("portalCcRecOutrosDescWrap");
    if (wrap) wrap.classList.toggle("hidden", !outrosOn);
    const inp = document.getElementById("portalCcRecOutrosDesc");
    if (inp) inp.required = Boolean(outrosOn);
  }

  function initReceitaTiposUi(rec) {
    const box = document.getElementById("portalComprovanteReceitaWrap");
    const totalLbl = document.getElementById("portalComprovanteReceitaTotalLbl");
    if (!box) return;
    const podeConfirmar = rec.status === STATUS.IA_OK;
    box.classList.toggle("hidden", !podeConfirmar);
    if (!podeConfirmar) return;

    const total = getValorTotalComprovanteRec(rec);
    if (totalLbl) {
      totalLbl.textContent = `Total do comprovante (a distribuir): ${currencyBRL(total)}`;
    }

    const aluguelCb = document.getElementById("portalCcRecAluguel");
    if (aluguelCb && receitaTiposRecId !== rec.id) {
      aluguelCb.checked = true;
      ["portalCcRecManutencao", "portalCcRecMultas", "portalCcRecOutros"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
      const desc = document.getElementById("portalCcRecOutrosDesc");
      if (desc) desc.value = "";
    }
    receitaTiposRecId = rec.id;
    syncReceitaOutrosDescVisibility();
    renderReceitaValorInputs(rec);

    if (!receitaTiposBound) {
      receitaTiposBound = true;
      const onChange = () => {
        const r = getById(comprovanteClienteUiIdAtual);
        if (!r) return;
        syncReceitaOutrosDescVisibility();
        renderReceitaValorInputs(r);
      };
      RECEITA_TIPOS.forEach((t) => {
        document.getElementById(t.checkId)?.addEventListener("change", onChange);
      });
      document.getElementById("portalCcRecValoresWrap")?.addEventListener("input", (e) => {
        if (!e.target?.id?.startsWith("portalCcRecValor")) return;
        const r = getById(comprovanteClienteUiIdAtual);
        if (r) atualizarReceitaSomaMsg(r);
      });
    }
  }

  function coletarDirecionamentoReceita(rec) {
    const sel = tiposReceitaSelecionados();
    if (!sel.length) {
      return { ok: false, msg: "Marque pelo menos um tipo de receita (aluguel, manutenção, multas ou outros)." };
    }
    const total = getValorTotalComprovanteRec(rec);
    const split = { aluguel: 0, manutencao: 0, multas: 0, outros: 0 };
    let soma = 0;
    for (const t of sel) {
      const v = parseCurrencyBR(document.getElementById(t.valorId)?.value);
      if (v <= 0) {
        return { ok: false, msg: `Informe o valor para ${t.label}.` };
      }
      split[t.key] = v;
      soma += v;
    }
    if (!valoresProximos(soma, total)) {
      return {
        ok: false,
        msg: `A soma dos valores (${currencyBRL(soma)}) deve ser igual ao total do comprovante (${currencyBRL(total)}).`,
      };
    }
    if (split.outros > 0) {
      const desc = String(document.getElementById("portalCcRecOutrosDesc")?.value || "").trim();
      if (!desc) {
        return { ok: false, msg: "Informe a descrição para receita «outros»." };
      }
      return { ok: true, split, descricaoOutros: desc };
    }
    return { ok: true, split, descricaoOutros: "" };
  }

  function materializarArraysLoc(loc) {
    if (!Array.isArray(loc.portalLancamentosAluguel)) {
      const virt =
        typeof window.__DK_getPortalLancamentosAluguelDoContrato === "function"
          ? window.__DK_getPortalLancamentosAluguelDoContrato(loc)
          : [];
      loc.portalLancamentosAluguel = virt.map((v) => ({ ...v }));
    }
    if (!Array.isArray(loc.portalMultasTransito)) loc.portalMultasTransito = [];
    if (!Array.isArray(loc.portalManutencoesRegistro)) loc.portalManutencoesRegistro = [];
  }

  function pagamentoJaRegistadoParaComprovante(loc, rec) {
    const id = String(rec.id || "").trim();
    const fp = String(rec.comprovanteFp || "").trim();
    const idTx = idTransacaoDoRec(rec);
    const fields = ["portalLancamentosAluguel", "portalMultasTransito", "portalManutencoesRegistro"];
    for (const f of fields) {
      const arr = Array.isArray(loc[f]) ? loc[f] : [];
      for (const p of arr) {
        if (!p || typeof p !== "object") continue;
        if (id && String(p.origemComprovanteClienteId || "") === id) return p;
        if (idTx && idTransacaoDoPagamento(p) === idTx) return p;
        if (fp && String(p.comprovanteFp || "") === fp && !id) return p;
      }
    }
    return null;
  }

  function baseMetaPagamentoComprovante(rec, regCpf, regNome) {
    return {
      data: rec.dataPagamento,
      createdAt: Date.now(),
      registradoPorCpf: regCpf,
      registradoPorNome: regNome,
      valorEspecie: 0,
      valorPix: 0,
      valorCartao: 0,
      origemComprovanteClienteId: rec.id,
      comprovanteFp: String(rec.comprovanteFp || "").trim(),
      confirmadoViaAppCliente: true,
      comprovanteClienteEnviadoEm: rec.enviadoEm || "",
      comprovanteClienteConfirmadoEm: new Date().toISOString(),
      comprovanteValidadoPorNome: regNome,
      comprovanteValidadoPorCpf: regCpf,
      valorInformadoCliente: roundCentavos(rec.valor),
      valorLidoIA: rec.iaValidacao ? roundCentavos(rec.iaValidacao.valor) : undefined,
      idTransacaoComprovante: idTransacaoDoRec(rec),
      horaPagamentoComprovante:
        String(rec?.iaValidacao?.horaPagamento || rec?.horaPagamentoLida || "").trim() ||
        normInstantePagamento(rec.enviadoEm, rec.dataPagamento, null).replace(/^\d{2}\/\d{2}\/\d{4}\s/, ""),
      registroComValorComprovanteIA: valorInformadoDivergeDaIA(rec),
    };
  }

  function criarRegistroParceladoComprovante(tipo, valor, rec, descricao, regCpf, regNome) {
    const cod = `CC${String(rec.id || "").replace(/\D/g, "").slice(-8) || Date.now()}`;
    const desc =
      String(descricao || "").trim() ||
      `Pagamento via comprovante app cliente (${rec.protocolo})`;
    const meta = baseMetaPagamentoComprovante(rec, regCpf, regNome);
    if (tipo === "multas") {
      return {
        ...meta,
        dataMulta: rec.dataPagamento,
        codMulta: cod,
        descricao: desc,
        valorMulta: valor,
        quantidadeParcelas: 1,
        dataPrimeiraParcela: rec.dataPagamento,
        dataUltimaParcela: rec.dataPagamento,
        parcelas: [{ numero: 1, data: rec.dataPagamento, valor }],
      };
    }
    return {
      ...meta,
      dataManutencao: rec.dataPagamento,
      codManutencao: cod,
      descricao: desc,
      valorManutencao: valor,
      quantidadeParcelas: 1,
      dataPrimeiraParcela: rec.dataPagamento,
      dataUltimaParcela: rec.dataPagamento,
      parcelas: [{ numero: 1, data: rec.dataPagamento, valor }],
    };
  }

  function persistirPagamentosDirecionados(rec, direcionamento, regCpf, regNome) {
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function") {
      return { ok: false, msg: "Cadastro indisponível." };
    }
    const CAD_LOC = typeof CAD_LOCACOES_KEY !== "undefined" ? CAD_LOCACOES_KEY : "dk_locacoes_cadastro";
    const cpf = onlyDigits(rec.cpf);
    const nc = normProto(rec.protocolo);
    const locs = loadCadastro(CAD_LOC);
    const idx = locs.findIndex((l) => onlyDigits(l.cpf) === cpf && normProto(l.numeroContrato) === nc);
    if (idx === -1) return { ok: false, msg: "Locação não encontrada para este CPF e protocolo." };

    const loc = locs[idx];
    materializarArraysLoc(loc);

    const ja = pagamentoJaRegistadoParaComprovante(loc, rec);
    if (ja) {
      const all = loadAll();
      const iCc = all.findIndex((r) => r.id === rec.id);
      if (iCc >= 0) {
        all[iCc] = alinharComprovanteConfirmadoComProtocolo(all[iCc], ja);
        saveAll(all);
      }
      return {
        ok: true,
        jaRegistadoNoProtocolo: true,
        rec: iCc >= 0 ? all[iCc] : rec,
        valorRegistado: roundCentavos(ja.valor),
      };
    }

    const { split, descricaoOutros } = direcionamento;
    const meta = baseMetaPagamentoComprovante(rec, regCpf, regNome);

    if (split.aluguel > 0) {
      loc.portalLancamentosAluguel.push({
        ...meta,
        valor: split.aluguel,
        valorPix: split.aluguel,
        tipoReceitaComprovante: "aluguel",
      });
    }
    if (split.outros > 0) {
      loc.portalLancamentosAluguel.push({
        ...meta,
        valor: split.outros,
        valorPix: split.outros,
        tipoReceitaComprovante: "outros",
        descricaoReceitaOutros: descricaoOutros,
      });
    }
    if (split.multas > 0) {
      loc.portalMultasTransito.push(
        criarRegistroParceladoComprovante("multas", split.multas, rec, descricaoOutros || "Multas — comprovante cliente", regCpf, regNome)
      );
    }
    if (split.manutencao > 0) {
      loc.portalManutencoesRegistro.push(
        criarRegistroParceladoComprovante(
          "manutencao",
          split.manutencao,
          rec,
          descricaoOutros || "Manutenção — comprovante cliente",
          regCpf,
          regNome
        )
      );
    }

    loc.updatedAt = Date.now();
    locs[idx] = loc;
    try {
      saveCadastro(CAD_LOC, locs);
    } catch (err) {
      return { ok: false, msg: err?.message || "Erro ao guardar locação." };
    }
    if (typeof window.__DK_pushToCloudAfterSave === "function") window.__DK_pushToCloudAfterSave();
    return { ok: true };
  }

  function persistirPagamentoNaLocacao(rec, valorRegisto) {
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function") {
      return { ok: false, msg: "Cadastro indisponível." };
    }
    const CAD_LOC = typeof CAD_LOCACOES_KEY !== "undefined" ? CAD_LOCACOES_KEY : "dk_locacoes_cadastro";
    const cpf = onlyDigits(rec.cpf);
    const nc = normProto(rec.protocolo);
    const locs = loadCadastro(CAD_LOC);
    const idx = locs.findIndex((l) => onlyDigits(l.cpf) === cpf && normProto(l.numeroContrato) === nc);
    if (idx === -1) return { ok: false, msg: "Locação não encontrada para este CPF e protocolo." };

    const loc = locs[idx];
    if (!Array.isArray(loc.portalLancamentosAluguel)) {
      const virt =
        typeof window.__DK_getPortalLancamentosAluguelDoContrato === "function"
          ? window.__DK_getPortalLancamentosAluguelDoContrato(loc)
          : [];
      loc.portalLancamentosAluguel = virt.map((v) => ({ ...v }));
    }
    const fpRec = String(rec.comprovanteFp || "").trim();
    const jaNoProtocolo = loc.portalLancamentosAluguel.find((p) => {
      if (!p || typeof p !== "object") return false;
      if (String(p.origemComprovanteClienteId || "") === rec.id) return true;
      if (fpRec && String(p.comprovanteFp || "") === fpRec) return true;
      return false;
    });
    if (jaNoProtocolo) {
      return {
        ok: false,
        msg: `Pagamento já registado neste protocolo (${String(jaNoProtocolo.data || "")} · ${currencyBRL(jaNoProtocolo.valor)}).`,
      };
    }
    let regCpf = "";
    let regNome = "Operador";
    try {
      const s = JSON.parse(localStorage.getItem("dk_sessao_cliente") || "{}");
      if (s?.tipo === "admin") {
        regCpf = onlyDigits(s.cpf).slice(0, 11);
        regNome = String(s.nome || "Operador").trim();
      }
    } catch {
      /* ignore */
    }
    const valorNum = Number(valorRegisto ?? valorParaRegistoPagamento(rec));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return { ok: false, msg: "Valor do pagamento inválido." };
    }
    const entry = {
      data: rec.dataPagamento,
      valor: valorNum,
      createdAt: Date.now(),
      registradoPorCpf: regCpf,
      registradoPorNome: regNome,
      valorEspecie: 0,
      valorPix: valorNum,
      valorCartao: 0,
      origemComprovanteClienteId: rec.id,
      comprovanteFp: fpRec,
      confirmadoViaAppCliente: true,
      comprovanteClienteEnviadoEm: rec.enviadoEm || "",
      comprovanteClienteConfirmadoEm: new Date().toISOString(),
      comprovanteValidadoPorNome: regNome,
      comprovanteValidadoPorCpf: regCpf,
      valorInformadoCliente: Number(rec.valor),
      valorLidoIA: rec.iaValidacao ? Number(rec.iaValidacao.valor) : undefined,
      idTransacaoComprovante: idTransacaoDoRec(rec),
      horaPagamentoComprovante:
        String(rec?.iaValidacao?.horaPagamento || rec?.horaPagamentoLida || "").trim() ||
        normInstantePagamento(rec.enviadoEm, rec.dataPagamento, null).replace(/^\d{2}\/\d{2}\/\d{4}\s/, ""),
      registroComValorComprovanteIA: valorInformadoDivergeDaIA(rec),
    };
    loc.portalLancamentosAluguel.push(entry);
    loc.updatedAt = Date.now();
    locs[idx] = loc;
    try {
      saveCadastro(CAD_LOC, locs);
    } catch (err) {
      return { ok: false, msg: err?.message || "Erro ao guardar locação." };
    }
    if (typeof window.__DK_pushToCloudAfterSave === "function") window.__DK_pushToCloudAfterSave();
    return { ok: true };
  }

  let confirmarComprovanteEmCurso = false;

  async function confirmarComprovanteCliente(id, opts) {
    if (confirmarComprovanteEmCurso) {
      return { ok: false, msg: "Confirmação em curso. Aguarde." };
    }
    const gate = exigirOperadorConferencia();
    if (!gate.ok) return { ok: false, msg: gate.msg };

    const rec = getById(id);
    if (!rec) return { ok: false, msg: "Registo não encontrado." };
    if (rec.status === STATUS.CONFIRMADO) return { ok: false, msg: "Já confirmado." };
    const idxPag = indicePagamentosProtocoloPorComprovante();
    const pagProto = comprovanteRegistadoNoProtocolo(rec, idxPag);
    if (pagProto) {
      const all = loadAll();
      const idx = all.findIndex((r) => r.id === id);
      if (idx >= 0) {
        all[idx] = alinharComprovanteConfirmadoComProtocolo(all[idx], pagProto);
        saveAll(all);
        return { ok: true, rec: all[idx], jaRegistadoNoProtocolo: true };
      }
    }
    if (rec.status !== STATUS.IA_OK) {
      return {
        ok: false,
        msg: "Faça a conferência do comprovante (IA) antes de confirmar o pagamento no protocolo.",
      };
    }

    const adminSenha =
      opts?.adminSenha ??
      String(document.getElementById("portalComprovanteAdminSenha")?.value || "").trim();
    const authDiv = autorizarConfirmacaoComDivergencia(rec, adminSenha);
    if (!authDiv.ok) return authDiv;

    if (!rec.comprovanteFp && rec.arquivoBase64) {
      rec.comprovanteFp = await computeComprovanteFingerprint(rec.arquivoBase64, rec.mimeType);
    }
    const dupConf = await detectarComprovanteDuplicado({
      comprovanteFp: rec.comprovanteFp,
      arquivoBase64: rec.arquivoBase64,
      mimeType: rec.mimeType,
      excludeId: rec.id,
      paraEnvio: false,
    });
    if (dupConf.duplicado) {
      return {
        ok: false,
        msg: dupConf.msgCliente || dupConf.msg,
        duplicata: true,
      };
    }

    const sigConf = assinaturaDupDeRec(rec);
    const dupLogConf = detectarDuplicidadeLogica({
      cpf: rec.cpf,
      protocolo: rec.protocolo,
      excludeId: rec.id,
      assinaturaComprovante: sigConf,
    });
    if (dupLogConf.duplicado && dupLogConf.reprovar) {
      return {
        ok: false,
        msg: dupLogConf.msgCliente || dupLogConf.msg,
        duplicata: true,
      };
    }

    const dir = coletarDirecionamentoReceita(rec);
    if (!dir.ok) return { ok: false, msg: dir.msg };

    const valorRegisto = getValorTotalComprovanteRec(rec);
    confirmarComprovanteEmCurso = true;
    let saveLoc;
    try {
      saveLoc = persistirPagamentosDirecionados(rec, dir, gate.operador.cpf, gate.operador.nome);
    } finally {
      confirmarComprovanteEmCurso = false;
    }
    if (!saveLoc.ok) return saveLoc;

    const regCpf = gate.operador.cpf;
    const regNome = gate.operador.nome;
    const all = loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx >= 0) {
      all[idx].status = STATUS.CONFIRMADO;
      all[idx].confirmadoPorCpf = regCpf;
      all[idx].confirmadoPorNome = regNome;
      all[idx].confirmadoEm = new Date().toISOString();
      all[idx].valorRegistadoProtocolo = valorRegisto;
      all[idx].direcionamentoReceita = dir.split;
      all[idx].descricaoReceitaOutros = dir.descricaoOutros || "";
      saveAll(all);
      if (typeof window.__DK_clienteNotificacaoPagamentoConfirmado === "function") {
        window.__DK_clienteNotificacaoPagamentoConfirmado({
          cpf: all[idx].cpf,
          protocolo: all[idx].protocolo,
          valor: valorRegisto,
          dataPagamento: all[idx].dataPagamento,
          comprovanteId: all[idx].id,
        });
      }
    }
    return { ok: true, rec: all[idx], valorRegistado: valorRegisto };
  }

  function rejeitarComprovanteCliente(id, motivo) {
    const gate = exigirOperadorConferencia();
    if (!gate.ok) return { ok: false, msg: gate.msg };
    const rec = getById(id);
    if (!rec) return { ok: false, msg: "Não encontrado." };
    const msgCliente =
      String(motivo || "").trim() || "Comprovante não aceite pela DK. Contacte a locadora.";
    aplicarRejeicaoComprovanteCliente(id, msgCliente, gate.operador, rec.iaValidacao, { manual: true });
    return { ok: true };
  }

  /** UI operador */
  let comprovanteClienteUiIdAtual = "";

  function statusLabel(st) {
    if (st === STATUS.CONFIRMADO) return "Confirmado pelo operador";
    if (st === STATUS.IA_OK) return "Validado (IA) — aguarda confirmação";
    if (st === STATUS.REJEITADO) return "Recusado";
    return "A processar (IA automática)";
  }

  function statusLabelComRec(r) {
    if (r?.status === STATUS.IA_OK && r.reabertoParaOperadorEm) {
      return "Reaberto — aguarda confirmação";
    }
    if (r?.status === STATUS.REJEITADO) {
      if (String(r.rejeitadoMotivo || "").toLowerCase().includes("mesma imagem")) {
        return "Arquivado (mesma imagem)";
      }
      if (String(r.rejeitadoMotivo || "").includes("duplicidade")) return "Arquivado (envio duplicado)";
      return r.rejeitadoAutomatico ? "Recusado (automático)" : "Recusado pelo operador";
    }
    return statusLabel(r?.status);
  }

  function refreshOperadorConferenciaHint() {
    const el = document.getElementById("portalComprovanteClienteOperadorHint");
    if (!el) return;
    const gate = exigirOperadorConferencia();
    if (!gate.ok) {
      el.textContent =
        "Conferência e validação com IA: só com sessão de colaborador ou administrador cadastrado, com permissão de lançamento de aluguel.";
      return;
    }
    el.textContent = `Operador em conferência: ${gate.operador.nome} (CPF ${gate.operador.cpf}). A IA corre automaticamente ao receber o comprovante; confirme aqui os que passaram na validação.`;
  }

  function renderTabelaComprovantes(rows, opts) {
    const abrirAttr = opts?.listaRecusados ? "data-cc-abrir-recusado" : "data-cc-abrir";
    if (!rows.length) {
      return `<p class="subtext">${escapeHtml(opts?.vazio || "Nenhum registo.")}</p>`;
    }
    const colMotivo = opts?.listaRecusados
      ? "<th>Motivo</th>"
      : "";
    return `<table class="portal-lanc-hist portal-comprovante-cliente-table" aria-label="${escapeHtml(opts?.ariaLabel || "Comprovantes")}">
      <thead><tr><th>Data envio</th><th>Cliente</th><th>Protocolo</th><th>Valor</th><th>Estado</th>${colMotivo}<th></th></tr></thead>
      <tbody>${rows
        .map((r) => {
          const env = r.enviadoEm ? new Date(r.enviadoEm).toLocaleString("pt-BR") : "—";
          const motivoTd = opts?.listaRecusados
            ? `<td class="portal-cc-motivo-recusa">${escapeHtml(r.rejeitadoMotivoCliente || r.rejeitadoMotivo || "—")}</td>`
            : "";
          const valorUi = valorInformadoDivergeDaIA(r)
            ? `${escapeHtml(currencyBRL(r.valor))} <span class="subtext">(imagem: ${escapeHtml(currencyBRL(valorIaBrutoRec(r) || valorIaEfetivoRec(r)))})</span>`
            : escapeHtml(currencyBRL(r.valor));
          return `<tr>
            <td>${escapeHtml(env)}</td>
            <td>${escapeHtml(r.nomeCliente || r.cpf)}</td>
            <td>${escapeHtml(r.protocolo)}</td>
            <td>${valorUi}</td>
            <td>${escapeHtml(statusLabelComRec(r))}</td>
            ${motivoTd}
            <td><button type="button" class="btn-primary btn-secondary-outline" ${abrirAttr}="${escapeHtml(r.id)}">Abrir</button></td>
          </tr>`;
        })
        .join("")}</tbody></table>`;
  }

  function renderListaOperador() {
    const wrap = document.getElementById("portalComprovanteClienteLista");
    const badge = document.getElementById("portalComprovanteClienteBadgeProcessando");
    if (!wrap) return;
    const nProc = contarPendentesAutoProcessamento();
    if (badge) {
      badge.textContent = nProc ? `${nProc} a processar pela IA…` : "";
      badge.classList.toggle("hidden", !nProc);
    }
    const rows = listarAguardandoConfirmacaoOperador();
    const nConfirmados = loadAll().filter((r) => r.status === STATUS.CONFIRMADO).length;
    const aguardaIa = loadAll()
      .filter((r) => r.status === STATUS.PENDENTE)
      .sort((a, b) => Date.parse(b.enviadoEm || 0) - Date.parse(a.enviadoEm || 0));
    let html = `<p class="subtext portal-cc-hist-resumo"><strong>${nConfirmados}</strong> pagamento(s) já confirmados pelo operador (histórico preservado na nuvem).</p>`;
    if (rows.length) {
      html += `<h4 class="portal-lanc-aluguel-section__title portal-cc-sublista-titulo">Aguardam confirmação manual (IA aprovou)</h4>${renderTabelaComprovantes(rows, {
        ariaLabel: "Comprovantes aguardando confirmação",
        vazio: "Nenhum comprovante aguarda confirmação.",
      })}`;
    } else {
      html += nProc
        ? '<p class="subtext">Comprovantes recebidos — a IA está a validar automaticamente. Os aprovados aparecem aqui para confirmação manual.</p>'
        : '<p class="subtext">Nenhum comprovante aguarda confirmação. Recusas indevidas por erro de centavos são reabertas automaticamente.</p>';
    }
    if (aguardaIa.length) {
      html += `<h4 class="portal-lanc-aluguel-section__title portal-cc-sublista-titulo">Aguardam validação IA</h4>${renderTabelaComprovantes(aguardaIa, {
        ariaLabel: "Comprovantes aguardando IA automática",
        vazio: "",
      })}`;
    }
    wrap.innerHTML = html;
  }

  function renderListaRecusados72h() {
    const wrap = document.getElementById("portalComprovanteClienteListaRecusados");
    if (!wrap) return;
    const rows = listarRecusadosUltimas72h();
    wrap.innerHTML = renderTabelaComprovantes(rows, {
      listaRecusados: true,
      ariaLabel: "Pagamentos recusados últimas 72 horas",
      vazio: "Nenhum pagamento recusado nas últimas 72 horas.",
    });
  }

  function togglePainelRecusados72h() {
    const painel = document.getElementById("portalComprovanteClientePainelRecusados");
    const btn = document.getElementById("portalComprovanteClienteBtnRecusados72h");
    if (!painel) return;
    const vaiMostrar = painel.classList.contains("hidden");
    painel.classList.toggle("hidden", !vaiMostrar);
    if (btn) btn.setAttribute("aria-expanded", vaiMostrar ? "true" : "false");
    if (vaiMostrar) renderListaRecusados72h();
  }

  /** Lista todas as assinaturas (comprovantes + banco + pagamentos no protocolo). */
  function listarAssinaturasComprovantesSistema() {
    sincronizarBancoAssinaturas();
    const rows = [];
    const seen = new Set();

    const push = (row) => {
      const k = String(row.assinatura || "").trim();
      if (!k || k === "(incompleta)" || k === "(aguarda IA)") return;
      if (seen.has(k)) return;
      seen.add(k);
      rows.push(row);
    };

    for (const r of loadAllRaw()) {
      if (r.status === STATUS.REJEITADO) continue;
      const sig = assinaturaDupDeRec(r);
      const chave = chaveBancoAssinatura(sig);
      if (!chave && !r.iaValidacao) continue;
      push({
        fonte: "comprovante",
        status: statusLabel(r.status),
        protocolo: r.protocolo,
        cliente: String(r.nomeCliente || "").trim(),
        cpf: r.cpf,
        enviado: r.enviadoEm ? new Date(r.enviadoEm).toLocaleString("pt-BR") : "—",
        resumo: textoAssinaturaDup(sig) || "—",
        assinatura: chave || "(incompleta)",
      });
    }

    for (const e of coletarEntradasBancoAssinaturas()) {
      push({
        fonte: e.fonte === "pagamento" ? "pagamento" : "banco",
        status: e.status === "pagamento_protocolo" ? "no protocolo" : statusLabel(e.status),
        protocolo: e.protocolo,
        cliente: "",
        cpf: e.cpf,
        enviado: e.enviadoEm ? new Date(e.enviadoEm).toLocaleString("pt-BR") : "—",
        resumo: e.chave.replace(/\|/g, " · "),
        assinatura: e.chave,
      });
    }

    return rows.sort((a, b) => String(b.enviado).localeCompare(String(a.enviado)));
  }

  function renderListaAssinaturasBanco() {
    const wrap = document.getElementById("portalComprovanteClienteListaAssinaturas");
    if (!wrap) return;
    const rows = listarAssinaturasComprovantesSistema();
    if (!rows.length) {
      wrap.innerHTML =
        '<p class="subtext">Nenhuma assinatura completa no banco neste navegador. Atualize da nuvem ou aguarde a IA validar comprovantes (protocolo + data + hora + valor + ID na imagem).</p>';
      return;
    }
    wrap.innerHTML = `<p class="subtext"><strong>${rows.length}</strong> assinatura(s) única(s).</p>
      <table class="portal-lanc-hist portal-comprovante-cliente-table" aria-label="Assinaturas no banco">
        <thead><tr><th>#</th><th>Fonte</th><th>Estado</th><th>Protocolo</th><th>Cliente / CPF</th><th>Resumo (IA)</th><th>Chave no banco</th></tr></thead>
        <tbody>${rows
          .map((r, i) => {
            const who = r.cliente ? `${escapeHtml(r.cliente)} · ${escapeHtml(r.cpf)}` : escapeHtml(r.cpf || "—");
            return `<tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(r.fonte)}</td>
              <td>${escapeHtml(r.status)}</td>
              <td>${escapeHtml(r.protocolo)}</td>
              <td>${who}</td>
              <td class="portal-cc-assinatura-resumo">${escapeHtml(r.resumo)}</td>
              <td class="portal-cc-banco-assinatura__chave"><code>${escapeHtml(r.assinatura)}</code></td>
            </tr>`;
          })
          .join("")}</tbody>
      </table>`;
  }

  function togglePainelAssinaturasBanco() {
    const painel = document.getElementById("portalComprovanteClientePainelAssinaturas");
    const btn = document.getElementById("portalComprovanteClienteBtnListarAssinaturas");
    if (!painel) return;
    const vaiMostrar = painel.classList.contains("hidden");
    painel.classList.toggle("hidden", !vaiMostrar);
    if (btn) btn.setAttribute("aria-expanded", vaiMostrar ? "true" : "false");
    if (vaiMostrar) renderListaAssinaturasBanco();
  }

  function renderAssinaturaBancoUi(rec) {
    const sig = assinaturaDupDeRec(rec);
    const chave = String(rec.assinaturaDupChave || "").trim() || chaveBancoAssinatura(sig);
    const texto = textoAssinaturaDup(sig);
    const dupLog =
      sig && chave
        ? detectarDuplicidadeLogica({
            cpf: rec.cpf,
            protocolo: rec.protocolo,
            excludeId: rec.id,
            assinaturaComprovante: sig,
          })
        : { duplicado: false, incompleto: true };

    if (!chave) {
      return `<div class="portal-cc-banco-assinatura subtext" role="status">
        <p><strong>Assinatura no banco</strong> — incompleta. A chave única exige protocolo, data, hora, valor e ID da transação lidos na imagem pela IA.</p>
        ${texto ? `<p>${escapeHtml(texto)}</p>` : ""}
      </div>`;
    }

    const dupHit = Boolean(dupLog.duplicado);
    const alerta = dupHit
      ? `<p class="comprovante-api-status comprovante-api-status--erro"><strong>⚠ Duplicata no banco</strong> — ${escapeHtml(dupLog.msgCliente || dupLog.msg || motivoDuplicataCliente(sig))}</p>`
      : `<p class="subtext"><strong>Assinatura única</strong> — não há outro comprovante nem pagamento no protocolo com a mesma chave.</p>`;

    return `<div class="portal-cc-banco-assinatura" role="status">
      <p><strong>Assinatura no banco</strong></p>
      <p class="portal-cc-banco-assinatura__texto">${escapeHtml(texto)}</p>
      <p class="subtext portal-cc-banco-assinatura__chave"><code>${escapeHtml(chave)}</code></p>
      ${alerta}
    </div>`;
  }

  function fillDetalheModal(rec) {
    comprovanteClienteUiIdAtual = rec.id;
    const el = document.getElementById("portalComprovanteClienteDetalheCorpo");
    if (!el) return;
    const ia = rec.iaValidacao;
    const conferidoPor =
      ia && ia.conferidoPorNome
        ? `<p><strong>Conferido por:</strong> ${escapeHtml(ia.conferidoPorNome)}${ia.conferidoPorCpf ? ` · CPF ${escapeHtml(ia.conferidoPorCpf)}` : ""}</p>`
        : "";
    const dupUi = detectarImagemComprovanteDuplicada(rec.comprovanteFp, rec.id, { paraEnvio: false });
    const sigUi = assinaturaDupDeRec(rec);
    const dupLogUi =
      sigUi && chaveBancoAssinatura(sigUi)
        ? detectarDuplicidadeLogica({
            cpf: rec.cpf,
            protocolo: rec.protocolo,
            excludeId: rec.id,
            assinaturaComprovante: sigUi,
          })
        : { duplicado: false };
    const dupLogicaHtml =
      dupLogUi.duplicado && dupLogUi.reprovar
        ? `<p class="comprovante-api-status comprovante-api-status--erro"><strong>⚠ Duplicata (banco)</strong> — ${escapeHtml(dupLogUi.msgCliente || dupLogUi.msg || "")}</p>`
        : "";
    const jaProc =
      ia?.jaProcessado || dupUi.duplicado
        ? `<p class="comprovante-api-status comprovante-api-status--erro"><strong>⚠ Imagem duplicada</strong> — ${escapeHtml(dupUi.msgCliente || dupUi.msg || MSG_DUP_IMAGEM_CLIENTE)}</p>`
        : "";
    const assinaturaBancoHtml = renderAssinaturaBancoUi(rec);
    const historicoHtml = `<div class="portal-cc-historico-dup subtext"><p><strong>Anti-duplicata</strong> — mesma <em>imagem</em> (hash) ou mesma <em>assinatura</em> (protocolo + data + hora + valor + ID lidos na imagem). A IA confere o valor lido com o valor declarado pelo cliente.</p></div>`;
    const idTxUi = idTransacaoDoRec(rec);
    const autentHtml =
      ia && (ia.riscoColagemOuEdicao === "alto" || ia.comprovanteAutentico === false)
        ? `<p class="comprovante-api-status comprovante-api-status--erro"><strong>⚠ Autenticidade</strong> — risco ${escapeHtml(ia.riscoColagemOuEdicao)}. ${escapeHtml(ia.observacoesAutenticidade || "Rever imagem antes de confirmar.")}</p>`
        : ia && ia.riscoColagemOuEdicao === "medio"
          ? `<p class="comprovante-api-status"><strong>Autenticidade</strong> — risco médio. ${escapeHtml(ia.observacoesAutenticidade || "")}</p>`
          : "";
    const recusadoHtml =
      rec.status === STATUS.REJEITADO
        ? `<p class="comprovante-api-status comprovante-api-status--erro"><strong>Recusado</strong> — ${escapeHtml(rec.rejeitadoMotivoCliente || rec.rejeitadoMotivo || "Sem motivo registado.")}${rec.rejeitadoEm ? ` <span class="subtext">(${escapeHtml(new Date(rec.rejeitadoEm).toLocaleString("pt-BR"))})</span>` : ""}</p>`
        : "";
    const iaHtml = ia
      ? `<div class="portal-cc-ia-resumo">
          <p><strong>Conferência com IA</strong> (${escapeHtml(ia.validadoEm ? new Date(ia.validadoEm).toLocaleString("pt-BR") : "")})${ia.processamentoAutomatico ? " · automática" : ""}</p>
          ${jaProc}
          ${dupLogicaHtml}
          ${autentHtml}
          ${conferidoPor}
          <p>Valor na imagem: ${escapeHtml(currencyBRL(ia.valorBruto ?? ia.valor))} ${ia.confereValor ? "✓" : "⚠"} (cliente: ${escapeHtml(currencyBRL(rec.valor))})</p>
          ${ia.revisaoValorManual ? '<p class="comprovante-api-status"><strong>Rever valor</strong> — confirme o que está no comprovante antes de validar.</p>' : ""}
          <p>Data lida: ${escapeHtml(ia.dataPagamento || "—")} ${ia.confereData ? "✓" : "⚠"}</p>
          <p>Hora lida (comprovante): ${escapeHtml(ia.horaPagamento || "—")}</p>
          <p>ID transação: ${escapeHtml(ia.idTransacao || "—")}</p>
          <p>CPF lido: ${escapeHtml(ia.cpf || "—")} ${ia.confereCpf ? "✓" : "⚠"}</p>
          <p class="subtext">${escapeHtml(ia.observacoes || "")}</p>
        </div>`
      : rec.status === STATUS.PENDENTE
        ? '<p class="subtext">Aguarda validação automática pela IA (duplicata e valor). Atualize a lista ou aguarde alguns segundos.</p>'
        : '<p class="subtext">Sem conferência IA registada.</p>';

    el.innerHTML = `
      ${recusadoHtml}
      <p><strong>Cliente:</strong> ${escapeHtml(rec.nomeCliente)} · CPF ${escapeHtml(rec.cpf)}</p>
      <p><strong>Protocolo:</strong> ${escapeHtml(rec.protocolo)}</p>
      <p><strong>Data pagamento (cliente):</strong> ${escapeHtml(rec.dataPagamento)}</p>
      <p><strong>Valor (cliente):</strong> ${escapeHtml(currencyBRL(rec.valor))}</p>
      <p><strong>ID transação:</strong> ${escapeHtml(idTxUi || "— (será lido na conferência IA)")}</p>
      <p><strong>Ficheiro:</strong> ${escapeHtml(rec.nomeArquivo)}</p>
      <p><strong>Enviado em:</strong> ${escapeHtml(rec.enviadoEm ? new Date(rec.enviadoEm).toLocaleString("pt-BR") : "—")}</p>
      ${iaHtml}
      ${assinaturaBancoHtml}
      ${historicoHtml}
    `;

    const btnIa = document.getElementById("portalComprovanteClienteBtnIA");
    const btnConf = document.getElementById("portalComprovanteClienteBtnConfirmar");
    const btnRej = document.getElementById("portalComprovanteClienteBtnRejeitar");
    const btnVer = document.getElementById("portalComprovanteClienteBtnVerArquivo");
    const podeConferir = exigirOperadorConferencia().ok;
    const bloqueadoDup =
      dupUi.duplicado || dupLogUi.duplicado || Boolean(rec.iaValidacao?.jaProcessado);
    const bloqueadoAutent =
      ia && (ia.riscoColagemOuEdicao === "alto" || ia.comprovanteAutentico === false);
    const soLeitura = rec.status === STATUS.REJEITADO;
    if (btnIa) {
      btnIa.disabled = soLeitura || rec.status === STATUS.CONFIRMADO || !podeConferir || bloqueadoDup;
    }
    if (btnConf) {
      btnConf.disabled =
        soLeitura || rec.status !== STATUS.IA_OK || !podeConferir || bloqueadoDup || bloqueadoAutent;
    }
    if (btnRej) btnRej.disabled = soLeitura || rec.status === STATUS.CONFIRMADO || !podeConferir;
    if (btnVer) {
      btnVer.disabled = !(String(rec.arquivoBase64 || "").trim() || rec.arquivoArmazenado === "idb");
    }
    refreshAdminSenhaUi(rec);
    initReceitaTiposUi(rec);
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove("hidden");
      m.setAttribute("aria-hidden", "false");
    }
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add("hidden");
      m.setAttribute("aria-hidden", "true");
    }
  }

  function openDetalhe(id) {
    const rec = getById(id);
    if (!rec) return;
    fillDetalheModal(rec);
    refreshOpenAIStatusUi();
    openModal("portalComprovanteClienteDetalheModal");
  }

  const CC_VIEWER_ZOOM_MIN = 0.5;
  const CC_VIEWER_ZOOM_MAX = 5;
  const CC_VIEWER_ZOOM_STEP = 0.25;
  const CC_VIEWER_FRAME_BASE_W = 900;
  let ccViewerZoom = 1;
  let ccViewerBlobUrl = null;

  function revokeViewerBlobUrl() {
    if (ccViewerBlobUrl) {
      try {
        URL.revokeObjectURL(ccViewerBlobUrl);
      } catch {
        /* ignore */
      }
      ccViewerBlobUrl = null;
    }
  }

  function arquivoBase64ToBlobUrl(arquivoBase64, mimeType) {
    const raw = String(arquivoBase64 || "").trim();
    if (!raw) return null;
    if (raw.startsWith("blob:")) return raw;
    const p = parseDataUrl(raw);
    let b64 = p.base64;
    let mime = String(mimeType || p.mime || "").trim();
    if (!b64) {
      const compact = raw.replace(/\s/g, "");
      if (/^[A-Za-z0-9+/]+=*$/.test(compact) && compact.length > 80) {
        b64 = compact;
        if (!mime) mime = "image/png";
      }
    }
    if (!b64) return null;
    mime = mime || "application/octet-stream";
    try {
      const bin = atob(p.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    } catch {
      return null;
    }
  }

  function getViewerModalEl() {
    return (
      document.getElementById("portalComprovanteClienteViewerModal") ||
      document.getElementById("clienteComprovanteViewerModal")
    );
  }

  function getViewerStage() {
    return (
      document.getElementById("portalComprovanteClienteViewerStage") ||
      document.getElementById("clienteComprovanteViewerStage")
    );
  }

  function getViewerScroll() {
    return (
      document.getElementById("portalComprovanteClienteViewerScroll") ||
      document.getElementById("clienteComprovanteViewerScroll")
    );
  }

  function getViewerCard() {
    return (
      document.querySelector("#portalComprovanteClienteViewerModal .portal-modal__card--cc-viewer") ||
      document.querySelector("#clienteComprovanteViewerModal .portal-modal__card--cc-viewer")
    );
  }

  function getViewerZoomLbl() {
    return (
      document.getElementById("portalComprovanteClienteViewerZoomLbl") ||
      document.getElementById("clienteComprovanteViewerZoomLbl")
    );
  }

  function applyViewerZoom() {
    const stage = getViewerStage();
    const lbl = getViewerZoomLbl();
    if (!stage) return;
    stage.style.transform = "";
    const img = stage.querySelector("img");
    const frameWrap = stage.querySelector(".portal-cc-viewer-frame-wrap");
    if (img && img.naturalWidth > 0) {
      img.style.width = `${Math.round(img.naturalWidth * ccViewerZoom)}px`;
      img.style.height = "auto";
    } else if (frameWrap) {
      const w = Math.round(CC_VIEWER_FRAME_BASE_W * ccViewerZoom);
      frameWrap.style.width = `${w}px`;
      const frame = frameWrap.querySelector("iframe");
      if (frame) {
        frame.style.width = "100%";
        frame.style.height = `${Math.round(640 * ccViewerZoom)}px`;
      }
    }
    if (lbl) lbl.textContent = `${Math.round(ccViewerZoom * 100)}%`;
  }

  function setViewerZoom(z) {
    ccViewerZoom = Math.min(CC_VIEWER_ZOOM_MAX, Math.max(CC_VIEWER_ZOOM_MIN, z));
    applyViewerZoom();
  }

  function fitViewerToScrollWidth() {
    const scroll = getViewerScroll();
    const stage = getViewerStage();
    if (!scroll || !stage) return;
    const img = stage.querySelector("img");
    const pad = 24;
    const avail = Math.max(240, scroll.clientWidth - pad);
    if (img && img.naturalWidth > 0) {
      setViewerZoom(Math.min(CC_VIEWER_ZOOM_MAX, Math.max(CC_VIEWER_ZOOM_MIN, avail / img.naturalWidth)));
      return;
    }
    setViewerZoom(Math.min(CC_VIEWER_ZOOM_MAX, Math.max(1, avail / CC_VIEWER_FRAME_BASE_W)));
  }

  /** Abertura legível: preenche altura em capturas verticais (telemóvel) ou largura em paisagem. */
  function fitViewerReadable() {
    const scroll = getViewerScroll();
    const stage = getViewerStage();
    if (!scroll || !stage) return;
    const img = stage.querySelector("img");
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      fitViewerToScrollWidth();
      return;
    }
    const pad = 24;
    const availW = Math.max(240, scroll.clientWidth - pad);
    const availH = Math.max(320, scroll.clientHeight - pad);
    const byW = availW / img.naturalWidth;
    const byH = availH / img.naturalHeight;
    const portrait = img.naturalHeight > img.naturalWidth * 1.15;
    let z = portrait ? Math.max(byH, byW) : Math.max(byW, byH);
    z = Math.min(CC_VIEWER_ZOOM_MAX, Math.max(1, z));
    setViewerZoom(z);
  }

  function toggleViewerFullscreen() {
    const card = getViewerCard();
    if (!card) return;
    const on = !card.classList.contains("is-cc-viewer-fullscreen");
    card.classList.toggle("is-cc-viewer-fullscreen", on);
    window.setTimeout(() => {
      if (on) fitViewerReadable();
      else fitViewerToScrollWidth();
    }, 80);
  }

  function bindViewerZoomUi() {
    const modal = getViewerModalEl();
    if (!modal || modal.dataset.ccZoomBound === "1") return;
    modal.dataset.ccZoomBound = "1";

    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cc-zoom]");
      if (!btn) return;
      const act = btn.getAttribute("data-cc-zoom");
      if (act === "in") setViewerZoom(ccViewerZoom + CC_VIEWER_ZOOM_STEP);
      else if (act === "out") setViewerZoom(ccViewerZoom - CC_VIEWER_ZOOM_STEP);
      else if (act === "reset") setViewerZoom(1);
      else if (act === "fit") fitViewerToScrollWidth();
      else if (act === "readable") fitViewerReadable();
      else if (act === "fullscreen") toggleViewerFullscreen();
    });

    const scroll = getViewerScroll();
    scroll?.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        setViewerZoom(ccViewerZoom + (e.deltaY < 0 ? CC_VIEWER_ZOOM_STEP : -CC_VIEWER_ZOOM_STEP));
      },
      { passive: false }
    );

    scroll?.addEventListener("dblclick", (e) => {
      const img = e.target.closest(".portal-cc-viewer-img");
      if (!img) return;
      if (ccViewerZoom < 1.75) fitViewerReadable();
      else setViewerZoom(1);
    });
  }

  function viewerFeedback(msg, isError) {
    const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
    if (fb && msg) {
      fb.textContent = msg;
      fb.classList.toggle("comprovante-api-status--erro", Boolean(isError));
    }
  }

  async function openComprovanteViewerById(id) {
    const rid = String(id || comprovanteClienteUiIdAtual || "").trim();
    if (!rid) {
      viewerFeedback("Comprovante não identificado. Feche e abra de novo na lista.", true);
      return;
    }
    const rec = await getByIdComArquivo(rid);
    if (!rec) {
      window.alert("Comprovante não encontrado. Toque em «Atualizar da nuvem» e tente de novo.");
      return;
    }
    if (!String(rec.arquivoBase64 || "").trim()) {
      viewerFeedback(
        "Imagem não está neste PC (cópia da nuvem sem ficheiro). Atualize da nuvem no telemóvel que enviou ou peça reenvio.",
        true
      );
      return;
    }
    if (!getViewerModalEl()) {
      window.alert("Visualizador de comprovante indisponível nesta página.");
      return;
    }
    comprovanteClienteUiIdAtual = rec.id;
    openViewer();
  }

  async function openViewer() {
    const rec = await getByIdComArquivo(comprovanteClienteUiIdAtual);
    const stage = getViewerStage();
    const linkAbrir = document.getElementById("portalComprovanteClienteViewerAbrir");
    const modalEl = getViewerModalEl();
    if (!rec) {
      viewerFeedback("Comprovante não encontrado para visualizar.", true);
      return;
    }
    if (!stage || !modalEl) {
      window.alert("Visualizador de comprovante indisponível nesta página.");
      return;
    }

    revokeViewerBlobUrl();
    const blobUrl = arquivoBase64ToBlobUrl(rec.arquivoBase64, rec.mimeType);
    if (!blobUrl) {
      stage.innerHTML =
        '<p class="subtext">Não foi possível abrir o comprovante neste dispositivo. Tente «Atualizar da nuvem» ou reenvio pelo cliente.</p>';
      modalEl.classList.remove("hidden");
      modalEl.setAttribute("aria-hidden", "false");
      viewerFeedback("Não foi possível decodificar a imagem do comprovante.", true);
      return;
    }
    viewerFeedback("", false);
    ccViewerBlobUrl = blobUrl;
    const safeUrl = blobUrl.replace(/"/g, "&quot;");
    const isPdf =
      String(rec.mimeType || "").includes("pdf") || String(rec.arquivoBase64 || "").includes("application/pdf");

    getViewerCard()?.classList.remove("is-cc-viewer-fullscreen");
    ccViewerZoom = 1;
    applyViewerZoom();

    if (isPdf) {
      stage.innerHTML = `<div class="portal-cc-viewer-frame-wrap"><iframe src="${safeUrl}" class="portal-cc-viewer-frame" title="Comprovante PDF"></iframe></div>`;
      window.setTimeout(() => fitViewerReadable(), 120);
    } else {
      stage.innerHTML = `<img src="${safeUrl}" alt="Comprovante" class="portal-cc-viewer-img">`;
      const img = stage.querySelector("img");
      const onReady = () => {
        fitViewerReadable();
        scrollComprovanteAoCentro();
      };
      if (img) {
        if (img.complete && img.naturalWidth) onReady();
        else img.addEventListener("load", onReady, { once: true });
      }
    }

    if (linkAbrir) {
      linkAbrir.href = "#";
      linkAbrir.classList.remove("hidden");
      if (linkAbrir.dataset.dkAbrirBound !== "1") {
        linkAbrir.dataset.dkAbrirBound = "1";
        linkAbrir.addEventListener("click", (ev) => {
          ev.preventDefault();
          if (ccViewerBlobUrl) window.open(ccViewerBlobUrl, "_blank", "noopener,noreferrer");
        });
      }
    }

    modalEl.classList.remove("hidden");
    modalEl.setAttribute("aria-hidden", "false");
    window.setTimeout(() => fitViewerReadable(), 200);
  }

  function closeViewerModal() {
    const modalEl = getViewerModalEl();
    if (modalEl) {
      modalEl.classList.add("hidden");
      modalEl.setAttribute("aria-hidden", "true");
    }
    revokeViewerBlobUrl();
  }

  function scrollComprovanteAoCentro() {
    const scroll = getViewerScroll();
    if (!scroll) return;
    scroll.scrollTop = Math.max(0, (scroll.scrollHeight - scroll.clientHeight) / 2);
    scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
  }

  function bindOperadorUi() {
    if (document.documentElement.dataset.dkCcOperadorBound === "1") return;
    document.documentElement.dataset.dkCcOperadorBound = "1";

    document.getElementById("portalComprovanteClienteDetalheModal")?.addEventListener("click", (e) => {
      const verBtn = e.target.closest("#portalComprovanteClienteBtnVerArquivo");
      if (!verBtn || verBtn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      void openComprovanteViewerById(comprovanteClienteUiIdAtual);
    });

    const abrirHandler = (e) => {
      const btn =
        e.target.closest("[data-cc-abrir]") || e.target.closest("[data-cc-abrir-recusado]");
      if (!btn) return;
      openDetalhe(btn.getAttribute("data-cc-abrir") || btn.getAttribute("data-cc-abrir-recusado"));
    };
    document.getElementById("portalComprovanteClienteLista")?.addEventListener("click", abrirHandler);
    document.getElementById("portalComprovanteClienteListaRecusados")?.addEventListener("click", abrirHandler);

    document.getElementById("portalComprovanteClienteBtnRecusados72h")?.addEventListener("click", () => {
      togglePainelRecusados72h();
    });
    document.getElementById("portalComprovanteClienteBtnListarAssinaturas")?.addEventListener("click", () => {
      togglePainelAssinaturasBanco();
    });

    document.getElementById("portalComprovanteClienteBtnProcessarIa")?.addEventListener("click", async () => {
      const fb = document.getElementById("portalComprovanteClienteListaMsg");
      if (fb) fb.textContent = "A processar fila com IA…";
      await processarFilaComprovantesAutomaticos();
      renderListaOperador();
      renderListaRecusados72h();
      if (fb) fb.textContent = "Processamento automático concluído.";
    });

    document.getElementById("portalComprovanteClienteBtnVerArquivo")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void openComprovanteViewerById(comprovanteClienteUiIdAtual);
    });

    document.getElementById("portalComprovanteClienteBtnIA")?.addEventListener("click", async () => {
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      if (fb) fb.textContent = "A conferir comprovante com IA…";
      const res = await validarComprovanteComIA(comprovanteClienteUiIdAtual);
      if (fb) {
        fb.textContent = res.ok
          ? "Conferência com IA registada pelo operador."
          : res.msg || "Falha.";
        fb.classList.toggle("comprovante-api-status--erro", Boolean(res.duplicata || res.rejeitado));
      }
      if (res.ok || res.rejeitado) {
        fillDetalheModal(getById(comprovanteClienteUiIdAtual));
        renderListaOperador();
        renderListaRecusados72h();
      }
    });

    document.getElementById("portalComprovanteClienteBtnConfirmar")?.addEventListener("click", async () => {
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      const btnConf = document.getElementById("portalComprovanteClienteBtnConfirmar");
      if (btnConf?.disabled) return;
      if (btnConf) btnConf.disabled = true;
      const adminSenha = String(document.getElementById("portalComprovanteAdminSenha")?.value || "").trim();
      if (fb) fb.textContent = "A confirmar pagamento…";
      const res = await confirmarComprovanteCliente(comprovanteClienteUiIdAtual, { adminSenha });
      if (btnConf) btnConf.disabled = false;
      if (fb) fb.textContent = res.ok ? "Pagamento confirmado e registado no protocolo." : res.msg || "Erro.";
      if (res.ok) {
        renderListaOperador();
        renderListaRecusados72h();
        closeModal("portalComprovanteClienteDetalheModal");
        if (typeof window.__DK_refreshOperacaoLancAluguelFromComprovante === "function") {
          window.__DK_refreshOperacaoLancAluguelFromComprovante(res.rec);
        }
      } else {
        const recNow = getById(comprovanteClienteUiIdAtual);
        if (recNow) fillDetalheModal(recNow);
      }
    });

    document.getElementById("portalComprovanteClienteBtnRejeitar")?.addEventListener("click", () => {
      const motivo = window.prompt("Motivo da rejeição (opcional):") || "";
      const res = rejeitarComprovanteCliente(comprovanteClienteUiIdAtual, motivo);
      const fb = document.getElementById("portalComprovanteClienteDetalheFeedback");
      if (fb) fb.textContent = res.ok ? "Comprovante rejeitado." : res.msg;
      if (res.ok) {
        invalidateComprovantesCache();
        renderListaOperador();
        renderListaRecusados72h();
        closeModal("portalComprovanteClienteDetalheModal");
      }
    });

    document.querySelectorAll("[data-close-cc-detalhe]").forEach((el) => {
      el.addEventListener("click", () => closeModal("portalComprovanteClienteDetalheModal"));
    });
    bindViewerCloseButtons();
    document.getElementById("portalComprovanteClienteBtnAtualizarLista")?.addEventListener("click", async () => {
      const fb = document.getElementById("portalComprovanteClienteListaMsg");
      if (fb) fb.textContent = "A carregar da nuvem…";
      invalidateComprovantesCache();
      try {
        if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
          await window.__DK_pullCloudSnapshotSilentMerge();
        }
      } catch {
        /* ignore */
      }
      if (fb) fb.textContent = "A processar comprovantes com IA automática…";
      await processarFilaComprovantesAutomaticos();
      renderListaOperador();
      renderListaRecusados72h();
      if (fb) fb.textContent = "Lista atualizada.";
    });
  }

  function bindViewerCloseButtons() {
    document.querySelectorAll("[data-close-cc-viewer]").forEach((el) => {
      if (el.dataset.dkCcCloseBound === "1") return;
      el.dataset.dkCcCloseBound = "1";
      el.addEventListener("click", () => closeViewerModal());
    });
  }

  function initViewerUiShared() {
    bindViewerZoomUi();
    bindViewerCloseButtons();
  }

  async function initOperadorUi() {
    bindOperadorUi();
    initViewerUiShared();
    bindOpenAIKeyUi();
    refreshOperadorConferenciaHint();
    const rep = await repararHistoricoComprovantesNuvem();
    const fb = document.getElementById("portalComprovanteClienteListaMsg");
    if (fb && rep.changed) {
      fb.textContent = `Histórico reparado: ${rep.aguardam} aguardam confirmação · ${rep.confirmados} já confirmados.`;
    }
    renderListaOperador();
    renderListaRecusados72h();
    probeOpenAIServer();
    await processarFilaComprovantesAutomaticos();
    await repararHistoricoComprovantesNuvem();
    renderListaOperador();
    renderListaRecusados72h();
  }

  window.__DK_comprovantesClienteAdd = adicionarComprovanteCliente;
  window.__DK_computeComprovanteFingerprintFromBase64 = computeComprovanteFingerprint;
  window.__DK_comprovantesClienteDetectarDuplicado = detectarComprovanteDuplicado;
  window.__DK_comprovantesClienteDetectarDuplicidadeLogica = detectarDuplicidadeLogica;
  window.__DK_comprovantesClienteSincronizarBancoAssinaturas = sincronizarBancoAssinaturas;
  window.__DK_listarAssinaturasComprovantes = listarAssinaturasComprovantesSistema;
  window.__DK_comprovantesClienteListPendentes = listarPendentesOperador;
  window.__DK_comprovantesClienteListByCpf = listarPorCliente;
  window.__DK_comprovantesClienteGet = getById;
  window.__DK_openComprovanteClienteViewerById = openComprovanteViewerById;
  window.__DK_comprovantesClienteValidateIA = validarComprovanteComIA;
  window.__DK_comprovantesClienteConfirmar = confirmarComprovanteCliente;
  window.__DK_comprovantesClienteDeAcordo = marcarClienteDeAcordoComRecusa;
  window.__DK_comprovantesClienteProcessarAutomatico = processarComprovanteAutomatico;
  window.__DK_comprovantesClienteProcessarFilaAutomatica = processarFilaComprovantesAutomaticos;
  window.__DK_comprovantesClienteListRecusados72h = listarRecusadosUltimas72h;
  window.__DK_comprovantesClienteRepararHistorico = repararHistoricoComprovantesNuvem;
  window.__DK_comprovantesClienteInvalidateCache = invalidateComprovantesCache;
  window.__DK_comprovantesClientePushNuvem = pushNuvem;
  window.__DK_comprovantesClientePayloadParaNuvem = payloadComprovantesParaNuvem;
  window.__DK_comprovantesClienteMigrarStorage = migrarArquivosInlineParaIdbSeNecessario;
  window.__DK_comprovantesClienteTemPendentesNuvem = function temPendentesNuvem() {
    return loadAll({ leitura: true }).some((r) => r.syncNuvem === "pendente");
  };

  async function limparComprovantesIdbCompleto() {
    try {
      const db = await openComprovantesArquivosDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(CC_ARQUIVOS_STORE, "readwrite");
        tx.objectStore(CC_ARQUIVOS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      ccArquivoMemoria.clear();
      return true;
    } catch (e) {
      console.warn("[DK comprovantes] limpar IndexedDB", e);
      return false;
    }
  }

  function filterLsArrayByCpf(key, cpfSet, cpfField = "cpf") {
    const report = { key, removed: 0 };
    let arr = [];
    try {
      const raw = localStorage.getItem(key);
      arr = raw ? JSON.parse(raw) : [];
    } catch {
      arr = [];
    }
    if (!Array.isArray(arr)) return report;
    const antes = arr.length;
    const kept = arr.filter((r) => !cpfSet.has(onlyDigits(r[cpfField]).slice(0, 11)));
    localStorage.setItem(key, JSON.stringify(kept));
    report.removed = antes - kept.length;
    return report;
  }

  /** Remove comprovantes, notificações, locações e lançamentos dos CPFs (teste / reinício). Portal + app cliente. */
  async function purgeClientesPorCpf(cpfs) {
    const set = new Set(
      (Array.isArray(cpfs) ? cpfs : String(cpfs || "").split(/[,;]/))
        .map((c) => onlyDigits(c).slice(0, 11))
        .filter((c) => c.length === 11)
    );
    const report = { cpfs: [...set], removed: {}, idbLimpo: false };
    if (!set.size) return { ok: false, msg: "Informe CPF(s) com 11 dígitos." };

    const allCc = loadAllRaw();
    for (const r of allCc) {
      if (!set.has(onlyDigits(r.cpf).slice(0, 11))) continue;
      if (r.id) await removerArquivoComprovanteIdb(r.id);
    }
    report.idbLimpo = await limparComprovantesIdbCompleto();

    const keysFixas = [
      STORAGE_KEY,
      "dk_cliente_notificacoes",
      BANCO_ASSINATURAS_KEY,
      "dk_comprovantes_banco",
      "dk_cliente_comprovantes_enviados",
      "dk_lancamentos_aluguel",
      "dk_lancamentos_aluguel_cadastro",
      "dk_clientes_validacao_pendente",
    ];
    for (const k of keysFixas) {
      const r = filterLsArrayByCpf(k, set);
      if (r.removed) report.removed[k] = r.removed;
    }

    try {
      const sess = JSON.parse(localStorage.getItem("dk_sessao_cliente_app") || "null");
      if (sess && set.has(onlyDigits(sess.cpf).slice(0, 11))) {
        localStorage.removeItem("dk_sessao_cliente_app");
        report.removed.dk_sessao_cliente_app = 1;
      }
    } catch {
      /* ignore */
    }
    localStorage.removeItem("dk_cliente_comprovantes_enviados");
    localStorage.removeItem("dkCloudLastPushedAt");

    const cadLocKey =
      typeof CAD_LOCACOES_KEY !== "undefined" ? CAD_LOCACOES_KEY : "dk_locacoes_cadastro";
    if (typeof loadCadastro === "function" && typeof saveCadastro === "function") {
      let locs = loadCadastro(cadLocKey);
      const antes = locs.length;
      locs = locs.filter((l) => !set.has(onlyDigits(l.cpf).slice(0, 11)));
      saveCadastro(cadLocKey, locs, { bypassImmutabilidadeCadastro: true });
      report.removed.dk_locacoes_cadastro = antes - locs.length;
      const portalKey = "dk_portal_clientes_cadastro";
      if (portalKey !== cadLocKey) {
        let plocs = loadCadastro(portalKey);
        const a2 = plocs.length;
        plocs = plocs.filter((l) => !set.has(onlyDigits(l.cpf).slice(0, 11)));
        saveCadastro(portalKey, plocs, { bypassImmutabilidadeCadastro: true });
        report.removed[portalKey] = a2 - plocs.length;
      }
    }

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("dk_")) continue;
      if (keysFixas.includes(key)) continue;
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) continue;
        const r = filterLsArrayByCpf(key, set);
        if (r.removed) report.removed[key] = (report.removed[key] || 0) + r.removed;
      } catch {
        /* ignore */
      }
    }

    invalidateComprovantesCache();
    if (typeof window.__DK_markLocalDataAuthority === "function") {
      window.__DK_markLocalDataAuthority(60 * 60 * 1000);
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      report.cloud = await window.__DK_pushCloudSnapshotNow();
    }
    if (typeof window.__DK_refreshComprovantesClienteLista === "function") {
      await window.__DK_refreshComprovantesClienteLista();
    } else if (document.getElementById("portalComprovanteClienteLista")) {
      renderListaOperador();
      renderListaRecusados72h();
    }
    if (window.__DK_CLIENTE_APP && typeof window.__DK_clienteAppRecarregar === "function") {
      window.__DK_clienteAppRecarregar();
    }
    return { ok: true, report };
  }

  window.__DK_purgeClientesPorCpf = purgeClientesPorCpf;
  window.__DK_purgeClientesTestePadrao = function purgeClientesTestePadrao() {
    return purgeClientesPorCpf(["19174403400", "06523244440"]);
  };

  const DK_AUTO_PURGE_TESTE_FLAG = "dk_auto_purge_clientes_teste_v3";

  async function executarAutoPurgeClientesTesteSeNecessario() {
    try {
      if (localStorage.getItem(DK_AUTO_PURGE_TESTE_FLAG) === "done") return null;
    } catch {
      return null;
    }
    const r = await purgeClientesPorCpf(["19174403400", "06523244440"]);
    try {
      localStorage.setItem(DK_AUTO_PURGE_TESTE_FLAG, "done");
    } catch {
      /* ignore */
    }
    return r;
  }

  window.__DK_executarAutoPurgeClientesTeste = executarAutoPurgeClientesTesteSeNecessario;
  window.__DK_refreshComprovantesClienteLista = async function refreshComprovantesClienteLista() {
    refreshOperadorConferenciaHint();
    const rep = await repararHistoricoComprovantesNuvem();
    const fb = document.getElementById("portalComprovanteClienteListaMsg");
    if (fb && rep.changed) {
      fb.textContent = `Histórico reparado: ${rep.aguardam} aguardam confirmação · ${rep.confirmados} confirmados.`;
    }
    await processarFilaComprovantesAutomaticos();
    await repararHistoricoComprovantesNuvem();
    renderListaOperador();
    renderListaRecusados72h();
  };

  async function bootstrapPortalComprovantesCliente() {
    await executarAutoPurgeClientesTesteSeNecessario();
    if (document.getElementById("portalComprovanteClienteLista")) await initOperadorUi();
    else if (getViewerModalEl()) initViewerUiShared();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bootstrapPortalComprovantesCliente().catch((e) => console.warn("[DK comprovantes] arranque", e));
    });
  } else {
    bootstrapPortalComprovantesCliente().catch((e) => console.warn("[DK comprovantes] arranque", e));
  }
})();
