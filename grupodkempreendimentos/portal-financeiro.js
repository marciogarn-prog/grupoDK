/**
 * Portal DK Locadora — Financeiro (Santander / Sicredi).
 * IA lê imagens ou PDF de extrato e agrega entradas/saídas por dia, semana e mês.
 */
(function portalFinanceiro() {
  const STORAGE_KEY = "dk_financeiro_extratos_v1";
  const OPENAI_KEY_STORAGE = "dk_openai_api_key";
  const BANCOS = {
    santander: "Santander",
    sicredi: "Sicredi",
  };

  /** Sugestão inicial se o operador ainda não guardou instruções. */
  const INSTRUCOES_PADRAO_BANCO = {
    santander: `App Santander (captura de ecrã): cada cabeçalho com calendário — ex. «Segunda, 18 de maio» — vale para TODOS os lançamentos abaixo até ao próximo cabeçalho de data. «Pix recebido» = entrada; «Pix enviado» = saída. Nome por baixo do tipo = pagadorNome. Complete o ano (ex.: maio/2023 → 18/05/2023).`,
    sicredi: `App Sicredi: cabeçalhos de data agrupam os lançamentos abaixo. Crédito = entrada; débito = saída. Propague a data do cabeçalho a cada movimento.`,
  };

  const MESES_PT = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  const panel = document.getElementById("panel-financeiro-locadora");
  if (!panel) return;

  const placeholder = document.getElementById("financeiroFormPlaceholder");
  const paneBanco = document.getElementById("financeiroPaneBanco");
  const tituloBanco = document.getElementById("financeiroBancoTitulo");
  const pasteZone = document.getElementById("financeiroExtratoPasteZone");
  const fileInp = document.getElementById("financeiroExtratoFile");
  const arquivoLbl = document.getElementById("financeiroExtratoArquivoLbl");
  const msgEl = document.getElementById("financeiroExtratoMsg");
  const extrairBtn = document.getElementById("financeiroExtratoExtrairIaBtn");
  const limparBtn = document.getElementById("financeiroExtratoLimparBtn");
  const uploadsLista = document.getElementById("financeiroUploadsLista");
  const resumoDados = document.getElementById("financeiroResumoDados");
  const verRelatorioBtn = document.getElementById("financeiroVerRelatorioBtn");
  const relatorioModal = document.getElementById("financeiroRelatorioModal");
  const relatorioConteudo = document.getElementById("financeiroRelatorioConteudo");
  const relatorioModalSub = document.getElementById("financeiroRelatorioModalSub");
  const relatorioPeriodoLbl = document.getElementById("financeiroRelatorioPeriodoLbl");
  const filtroDe = document.getElementById("financeiroFiltroDe");
  const filtroAte = document.getElementById("financeiroFiltroAte");
  const filtroCategoria = document.getElementById("financeiroFiltroCategoria");

  let bancoAtivo = "";
  /** Fila antes da IA: { id, file, nome }[] */
  let arquivosPendentes = [];
  let revisaoEmCurso = false;
  let revisaoUploadIdPendente = null;
  let revisaoErrosUploadIdFocus = null;
  const pendentesLista = document.getElementById("financeiroPendentesLista");
  const revisarTodosBtn = document.getElementById("financeiroExtratoRevisarTodosBtn");
  const verErrosIaBtn = document.getElementById("financeiroVerErrosIaBtn");
  const revisarArquivoInp = document.getElementById("financeiroRevisarArquivoInput");
  const revisarLoteInp = document.getElementById("financeiroRevisarLoteInput");
  const iaInstrucoesEl = document.getElementById("financeiroIaInstrucoes");
  const revisaoErrosModal = document.getElementById("financeiroRevisaoErrosModal");
  const INSTRUCOES_IA_KEY = "dk_financeiro_ia_instrucoes_v1";

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currencyBRL(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "R$ 0,00";
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function normBucket(b) {
    if (Array.isArray(b)) return { uploads: b };
    if (b && Array.isArray(b.uploads)) return { uploads: b.uploads };
    return { uploads: [] };
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const o = raw ? JSON.parse(raw) : {};
      return {
        santander: normBucket(o.santander),
        sicredi: normBucket(o.sicredi),
      };
    } catch {
      return { santander: { uploads: [] }, sicredi: { uploads: [] } };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getUploads(banco) {
    return loadStore()[banco]?.uploads || [];
  }

  function setUploads(banco, uploads) {
    const store = loadStore();
    store[banco] = { uploads };
    saveStore(store);
    agendarSyncNuvem();
  }

  function agendarSyncNuvem() {
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
    }
  }

  function periodoAcumuladoTexto(banco) {
    const movs = todosMovimentosBanco(banco, false);
    let min = null;
    let max = null;
    for (const m of movs) {
      const d = parseBrDate(m.data);
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    if (!min) return "";
    if (max && formatBrDate(min) !== formatBrDate(max)) {
      return ` · acumulado de ${formatBrDate(min)} a ${formatBrDate(max)}`;
    }
    return ` · desde ${formatBrDate(min)}`;
  }

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normNome(s) {
    return String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function extrairCpfsDoTexto(texto) {
    const out = [];
    const s = String(texto || "");
    const re = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}/g;
    let m;
    while ((m = re.exec(s))) {
      const d = onlyDigits(m[0]);
      if (d.length === 11) out.push(d);
    }
    return [...new Set(out)];
  }

  function extrairNomePix(descricao) {
    const d = String(descricao || "");
    const patterns = [
      /(?:pix\s+)?recebido\s+de\s+(.+?)(?:\s+[-–]|\s+cpf|\s+cnpj|\s+valor|$)/i,
      /(?:transfer[eê]ncia|ted)\s+de\s+(.+?)(?:\s+[-–]|\s+cpf|$)/i,
      /(?:credito|cr[eé]dito)\s+[-–]?\s*(.+?)(?:\s+[-–]|$)/i,
      /^(.+?)\s+[-–]\s+pix/i,
    ];
    for (const re of patterns) {
      const m = d.match(re);
      if (m?.[1]) {
        const n = String(m[1]).trim().replace(/\s+/g, " ");
        if (n.length >= 3 && n.length <= 120) return n;
      }
    }
    return "";
  }

  function resolverPagador(mov) {
    let cpf = onlyDigits(mov.pagadorCpf || mov.cpfPagador || "");
    let nome = String(mov.pagadorNome || mov.nomePagador || "").trim();
    const desc = String(mov.descricao || "");
    if (!cpf) {
      const cpfs = extrairCpfsDoTexto(desc);
      if (cpfs.length) cpf = cpfs[0];
    }
    if (!nome) nome = extrairNomePix(desc);
    if (!nome && desc.length >= 3 && desc.length <= 100) nome = desc;
    return { cpf, nome };
  }

  function buscarClienteCadastro(cpf, nome) {
    if (cpf.length === 11 && typeof findClienteByCpfCadastro === "function") {
      const c = findClienteByCpfCadastro(cpf);
      if (c) {
        return {
          status: "cadastrado",
          nomeCadastro: String(c.nome || "").trim(),
          cpf: onlyDigits(c.cpf),
        };
      }
    }
    const nn = normNome(nome);
    if (nn.length >= 4) {
      let clientes = [];
      try {
        const raw = localStorage.getItem("dk_clientes_cadastro");
        clientes = raw ? JSON.parse(raw) : [];
      } catch {
        clientes = [];
      }
      for (const c of clientes) {
        const cn = normNome(c.nome);
        if (!cn) continue;
        if (cn === nn || cn.includes(nn) || nn.includes(cn)) {
          return {
            status: "cadastrado",
            nomeCadastro: String(c.nome || "").trim(),
            cpf: onlyDigits(c.cpf),
          };
        }
      }
    }
    if (!nome && !cpf) {
      return { status: "indeterminado", nomeCadastro: "", cpf: "" };
    }
    return { status: "nao_cadastrado", nomeCadastro: "", cpf: cpf || "" };
  }

  /** Histórico normalizado para comparar linhas repetidas (IA pode mudar pontuação). */
  function normDescricaoParaDedupe(s) {
    return normNome(s)
      .replace(/\b(PIX|TED|DOC|TEF|TRANSF)\b/g, " ")
      .replace(/\d{2}:\d{2}(:\d{2})?/g, " ")
      .replace(/\bE\d{10,}\b/g, " ")
      .replace(/\b\d{20,}\b/g, " ")
      .replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function movimentoFingerprint(m) {
    const { cpf, nome } = resolverPagador(m);
    return [
      dateKeyBr(m.data),
      m.tipo,
      Number(m.valor).toFixed(2),
      normDescricaoParaDedupe(m.descricao).slice(0, 80),
      cpf,
      normNome(nome).slice(0, 40),
    ].join("|");
  }

  /** Chave mais tolerante: mesmo dia + valor + tipo + CPF ou nome do pagador. */
  function movimentoFingerprintLoose(m) {
    const { cpf, nome } = resolverPagador(m);
    const base = `${dateKeyBr(m.data)}|${m.tipo}|${Number(m.valor).toFixed(2)}`;
    if (cpf.length === 11) return `${base}|cpf:${cpf}`;
    const n = normNome(nome);
    if (n.length >= 4) return `${base}|nome:${n.slice(0, 36)}`;
    const d = normDescricaoParaDedupe(m.descricao).slice(0, 40);
    return `${base}|d:${d}`;
  }

  function descricoesEquivalentes(a, b) {
    const x = normDescricaoParaDedupe(a);
    const y = normDescricaoParaDedupe(b);
    if (!x || !y) return false;
    if (x === y) return true;
    if (x.length >= 10 && y.length >= 10 && (x.includes(y) || y.includes(x))) return true;
    return false;
  }

  function isMovimentoDuplicado(m, seenExact, seenLoose, existentes) {
    const ex = movimentoFingerprint(m);
    const lo = movimentoFingerprintLoose(m);
    if (seenExact.has(ex) || seenLoose.has(lo)) return true;

    const dk = dateKeyBr(m.data);
    const v = Number(m.valor).toFixed(2);
    const { cpf: cpfM, nome: nomeM } = resolverPagador(m);

    for (const e of existentes) {
      if (dateKeyBr(e.data) !== dk || e.tipo !== m.tipo) continue;
      if (Number(e.valor).toFixed(2) !== v) continue;

      if (descricoesEquivalentes(m.descricao, e.descricao)) return true;

      const { cpf: cpfE, nome: nomeE } = resolverPagador(e);
      if (cpfM.length === 11 && cpfM === cpfE) return true;

      const nm = normNome(nomeM);
      const ne = normNome(nomeE);
      if (nm.length >= 4 && ne.length >= 4 && (nm === ne || nm.includes(ne) || ne.includes(nm))) {
        return true;
      }
    }
    return false;
  }

  function dedupeListaMovimentos(lista) {
    const seenExact = new Set();
    const seenLoose = new Set();
    const out = [];
    const existentes = [];
    for (const m of lista) {
      if (isMovimentoDuplicado(m, seenExact, seenLoose, existentes)) continue;
      seenExact.add(movimentoFingerprint(m));
      seenLoose.add(movimentoFingerprintLoose(m));
      existentes.push(m);
      out.push(m);
    }
    return out;
  }

  /** Separa movimentos novos dos que já existem na base acumulativa. */
  function filtrarMovimentosNovos(novos, banco) {
    const base = todosMovimentosBanco(banco);
    const seenExact = new Set(base.map((m) => movimentoFingerprint(m)));
    const seenLoose = new Set(base.map((m) => movimentoFingerprintLoose(m)));
    const existentes = [...base];
    const kept = [];
    let ignorados = 0;
    for (const m of novos) {
      if (isMovimentoDuplicado(m, seenExact, seenLoose, existentes)) {
        ignorados += 1;
        continue;
      }
      seenExact.add(movimentoFingerprint(m));
      seenLoose.add(movimentoFingerprintLoose(m));
      existentes.push(m);
      kept.push(m);
    }
    return { kept, ignorados };
  }

  function movimentoNoPeriodo(m, deBr, ateBr) {
    const d = parseBrDate(m.data);
    if (!d) return false;
    const de = parseBrDate(deBr);
    const ate = parseBrDate(ateBr);
    if (de) {
      de.setHours(0, 0, 0, 0);
      if (d < de) return false;
    }
    if (ate) {
      ate.setHours(23, 59, 59, 999);
      if (d > ate) return false;
    }
    return true;
  }

  function limitesDatasMovimentos(movs) {
    let min = null;
    let max = null;
    for (const m of movs) {
      const d = parseBrDate(m.data);
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    return { min, max };
  }

  function newId() {
    return `fin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function parseBrDate(s) {
    const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function normMesPt(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /** DD/MM/AAAA, DD/MM+ano, «18 de maio», «Segunda, 18 de maio». */
  function parseDataExtratoFlexivel(s, anoRef) {
    const t = String(s ?? "").trim();
    if (!t) return null;

    let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;

    m = t.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m && anoRef) {
      return formatBrDate(new Date(Number(anoRef), Number(m[2]) - 1, Number(m[1])));
    }

    m = t.match(/(\d{1,2})\s+de\s+([a-zà-úç]+)/i);
    if (m) {
      const mes = MESES_PT[normMesPt(m[2])];
      const ano = anoRef || new Date().getFullYear();
      if (mes) return formatBrDate(new Date(ano, mes - 1, Number(m[1])));
    }

    return null;
  }

  function inferirAnoReferencia(parsed, nomeArquivo, movimentosBase) {
    const yParsed = Number(parsed?.anoReferencia);
    if (Number.isFinite(yParsed) && yParsed >= 2000 && yParsed <= 2100) return yParsed;

    for (const src of [
      String(parsed?.observacoes || ""),
      String(nomeArquivo || ""),
      JSON.stringify(parsed?.cabecalhosDatas || []),
    ]) {
      const ym = src.match(/20\d{2}/);
      if (ym) return Number(ym[0]);
    }

    for (const m of movimentosBase || []) {
      const d = parseBrDate(parseDataExtratoFlexivel(m?.data, null) || m?.data);
      if (d) return d.getFullYear();
    }

    if (bancoAtivo) {
      for (const m of todosMovimentosBanco(bancoAtivo)) {
        const d = parseBrDate(m.data);
        if (d) return d.getFullYear();
      }
    }

    return new Date().getFullYear();
  }

  function inferirTipoPorDescricao(descricao, tipoAtual) {
    const t = String(tipoAtual || "").toLowerCase();
    if (t === "entrada" || t === "saida") return t;
    const d = String(descricao || "");
    if (/pix\s*recebid|credito|cr[eé]dito|dep[oó]sito|recebiment/i.test(d)) return "entrada";
    if (/pix\s*enviad|d[eé]bito|debito|pagament|saque|tarifa|envio/i.test(d)) return "saida";
    return t || "saida";
  }

  /**
   * App móvel: cabeçalhos de data + movimentos. Aceita secoes[] ou movimentos[] plano.
   */
  function flattenExtratoParsed(parsed, nomeArquivo) {
    const anoRef = inferirAnoReferencia(parsed, nomeArquivo, parsed?.movimentos);
    const out = [];

    const secoes = parsed?.secoes || parsed?.gruposPorData || parsed?.grupos || [];
    if (Array.isArray(secoes) && secoes.length) {
      for (const sec of secoes) {
        const dataHeader = parseDataExtratoFlexivel(
          sec.data || sec.dataCabecalho || sec.dataCabecalhoBr || sec.dataTextoOriginal || sec.cabecalho,
          anoRef
        );
        const movs = sec.movimentos || sec.lancamentos || [];
        for (const m of movs) {
          out.push({
            ...m,
            data:
              parseDataExtratoFlexivel(m.data || m.dataMovimento, anoRef) ||
              dataHeader ||
              m.data ||
              m.dataMovimento,
          });
        }
      }
    } else {
      const flat = parsed?.movimentos || parsed?.lancamentos || [];
      for (const m of flat) {
        out.push({
          ...m,
          data: parseDataExtratoFlexivel(m.data || m.dataMovimento, anoRef) || m.data || m.dataMovimento,
        });
      }
    }

    if (!out.length) return out;

    let dataCorrente = "";
    const cabecalhos = Array.isArray(parsed?.cabecalhosDatas) ? parsed.cabecalhosDatas : [];
    let cabIdx = 0;

    return out.map((m) => {
      const bruta = String(m.data || "").trim();
      const parsedData = parseDataExtratoFlexivel(bruta, anoRef);
      const desc = String(m.descricao || m.historico || m.lancamento || "").trim();
      const soData =
        parsedData &&
        (!desc || /^(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)/i.test(desc));

      if (soData && !/pix/i.test(desc)) {
        dataCorrente = parsedData;
        return { ...m, data: parsedData, _cabecalhoData: true };
      }

      if (parsedData) dataCorrente = parsedData;
      else if (!dataCorrente && cabIdx < cabecalhos.length) {
        const dc = parseDataExtratoFlexivel(cabecalhos[cabIdx], anoRef);
        if (dc) {
          dataCorrente = dc;
          cabIdx += 1;
        }
      }

      return {
        ...m,
        data: parsedData || dataCorrente || bruta,
      };
    }).filter((m) => !m._cabecalhoData);
  }

  function contarDatasUnicasMovimentos(movs) {
    const set = new Set();
    for (const m of movs || []) {
      const k = dateKeyBr(m.data);
      if (k) set.add(k);
    }
    return set.size;
  }

  function blocoLayoutAppMobile(bancoLabel) {
    const b = String(bancoLabel || "").toLowerCase();
    const app = b.includes("sant") ? "Santander" : b.includes("sicr") ? "Sicredi" : "banco";
    return `

LAYOUT APP MÓVEL (${app} — captura WhatsApp/ecrã):
- Cabeçalhos de DATA aparecem UMA vez com ícone de calendário (ex.: «Segunda, 18 de maio», «Terça, 19 de maio»).
- TODOS os lançamentos IMEDIATAMENTE ABAIXO desse cabeçalho pertencem a essa data, até aparecer o PRÓXIMO cabeçalho.
- Cada lançamento: tipo («Pix recebido», «Pix enviado»), nome da pessoa, valor R$ à direita.
- «Pix recebido» = entrada; «Pix enviado» = saida.
- OBRIGATÓRIO: preencha o campo data (DD/MM/AAAA) em CADA movimento, propagando a data do cabeçalho vigente.
- Use o formato secoes[] quando for captura de app: [{ "dataCabecalho":"18/05/2023", "dataTextoOriginal":"Segunda, 18 de maio", "movimentos":[...] }].
- Informe anoReferencia (ex.: 2023) e cabecalhosDatas (lista de todas as datas de cabeçalho visíveis na imagem).
- NÃO omita nenhum Pix visível — conte todos os cabeçalhos de data da imagem.`;
  }

  function formatBrDate(d) {
    const p2 = (n) => String(n).padStart(2, "0");
    return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function dateKeyBr(s) {
    const d = parseBrDate(s);
    if (!d) return "";
    const p2 = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }

  /** Segunda-feira como início da semana (ISO-like label). */
  function weekKeyFromBr(s) {
    const d = parseBrDate(s);
    if (!d) return "";
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    const p2 = (n) => String(n).padStart(2, "0");
    return `${mon.getFullYear()}-S${p2(mon.getDate())}/${p2(mon.getMonth() + 1)}`;
  }

  function monthKeyFromBr(s) {
    const d = parseBrDate(s);
    if (!d) return "";
    const p2 = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
  }

  function monthLabel(key) {
    const [y, m] = String(key).split("-");
    if (!y || !m) return key;
    const meses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const mi = Number(m) - 1;
    return `${meses[mi] || m}/${y}`;
  }

  function weekLabel(key) {
    const rest = String(key).replace(/^\d{4}-S/, "");
    return rest ? `Semana a partir de ${rest}` : key;
  }

  function normalizarMovimentos(lista, anoRef) {
    const out = [];
    for (const m of lista || []) {
      let data = parseDataExtratoFlexivel(m.data || m.dataMovimento, anoRef) || String(m.data || m.dataMovimento || "").trim();
      const descricao = String(m.descricao || m.historico || m.lancamento || "").trim();
      let valor = Number(m.valor);
      if (!Number.isFinite(valor)) {
        const v2 = String(m.valor || "")
          .replace(/\./g, "")
          .replace(",", ".")
          .replace(/[^\d.-]/g, "");
        valor = Number(v2);
      }
      if (!Number.isFinite(valor) || valor <= 0) continue;

      const nomePix = String(m.pagadorNome || m.nomePagador || "").trim();
      const descCompleta = nomePix && !descricao.includes(nomePix) ? `${descricao} — ${nomePix}`.trim() : descricao;

      let tipo = inferirTipoPorDescricao(descCompleta, String(m.tipo || "").toLowerCase());
      if (tipo !== "entrada" && tipo !== "saida") {
        tipo = m.credito === true || m.debito === false ? "entrada" : "saida";
      }
      if (tipo !== "entrada" && tipo !== "saida") {
        const sinal = String(m.sinal || "").toLowerCase();
        tipo = sinal === "+" || sinal === "c" ? "entrada" : "saida";
      }

      const pagadorNome = nomePix || (descricao.match(/pix\s+(?:recebid|enviad)[oa]?\s*(.*)/i)?.[1]?.trim()) || "";
      const pagadorCpf = onlyDigits(m.pagadorCpf || m.cpfPagador || "");
      const categoria = String(m.categoria || "").trim() || (/pix/i.test(descCompleta) ? "pix" : "");

      if (!parseBrDate(data)) continue;

      out.push({
        data,
        descricao: descCompleta || descricao,
        valor: Math.abs(valor),
        tipo,
        pagadorNome,
        pagadorCpf,
        categoria,
      });
    }
    return out;
  }

  /** Base acumulativa sem duplicar linhas repetidas entre ficheiros/dias. */
  function todosMovimentosBanco(banco, dedupe) {
    const uploads = getUploads(banco);
    const brutos = [];
    for (const u of uploads) {
      for (const m of u.movimentos || []) {
        brutos.push({ ...m, _uploadId: u.id, _arquivo: u.nomeArquivo });
      }
    }
    if (dedupe === false) return brutos;
    return dedupeListaMovimentos(brutos);
  }

  function agregar(movs, keyFn, labelFn) {
    const map = new Map();
    for (const m of movs) {
      const k = keyFn(m.data);
      if (!k) continue;
      if (!map.has(k)) map.set(k, { key: k, label: labelFn(k), entrada: 0, saida: 0, qtd: 0 });
      const row = map.get(k);
      if (m.tipo === "entrada") row.entrada += m.valor;
      else row.saida += m.valor;
      row.qtd += 1;
    }
    return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  }

  function renderTabelaAgg(titulo, rows) {
    if (!rows.length) {
      return `<p class="subtext">${escapeHtml(titulo)}: sem movimentos com data válida.</p>`;
    }
    let totE = 0;
    let totS = 0;
    const trs = rows
      .map((r) => {
        totE += r.entrada;
        totS += r.saida;
        const saldo = r.entrada - r.saida;
        return `<tr>
          <td>${escapeHtml(r.label)}</td>
          <td class="financeiro-num">${currencyBRL(r.entrada)}</td>
          <td class="financeiro-num">${currencyBRL(r.saida)}</td>
          <td class="financeiro-num">${currencyBRL(saldo)}</td>
          <td>${r.qtd}</td>
        </tr>`;
      })
      .join("");
    return `
      <h4 class="financeiro-relatorio__subtitle">${escapeHtml(titulo)}</h4>
      <div class="portal-lanc-hist-wrap">
        <table class="portal-lanc-hist financeiro-relatorio-table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Entradas</th>
              <th>Saídas</th>
              <th>Saldo</th>
              <th>Qtd.</th>
            </tr>
          </thead>
          <tbody>${trs}</tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td class="financeiro-num"><strong>${currencyBRL(totE)}</strong></td>
              <td class="financeiro-num"><strong>${currencyBRL(totS)}</strong></td>
              <td class="financeiro-num"><strong>${currencyBRL(totE - totS)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  function atualizarResumoBar() {
    if (!bancoAtivo) return;
    const uploads = getUploads(bancoAtivo);
    const movs = todosMovimentosBanco(bancoAtivo);
    const nArq = uploads.length;
    const nMov = movs.length;
    if (resumoDados) {
      const acum = nMov > 0 ? periodoAcumuladoTexto(bancoAtivo) : "";
      resumoDados.textContent =
        nMov > 0
          ? `Base acumulativa: ${nMov} movimento(s) em ${nArq} ficheiro(s)${acum}. Novos envios somam a esta base. Use «Ver relatório».`
          : nArq > 0
            ? `${nArq} ficheiro(s) sem movimentos válidos.`
            : "Nenhum movimento guardado ainda. Cada extrato que enviar fica guardado e acumula.";
    }
    if (verRelatorioBtn) {
      verRelatorioBtn.disabled = nMov === 0;
    }
    atualizarBotaoRevisarTodos();
  }

  function renderTabelaLancamentos(titulo, linhas, cols) {
    if (!linhas.length) {
      return `<p class="subtext">${escapeHtml(titulo)}: nada no período.</p>`;
    }
    const head = cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
    const body = linhas
      .map((row) => {
        const tds = cols.map((c) => {
          const v = c.render ? c.render(row) : row[c.key];
          return `<td${c.num ? ' class="financeiro-num"' : ""}>${v}</td>`;
        });
        return `<tr>${tds.join("")}</tr>`;
      })
      .join("");
    return `
      <h4 class="financeiro-relatorio__subtitle">${escapeHtml(titulo)}</h4>
      <div class="portal-lanc-hist-wrap">
        <table class="portal-lanc-hist financeiro-relatorio-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  const CATEGORIA_LABELS = {
    resumo: "Resumo — entradas e saídas por dia, semana e mês",
    entradas: "Total de entradas no período",
    saidas: "Saídas no período",
    clientes_repetidos: "Clientes repetidos (vários pagamentos)",
    quem_pagou: "Quem pagou — cruzamento com cadastro",
  };

  let relatorioEstadoAtual = null;
  const relatorioExportAcoes = document.getElementById("financeiroRelatorioExportAcoes");

  function coletarEstadoRelatorio() {
    const de = String(filtroDe?.value || "").trim();
    const ate = String(filtroAte?.value || "").trim();
    const cat = String(filtroCategoria?.value || "resumo");
    const todos = todosMovimentosBanco(bancoAtivo);
    const movs = todos.filter((m) => movimentoNoPeriodo(m, de, ate));
    return {
      de,
      ate,
      cat,
      catLabel: CATEGORIA_LABELS[cat] || cat,
      banco: bancoAtivo,
      bancoLabel: BANCOS[bancoAtivo] || bancoAtivo,
      movs,
      totalBase: todos.length,
      hasData: movs.length > 0,
    };
  }

  function aggRowsPlain(rows) {
    return rows.map((r) => [
      r.label,
      currencyBRL(r.entrada),
      currencyBRL(r.saida),
      currencyBRL(r.entrada - r.saida),
      String(r.qtd),
    ]);
  }

  function buildRelatorioSections(estado) {
    const { movs, cat } = estado;
    const sections = [];
    if (!movs.length) return sections;

    if (cat === "resumo") {
      const porDia = agregar(movs, dateKeyBr, (k) => {
        const p = k.split("-");
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : k;
      });
      const porSemana = agregar(movs, weekKeyFromBr, weekLabel);
      const porMes = agregar(movs, monthKeyFromBr, monthLabel);
      const aggHeaders = ["Período", "Entradas", "Saídas", "Saldo", "Qtd."];
      if (porDia.length) {
        sections.push({ title: "Por dia", headers: aggHeaders, rows: aggRowsPlain(porDia), numericCols: [1, 2, 3] });
      }
      if (porSemana.length) {
        sections.push({
          title: "Por semana (segunda a domingo)",
          headers: aggHeaders,
          rows: aggRowsPlain(porSemana),
          numericCols: [1, 2, 3],
        });
      }
      if (porMes.length) {
        sections.push({ title: "Por mês", headers: aggHeaders, rows: aggRowsPlain(porMes), numericCols: [1, 2, 3] });
      }
    } else if (cat === "entradas") {
      const ent = movs.filter((m) => m.tipo === "entrada");
      const tot = ent.reduce((s, m) => s + m.valor, 0);
      sections.push({
        title: "Detalhe das entradas",
        subtitle: `Total entradas: ${currencyBRL(tot)} (${ent.length} lançamento(s))`,
        headers: ["Data", "Descrição", "Valor"],
        rows: ent.map((m) => [m.data, m.descricao, currencyBRL(m.valor)]),
        numericCols: [2],
      });
    } else if (cat === "saidas") {
      const sai = movs.filter((m) => m.tipo === "saida");
      const tot = sai.reduce((s, m) => s + m.valor, 0);
      sections.push({
        title: "Detalhe das saídas",
        subtitle: `Total saídas: ${currencyBRL(tot)} (${sai.length} lançamento(s))`,
        headers: ["Data", "Descrição", "Valor"],
        rows: sai.map((m) => [m.data, m.descricao, currencyBRL(m.valor)]),
        numericCols: [2],
      });
    } else if (cat === "clientes_repetidos") {
      const map = new Map();
      for (const m of movs.filter((x) => x.tipo === "entrada")) {
        const { cpf, nome } = resolverPagador(m);
        const chave = cpf || normNome(nome) || normNome(m.descricao);
        if (!chave) continue;
        if (!map.has(chave)) {
          map.set(chave, { cpf, nome: nome || m.descricao, total: 0, qtd: 0, datas: [] });
        }
        const g = map.get(chave);
        g.total += m.valor;
        g.qtd += 1;
        g.datas.push(m.data);
      }
      const reps = Array.from(map.values())
        .filter((g) => g.qtd >= 2)
        .sort((a, b) => b.total - a.total);
      sections.push({
        title: "Clientes repetidos",
        subtitle: `Pagadores com 2 ou mais entradas no período (${reps.length}).`,
        headers: ["Nome / histórico", "CPF", "Qtd.", "Total", "Datas"],
        rows: reps.map((r) => [
          r.nome,
          r.cpf || "—",
          String(r.qtd),
          currencyBRL(r.total),
          [...new Set(r.datas)].sort().join(", "),
        ]),
        numericCols: [3],
      });
    } else if (cat === "quem_pagou") {
      const ent = movs.filter((m) => m.tipo === "entrada");
      const linhas = ent.map((m) => {
        const { cpf, nome } = resolverPagador(m);
        const cad = buscarClienteCadastro(cpf, nome);
        const statusTxt =
          cad.status === "cadastrado"
            ? "Cadastrado"
            : cad.status === "nao_cadastrado"
              ? "Não cadastrado"
              : "—";
        return {
          data: m.data,
          nomeExib: cad.nomeCadastro || nome || "—",
          cpf: cpf || cad.cpf || "—",
          descricao: m.descricao,
          valor: m.valor,
          statusTxt,
        };
      });
      const totCad = linhas.filter((l) => l.statusTxt === "Cadastrado").length;
      const totNao = linhas.filter((l) => l.statusTxt === "Não cadastrado").length;
      sections.push({
        title: "Quem pagou",
        subtitle: `${ent.length} entrada(s): ${totCad} cadastrado(s), ${totNao} não cadastrado(s).`,
        headers: ["Data", "Pagador", "CPF", "Valor", "Cadastro", "Histórico"],
        rows: linhas.map((l) => [
          l.data,
          l.nomeExib,
          l.cpf,
          currencyBRL(l.valor),
          l.statusTxt,
          l.descricao,
        ]),
        numericCols: [3],
      });
    }
    return sections;
  }

  function atualizarBotoesExportRelatorio(hasData) {
    if (!relatorioExportAcoes) return;
    relatorioExportAcoes.classList.toggle("hidden", !hasData);
    relatorioExportAcoes.setAttribute("aria-hidden", hasData ? "false" : "true");
    const pdfBtn = document.getElementById("financeiroRelatorioPdfBtn");
    const xlsBtn = document.getElementById("financeiroRelatorioExcelBtn");
    if (pdfBtn) pdfBtn.disabled = !hasData;
    if (xlsBtn) xlsBtn.disabled = !hasData;
  }

  function brDateFilenameSegment(br) {
    const t = String(br || "").trim();
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[3]}`;
    return t.replace(/\//g, "-") || "periodo";
  }

  function nomeArquivoRelatorioFinanceiro(estado) {
    const banco = String(estado.bancoLabel || "financeiro").replace(/\s+/g, " ").trim();
    const de = brDateFilenameSegment(estado.de);
    const ate = brDateFilenameSegment(estado.ate);
    return `relatorio financeiro ${banco} ${de} ate ${ate}`.replace(/[<>:"/\\|?*]+/g, "").slice(0, 180);
  }

  function buildFinanceiroPdfDocumentHtml(estado, sections) {
    const quando = new Date().toLocaleString("pt-BR");
    const parteDe = estado.de || "início";
    const parteAte = estado.ate || "fim";
    const blocos = sections
      .map((s) => {
        const head = s.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
        const body = (s.rows || [])
          .map((row) => {
            const tds = row
              .map((c, i) => {
                const align = s.numericCols?.includes(i) ? ' style="text-align:right"' : "";
                return `<td${align}>${escapeHtml(String(c ?? ""))}</td>`;
              })
              .join("");
            return `<tr>${tds}</tr>`;
          })
          .join("");
        const subt = s.subtitle ? `<p class="meta">${escapeHtml(s.subtitle)}</p>` : "";
        return `<h2>${escapeHtml(s.title)}</h2>${subt}<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${s.headers.length}">Nenhum registo.</td></tr>`}</tbody></table>`;
      })
      .join('<div style="height:14px"></div>');
    const titulo = `Relatório financeiro — ${estado.bancoLabel}`;
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.05rem;margin:0 0 0.35rem}
      h2{font-size:0.95rem;margin:1rem 0 0.35rem;color:#333}
      .meta{color:#444;margin:0.2rem 0 0.5rem;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-bottom:0.35rem}
      th,td{border:1px solid #333;padding:5px 7px;text-align:left;vertical-align:top}
      th{background:#eee;font-weight:600}
    </style></head><body>
      <h1>${escapeHtml(titulo)}</h1>
      <p class="meta"><strong>${escapeHtml(estado.catLabel)}</strong></p>
      <p class="meta">Período: ${escapeHtml(parteDe)} até ${escapeHtml(parteAte)} · ${escapeHtml(String(estado.movs.length))} lançamento(s) de ${escapeHtml(String(estado.totalBase))} na base</p>
      <p class="meta">Emitido em ${escapeHtml(quando)} · Grupo DK Locadora</p>
      ${blocos}
    </body></html>`;
  }

  function buildFinanceiroExcelDocumentHtml(estado, sections) {
    const parteDe = estado.de || "início";
    const parteAte = estado.ate || "fim";
    const titulo = `Relatório financeiro — ${estado.bancoLabel}`;
    const meta = [
      `<tr><td colspan="6"><strong>${escapeHtml(titulo)}</strong></td></tr>`,
      `<tr><td colspan="6">${escapeHtml(estado.catLabel)}</td></tr>`,
      `<tr><td colspan="6">Período: ${escapeHtml(parteDe)} até ${escapeHtml(parteAte)} · ${estado.movs.length} lançamento(s)</td></tr>`,
      `<tr><td colspan="6"></td></tr>`,
    ].join("");
    const blocos = sections
      .map((s) => {
        const head = `<tr>${s.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
        const subt = s.subtitle ? `<tr><td colspan="${s.headers.length}">${escapeHtml(s.subtitle)}</td></tr>` : "";
        const body = (s.rows || [])
          .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`)
          .join("");
        return `<tr><td colspan="${s.headers.length}"><strong>${escapeHtml(s.title)}</strong></td></tr>${subt}${head}${body}<tr><td colspan="${s.headers.length}"></td></tr>`;
      })
      .join("");
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">${meta}${blocos}</table></body></html>`;
  }

  function montarTextoShareFinanceiro(estado, sections) {
    const parteDe = estado.de || "início";
    const parteAte = estado.ate || "fim";
    const linhas = [
      `Relatório financeiro — ${estado.bancoLabel}`,
      estado.catLabel,
      `Período: ${parteDe} até ${parteAte}`,
      `${estado.movs.length} lançamento(s) no período`,
      "",
    ];
    for (const s of sections) {
      linhas.push(s.title);
      if (s.subtitle) linhas.push(s.subtitle);
      if (s.rows?.length) {
        linhas.push(`${s.rows.length} linha(s) no detalhe.`);
      }
      linhas.push("");
    }
    return linhas.join("\n").trim();
  }

  function emitFinanceiroRelatorioPdf() {
    renderRelatorioModalConteudo();
    const estado = relatorioEstadoAtual;
    if (!estado?.hasData) {
      window.alert("Nenhum movimento no período selecionado. Ajuste as datas ou atualize o relatório.");
      return;
    }
    const sections = buildRelatorioSections(estado);
    if (!sections.length) {
      window.alert("Não há dados para exportar neste tipo de relatório.");
      return;
    }
    const html = buildFinanceiroPdfDocumentHtml(estado, sections);
    const fileBase = nomeArquivoRelatorioFinanceiro(estado);
    const ctx = {
      fileSlug: "financeiro-extrato",
      title: `Relatório financeiro — ${estado.bancoLabel}`,
      buildPdfHtml: () => html,
      shareMeta: {
        title: `Relatório financeiro — ${estado.bancoLabel}`,
        bodyText: montarTextoShareFinanceiro(estado, sections),
        fileBaseName: fileBase,
      },
    };
    if (typeof window.__DK_emitPortalRelatorioPdf === "function") {
      window.__DK_emitPortalRelatorioPdf(ctx);
      return;
    }
    window.alert("Visualizador PDF indisponível. Recarregue a página.");
  }

  function emitFinanceiroRelatorioExcel() {
    renderRelatorioModalConteudo();
    const estado = relatorioEstadoAtual;
    if (!estado?.hasData) {
      window.alert("Nenhum movimento no período selecionado. Ajuste as datas ou atualize o relatório.");
      return;
    }
    const sections = buildRelatorioSections(estado);
    if (!sections.length) {
      window.alert("Não há dados para exportar neste tipo de relatório.");
      return;
    }
    const ctx = {
      fileSlug: "financeiro-extrato",
      title: `Relatório financeiro — ${estado.bancoLabel}`,
      buildExcelHtml: () => buildFinanceiroExcelDocumentHtml(estado, sections),
    };
    if (typeof window.__DK_emitPortalRelatorioExcel === "function") {
      window.__DK_emitPortalRelatorioExcel(ctx);
      return;
    }
    window.alert("Exportação Excel indisponível. Recarregue a página.");
  }

  function renderRelatorioModalConteudo() {
    if (!relatorioConteudo || !bancoAtivo) return;
    const estado = coletarEstadoRelatorio();
    relatorioEstadoAtual = estado;

    if (relatorioPeriodoLbl) {
      const parteDe = estado.de || "início";
      const parteAte = estado.ate || "fim";
      relatorioPeriodoLbl.textContent = `Período: ${parteDe} até ${parteAte} · ${estado.movs.length} de ${estado.totalBase} lançamento(s)`;
    }

    atualizarBotoesExportRelatorio(estado.hasData);

    if (!estado.hasData) {
      relatorioConteudo.innerHTML =
        "<p class=\"subtext\">Nenhum movimento neste período. Ajuste as datas ou envie mais imagens.</p>";
      return;
    }

    const { movs, cat } = estado;
    let html = "";

    if (cat === "resumo") {
      const porDia = agregar(movs, dateKeyBr, (k) => {
        const p = k.split("-");
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : k;
      });
      const porSemana = agregar(movs, weekKeyFromBr, weekLabel);
      const porMes = agregar(movs, monthKeyFromBr, monthLabel);
      html = `${renderTabelaAgg("Por dia", porDia)}${renderTabelaAgg("Por semana (segunda a domingo)", porSemana)}${renderTabelaAgg("Por mês", porMes)}`;
    } else if (cat === "entradas") {
      const ent = movs.filter((m) => m.tipo === "entrada");
      const tot = ent.reduce((s, m) => s + m.valor, 0);
      html = `<p class="subtext"><strong>Total entradas:</strong> ${currencyBRL(tot)} (${ent.length} lançamento(s))</p>`;
      html += renderTabelaLancamentos("Detalhe das entradas", ent, [
        { label: "Data", key: "data" },
        { label: "Descrição", render: (r) => escapeHtml(r.descricao) },
        { label: "Valor", render: (r) => currencyBRL(r.valor), num: true },
      ]);
    } else if (cat === "saidas") {
      const sai = movs.filter((m) => m.tipo === "saida");
      const tot = sai.reduce((s, m) => s + m.valor, 0);
      html = `<p class="subtext"><strong>Total saídas:</strong> ${currencyBRL(tot)} (${sai.length} lançamento(s))</p>`;
      html += renderTabelaLancamentos("Detalhe das saídas", sai, [
        { label: "Data", key: "data" },
        { label: "Descrição", render: (r) => escapeHtml(r.descricao) },
        { label: "Valor", render: (r) => currencyBRL(r.valor), num: true },
      ]);
    } else if (cat === "clientes_repetidos") {
      const map = new Map();
      for (const m of movs.filter((x) => x.tipo === "entrada")) {
        const { cpf, nome } = resolverPagador(m);
        const chave = cpf || normNome(nome) || normNome(m.descricao);
        if (!chave) continue;
        if (!map.has(chave)) {
          map.set(chave, { cpf, nome: nome || m.descricao, total: 0, qtd: 0, datas: [] });
        }
        const g = map.get(chave);
        g.total += m.valor;
        g.qtd += 1;
        g.datas.push(m.data);
      }
      const reps = Array.from(map.values())
        .filter((g) => g.qtd >= 2)
        .sort((a, b) => b.total - a.total);
      html = `<p class="subtext">Pagadores com 2 ou mais entradas no período (${reps.length}).</p>`;
      html += renderTabelaLancamentos("Clientes repetidos", reps, [
        { label: "Nome / histórico", render: (r) => escapeHtml(r.nome) },
        { label: "CPF", render: (r) => (r.cpf ? escapeHtml(r.cpf) : "—") },
        { label: "Qtd.", key: "qtd" },
        { label: "Total", render: (r) => currencyBRL(r.total), num: true },
        { label: "Datas", render: (r) => escapeHtml([...new Set(r.datas)].sort().join(", ")) },
      ]);
    } else if (cat === "quem_pagou") {
      const ent = movs.filter((m) => m.tipo === "entrada");
      const linhas = ent.map((m) => {
        const { cpf, nome } = resolverPagador(m);
        const cad = buscarClienteCadastro(cpf, nome);
        const statusHtml =
          cad.status === "cadastrado"
            ? `<span class="financeiro-status-cad">Cadastrado</span>`
            : cad.status === "nao_cadastrado"
              ? `<span class="financeiro-status-nao-cad">Não cadastrado</span>`
              : "—";
        return {
          data: m.data,
          nomeExib: cad.nomeCadastro || nome || "—",
          cpf: cpf || cad.cpf || "—",
          descricao: m.descricao,
          valor: m.valor,
          statusHtml,
        };
      });
      const totCad = linhas.filter((l) => l.statusHtml.includes("Cadastrado")).length;
      const totNao = linhas.filter((l) => l.statusHtml.includes("Não cadastrado")).length;
      html = `<p class="subtext">${ent.length} entrada(s): <span class="financeiro-status-cad">${totCad} cadastrado(s)</span>, <span class="financeiro-status-nao-cad">${totNao} não cadastrado(s)</span>.</p>`;
      html += renderTabelaLancamentos("Quem pagou", linhas, [
        { label: "Data", key: "data" },
        { label: "Pagador", render: (r) => escapeHtml(r.nomeExib) },
        { label: "CPF", render: (r) => escapeHtml(r.cpf) },
        { label: "Valor", render: (r) => currencyBRL(r.valor), num: true },
        { label: "Cadastro", render: (r) => r.statusHtml },
        { label: "Histórico", render: (r) => escapeHtml(r.descricao) },
      ]);
    }

    relatorioConteudo.innerHTML = html;
  }

  function abrirRelatorioModal() {
    if (!bancoAtivo || !relatorioModal) return;
    const movs = todosMovimentosBanco(bancoAtivo);
    if (!movs.length) return;
    const { min, max } = limitesDatasMovimentos(movs);
    if (filtroDe && min) filtroDe.value = formatBrDate(min);
    if (filtroAte && max) filtroAte.value = formatBrDate(max);
    if (relatorioModalSub) {
      const acum = periodoAcumuladoTexto(bancoAtivo);
      relatorioModalSub.textContent = `${BANCOS[bancoAtivo]} · ${getUploads(bancoAtivo).length} ficheiro(s) · ${movs.length} movimento(s) acumulados${acum}`;
    }
    const tit = document.getElementById("financeiroRelatorioModalTitulo");
    if (tit) tit.textContent = `Relatório — ${BANCOS[bancoAtivo]}`;
    relatorioModal.classList.remove("hidden");
    renderRelatorioModalConteudo();
  }

  function fecharRelatorioModal() {
    relatorioModal?.classList.add("hidden");
    atualizarBotoesExportRelatorio(false);
  }

  function loadInstrucoesIaStore() {
    try {
      return JSON.parse(localStorage.getItem(INSTRUCOES_IA_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function getInstrucoesIaAtivas() {
    if (!bancoAtivo) return "";
    return String(loadInstrucoesIaStore()[bancoAtivo] || "").trim();
  }

  function saveInstrucoesIaAtivas(texto) {
    if (!bancoAtivo) return;
    const o = loadInstrucoesIaStore();
    o[bancoAtivo] = String(texto || "").trim().slice(0, 2000);
    localStorage.setItem(INSTRUCOES_IA_KEY, JSON.stringify(o));
    if (iaInstrucoesEl) iaInstrucoesEl.value = o[bancoAtivo];
    const modalTa = document.getElementById("financeiroIaInstrucoesModal");
    if (modalTa && revisaoErrosModal && !revisaoErrosModal.classList.contains("hidden")) {
      modalTa.value = o[bancoAtivo];
    }
  }

  function syncInstrucoesIaUi() {
    if (iaInstrucoesEl) {
      iaInstrucoesEl.value = getInstrucoesIaAtivas();
      iaInstrucoesEl.placeholder =
        INSTRUCOES_PADRAO_BANCO[bancoAtivo] ||
        "Ex.: cabeçalho de data vale para todos os Pix abaixo até ao próximo cabeçalho.";
    }
  }

  function blocoInstrucoesIaPrompt(instrucoesExtra) {
    const base = getInstrucoesIaAtivas();
    const extra = String(instrucoesExtra || "").trim();
    const partes = [];
    if (base) partes.push(base);
    if (extra && extra !== base) partes.push(extra);
    if (!partes.length) return "";
    return `\n\nINSTRUÇÕES DO OPERADOR (obrigatório seguir):\n${partes.join("\n\n")}\n`;
  }

  function normNomeArquivo(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, " ")
      .trim();
  }

  function extrairRelatorioErros(parsed, totalExtraidas, instrucoesExtra, movimentosNormalizados) {
    const linhas = [];
    const raw = parsed?.linhasNaoLidas || parsed?.linhas_ilegiveis || parsed?.errosLeitura || [];
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string") {
          linhas.push({ numeroLinha: null, textoVisivel: item, motivo: "ilegível", campo: null });
        } else if (item && typeof item === "object") {
          linhas.push({
            numeroLinha: item.numeroLinha ?? item.linha ?? null,
            textoVisivel: String(
              item.textoVisivel ?? item.texto ?? item.textoParcial ?? item.descricao ?? ""
            ).trim(),
            motivo: String(item.motivo ?? item.erro ?? "não lido").trim(),
            campo: item.campo ? String(item.campo) : null,
          });
        }
      }
    }
    const avisos = [];
    const obs = String(parsed?.observacoes || "").trim();
    if (obs) avisos.push(obs);
    if (Array.isArray(parsed?.avisos)) {
      for (const a of parsed.avisos) {
        const t = String(a || "").trim();
        if (t) avisos.push(t);
      }
    }
    const totalVis = Number(parsed?.totalLinhasVisiveis);
    if (Number.isFinite(totalVis) && totalVis > totalExtraidas) {
      avisos.push(
        `Contagem: ${totalVis} lançamento(s) visível(eis) na imagem, ${totalExtraidas} extraído(s) — use «Revisar com IA».`
      );
    }
    const nCab =
      Number(parsed?.totalCabecalhosData) ||
      (Array.isArray(parsed?.cabecalhosDatas) ? parsed.cabecalhosDatas.length : 0) ||
      (Array.isArray(parsed?.secoes) ? parsed.secoes.length : 0);
    const nDatas = contarDatasUnicasMovimentos(movimentosNormalizados);
    if (nCab > 0 && nDatas < nCab) {
      avisos.push(
        `Datas: a imagem tem ${nCab} cabeçalho(s) de data, mas só ${nDatas} data(s) nos movimentos — faltam lançamentos ou datas não foram propagadas do cabeçalho.`
      );
    }
    return {
      linhasNaoLidas: linhas,
      avisos,
      totalLinhasVisiveis: Number.isFinite(totalVis) ? totalVis : null,
      totalCabecalhosData: nCab || null,
      totalDatasExtraidas: nDatas || null,
      totalExtraidas,
      instrucoesUsadas: [getInstrucoesIaAtivas(), String(instrucoesExtra || "").trim()]
        .filter(Boolean)
        .join("\n\n"),
      geradoEm: new Date().toISOString(),
    };
  }

  function uploadTemErrosIa(u) {
    const r = u?.relatorioErros;
    if (!r) return false;
    return (r.linhasNaoLidas?.length || 0) > 0 || (r.avisos?.length || 0) > 0;
  }

  function contarErrosUpload(u) {
    const r = u?.relatorioErros;
    if (!r) return 0;
    return (r.linhasNaoLidas?.length || 0) + (r.avisos?.length || 0);
  }

  function contarUploadsComErrosIa() {
    if (!bancoAtivo) return 0;
    return getUploads(bancoAtivo).filter(uploadTemErrosIa).length;
  }

  function atualizarBotaoErrosIa() {
    if (!verErrosIaBtn) return;
    const n = contarUploadsComErrosIa();
    verErrosIaBtn.disabled = n === 0;
    verErrosIaBtn.textContent = n ? `Relatório de erros IA (${n})` : "Relatório de erros IA";
  }

  function guardarArquivoNoUpload(uploadId, dataUrl) {
    const uploads = getUploads(bancoAtivo);
    const idx = uploads.findIndex((u) => u.id === uploadId);
    if (idx < 0) return;
    uploads[idx].arquivoDataUrl = dataUrl;
    setUploads(bancoAtivo, uploads);
  }

  function pedirArquivoRevisao(nomeSugestao) {
    return new Promise((resolve) => {
      if (!revisarArquivoInp) {
        resolve(null);
        return;
      }
      revisarArquivoInp.value = "";
      const handler = async () => {
        revisarArquivoInp.removeEventListener("change", handler);
        const f = revisarArquivoInp.files?.[0];
        revisarArquivoInp.value = "";
        if (!f || !arquivoExtratoValido(f)) {
          resolve(null);
          return;
        }
        try {
          resolve(await fileToBase64(f));
        } catch {
          resolve(null);
        }
      };
      revisarArquivoInp.addEventListener("change", handler);
      if (msgEl) {
        msgEl.textContent = `Escolha a imagem/PDF de «${nomeSugestao || "extrato"}» — o registo mantém-se, só associa o ficheiro para revisão.`;
        msgEl.classList.remove("portal-feedback--erro");
      }
      revisarArquivoInp.click();
    });
  }

  function pedirArquivosRevisaoLote() {
    return new Promise((resolve) => {
      if (!revisarLoteInp) {
        resolve([]);
        return;
      }
      revisarLoteInp.value = "";
      const handler = () => {
        revisarLoteInp.removeEventListener("change", handler);
        const list = revisarLoteInp.files ? Array.from(revisarLoteInp.files) : [];
        revisarLoteInp.value = "";
        resolve(list.filter(arquivoExtratoValido));
      };
      revisarLoteInp.addEventListener("change", handler);
      revisarLoteInp.click();
    });
  }

  async function associarImagensUploadsSemArquivo() {
    const sem = getUploads(bancoAtivo).filter((u) => !u.arquivoDataUrl);
    if (!sem.length) return true;

    if (msgEl) {
      msgEl.textContent = `Selecione ${sem.length} imagem(ns)/PDF(s) para associar (nomes: ${sem.map((u) => u.nomeArquivo).join("; ")}).`;
      msgEl.classList.remove("portal-feedback--erro");
    }

    const files = await pedirArquivosRevisaoLote();
    if (!files.length) return false;

    const usados = new Set();
    for (const upload of sem) {
      const alvo = normNomeArquivo(upload.nomeArquivo);
      let fi = -1;
      for (let i = 0; i < files.length; i += 1) {
        if (usados.has(i)) continue;
        if (normNomeArquivo(files[i].name) === alvo) {
          fi = i;
          break;
        }
      }
      if (fi < 0) {
        for (let i = 0; i < files.length; i += 1) {
          if (usados.has(i)) continue;
          const fn = normNomeArquivo(files[i].name);
          if (alvo.length >= 8 && (fn.includes(alvo.slice(0, 24)) || alvo.includes(fn.slice(0, 24)))) {
            fi = i;
            break;
          }
        }
      }
      if (fi < 0 && files.length === sem.length) {
        const j = sem.indexOf(upload);
        if (j >= 0 && !usados.has(j) && j < files.length) fi = j;
      }
      if (fi < 0) continue;
      usados.add(fi);
      try {
        const raw = await fileToBase64(files[fi]);
        const guardado = (await dataUrlParaArmazenamento(raw)) || raw;
        guardarArquivoNoUpload(upload.id, guardado);
      } catch {
        /* ignore */
      }
    }

    renderUploadsLista();
    const aindaSem = getUploads(bancoAtivo).filter((u) => !u.arquivoDataUrl).length;
    if (aindaSem > 0) {
      return window.confirm(
        `${aindaSem} ficheiro(s) ainda sem imagem associada.\n\nContinuar revisão apenas dos que têm imagem?`
      );
    }
    return true;
  }

  async function obterDataUrlParaRevisao(upload) {
    if (upload.arquivoDataUrl) return upload.arquivoDataUrl;
    const dataUrl = await pedirArquivoRevisao(upload.nomeArquivo);
    if (!dataUrl) return null;
    const guardado = (await dataUrlParaArmazenamento(dataUrl)) || dataUrl;
    guardarArquivoNoUpload(upload.id, guardado);
    return guardado;
  }

  function fecharRelatorioErrosModal() {
    revisaoErrosModal?.classList.add("hidden");
    revisaoErrosUploadIdFocus = null;
  }

  function renderHtmlRelatorioErrosUpload(u) {
    const r = u.relatorioErros;
    if (!r) return "";
    const dt = r.geradoEm ? new Date(r.geradoEm).toLocaleString("pt-BR") : "";
    let html = `<div class="financeiro-revisao-erros-ficheiro" data-fin-erros-upload="${escapeHtml(u.id)}">`;
    html += `<h4 class="financeiro-relatorio__subtitle">${escapeHtml(u.nomeArquivo || "extrato")}</h4>`;
    html += `<p class="subtext">${(u.movimentos || []).length} movimento(s) · ${escapeHtml(dt)}`;
    if (r.totalLinhasVisiveis != null) {
      html += ` · ${r.totalLinhasVisiveis} linha(s) visível(eis) na imagem`;
    }
    html += "</p>";
    if (r.instrucoesUsadas) {
      html += `<p class="subtext"><strong>Instruções usadas:</strong> ${escapeHtml(r.instrucoesUsadas)}</p>`;
    }
    if (r.linhasNaoLidas?.length) {
      html += `<div class="portal-lanc-hist-wrap"><table class="portal-lanc-hist financeiro-relatorio-table">
        <thead><tr><th>Linha</th><th>Texto visível</th><th>Campo</th><th>Motivo</th></tr></thead><tbody>`;
      html += r.linhasNaoLidas
        .map(
          (ln) =>
            `<tr><td>${ln.numeroLinha != null ? escapeHtml(String(ln.numeroLinha)) : "—"}</td>` +
            `<td>${escapeHtml(ln.textoVisivel || "—")}</td>` +
            `<td>${escapeHtml(ln.campo || "—")}</td>` +
            `<td>${escapeHtml(ln.motivo || "—")}</td></tr>`
        )
        .join("");
      html += "</tbody></table></div>";
    }
    if (r.avisos?.length) {
      html += `<ul class="subtext">${r.avisos.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`;
    }
    html += `<button type="button" class="btn-primary btn-secondary-outline financeiro-erros-revisar-um" data-fin-erros-revisar="${escapeHtml(u.id)}">Revisar este ficheiro</button>`;
    html += "</div>";
    return html;
  }

  function abrirRelatorioErrosModal(uploadIdFocus) {
    if (!revisaoErrosModal || !bancoAtivo) return;
    const uploads = getUploads(bancoAtivo).filter(uploadTemErrosIa);
    if (!uploads.length) {
      window.alert("Nenhum relatório de erros da IA. Faça uma revisão primeiro.");
      return;
    }
    revisaoErrosUploadIdFocus = uploadIdFocus || null;
    const tit = document.getElementById("financeiroRevisaoErrosTitulo");
    const sub = document.getElementById("financeiroRevisaoErrosSub");
    const corpo = document.getElementById("financeiroRevisaoErrosConteudo");
    const modalTa = document.getElementById("financeiroIaInstrucoesModal");
    const lista = uploadIdFocus ? uploads.filter((u) => u.id === uploadIdFocus) : uploads;
    if (tit) tit.textContent = uploadIdFocus ? "Erros IA — ficheiro" : "Relatório de erros — IA extrato";
    if (sub) {
      sub.textContent =
        "Linhas que a IA não conseguiu ler ou avisos. Ajuste as instruções abaixo e clique em «Revisar de novo».";
    }
    if (corpo) {
      corpo.innerHTML =
        lista.map(renderHtmlRelatorioErrosUpload).join("") ||
        "<p class=\"subtext\">Sem erros registados.</p>";
      corpo.querySelectorAll("[data-fin-erros-revisar]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-fin-erros-revisar");
          if (id) {
            fecharRelatorioErrosModal();
            void revisarUploadComIA(id, { instrucoesExtra: modalTa?.value });
          }
        });
      });
    }
    if (modalTa) modalTa.value = getInstrucoesIaAtivas();
    revisaoErrosModal.classList.remove("hidden");
  }

  function atualizarBotaoRevisarTodos() {
    if (!revisarTodosBtn) return;
    const total = bancoAtivo ? getUploads(bancoAtivo).length : 0;
    revisarTodosBtn.disabled = revisaoEmCurso || total === 0;
    revisarTodosBtn.title =
      total === 0
        ? "Nenhum ficheiro processado."
        : `Revisar ${total} ficheiro(s) com IA. Se faltar imagem, pede para escolher o ficheiro (sem remover o registo).`;
  }

  function setFinanceiroIaUiBusy(busy) {
    if (extrairBtn) extrairBtn.disabled = busy;
    if (limparBtn) limparBtn.disabled = busy;
    const total = bancoAtivo ? getUploads(bancoAtivo).length : 0;
    if (revisarTodosBtn) revisarTodosBtn.disabled = busy || total === 0;
    if (verErrosIaBtn) verErrosIaBtn.disabled = busy || contarUploadsComErrosIa() === 0;
    uploadsLista?.querySelectorAll("[data-fin-upload-revisar]").forEach((b) => {
      b.disabled = busy;
    });
    uploadsLista?.querySelectorAll("[data-fin-erros-ver]").forEach((b) => {
      b.disabled = busy;
    });
  }

  function renderUploadsLista() {
    if (!uploadsLista || !bancoAtivo) return;
    const uploads = getUploads(bancoAtivo);
    if (!uploads.length) {
      uploadsLista.innerHTML = '<p class="subtext">Nenhum extrato processado neste banco.</p>';
      atualizarBotaoRevisarTodos();
      atualizarBotaoErrosIa();
      return;
    }
    uploadsLista.innerHTML = uploads
      .slice()
      .reverse()
      .map((u) => {
        const dt = u.processadoEm ? new Date(u.processadoEm).toLocaleString("pt-BR") : "";
        const n = (u.movimentos || []).length;
        const temArquivo = Boolean(u.arquivoDataUrl);
        const revisado = u.revisadoEm ? ` · revisado ${new Date(u.revisadoEm).toLocaleString("pt-BR")}` : "";
        const nErros = contarErrosUpload(u);
        const errosBtn = nErros
          ? `<button type="button" class="btn-primary btn-secondary-outline financeiro-erros-ver" data-fin-erros-ver="${escapeHtml(u.id)}">Erros IA (${nErros})</button>`
          : "";
        const hintImg = temArquivo
          ? ""
          : '<span class="subtext"> · ao revisar, escolha a imagem (registo mantém-se)</span>';
        return `<div class="financeiro-upload-item">
          <div>
            <strong>${escapeHtml(u.nomeArquivo || "extrato")}</strong>
            <span class="subtext"> — ${n} movimento(s) · ${escapeHtml(dt)}${revisado}</span>
            ${u.revisadoEm ? '<span class="financeiro-upload-item__badge">✓ revisado IA</span>' : ""}
            ${nErros ? '<span class="financeiro-upload-item__badge financeiro-upload-item__badge--erro">⚠ erros leitura</span>' : ""}
            ${hintImg}
          </div>
          <div class="financeiro-upload-item__acoes">
            <button type="button" class="btn-primary btn-secondary-outline financeiro-upload-revisar" data-fin-upload-revisar="${escapeHtml(u.id)}">Revisar com IA</button>
            ${errosBtn}
            <button type="button" class="btn-primary btn-secondary-outline financeiro-upload-remover" data-fin-upload-id="${escapeHtml(u.id)}">Remover</button>
          </div>
        </div>`;
      })
      .join("");
    uploadsLista.querySelectorAll(".financeiro-upload-remover").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-fin-upload-id");
        if (!id || !bancoAtivo) return;
        const ups = getUploads(bancoAtivo).filter((u) => u.id !== id);
        setUploads(bancoAtivo, ups);
        renderUploadsLista();
        atualizarResumoBar();
      });
    });
    uploadsLista.querySelectorAll("[data-fin-upload-revisar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-fin-upload-revisar");
        if (id) void revisarUploadComIA(id);
      });
    });
    uploadsLista.querySelectorAll("[data-fin-erros-ver]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-fin-erros-ver");
        if (id) abrirRelatorioErrosModal(id);
      });
    });
    atualizarBotaoRevisarTodos();
    atualizarBotaoErrosIa();
  }

  async function revisarUploadComIA(uploadId, opts = {}) {
    if (!bancoAtivo || revisaoEmCurso) return;
    const uploads = getUploads(bancoAtivo);
    const upload = uploads.find((u) => u.id === uploadId);
    if (!upload) return;

    const instrucoesExtra = String(opts.instrucoesExtra || "").trim();
    if (instrucoesExtra) saveInstrucoesIaAtivas(instrucoesExtra);

    const dataUrl = await obterDataUrlParaRevisao(upload);
    if (!dataUrl) {
      if (msgEl) {
        msgEl.textContent = "Revisão cancelada — nenhuma imagem seleccionada.";
        msgEl.classList.add("portal-feedback--erro");
      }
      return;
    }

    revisaoEmCurso = true;
    setFinanceiroIaUiBusy(true);
    if (msgEl) {
      msgEl.textContent = `Revisão IA (linha a linha): ${upload.nomeArquivo || "extrato"}… pode demorar ~1–2 min.`;
      msgEl.classList.remove("portal-feedback--erro");
      msgEl.classList.remove("portal-feedback--ok");
    }

    try {
      const r = await processarDataUrlExtrato(dataUrl, upload.nomeArquivo || "extrato", {
        modoRevisao: true,
        uploadId: upload.id,
        movimentosAnteriores: upload.movimentos || [],
        salvarArquivo: false,
        instrucoesExtra,
      });
      renderUploadsLista();
      atualizarResumoBar();
      if (relatorioModal && !relatorioModal.classList.contains("hidden")) {
        renderRelatorioModalConteudo();
      }
      if (!r.ok) {
        if (msgEl) {
          msgEl.textContent = r.erro || "Falha na revisão IA.";
          msgEl.classList.add("portal-feedback--erro");
        }
        return;
      }
      const total = todosMovimentosBanco(bancoAtivo).length;
      const diff = (r.novos || 0) - (r.anterior || 0);
      const diffTxt = diff > 0 ? ` (+${diff} vs anterior)` : diff < 0 ? ` (${diff} vs anterior)` : " (mesma quantidade)";
      const nErros = (r.relatorioErros?.linhasNaoLidas?.length || 0) + (r.relatorioErros?.avisos?.length || 0);
      if (msgEl) {
        msgEl.textContent = `Revisão concluída: ${r.novos} movimento(s)${diffTxt} · base total: ${total}.${nErros ? ` ${nErros} aviso(s)/erro(s) — veja «Erros IA».` : ""}`;
        msgEl.classList.remove("portal-feedback--erro");
        msgEl.classList.add("portal-feedback--ok");
      }
      if (nErros > 0) abrirRelatorioErrosModal(upload.id);
    } catch (e) {
      if (msgEl) {
        msgEl.textContent = String(e?.message || e);
        msgEl.classList.add("portal-feedback--erro");
      }
    } finally {
      revisaoEmCurso = false;
      setFinanceiroIaUiBusy(false);
      atualizarBotaoRevisarTodos();
      atualizarBotaoErrosIa();
    }
  }

  async function revisarTodosComIA(opts = {}) {
    if (!bancoAtivo || revisaoEmCurso) return;
    const lista = getUploads(bancoAtivo);
    if (!lista.length) {
      window.alert("Nenhum ficheiro processado para revisar.");
      return;
    }

    const instrucoesExtra = String(opts.instrucoesExtra || "").trim();
    if (instrucoesExtra) saveInstrucoesIaAtivas(instrucoesExtra);

    if (
      !window.confirm(
        `Revisar ${lista.length} ficheiro(s) com IA avançada (linha a linha)?\n\nSe faltar imagem, será pedido para escolher o ficheiro — o registo não é removido.`
      )
    ) {
      return;
    }

    revisaoEmCurso = true;
    setFinanceiroIaUiBusy(true);

    try {
      const okAssoc = await associarImagensUploadsSemArquivo();
      if (!okAssoc) {
        if (msgEl) msgEl.textContent = "Revisão em lote cancelada.";
        return;
      }

      const paraRevisar = getUploads(bancoAtivo).filter((u) => u.arquivoDataUrl);
      let ok = 0;
      let fail = 0;
      let comErros = 0;

      for (let i = 0; i < paraRevisar.length; i += 1) {
        const u = paraRevisar[i];
        if (msgEl) {
          msgEl.textContent = `Revisão IA ${i + 1}/${paraRevisar.length}: ${u.nomeArquivo || "extrato"}…`;
          msgEl.classList.remove("portal-feedback--erro");
          msgEl.classList.remove("portal-feedback--ok");
        }
        try {
          const r = await processarDataUrlExtrato(u.arquivoDataUrl, u.nomeArquivo || "extrato", {
            modoRevisao: true,
            uploadId: u.id,
            movimentosAnteriores: u.movimentos || [],
            salvarArquivo: false,
            instrucoesExtra,
          });
          if (r.ok) {
            ok += 1;
            if (uploadTemErrosIa(getUploads(bancoAtivo).find((x) => x.id === u.id))) comErros += 1;
          } else fail += 1;
        } catch {
          fail += 1;
        }
      }

      renderUploadsLista();
      atualizarResumoBar();
      if (relatorioModal && !relatorioModal.classList.contains("hidden")) {
        renderRelatorioModalConteudo();
      }
      const total = todosMovimentosBanco(bancoAtivo).length;
      if (msgEl) {
        msgEl.textContent = `Revisão em lote: ${ok}/${paraRevisar.length} OK${fail ? ` · ${fail} erro(s)` : ""}${comErros ? ` · ${comErros} com avisos` : ""} · base: ${total}.`;
        msgEl.classList.toggle("portal-feedback--erro", fail === paraRevisar.length);
        msgEl.classList.toggle("portal-feedback--ok", ok > 0);
      }
      if (comErros > 0) abrirRelatorioErrosModal(null);
    } finally {
      revisaoEmCurso = false;
      setFinanceiroIaUiBusy(false);
      atualizarBotaoRevisarTodos();
      atualizarBotaoErrosIa();
    }
  }

  function setFinanceiroPlaceholderVisible(visible) {
    placeholder?.classList.toggle("hidden", !visible);
    placeholder?.setAttribute("aria-hidden", visible ? "false" : "true");
    paneBanco?.classList.toggle("hidden", visible);
  }

  function syncFinanceiroSidebarButtons(activeId) {
    ["btn-financeiro-santander", "btn-financeiro-sicredi"].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const on = Boolean(activeId && id === activeId);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  function arquivoExtratoValido(file) {
    if (!file) return false;
    const t = String(file.type || "").toLowerCase();
    return t.startsWith("image/") || t === "application/pdf";
  }

  function renderPendentesLista() {
    if (!pendentesLista) return;
    if (!arquivosPendentes.length) {
      pendentesLista.innerHTML = "";
      pendentesLista.classList.add("hidden");
      if (arquivoLbl) arquivoLbl.textContent = "";
      pasteZone?.classList.remove("portal-operador-comprovante-paste--ativo");
      return;
    }
    pendentesLista.classList.remove("hidden");
    pendentesLista.innerHTML = arquivosPendentes
      .map(
        (a, idx) => `<div class="financeiro-pendente-item">
          <span class="financeiro-pendente-item__nome" title="${escapeHtml(a.nome)}">${idx + 1}. ${escapeHtml(a.nome)}</span>
          <button type="button" class="btn-primary btn-secondary-outline financeiro-pendente-item__remover" data-fin-pendente-id="${escapeHtml(a.id)}">Remover</button>
        </div>`
      )
      .join("");
    pendentesLista.querySelectorAll("[data-fin-pendente-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-fin-pendente-id");
        arquivosPendentes = arquivosPendentes.filter((x) => x.id !== id);
        renderPendentesLista();
      });
    });
    if (arquivoLbl) {
      arquivoLbl.textContent = `${arquivosPendentes.length} ficheiro(s) na fila — pode adicionar mais ou clicar em «Extrair movimentos com IA».`;
    }
    pasteZone?.classList.add("portal-operador-comprovante-paste--ativo");
  }

  function adicionarArquivosPendentes(files) {
    let n = 0;
    for (const file of files) {
      if (!arquivoExtratoValido(file)) continue;
      const dup = arquivosPendentes.some(
        (p) => p.nome === (file.name || "") && p.file.size === file.size && p.file.lastModified === file.lastModified
      );
      if (dup) continue;
      arquivosPendentes.push({
        id: newId(),
        file,
        nome: file.name || "extrato",
      });
      n += 1;
    }
    renderPendentesLista();
    if (msgEl && n > 0) {
      msgEl.textContent =
        n === 1 ? "1 ficheiro adicionado à fila." : `${n} ficheiro(s) adicionados à fila.`;
      msgEl.classList.remove("portal-feedback--erro");
      msgEl.classList.remove("portal-feedback--ok");
    }
    return n;
  }

  function limparArquivoPendente() {
    arquivosPendentes = [];
    if (fileInp) fileInp.value = "";
    renderPendentesLista();
    if (msgEl) msgEl.textContent = "";
  }

  function adicionarArquivoPendente(file, nome) {
    if (!arquivoExtratoValido(file)) return 0;
    return adicionarArquivosPendentes([file]);
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

  async function comprimirImagemDataUrl(dataUrl, maxPx, quality) {
    const { mime, base64 } = parseDataUrl(dataUrl);
    if (!mime.startsWith("image/") || !base64) return dataUrl;
    const q = Number.isFinite(quality) ? quality : 0.82;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const max = maxPx || 1400;
        if (w > h && w > max) {
          h = Math.round((h * max) / w);
          w = max;
        } else if (h > max) {
          w = Math.round((w * max) / h);
          h = max;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", q));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function dataUrlParaArmazenamento(dataUrl) {
    const { mime } = parseDataUrl(dataUrl);
    if (!mime.startsWith("image/")) {
      if (mime === "application/pdf" && String(dataUrl).length < 600000) return dataUrl;
      return null;
    }
    let url = await comprimirImagemDataUrl(dataUrl, 1400, 0.78);
    if (url.length > 450000) url = await comprimirImagemDataUrl(dataUrl, 1200, 0.68);
    if (url.length > 450000) url = await comprimirImagemDataUrl(dataUrl, 1000, 0.6);
    return url.length <= 500000 ? url : null;
  }

  function formatarErroServidorIa(data, status) {
    if (!data) {
      if (status === 413) return "Extrato demasiado grande. Reduza a imagem ou envie captura de ecrã.";
      return `Resposta inválida (HTTP ${status}).`;
    }
    const reason = String(data.reason || "").trim();
    if (reason === "openai_not_configured") return "";
    let detail = String(data.error || data.message || "").trim();
    if (detail.startsWith("{")) {
      try {
        const inner = JSON.parse(detail);
        detail = String(inner?.error?.message || inner?.message || detail);
      } catch {
        const m = detail.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
        if (m) detail = m[1].replace(/\\"/g, '"');
      }
    }
    return detail || reason || `HTTP ${status}`;
  }

  function extrairArquivoClipboard(clipboardData) {
    if (!clipboardData) return null;
    const files = clipboardData.files;
    if (files?.length) {
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        if (!f) continue;
        const t = String(f.type || "").toLowerCase();
        if (t.startsWith("image/") || t === "application/pdf") return f;
      }
      if (files[0]) return files[0];
    }
    const items = clipboardData.items;
    if (!items?.length) return null;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item || item.kind !== "file") continue;
      const f = item.getAsFile();
      if (!f) continue;
      const t = String(f.type || item.type || "").toLowerCase();
      if (!t || t.startsWith("image/") || t === "application/pdf") return f;
    }
    return null;
  }

  function montarPromptExtrato(bancoLabel, instrucoesExtra) {
    const schema =
      '{"banco":"santander|sicredi","anoReferencia":2023,"cabecalhosDatas":["DD/MM/AAAA"],"secoes":[{"dataCabecalho":"DD/MM/AAAA","dataTextoOriginal":"Segunda, 18 de maio","movimentos":[{"data":"DD/MM/AAAA","descricao":"Pix recebido — Nome","valor":0.00,"tipo":"entrada|saida","pagadorNome":string|null,"pagadorCpf":string|null,"categoria":string|null}]}],"movimentos":[{"data":"DD/MM/AAAA","descricao":"string","valor":0.00,"tipo":"entrada|saida","pagadorNome":string|null,"pagadorCpf":string|null,"categoria":string|null}],"observacoes":string|null,"linhasNaoLidas":[{"numeroLinha":number|null,"textoVisivel":"string","motivo":"string","campo":"data|valor|descricao|null"}],"totalLinhasVisiveis":number|null,"totalCabecalhosData":number|null}';
    return `Leitor de extrato bancário brasileiro (${bancoLabel}). Analise a imagem ou PDF anexo.

Extraia TODAS as movimentações visíveis. Não omita linhas.${blocoLayoutAppMobile(bancoLabel)}

Use secoes[] para capturas de app móvel (cada secção = um cabeçalho de data + lançamentos abaixo). Também pode usar movimentos[] plano com data em cada item.

Para cada linha ilegível, registe em linhasNaoLidas.

Responda APENAS um objeto json válido (sem markdown): ${schema}

Regras:
- data em DD/MM/AAAA em TODOS os movimentos (propagada do cabeçalho de data quando for app móvel)
- valor numérico positivo com até 2 decimais
- tipo "entrada" para Pix recebido/créditos; "saida" para Pix enviado/débitos
- pagadorNome: nome da pessoa abaixo de Pix recebido/enviado
- totalCabecalhosData: quantos cabeçalhos de data distintos existem na imagem
- cabecalhosDatas: lista DD/MM/AAAA de cada cabeçalho visível
- totalLinhasVisiveis: quantos Pix/lançamentos individuais contou
- banco: "${bancoLabel.toLowerCase().includes("sant") ? "santander" : "sicredi"}"${blocoInstrucoesIaPrompt(instrucoesExtra)}`;
  }

  function montarPromptExtratoRevisao(bancoLabel, movimentosAnteriores, instrucoesExtra) {
    const schema =
      '{"banco":"santander|sicredi","anoReferencia":2023,"cabecalhosDatas":["DD/MM/AAAA"],"secoes":[{"dataCabecalho":"DD/MM/AAAA","dataTextoOriginal":"string","movimentos":[...]}],"movimentos":[...],"observacoes":string|null,"totalLinhasVisiveis":number|null,"totalCabecalhosData":number|null,"linhasNaoLidas":[{"numeroLinha":number|null,"textoVisivel":"string","motivo":"string","campo":"data|valor|descricao|null"}],"avisos":["string"]}';
    const nAnt = Array.isArray(movimentosAnteriores) ? movimentosAnteriores.length : 0;
    const datasAnt = contarDatasUnicasMovimentos(movimentosAnteriores);
    const amostraAnt = (movimentosAnteriores || [])
      .slice(0, 8)
      .map((m) => `${m.data} · ${m.descricao} · ${currencyBRL(m.valor)} (${m.tipo})`)
      .join("\n");
    return `REVISÃO DETALHADA de extrato bancário brasileiro (${bancoLabel}). Extração anterior: ${nAnt} movimento(s) em ${datasAnt} data(s) distinta(s) — INCOMPLETA se faltarem cabeçalhos/datas.

Leia a imagem LINHA A LINHA. NÃO omita cabeçalhos de data nem Pix.${blocoLayoutAppMobile(bancoLabel)}

${nAnt > 0 ? `Amostra anterior:\n${amostraAnt}\n` : ""}

CRÍTICO: cada cabeçalho «Segunda, 18 de maio» etc. deve gerar data DD/MM/AAAA em TODOS os Pix abaixo até ao próximo cabeçalho.

OBRIGATÓRIO: linhasNaoLidas para linhas ilegíveis; cabecalhosDatas com TODAS as datas visíveis; totalCabecalhosData = tamanho de cabecalhosDatas.

Responda APENAS um objeto json válido (sem markdown): ${schema}

Regras rigorosas:
- Preferir secoes[] no app móvel (um bloco por cabeçalho de data)
- Pix recebido = entrada; Pix enviado = saida
- pagadorNome = nome sob o tipo Pix
- banco: "${bancoLabel.toLowerCase().includes("sant") ? "santander" : "sicredi"}"${blocoInstrucoesIaPrompt(instrucoesExtra)}`;
  }

  async function probeOpenAIServidor() {
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true }),
      });
      const data = await res.json();
      return Boolean(data?.ok && data?.mode === "server");
    } catch {
      return false;
    }
  }

  async function refreshFinanceiroOpenAIStatus() {
    const el = document.getElementById("financeiroOpenAIStatus");
    if (!el) return;
    el.textContent = "A verificar IA…";
    const server = await probeOpenAIServidor();
    const local = String(localStorage.getItem(OPENAI_KEY_STORAGE) || "").trim();
    if (server) {
      el.innerHTML = "✓ <strong>IA no servidor</strong> (Vercel) — pode extrair movimentos.";
      return;
    }
    if (local) {
      el.textContent = "✓ Chave OpenAI neste navegador — pode extrair movimentos.";
      return;
    }
    el.innerHTML =
      'IA não disponível. Configure <code>OPENAI_API_KEY</code> na Vercel (redeploy) ou guarde a chave em Operação → Lançamento de aluguel → Validação → «Chave OpenAI só neste navegador».';
  }

  async function chamarOpenAIExtrato(content, opts = {}) {
    const maxTokens = Number(opts.max_tokens) > 0 ? opts.max_tokens : 4096;
    const modo = String(opts.modo || "").toLowerCase();
    const payload = { content, tipo: "extrato", max_tokens: maxTokens, modo };
    const bodyStr = JSON.stringify(payload);
    if (bodyStr.length > 3_800_000) {
      return {
        ok: false,
        msg: "Extrato demasiado grande para enviar (~4 MB). Comprima a imagem ou use captura de ecrã mais pequena.",
      };
    }

    let erroServidor = "";
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
      const raw = await res.text();
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {
        erroServidor = formatarErroServidorIa(null, res.status);
      }
      if (data) {
        if (res.ok && data.ok && data.parsed) {
          return { ok: true, parsed: data.parsed, via: "server" };
        }
        erroServidor = formatarErroServidorIa(data, res.status);
      }
    } catch (e) {
      erroServidor = `Ligação ao servidor: ${String(e?.message || e)}`;
    }

    if (erroServidor) {
      const timeout =
        /timeout|timed out|504|FUNCTION_INVOCATION_TIMEOUT/i.test(erroServidor);
      return {
        ok: false,
        msg: timeout
          ? "Servidor IA: tempo esgotado (extrato grande). Tente uma foto com menos linhas ou aguarde e repita."
          : `Servidor IA: ${erroServidor}`,
      };
    }

    const key = String(localStorage.getItem(OPENAI_KEY_STORAGE) || "").trim();
    if (!key) {
      return {
        ok: false,
        msg: "IA no servidor indisponível e sem chave neste navegador. Guarde a chave em Operação → Validação → «Chave OpenAI só neste navegador».",
      };
    }

    try {
      const model = modo === "revisao" ? "gpt-4o" : "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
          max_tokens: maxTokens,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, msg: `OpenAI: ${t.slice(0, 200)}` };
      }
      const data = await res.json();
      let raw = String(data.choices?.[0]?.message?.content || "").trim();
      const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
      if (fence) raw = fence[1].trim();
      return { ok: true, parsed: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, msg: String(e?.message || e) };
    }
  }

  async function processarDataUrlExtrato(dataUrlRaw, nomeArquivo, opts = {}) {
    const {
      modoRevisao = false,
      uploadId = null,
      movimentosAnteriores = [],
      salvarArquivo = true,
      instrucoesExtra = "",
    } = opts;
    let dataUrl = dataUrlRaw;
    const { mime: mimeRaw } = parseDataUrl(dataUrlRaw);
    const maxPxIa = modoRevisao ? 2400 : 2000;
    if (mimeRaw.startsWith("image/")) {
      dataUrl = await comprimirImagemDataUrl(dataUrlRaw, maxPxIa, modoRevisao ? 0.9 : 0.86);
    }

    let arquivoParaGuardar = null;
    if (salvarArquivo && !uploadId) {
      arquivoParaGuardar = await dataUrlParaArmazenamento(dataUrlRaw);
    }

    const bancoLabel = BANCOS[bancoAtivo] || bancoAtivo;
    const prompt = modoRevisao
      ? montarPromptExtratoRevisao(bancoLabel, movimentosAnteriores, instrucoesExtra)
      : montarPromptExtrato(bancoLabel, instrucoesExtra);
    const content = [{ type: "text", text: prompt }];
    const parsedUrl = parseDataUrl(dataUrl);
    if (parsedUrl.mime.startsWith("image/") && parsedUrl.base64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${parsedUrl.mime};base64,${parsedUrl.base64}`, detail: "high" },
      });
    } else if (parsedUrl.mime === "application/pdf" && parsedUrl.base64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${parsedUrl.base64}` },
      });
      content.push({
        type: "text",
        text: `PDF: ${nomeArquivo}. Leia todas as páginas visíveis do extrato mensal ou movimentação diária.`,
      });
    } else {
      content.push({
        type: "text",
        text: `Ficheiro ${nomeArquivo} (${parsedUrl.mime}). Extraia movimentações se possível.`,
      });
    }

    const oai = await chamarOpenAIExtrato(content, {
      max_tokens: 8192,
      modo: modoRevisao ? "revisao" : "",
    });
    if (!oai.ok) {
      return { ok: false, erro: oai.msg || "Falha na IA." };
    }

    const anoRef = inferirAnoReferencia(oai.parsed, nomeArquivo);
    const flat = flattenExtratoParsed(oai.parsed, nomeArquivo);
    const movimentosBrutos = normalizarMovimentos(flat, anoRef);
    if (!movimentosBrutos.length) {
      return {
        ok: false,
        erro:
          String(oai.parsed?.observacoes || "") ||
          "A IA não encontrou movimentos neste ficheiro. Use «Revisar com IA» ou ajuste instruções (cabecalho de data → Pix abaixo).",
      };
    }

    const movimentos = dedupeListaMovimentos(movimentosBrutos);
    const observacoes = String(oai.parsed?.observacoes || "").trim();
    const totalVisivel = oai.parsed?.totalLinhasVisiveis;
    const relatorioErros = extrairRelatorioErros(
      oai.parsed,
      movimentos.length,
      instrucoesExtra,
      movimentos
    );

    if (uploadId) {
      const uploads = getUploads(bancoAtivo);
      const idx = uploads.findIndex((u) => u.id === uploadId);
      if (idx < 0) return { ok: false, erro: "Ficheiro não encontrado na base." };
      const anterior = (uploads[idx].movimentos || []).length;
      uploads[idx] = {
        ...uploads[idx],
        movimentos,
        processadoEm: new Date().toISOString(),
        revisadoEm: new Date().toISOString(),
        observacoes,
        totalLinhasVisiveis: totalVisivel,
        relatorioErros,
      };
      setUploads(bancoAtivo, uploads);
      return {
        ok: true,
        revisao: true,
        novos: movimentos.length,
        anterior,
        observacoes,
        totalVisivel,
        relatorioErros,
      };
    }

    const { kept: movimentosNovos, ignorados } = filtrarMovimentosNovos(movimentos, bancoAtivo);

    if (!movimentosNovos.length) {
      return {
        ok: true,
        vazio: true,
        ignorados: ignorados || movimentosBrutos.length,
        observacoes,
      };
    }

    const uploads = getUploads(bancoAtivo);
    uploads.push({
      id: newId(),
      nomeArquivo,
      processadoEm: new Date().toISOString(),
      movimentos: movimentosNovos,
      observacoes,
      arquivoDataUrl: arquivoParaGuardar || undefined,
      totalLinhasVisiveis: totalVisivel,
      relatorioErros,
    });
    setUploads(bancoAtivo, uploads);

    return { ok: true, novos: movimentosNovos.length, ignorados, observacoes, relatorioErros };
  }

  async function processarUmArquivoExtrato(file, nomeArquivo, opts = {}) {
    const dataUrl = await fileToBase64(file);
    return processarDataUrlExtrato(dataUrl, nomeArquivo, opts);
  }

  async function extrairComIA() {
    if (!bancoAtivo) return;
    if (!arquivosPendentes.length) {
      if (msgEl) {
        msgEl.textContent = "Adicione uma ou mais imagens/PDFs à fila primeiro.";
        msgEl.classList.add("portal-feedback--erro");
      }
      return;
    }

    const fila = [...arquivosPendentes];
    setFinanceiroIaUiBusy(true);

    let okCount = 0;
    let failCount = 0;
    let vazioCount = 0;
    let totalNovos = 0;
    let totalIgnorados = 0;

    try {
      for (let i = 0; i < fila.length; i += 1) {
        const item = fila[i];
        if (msgEl) {
          msgEl.textContent = `A processar ${i + 1}/${fila.length}: ${item.nome}… (pode demorar ~1 min por imagem)`;
          msgEl.classList.remove("portal-feedback--erro");
          msgEl.classList.remove("portal-feedback--ok");
        }

        try {
          const r = await processarUmArquivoExtrato(item.file, item.nome);
          if (!r.ok) {
            failCount += 1;
            continue;
          }
          if (r.vazio) {
            vazioCount += 1;
            totalIgnorados += r.ignorados || 0;
            okCount += 1;
            continue;
          }
          okCount += 1;
          totalNovos += r.novos || 0;
          totalIgnorados += r.ignorados || 0;
        } catch (e) {
          failCount += 1;
          if (msgEl && i === fila.length - 1) {
            msgEl.textContent = String(e?.message || e);
          }
        }
      }

      arquivosPendentes = [];
      if (fileInp) fileInp.value = "";
      renderPendentesLista();
      renderUploadsLista();
      atualizarResumoBar();

      const total = todosMovimentosBanco(bancoAtivo).length;
      if (msgEl) {
        if (failCount === fila.length) {
          msgEl.textContent = "Nenhum ficheiro foi processado com sucesso. Tente novamente.";
          msgEl.classList.add("portal-feedback--erro");
        } else {
          const partes = [
            `${okCount}/${fila.length} ficheiro(s) processado(s)`,
            `+${totalNovos} movimento(s) novo(s)`,
          ];
          if (totalIgnorados > 0) partes.push(`${totalIgnorados} repetido(s) ignorado(s)`);
          if (vazioCount > 0) partes.push(`${vazioCount} sem movimentos novos`);
          if (failCount > 0) partes.push(`${failCount} com erro`);
          msgEl.textContent = `${partes.join(" · ")} · base: ${total} no relatório.`;
          msgEl.classList.remove("portal-feedback--erro");
          msgEl.classList.add("portal-feedback--ok");
        }
      }
    } catch (e) {
      if (msgEl) {
        msgEl.textContent = String(e?.message || e);
        msgEl.classList.add("portal-feedback--erro");
      }
    } finally {
      setFinanceiroIaUiBusy(false);
    }
  }

  function abrirBanco(banco, btnId) {
    if (!BANCOS[banco]) return;
    bancoAtivo = banco;
    limparArquivoPendente();
    setFinanceiroPlaceholderVisible(false);
    if (typeof window.__DK_financeiroHideModulos === "function") {
      window.__DK_financeiroHideModulos({ keepBanco: true });
    }
    syncFinanceiroSidebarButtons(btnId);
    if (tituloBanco) tituloBanco.textContent = BANCOS[banco];
    void refreshFinanceiroOpenAIStatus();
    syncInstrucoesIaUi();
    renderUploadsLista();
    atualizarResumoBar();
  }

  function resetFinanceiroUi() {
    bancoAtivo = "";
    limparArquivoPendente();
    setFinanceiroPlaceholderVisible(true);
    syncFinanceiroSidebarButtons(null);
    fecharRelatorioModal();
    fecharRelatorioErrosModal();
    if (uploadsLista) uploadsLista.innerHTML = "";
    if (resumoDados) resumoDados.textContent = "Nenhum movimento guardado ainda.";
    if (verRelatorioBtn) verRelatorioBtn.disabled = true;
  }

  function financeiroPaneVisivel() {
    return panel && !panel.classList.contains("hidden") && paneBanco && !paneBanco.classList.contains("hidden");
  }

  function bindUi() {
    if (document.documentElement.dataset.dkFinanceiroBound === "1") return;
    document.documentElement.dataset.dkFinanceiroBound = "1";

    document.getElementById("btn-financeiro-santander")?.addEventListener("click", () => {
      abrirBanco("santander", "btn-financeiro-santander");
    });
    document.getElementById("btn-financeiro-sicredi")?.addEventListener("click", () => {
      abrirBanco("sicredi", "btn-financeiro-sicredi");
    });

    const onPaste = (e) => {
      if (!financeiroPaneVisivel()) return;
      const alvo = e.target;
      if (alvo?.tagName === "INPUT" && alvo?.id !== "financeiroExtratoFile" && !extrairArquivoClipboard(e.clipboardData)) {
        return;
      }
      const f = extrairArquivoClipboard(e.clipboardData);
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      adicionarArquivoPendente(f, f.name || "extrato-colado.png");
    };

    pasteZone?.addEventListener("paste", onPaste);
    document.addEventListener("paste", onPaste, true);

    pasteZone?.addEventListener("click", (e) => {
      if (
        e.target === fileInp ||
        e.target?.closest?.("#financeiroEscolherMultiplosBtn") ||
        e.target?.closest?.("[data-fin-pendente-id]")
      ) {
        return;
      }
      fileInp?.click();
    });

    fileInp?.addEventListener("change", () => {
      const list = fileInp.files ? Array.from(fileInp.files) : [];
      if (list.length) adicionarArquivosPendentes(list);
      fileInp.value = "";
    });

    extrairBtn?.addEventListener("click", () => void extrairComIA());
    revisarTodosBtn?.addEventListener("click", () => void revisarTodosComIA());
    verErrosIaBtn?.addEventListener("click", () => abrirRelatorioErrosModal(null));
    limparBtn?.addEventListener("click", () => limparArquivoPendente());

    document.getElementById("financeiroIaInstrucoesGuardarBtn")?.addEventListener("click", () => {
      saveInstrucoesIaAtivas(iaInstrucoesEl?.value || "");
      if (msgEl) {
        msgEl.textContent = "Instruções guardadas para este banco.";
        msgEl.classList.remove("portal-feedback--erro");
        msgEl.classList.add("portal-feedback--ok");
      }
    });

    document.getElementById("financeiroRevisaoErrosRevisarBtn")?.addEventListener("click", () => {
      const modalTa = document.getElementById("financeiroIaInstrucoesModal");
      const texto = modalTa?.value || "";
      saveInstrucoesIaAtivas(texto);
      fecharRelatorioErrosModal();
      if (revisaoErrosUploadIdFocus) {
        void revisarUploadComIA(revisaoErrosUploadIdFocus, { instrucoesExtra: texto });
      } else {
        void revisarTodosComIA({ instrucoesExtra: texto });
      }
    });

    revisaoErrosModal?.querySelectorAll("[data-close-fin-erros]").forEach((el) => {
      el.addEventListener("click", () => fecharRelatorioErrosModal());
    });

    verRelatorioBtn?.addEventListener("click", () => abrirRelatorioModal());
    document.getElementById("financeiroRelatorioAtualizarBtn")?.addEventListener("click", () => {
      renderRelatorioModalConteudo();
    });
    document.getElementById("financeiroRelatorioPdfBtn")?.addEventListener("click", () => {
      emitFinanceiroRelatorioPdf();
    });
    document.getElementById("financeiroRelatorioExcelBtn")?.addEventListener("click", () => {
      emitFinanceiroRelatorioExcel();
    });
    filtroCategoria?.addEventListener("change", () => {
      if (relatorioModal && !relatorioModal.classList.contains("hidden")) {
        renderRelatorioModalConteudo();
      }
    });
    relatorioModal?.querySelectorAll("[data-close-fin-relatorio]").forEach((el) => {
      el.addEventListener("click", () => fecharRelatorioModal());
    });

    if (filtroDe && typeof bindDateMaskInput === "function") bindDateMaskInput(filtroDe);
    if (filtroAte && typeof bindDateMaskInput === "function") bindDateMaskInput(filtroAte);
    if (typeof window.bindDkIntervaloCalendarios === "function") {
      window.bindDkIntervaloCalendarios(document);
    } else {
      if (filtroDe && typeof window.bindDkDateCalendario === "function") window.bindDkDateCalendario(filtroDe);
      if (filtroAte && typeof window.bindDkDateCalendario === "function") window.bindDkDateCalendario(filtroAte);
    }
  }

  function migrarStorageLegado() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (Array.isArray(o.santander) || Array.isArray(o.sicredi)) {
        saveStore({
          santander: normBucket(o.santander),
          sicredi: normBucket(o.sicredi),
        });
      }
    } catch {
      /* ignore */
    }
  }

  migrarStorageLegado();
  bindUi();

  window.__DK_financeiroReset = resetFinanceiroUi;
  window.__DK_financeiroEscapeBack = () => {
    if (!panel || panel.classList.contains("hidden")) return false;
    if (revisaoErrosModal && !revisaoErrosModal.classList.contains("hidden")) {
      fecharRelatorioErrosModal();
      return true;
    }
    if (relatorioModal && !relatorioModal.classList.contains("hidden")) {
      fecharRelatorioModal();
      return true;
    }
    if (typeof window.__DK_financeiroModuloEscapeBack === "function" && window.__DK_financeiroModuloEscapeBack()) {
      return true;
    }
    if (!bancoAtivo) return false;
    bancoAtivo = "";
    limparArquivoPendente();
    setFinanceiroPlaceholderVisible(true);
    syncFinanceiroSidebarButtons(null);
    return true;
  };
  window.__DK_financeiroOnShow = () => {
    resetFinanceiroUi();
    if (typeof window.__DK_financeiroModulosOnShow === "function") window.__DK_financeiroModulosOnShow();
    void refreshFinanceiroOpenAIStatus();
  };
  window.__DK_financeiroRefreshFromStorage = () => {
    if (!bancoAtivo) return;
    renderUploadsLista();
    atualizarResumoBar();
    if (relatorioModal && !relatorioModal.classList.contains("hidden")) {
      renderRelatorioModalConteudo();
    }
  };
})();
