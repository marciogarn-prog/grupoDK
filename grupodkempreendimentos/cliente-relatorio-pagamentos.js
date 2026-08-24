/**
 * Relatório 2 — Por cliente (mesmo HTML do portal para o app cliente).
 */
(function clienteRelatorioPagamentos() {
  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normProto(nc) {
    return String(nc || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function normPlate(p) {
    return String(p || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function parseBrDate(s) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(s);
    const raw = String(s || "").trim();
    if (!raw) return null;
    if (raw.includes("/")) {
      const [day, month, year] = raw.split("/").map(Number);
      if (!day || !month || !year) return null;
      return new Date(year, month - 1, day);
    }
    return null;
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

  function parsePortalLancamentoValorRaw(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "").trim();
    if (!s) return 0;
    if (s.includes(",")) {
      const cleaned = s
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    const plain = s.replace(/[R$\s]/g, "");
    if (/^\d+(\.\d{1,2})?$/.test(plain)) {
      const n = Number(plain);
      return Number.isFinite(n) ? n : 0;
    }
    return parseCurrencyBR(s);
  }

  function formatSumBrl(n) {
    const abs = Math.abs(Number(n || 0));
    const txt = currencyBRL(abs);
    if (Number(n) < 0) return `-${txt}`;
    return txt;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatIso(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  }

  function normalizeLancEntry(x) {
    if (!x || typeof x !== "object") return null;
    const data = String(x.data || x.dataPagamento || "").trim();
    if (!data) return null;
    const meios = ["valorEspecie", "valorPix", "valorCartao"];
    const anyMeios = meios.some((k) => Object.prototype.hasOwnProperty.call(x, k));
    let valor;
    if (anyMeios) {
      const e = Number(parsePortalLancamentoValorRaw(x.valorEspecie ?? 0));
      const p = Number(parsePortalLancamentoValorRaw(x.valorPix ?? 0));
      const c = Number(parsePortalLancamentoValorRaw(x.valorCartao ?? 0));
      valor = e + p + c;
    } else {
      valor =
        typeof x.valor === "number" && Number.isFinite(x.valor)
          ? x.valor
          : Number(parsePortalLancamentoValorRaw(x.valor ?? x.valorPago ?? 0));
    }
    if (!Number.isFinite(valor) || valor <= 0) return null;
    return {
      data,
      valor,
      createdAt: Number(x.createdAt || 0),
      confirmadoViaAppCliente: Boolean(x.confirmadoViaAppCliente),
      origemComprovanteClienteId: String(x.origemComprovanteClienteId || "").trim(),
      registradoPorNome: String(x.registradoPorNome || x.comprovanteValidadoPorNome || "").trim(),
      comprovanteClienteEnviadoEm: x.comprovanteClienteEnviadoEm,
      comprovanteClienteConfirmadoEm: x.comprovanteClienteConfirmadoEm,
      comprovanteValidadoPorNome: x.comprovanteValidadoPorNome,
    };
  }

  function mergeLancamentos(arrays) {
    const flat = [];
    for (const a of arrays || []) {
      if (!Array.isArray(a)) continue;
      for (const x of a) {
        const n = normalizeLancEntry(x);
        if (n) flat.push(n);
      }
    }
    flat.sort((a, b) => {
      const da = parseBrDate(a.data)?.getTime() || 0;
      const db = parseBrDate(b.data)?.getTime() || 0;
      if (da !== db) return da - db;
      return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    });
    if (typeof window.__DK_dedupeLancamentosPagamento === "function") {
      return window.__DK_dedupeLancamentosPagamento(flat);
    }
    return flat;
  }

  function lancamentosFromGlobal(loc) {
    const out = [];
    try {
      const raw = localStorage.getItem("dk_lancamentos_aluguel");
      const global = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(global)) return out;
      const cpf = onlyDigits(loc.cpf).slice(0, 11);
      const nc = normProto(loc.numeroContrato);
      const plate = normPlate(loc.placa);
      global.forEach((item) => {
        if (!item || typeof item !== "object") return;
        if (onlyDigits(item.cpf) !== cpf) return;
        if (normProto(item.numeroContrato) !== nc && normPlate(item.placa) !== plate) return;
        const n = normalizeLancEntry({
          data: item.dataPagamento || item.semanaInicio,
          valor: item.valorPago ?? item.valor,
          createdAt: item.createdAt || item.id,
          registradoPorNome: item.registradoPorNome,
        });
        if (n) out.push(n);
      });
    } catch {
      /* ignore */
    }
    return out;
  }

  function getLancamentosContrato(loc) {
    if (typeof window.__DK_getLancamentosAluguelCanonico === "function") {
      return window.__DK_getLancamentosAluguelCanonico(loc).filter((lan) => {
        if (lan?.pagamentoInvalidado) return false;
        const oid = String(lan.origemComprovanteClienteId || "").trim();
        if (oid) {
          const ex = loadComprovantes().find((x) => String(x.id || "") === oid);
          if (ex?.pagamentoInvalidado) return false;
        }
        return true;
      });
    }
    const chunks = [];
    if (Array.isArray(loc.portalLancamentosAluguel) && loc.portalLancamentosAluguel.length) {
      chunks.push(loc.portalLancamentosAluguel);
    }
    if (Array.isArray(loc.lancamentosAluguel) && loc.lancamentosAluguel.length) {
      chunks.push(loc.lancamentosAluguel);
    }
    if (Array.isArray(loc.lancamentos) && loc.lancamentos.length) {
      chunks.push(loc.lancamentos);
    }
    const legado = Number(parsePortalLancamentoValorRaw(loc.totalPagoAno2025 ?? "0"));
    if (legado > 0 && !chunks.length) {
      chunks.push([
        {
          data: String(loc.ultimoLancamentoAluguelData || "").trim() || "01/01/2025",
          valor: legado,
        },
      ]);
    }
    const global = lancamentosFromGlobal(loc);
    if (global.length) chunks.push(global);
    return mergeLancamentos(chunks).filter((lan) => {
      if (lan?.pagamentoInvalidado) return false;
      const oid = String(lan.origemComprovanteClienteId || "").trim();
      if (oid) {
        const ex = loadComprovantes().find((x) => String(x.id || "") === oid);
        if (ex?.pagamentoInvalidado) return false;
      }
      return true;
    });
  }

  function computeTempoDiasLoc(loc) {
    const rawInicio = String(loc?.inicio || "").trim();
    if (!rawInicio) return 0;
    const inicio = parseBrDate(rawInicio);
    if (!inicio || Number.isNaN(inicio.getTime())) return 0;
    const rawFim = String(loc?.fim || "").trim();
    if (rawFim) {
      const fim = parseBrDate(rawFim);
      if (fim && !Number.isNaN(fim.getTime())) {
        const t0 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
        const t1 = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
        return Math.max(1, Math.round((t1 - t0) / 86400000));
      }
    }
    const start = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000));
  }

  function computeResumoProtocolo(loc) {
    const parseCur = (v) => Number(parsePortalLancamentoValorRaw(v));
    let valLoc = parseCur(loc?.valorLocacao ?? "0");
    const valInv = parseCur(loc?.valorInvestimento ?? "0");
    const valSemanalCampo = parseCur(loc?.valorSemanal ?? loc?.valorParcela ?? "0");
    if (valLoc <= 0 && valSemanalCampo > 0) {
      valLoc = Math.max(0, valSemanalCampo - valInv);
    }
    const plano = valLoc + valInv > 0 ? valLoc + valInv : valSemanalCampo;
    const tempo = computeTempoDiasLoc(loc);
    const custoDiaNum = plano / 7;
    const valorDevidoPlanoNum = tempo * (plano / 7);
    const valorDevidoAluguelNum = tempo * (valLoc / 7);
    const valorDevidoManutencaoNum = (() => {
      const arrManut = Array.isArray(loc?.portalManutencoesRegistro) ? loc.portalManutencoesRegistro : [];
      if (arrManut.length) {
        let s = 0;
        for (const m of arrManut) {
          const v = parseCur(m?.valorManutencao ?? m?.valorMulta ?? m?.valor ?? 0);
          if (Number.isFinite(v)) s += v;
        }
        return s;
      }
      return parseCur(
        loc?.valorDevidoManutencao ??
          loc?.devidoManutencao ??
          loc?.gastosManutencao ??
          loc?.gastoManutencao ??
          0
      );
    })();
    const valorDevidoMultasNum = parseCur(
      loc?.valorDevidoMulta ??
        loc?.valorDevidoMultas ??
        loc?.devidoMulta ??
        loc?.devidoMultas ??
        0
    );
    const lancs = getLancamentosContrato(loc);
    const totalPagoNum = lancs.reduce((a, x) => a + Number(x.valor || 0), 0);
    const investimentoAcumuladoNum =
      totalPagoNum - (valorDevidoAluguelNum + valorDevidoMultasNum + valorDevidoManutencaoNum);
    const tipoPlanoStr =
      String(loc?.plano || loc?.opcaoContrato || "").trim() ||
      (valInv > 0 ? "DK MINHA MOTO" : "DK MEU TRANSPORTE");
    return {
      custoDia: currencyBRL(custoDiaNum),
      valorAluguel: currencyBRL(valLoc),
      valorInvestimento: currencyBRL(valInv),
      valorPlano: currencyBRL(plano),
      valorDevidoPlano: currencyBRL(valorDevidoPlanoNum),
      totalPago: currencyBRL(totalPagoNum),
      tipoPlano: tipoPlanoStr,
      valorDevidoAluguel: currencyBRL(valorDevidoAluguelNum),
      investimentoAcumulado: formatSumBrl(investimentoAcumuladoNum),
      investimentoAcumuladoNeg: investimentoAcumuladoNum < 0,
    };
  }

  function loadComprovantes() {
    try {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function collectValidados(cpf, proto, lancs) {
    const cpfD = onlyDigits(cpf).slice(0, 11);
    const pNorm = normProto(proto);
    const map = new Map();

    for (const r of loadComprovantes()) {
      if (onlyDigits(r.cpf) !== cpfD) continue;
      if (normProto(r.protocolo) !== pNorm) continue;
      if (r.status !== "confirmado") continue;
      const id = String(r.id || "").trim();
      map.set(id || `c_${r.confirmadoEm}`, {
        enviadoEm: r.enviadoEm,
        confirmadoEm: r.confirmadoEm,
        validadoPorNome: String(r.confirmadoPorNome || "").trim() || "—",
        valor: Number(r.valorRegistadoProtocolo ?? r.valor ?? 0),
        arquivoUrl: String(r.arquivoBase64 || "").trim(),
        nomeArquivo: String(r.nomeArquivo || "").trim(),
        comprovanteId: id,
        invalidado: Boolean(r.pagamentoInvalidado),
      });
    }

    for (const lan of lancs || []) {
      if (!lan.confirmadoViaAppCliente) continue;
      const id = String(lan.origemComprovanteClienteId || "").trim();
      if (id && map.has(id)) continue;
      const ex = id ? loadComprovantes().find((x) => x.id === id) : null;
      const key = id || `l_${lan.data}`;
      map.set(key, {
        enviadoEm: lan.comprovanteClienteEnviadoEm || ex?.enviadoEm || "",
        confirmadoEm: lan.comprovanteClienteConfirmadoEm || ex?.confirmadoEm || "",
        validadoPorNome:
          String(lan.comprovanteValidadoPorNome || lan.registradoPorNome || ex?.confirmadoPorNome || "").trim() ||
          "—",
        valor: Number(lan.valor ?? ex?.valorRegistadoProtocolo ?? ex?.valor ?? 0),
        arquivoUrl: ex?.arquivoBase64 ? String(ex.arquivoBase64) : "",
        nomeArquivo: String(ex?.nomeArquivo || "").trim(),
        comprovanteId: id,
      });
    }

    return Array.from(map.values())
      .filter((x) => x.valor > 0)
      .sort((a, b) => {
        const ai = a.invalidado ? 1 : 0;
        const bi = b.invalidado ? 1 : 0;
        if (ai !== bi) return ai - bi;
        return Date.parse(b.confirmadoEm || 0) - Date.parse(a.confirmadoEm || 0);
      });
  }

  function buildValidadosHtml(validados, eh) {
    if (!validados.length) {
      return `<p class="meta portal-validados-vazio">${eh("Nenhum pagamento validado pelo app cliente neste protocolo.")}</p>`;
    }
    let html = `<p class="sum-title">${eh("Pagamentos validados (app cliente)")}</p>`;
    html += `<table class="validados-app"><thead><tr>
      <th>${eh("Envio pelo cliente")}</th>
      <th>${eh("Validação DK")}</th>
      <th>${eh("Funcionário DK")}</th>
      <th>${eh("Valor pago")}</th>
    </tr></thead><tbody>`;
    for (const v of validados) {
      const inv = Boolean(v.invalidado);
      const rowCls = inv
        ? ' class="validados-app-row--invalidado"'
        : ' class="validados-app-row--ativo"';
      const vf = currencyBRL(v.valor);
      let valorCell = eh(vf);
      const compId = String(v.comprovanteId || "").trim();
      const lnkCls = inv ? "lnk-comprovante lnk-comprovante--invalidado" : "lnk-comprovante";
      if (compId) {
        valorCell = `<button type="button" class="${lnkCls}" data-dk-comprovante-id="${eh(compId)}" title="${eh(v.nomeArquivo || "Comprovante")}">${eh(vf)} — ${eh("Ver comprovante")}</button>`;
      }
      html += `<tr${rowCls}>
        <td>${eh(formatIso(v.enviadoEm))}</td>
        <td>${eh(formatIso(v.confirmadoEm))}</td>
        <td>${eh(v.validadoPorNome)}</td>
        <td>${valorCell}</td>
      </tr>`;
    }
    html += "</tbody></table>";
    return html;
  }

  function buildRelatorio2Html(cpf, nome, locacoes) {
    const eh = escapeHtml;
    const fmtCpf =
      cpf.length === 11
        ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
        : cpf;
    const quando = new Date().toLocaleString("pt-BR");
    const title = "Relatório 2 — Por cliente";

    let body = "";
    if (!locacoes.length) {
      body = `<p class="meta">${eh("Nenhuma locação com protocolo encontrada para este CPF.")}</p>`;
    }

    for (const loc of locacoes) {
      const proto = String(loc.numeroContrato || "").trim() || "—";
      const placa = normPlate(loc.placa) || "—";
      const lancs = getLancamentosContrato(loc);
      const resumo = computeResumoProtocolo(loc);
      const validados = collectValidados(cpf, proto, lancs);

      body += `<h2>${eh(`Protocolo ${proto} · Placa ${placa}`)}</h2>`;
      body += `<p class="meta">${eh("Pagamentos")}</p>`;
      body += `<table><thead><tr><th>${eh("Protocolo")}</th><th>${eh("Data do pagamento")}</th><th>${eh("Valor")}</th><th>${eh("Registado por")}</th></tr></thead><tbody>`;
      if (!lancs.length) {
        body += `<tr><td colspan="4">${eh("Nenhum lançamento registado neste protocolo.")}</td></tr>`;
      } else {
        for (const lan of lancs) {
          body += `<tr><td>${eh(lan.protocoloLancamento || "—")}</td><td>${eh(lan.data)}</td><td>${eh(currencyBRL(lan.valor))}</td><td>${eh(lan.registradoPorNome || lan.registradoPorCpf || "—")}</td></tr>`;
        }
      }
      body += `</tbody></table>`;
      body += `<p class="sum-title">${eh("Resumo do protocolo")}</p>`;
      body += `<table class="resumo"><tbody>`;
      const rows3 = [
        [
          ["QUANTO CUSTA O DIA", resumo.custoDia],
          ["VALOR DO ALUGUEL", resumo.valorAluguel],
          ["VALOR INVESTIMENTO", resumo.valorInvestimento],
        ],
        [
          ["VALOR DO PLANO", resumo.valorPlano],
          ["VALOR DEVIDO DO PLANO", resumo.valorDevidoPlano],
          ["TOTAL PAGO", resumo.totalPago],
        ],
        [
          ["TIPO DE PLANO", resumo.tipoPlano],
          ["VALOR DEVIDO DO ALUGUEL", resumo.valorDevidoAluguel],
          ["INVESTIMENTO ACUMULADO", resumo.investimentoAcumulado],
        ],
      ];
      for (const row of rows3) {
        body += `<tr>`;
        for (const [lbl, val] of row) {
          const neg =
            lbl === "INVESTIMENTO ACUMULADO" && resumo.investimentoAcumuladoNeg ? ' class="neg"' : "";
          body += `<td><span class="lbl">${eh(lbl)}</span><br /><span class="val"${neg}>${eh(val)}</span></td>`;
        }
        body += `</tr>`;
      }
      body += `</tbody></table>`;
      body += buildValidadosHtml(validados, eh);
      body += `<hr />`;
    }

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${eh(title)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.1rem;margin:0 0 0.35rem}
      h2{font-size:1rem;margin:1rem 0 0.35rem}
      .meta{color:#444;margin:0.25rem 0;font-size:11px}
      .sum-title{font-weight:700;margin:0.65rem 0 0.35rem;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-bottom:0.5rem}
      th,td{border:1px solid #333;padding:6px 8px;text-align:left}
      th{background:#eee;font-weight:600}
      table.resumo td{width:33%;vertical-align:top}
      table.resumo .lbl{font-size:10px;color:#555;display:block;margin-bottom:3px}
      table.resumo .val{font-size:12px;font-weight:600}
      table.resumo .val.neg{color:#b71c1c}
      table.validados-app{margin-top:0.75rem}
      table.validados-app .lnk-comprovante{color:#1565c0;font-weight:600;text-decoration:underline;cursor:pointer;background:none;border:none;padding:0;font:inherit}
      .portal-validados-vazio{margin-top:0.75rem}
      hr{border:none;border-top:1px solid #ccc;margin:1rem 0}
    </style></head><body>
      <h1>${eh(title)}</h1>
      <p class="meta">${eh(`CPF: ${fmtCpf}`)}</p>
      <p class="meta">${eh(`Cliente: ${nome || "—"}`)}</p>
      <p class="meta">${eh(`Emitido em ${quando}`)}</p>
      ${body}
      <script>
      (function () {
        document.addEventListener("click", function (e) {
          var el = e.target.closest && e.target.closest(".lnk-comprovante[data-dk-comprovante-id]");
          if (!el) return;
          e.preventDefault();
          var id = el.getAttribute("data-dk-comprovante-id");
          if (!id) return;
          try {
            if (window.parent && window.parent !== window && window.parent.__DK_openComprovanteClienteViewerById) {
              window.parent.__DK_openComprovanteClienteViewerById(id);
              return;
            }
          } catch (err) { /* ignore */ }
          if (typeof window.__DK_openComprovanteClienteViewerById === "function") {
            window.__DK_openComprovanteClienteViewerById(id);
          }
        });
      })();
      </script>
    </body></html>`;
  }

  window.__DK_clienteBuildRelatorioPagamentosHtml = function buildForCliente(cpfDigits, nomeCliente) {
    const cpf = onlyDigits(cpfDigits).slice(0, 11);
    const locs = [];
    try {
      const raw = localStorage.getItem("dk_locacoes_cadastro");
      const all = raw ? JSON.parse(raw) : [];
      if (Array.isArray(all)) {
        all.forEach((loc) => {
          if (onlyDigits(loc.cpf) === cpf && normProto(loc.numeroContrato)) locs.push(loc);
        });
      }
    } catch {
      /* ignore */
    }
    locs.sort((a, b) => String(a.numeroContrato || "").localeCompare(String(b.numeroContrato || ""), "pt-BR"));
    return buildRelatorio2Html(cpf, nomeCliente, locs);
  };
})();
