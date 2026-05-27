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
  let arquivoPendente = null;
  let arquivoPendenteNome = "";

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

  function movimentoFingerprint(m) {
    const { cpf, nome } = resolverPagador(m);
    return [
      dateKeyBr(m.data),
      m.tipo,
      Number(m.valor).toFixed(2),
      normNome(m.descricao).slice(0, 60),
      cpf,
      normNome(nome).slice(0, 40),
    ].join("|");
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

  function normalizarMovimentos(lista) {
    const out = [];
    for (const m of lista || []) {
      const data = String(m.data || m.dataMovimento || "").trim();
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
      let tipo = String(m.tipo || "").toLowerCase();
      if (tipo !== "entrada" && tipo !== "saida") {
        tipo = m.credito === true || m.debito === false ? "entrada" : "saida";
      }
      if (tipo !== "entrada" && tipo !== "saida") {
        const sinal = String(m.sinal || "").toLowerCase();
        tipo = sinal === "+" || sinal === "c" ? "entrada" : "saida";
      }
      const pagadorNome = String(m.pagadorNome || m.nomePagador || "").trim();
      const pagadorCpf = onlyDigits(m.pagadorCpf || m.cpfPagador || "");
      const categoria = String(m.categoria || "").trim();
      out.push({
        data,
        descricao,
        valor: Math.abs(valor),
        tipo,
        pagadorNome,
        pagadorCpf,
        categoria,
      });
    }
    return out;
  }

  function todosMovimentosBanco(banco, dedupe) {
    const uploads = getUploads(banco);
    const movs = [];
    const seen = new Set();
    for (const u of uploads) {
      for (const m of u.movimentos || []) {
        const row = { ...m };
        if (dedupe !== false) {
          const fp = movimentoFingerprint(row);
          if (seen.has(fp)) continue;
          seen.add(fp);
        }
        movs.push(row);
      }
    }
    return movs;
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
      resumoDados.textContent =
        nMov > 0
          ? `${nMov} movimento(s) de ${nArq} ficheiro(s) — use «Ver relatório» para filtrar por período e tipo.`
          : nArq > 0
            ? `${nArq} ficheiro(s) sem movimentos válidos.`
            : "Nenhum movimento guardado ainda.";
    }
    if (verRelatorioBtn) {
      verRelatorioBtn.disabled = nMov === 0;
    }
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

  function renderRelatorioModalConteudo() {
    if (!relatorioConteudo || !bancoAtivo) return;
    const de = String(filtroDe?.value || "").trim();
    const ate = String(filtroAte?.value || "").trim();
    const cat = String(filtroCategoria?.value || "resumo");
    const todos = todosMovimentosBanco(bancoAtivo);
    const movs = todos.filter((m) => movimentoNoPeriodo(m, de, ate));

    if (relatorioPeriodoLbl) {
      const parteDe = de || "início";
      const parteAte = ate || "fim";
      relatorioPeriodoLbl.textContent = `Período: ${parteDe} até ${parteAte} · ${movs.length} de ${todos.length} lançamento(s)`;
    }

    if (!movs.length) {
      relatorioConteudo.innerHTML =
        "<p class=\"subtext\">Nenhum movimento neste período. Ajuste as datas ou envie mais imagens.</p>";
      return;
    }

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
      relatorioModalSub.textContent = `${BANCOS[bancoAtivo]} · ${getUploads(bancoAtivo).length} ficheiro(s) · ${movs.length} movimento(s) consolidados`;
    }
    const tit = document.getElementById("financeiroRelatorioModalTitulo");
    if (tit) tit.textContent = `Relatório — ${BANCOS[bancoAtivo]}`;
    relatorioModal.classList.remove("hidden");
    renderRelatorioModalConteudo();
  }

  function fecharRelatorioModal() {
    relatorioModal?.classList.add("hidden");
  }

  function renderUploadsLista() {
    if (!uploadsLista || !bancoAtivo) return;
    const uploads = getUploads(bancoAtivo);
    if (!uploads.length) {
      uploadsLista.innerHTML = '<p class="subtext">Nenhum extrato processado neste banco.</p>';
      return;
    }
    uploadsLista.innerHTML = uploads
      .slice()
      .reverse()
      .map((u) => {
        const dt = u.processadoEm ? new Date(u.processadoEm).toLocaleString("pt-BR") : "";
        const n = (u.movimentos || []).length;
        return `<div class="financeiro-upload-item">
          <div>
            <strong>${escapeHtml(u.nomeArquivo || "extrato")}</strong>
            <span class="subtext"> — ${n} movimento(s) · ${escapeHtml(dt)}</span>
          </div>
          <button type="button" class="btn-primary btn-secondary-outline financeiro-upload-remover" data-fin-upload-id="${escapeHtml(u.id)}">Remover</button>
        </div>`;
      })
      .join("");
    uploadsLista.querySelectorAll(".financeiro-upload-remover").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-fin-upload-id");
        if (!id || !bancoAtivo) return;
        const uploads = getUploads(bancoAtivo).filter((u) => u.id !== id);
        setUploads(bancoAtivo, uploads);
        renderUploadsLista();
        atualizarResumoBar();
      });
    });
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

  function limparArquivoPendente() {
    arquivoPendente = null;
    arquivoPendenteNome = "";
    if (fileInp) fileInp.value = "";
    if (arquivoLbl) arquivoLbl.textContent = "";
    if (msgEl) msgEl.textContent = "";
    pasteZone?.classList.remove("portal-operador-comprovante-paste--ativo");
  }

  function definirArquivoPendente(file, nome) {
    arquivoPendente = file;
    arquivoPendenteNome = nome || file?.name || "extrato";
    if (arquivoLbl) arquivoLbl.textContent = `Ficheiro: ${arquivoPendenteNome}`;
    pasteZone?.classList.add("portal-operador-comprovante-paste--ativo");
    if (msgEl) {
      msgEl.textContent = "Pronto para extrair. Clique em «Extrair movimentos com IA».";
      msgEl.classList.remove("portal-feedback--erro");
    }
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

  async function comprimirImagemDataUrl(dataUrl, maxPx) {
    const { mime, base64 } = parseDataUrl(dataUrl);
    if (!mime.startsWith("image/") || !base64) return dataUrl;
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
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
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

  function montarPromptExtrato(bancoLabel) {
    const schema =
      '{"banco":"santander|sicredi","movimentos":[{"data":"DD/MM/AAAA","descricao":"string","valor":0.00,"tipo":"entrada|saida","pagadorNome":string|null,"pagadorCpf":string|null,"categoria":string|null}],"observacoes":string|null}';
    return `Leitor de extrato bancário brasileiro (${bancoLabel}). Analise a imagem ou PDF anexo.

Extraia TODAS as movimentações visíveis (créditos, débitos, PIX, TED, tarifas, salários, etc.).

Responda APENAS um objeto json válido (sem markdown): ${schema}

Regras:
- data em DD/MM/AAAA; se o extrato só mostrar dia/mês, complete com o ano visível no documento
- valor numérico positivo com até 2 decimais
- tipo "entrada" para créditos/depósitos/recebimentos; "saida" para débitos/pagamentos/saques
- descricao: histórico como no extrato
- pagadorNome e pagadorCpf: em PIX/TED preencha nome e CPF/CNPJ do pagador ou recebedor quando aparecer
- categoria: ex. pix, ted, tarifa, salario, boleto — quando identificável
- banco: "${bancoLabel.toLowerCase().includes("sant") ? "santander" : "sicredi"}"`;
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

  async function chamarOpenAIExtrato(content) {
    const payload = { content, tipo: "extrato", max_tokens: 4096 };
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
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
          max_tokens: 4096,
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

  async function extrairComIA() {
    if (!bancoAtivo) return;
    if (!arquivoPendente) {
      if (msgEl) {
        msgEl.textContent = "Escolha ou cole um extrato (imagem ou PDF) primeiro.";
        msgEl.classList.add("portal-feedback--erro");
      }
      return;
    }
    if (extrairBtn) extrairBtn.disabled = true;
    if (msgEl) {
      msgEl.textContent = "A IA está a ler o extrato… pode demorar até um minuto em PDFs longos.";
      msgEl.classList.remove("portal-feedback--erro");
    }

    try {
      let dataUrl = await fileToBase64(arquivoPendente);
      const { mime, base64 } = parseDataUrl(dataUrl);
      if (mime.startsWith("image/")) {
        dataUrl = await comprimirImagemDataUrl(dataUrl, 1400);
      }

      const bancoLabel = BANCOS[bancoAtivo] || bancoAtivo;
      const content = [{ type: "text", text: montarPromptExtrato(bancoLabel) }];
      const parsedUrl = parseDataUrl(dataUrl);
      if (parsedUrl.mime.startsWith("image/") && parsedUrl.base64) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${parsedUrl.mime};base64,${parsedUrl.base64}` },
        });
      } else if (parsedUrl.mime === "application/pdf" && parsedUrl.base64) {
        content.push({
          type: "image_url",
          image_url: { url: `data:application/pdf;base64,${parsedUrl.base64}` },
        });
        content.push({
          type: "text",
          text: `PDF: ${arquivoPendenteNome}. Leia todas as páginas visíveis do extrato mensal ou movimentação diária.`,
        });
      } else {
        content.push({
          type: "text",
          text: `Ficheiro ${arquivoPendenteNome} (${parsedUrl.mime}). Extraia movimentações se possível.`,
        });
      }

      const oai = await chamarOpenAIExtrato(content);
      if (!oai.ok) {
        if (msgEl) {
          msgEl.textContent = oai.msg || "Falha na IA.";
          msgEl.classList.add("portal-feedback--erro");
        }
        return;
      }

      const movimentos = normalizarMovimentos(oai.parsed?.movimentos || oai.parsed?.lancamentos);
      if (!movimentos.length) {
        if (msgEl) {
          msgEl.textContent =
            String(oai.parsed?.observacoes || "") ||
            "A IA não encontrou movimentos. Tente outra imagem mais nítida ou um PDF.";
          msgEl.classList.add("portal-feedback--erro");
        }
        return;
      }

      const uploads = getUploads(bancoAtivo);
      uploads.push({
        id: newId(),
        nomeArquivo: arquivoPendenteNome,
        processadoEm: new Date().toISOString(),
        movimentos,
        observacoes: String(oai.parsed?.observacoes || "").trim(),
      });
      setUploads(bancoAtivo, uploads);
      limparArquivoPendente();
      renderUploadsLista();
      atualizarResumoBar();
      if (msgEl) {
        msgEl.textContent = `${movimentos.length} movimento(s) adicionado(s). Clique em «Ver relatório».`;
        msgEl.classList.remove("portal-feedback--erro");
        msgEl.classList.add("portal-feedback--ok");
      }
    } catch (e) {
      if (msgEl) {
        msgEl.textContent = String(e?.message || e);
        msgEl.classList.add("portal-feedback--erro");
      }
    } finally {
      if (extrairBtn) extrairBtn.disabled = false;
    }
  }

  function abrirBanco(banco, btnId) {
    if (!BANCOS[banco]) return;
    bancoAtivo = banco;
    limparArquivoPendente();
    setFinanceiroPlaceholderVisible(false);
    syncFinanceiroSidebarButtons(btnId);
    if (tituloBanco) tituloBanco.textContent = BANCOS[banco];
    void refreshFinanceiroOpenAIStatus();
    renderUploadsLista();
    atualizarResumoBar();
  }

  function resetFinanceiroUi() {
    bancoAtivo = "";
    limparArquivoPendente();
    setFinanceiroPlaceholderVisible(true);
    syncFinanceiroSidebarButtons(null);
    fecharRelatorioModal();
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
      definirArquivoPendente(f, f.name || "extrato-colado.png");
    };

    pasteZone?.addEventListener("paste", onPaste);
    document.addEventListener("paste", onPaste, true);

    pasteZone?.addEventListener("click", (e) => {
      if (e.target === fileInp) return;
      fileInp?.click();
    });

    fileInp?.addEventListener("change", () => {
      const f = fileInp.files?.[0];
      if (f) definirArquivoPendente(f, f.name);
    });

    extrairBtn?.addEventListener("click", () => void extrairComIA());
    limparBtn?.addEventListener("click", () => limparArquivoPendente());

    verRelatorioBtn?.addEventListener("click", () => abrirRelatorioModal());
    document.getElementById("financeiroRelatorioAtualizarBtn")?.addEventListener("click", () => {
      renderRelatorioModalConteudo();
    });
    relatorioModal?.querySelectorAll("[data-close-fin-relatorio]").forEach((el) => {
      el.addEventListener("click", () => fecharRelatorioModal());
    });

    if (filtroDe && typeof bindDateMaskInput === "function") bindDateMaskInput(filtroDe);
    if (filtroAte && typeof bindDateMaskInput === "function") bindDateMaskInput(filtroAte);
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
  window.__DK_financeiroOnShow = () => {
    resetFinanceiroUi();
    void refreshFinanceiroOpenAIStatus();
  };
})();
