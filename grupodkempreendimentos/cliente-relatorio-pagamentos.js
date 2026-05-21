/**
 * Relatório de pagamentos do cliente (mesmo conteúdo do Relatório 2 do portal).
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

  function parseBrDate(s) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(s);
    const raw = String(s || "").trim();
    if (!raw || !raw.includes("/")) return null;
    const [day, month, year] = raw.split("/").map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  }

  function currencyBRL(n) {
    if (typeof window.currencyBRL === "function") return window.currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

  function loadComprovantes() {
    try {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function getLancamentosFromLoc(loc) {
    const out = [];
    const push = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((x) => {
        if (!x || typeof x !== "object") return;
        const data = String(x.data || x.dataPagamento || "").trim();
        let valor = typeof x.valor === "number" ? x.valor : Number(x.valor || 0);
        if (!Number.isFinite(valor) || valor <= 0) return;
        out.push({
          data,
          valor,
          confirmadoViaAppCliente: Boolean(x.confirmadoViaAppCliente),
          origemComprovanteClienteId: String(x.origemComprovanteClienteId || "").trim(),
          registradoPorNome: String(x.registradoPorNome || x.comprovanteValidadoPorNome || "").trim(),
          comprovanteClienteEnviadoEm: x.comprovanteClienteEnviadoEm,
          comprovanteClienteConfirmadoEm: x.comprovanteClienteConfirmadoEm,
          comprovanteValidadoPorNome: x.comprovanteValidadoPorNome,
        });
      });
    };
    push(loc.portalLancamentosAluguel);
    push(loc.lancamentosAluguel);
    push(loc.lancamentos);
    return out;
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
      });
    }

    return Array.from(map.values())
      .filter((x) => x.valor > 0)
      .sort((a, b) => Date.parse(b.confirmadoEm || 0) - Date.parse(a.confirmadoEm || 0));
  }

  function buildRelatorioHtml(cpf, nome, locacoes) {
    const eh = escapeHtml;
    const fmtCpf =
      cpf.length === 11
        ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
        : cpf;
    const quando = new Date().toLocaleString("pt-BR");
    const resumoFn =
      typeof window.__DK_clienteComputeResumoContrato === "function"
        ? window.__DK_clienteComputeResumoContrato
        : null;

    let body = "";
    for (const loc of locacoes) {
      const proto = String(loc.numeroContrato || "").trim() || "—";
      const placa = String(loc.placa || "").trim() || "—";
      const lancs = getLancamentosFromLoc(loc).sort((a, b) => {
        const ta = parseBrDate(a.data)?.getTime() || 0;
        const tb = parseBrDate(b.data)?.getTime() || 0;
        return ta - tb;
      });
      const resumo = resumoFn ? resumoFn(loc) : null;
      const validados = collectValidados(cpf, proto, lancs);

      body += `<h2>Protocolo ${eh(proto)} · Placa ${eh(placa)}</h2>`;
      body += `<p class="meta">Pagamentos</p><table><thead><tr><th>Data</th><th>Valor</th></tr></thead><tbody>`;
      if (!lancs.length) {
        body += `<tr><td colspan="2">Nenhum lançamento.</td></tr>`;
      } else {
        for (const lan of lancs) {
          body += `<tr><td>${eh(lan.data)}</td><td>${eh(currencyBRL(lan.valor))}</td></tr>`;
        }
      }
      body += `</tbody></table>`;

      if (resumo) {
        body += `<p class="sum-title">Resumo do protocolo</p><table class="resumo"><tbody>`;
        const rows = [
          ["Data de início", resumo.inicio],
          ["Placa", resumo.placa],
          ["Valor devido (estimado)", resumo.valorDevidoTexto],
          ["Total pago", resumo.totalPago],
          ["Tempo de locação", resumo.tempoLocacaoTexto],
          ["Gasto com manutenção", resumo.gastoManutencao],
          ["Multas registradas", resumo.multasRegistradas],
        ];
        for (const [lbl, val] of rows) {
          body += `<tr><td class="lbl">${eh(lbl)}</td><td>${eh(val)}</td></tr>`;
        }
        body += `</tbody></table>`;
      }

      body += `<p class="sum-title">Pagamentos validados (app cliente)</p>`;
      body += `<table class="validados"><thead><tr>
        <th>Envio pelo cliente</th><th>Validação DK</th><th>Funcionário DK</th><th>Valor pago</th>
      </tr></thead><tbody>`;
      if (!validados.length) {
        body += `<tr><td colspan="4">Nenhum pagamento validado neste protocolo.</td></tr>`;
      } else {
        for (const v of validados) {
          const vf = currencyBRL(v.valor);
          let valorCell = eh(vf);
          if (v.arquivoUrl) {
            valorCell = `<a href="${v.arquivoUrl.replace(/"/g, "&quot;")}" target="_blank" rel="noopener">${eh(vf)} — Ver comprovante</a>`;
          }
          body += `<tr>
            <td>${eh(formatIso(v.enviadoEm))}</td>
            <td>${eh(formatIso(v.confirmadoEm))}</td>
            <td>${eh(v.validadoPorNome)}</td>
            <td>${valorCell}</td>
          </tr>`;
        }
      }
      body += `</tbody></table><hr />`;
    }

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de pagamentos</title>
<style>
body{font-family:system-ui,sans-serif;margin:1rem;font-size:12px;color:#111}
h1{font-size:1.1rem} h2{font-size:1rem;margin-top:1rem}
.meta{color:#555;font-size:11px}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{border:1px solid #333;padding:6px;text-align:left}
th{background:#eee}
.sum-title{font-weight:700;margin-top:10px}
a{color:#1565c0}
hr{border:none;border-top:1px solid #ccc;margin:1rem 0}
</style></head><body>
<h1>Relatório de pagamentos — DK Locadora</h1>
<p class="meta">CPF: ${eh(fmtCpf)} · Cliente: ${eh(nome || "—")}</p>
<p class="meta">Emitido em ${eh(quando)}</p>
${body || "<p>Sem contratos.</p>"}
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
          if (onlyDigits(loc.cpf) === cpf) locs.push(loc);
        });
      }
    } catch {
      /* ignore */
    }
    locs.sort((a, b) => String(a.numeroContrato || "").localeCompare(String(b.numeroContrato || ""), "pt-BR"));
    return buildRelatorioHtml(cpf, nomeCliente, locs);
  };
})();
