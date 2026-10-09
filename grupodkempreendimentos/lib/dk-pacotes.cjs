/**
 * Pacotes DK — opção 3: fichas (estado) + movimento do dia + ficheiro à parte.
 * O histórico dos outros dias não entra no pacote e não é apagado na fusão.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.__DK_pacotes = api;
})(typeof window !== "undefined" ? window : globalThis, function dkPacotesFactory() {
  const DIA_KEYS = [
    "dk_lancamentos_aluguel",
    "dk_comprovantes_banco",
    "dk_comprovantes_cliente_pendentes",
    "dk_financeiro_extratos_v1",
    "dk_financeiro_despesas_v1",
    "dk_financeiro_ceo_despesas_v1",
    "dk_manutencoes_rapidas_v1",
    "dk_manutencoes_cadastro",
    "dk_portal_checklist_historico_v1",
    "dk_portal_checklist_movimentacoes_v1",
    "dk_portal_setor_movimentacoes_v1",
    "dk_audit_log",
    "dk_pagamentos_auditoria_v1",
    "dk_cliente_notificacoes",
    "dk_comunicacao_operacao_v1",
  ];
  const FICHA_KEYS = [
    "dk_clientes_cadastro",
    "dk_portal_clientes_cadastro",
    "dk_veiculos_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
    "dk_locacoes_cadastro",
    "dk_locacoes_quadro_geral",
    "dk_funcionarios_access",
    "dk_clientes_validacao_pendente",
  ];
  const FICHEIRO_CHAVES = ["dk_cliente_docs_v1", "dk_locacao_documentos_v1", "dk_documentos_deposito_v1"];

  function hojeYmd(data) {
    const d = data instanceof Date ? data : new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function ymdDeTexto(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) return `${br[3]}-${String(br[2]).padStart(2, "0")}-${String(br[1]).padStart(2, "0")}`;
    const n = Number(s);
    if (Number.isFinite(n) && n > 1e11) return hojeYmd(new Date(n));
    const parsed = Date.parse(s);
    if (Number.isFinite(parsed) && /T|\d{4}-\d{2}-\d{2}/.test(s)) return hojeYmd(new Date(parsed));
    return "";
  }

  function ymdDoRegisto(rec) {
    if (!rec || typeof rec !== "object") return "";
    const campos = [
      "data",
      "dataPagamento",
      "dataPagamentoBr",
      "dataLancamento",
      "dataDespesa",
      "dataMovimento",
      "dataCadastro",
      "enviadoEm",
      "criadoEm",
      "createdAt",
      "updatedAt",
      "timestamp",
      "em",
    ];
    for (const c of campos) {
      const ymd = ymdDeTexto(rec[c]);
      if (ymd) return ymd;
    }
    return "";
  }

  function ymdToqueFicha(rec) {
    if (!rec || typeof rec !== "object") return "";
    return ymdDeTexto(rec.updatedAt) || ymdDeTexto(rec.createdAt) || ymdDeTexto(rec.dataCadastro) || "";
  }

  function idRegisto(rec) {
    if (!rec || typeof rec !== "object") return "";
    const id = String(rec.id || rec.protocoloLancamento || rec.codigo || "").trim();
    return id;
  }

  function ehBinario(valor) {
    const s = String(valor || "");
    return s.startsWith("data:") || s.length > 400;
  }

  function semBinario(rec) {
    if (!rec || typeof rec !== "object") return rec;
    const out = Array.isArray(rec) ? rec.map(semBinario) : { ...rec };
    if (Array.isArray(rec)) return out;
    for (const k of ["arquivoBase64", "imagem", "imagemRecortada", "imagemOriginal"]) {
      if (ehBinario(out[k])) out[k] = "";
    }
    if (ehBinario(out.data)) out.data = "";
    return out;
  }

  function manterBinario(prev, next) {
    if (!next || typeof next !== "object") return next;
    if (!prev || typeof prev !== "object") return next;
    const out = { ...next };
    for (const k of ["arquivoBase64", "imagem", "imagemRecortada", "imagemOriginal", "data"]) {
      if (!ehBinario(out[k]) && ehBinario(prev[k])) out[k] = prev[k];
    }
    return out;
  }

  function idFicha(chave, rec) {
    const dig = (v) => String(v ?? "").replace(/\D/g, "");
    if (chave.indexOf("cliente") >= 0) return dig(rec && rec.cpf).slice(0, 11);
    if (chave.indexOf("veiculo") >= 0 || chave.indexOf("frota") >= 0) {
      return String((rec && rec.placa) || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    }
    if (chave.indexOf("locac") >= 0) return dig(rec && (rec.numeroContrato || rec.protocolo));
    return idRegisto(rec);
  }

  function fundirListaDia(existing, incoming, dia) {
    const ficar = [];
    const porId = new Map();
    const semId = [];
    (Array.isArray(existing) ? existing : []).forEach((r) => {
      if (!r || typeof r !== "object") return;
      if (ymdDoRegisto(r) !== dia) {
        ficar.push(r);
        return;
      }
      const id = idRegisto(r);
      if (id) porId.set(id, r);
      else semId.push(r);
    });
    (Array.isArray(incoming) ? incoming : []).forEach((r) => {
      if (!r || typeof r !== "object") return;
      const d = ymdDoRegisto(r);
      if (d && d !== dia) return;
      const id = idRegisto(r);
      if (!id) {
        semId.push(r);
        return;
      }
      const prev = porId.get(id);
      porId.set(id, prev ? manterBinario(prev, r) : r);
    });
    return [...ficar, ...porId.values(), ...semId];
  }

  function fundirListaFicha(chave, existing, incoming) {
    const by = new Map();
    const semId = [];
    (Array.isArray(existing) ? existing : []).forEach((r) => {
      if (!r || typeof r !== "object") return;
      const id = idFicha(chave, r);
      if (!id) semId.push(r);
      else by.set(id, r);
    });
    (Array.isArray(incoming) ? incoming : []).forEach((r) => {
      if (!r || typeof r !== "object") return;
      const id = idFicha(chave, r);
      if (!id) {
        semId.push(r);
        return;
      }
      const prev = by.get(id);
      by.set(id, prev ? manterBinario(prev, { ...prev, ...r }) : r);
    });
    return [...by.values(), ...semId];
  }

  function extrairPacoteDia(payload, dia) {
    const ymd = ymdDeTexto(dia) || String(dia || "");
    const out = {};
    const ficheiros = [];
    if (!payload || typeof payload !== "object" || !ymd) return { payload: out, ficheiros, dia: ymd };
    DIA_KEYS.forEach((chave) => {
      const arr = payload[chave];
      if (!Array.isArray(arr)) return;
      const doDia = [];
      arr.forEach((rec) => {
        if (ymdDoRegisto(rec) !== ymd) return;
        if (ehBinario(rec && (rec.arquivoBase64 || rec.data || rec.imagem))) {
          ficheiros.push({ chave, registro: rec });
        }
        doDia.push(semBinario(rec));
      });
      out[chave] = doDia;
    });
    FICHA_KEYS.forEach((chave) => {
      const arr = payload[chave];
      if (!Array.isArray(arr)) return;
      const doDia = arr.filter((rec) => ymdToqueFicha(rec) === ymd).map(semBinario);
      if (doDia.length) out[chave] = doDia;
    });
    return { payload: out, ficheiros, dia: ymd };
  }

  function fundirPacoteDia(existing, dia, pacote) {
    const ymd = ymdDeTexto(dia) || String(dia || "");
    const base = existing && typeof existing === "object" ? existing : {};
    const out = { ...base };
    const parte = pacote && typeof pacote === "object" ? pacote : {};
    if (!ymd) return out;
    Object.keys(parte).forEach((chave) => {
      if (DIA_KEYS.indexOf(chave) >= 0 && Array.isArray(parte[chave])) {
        out[chave] = fundirListaDia(base[chave], parte[chave], ymd);
        return;
      }
      if (FICHA_KEYS.indexOf(chave) >= 0 && Array.isArray(parte[chave])) {
        out[chave] = fundirListaFicha(chave, base[chave], parte[chave]);
      }
    });
    return out;
  }

  function fundirFicheiro(existing, chave, registro) {
    const base = existing && typeof existing === "object" ? { ...existing } : {};
    if (!registro || typeof registro !== "object") return base;
    if (chave === "dk_cliente_docs_v1") {
      const cpf = String(registro.cpf || "").replace(/\D/g, "").slice(0, 11);
      const tipo = String(registro.tipo || "");
      if (cpf.length !== 11 || !tipo) return base;
      const map = base.dk_cliente_docs_v1 && typeof base.dk_cliente_docs_v1 === "object" ? { ...base.dk_cliente_docs_v1 } : {};
      const row = map[cpf] && typeof map[cpf] === "object" ? { ...map[cpf] } : {};
      row[tipo] = manterBinario(row[tipo], registro);
      map[cpf] = row;
      base.dk_cliente_docs_v1 = map;
      return base;
    }
    if (FICHEIRO_CHAVES.indexOf(chave) < 0) return base;
    const lista = Array.isArray(base[chave]) ? base[chave].slice() : [];
    const id = idRegisto(registro);
    if (!id) return base;
    const idx = lista.findIndex((r) => idRegisto(r) === id);
    if (idx === -1) lista.push(registro);
    else lista[idx] = manterBinario(lista[idx], { ...lista[idx], ...registro });
    base[chave] = lista;
    return base;
  }

  function digitosCliente(v) {
    return String(v ?? "").replace(/\D/g, "");
  }

  function textoCliente(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  }

  function codigoCliente4(v) {
    const d = digitosCliente(v);
    return d ? d.padStart(4, "0").slice(-4) : "";
  }

  /** Campos do cadastro, sem hora de gravação. Dois lados iguais devolvem a mesma frase. */
  function assinaturaCliente(c) {
    if (!c || typeof c !== "object") return "";
    const cpf = digitosCliente(c.cpf).slice(0, 11);
    if (cpf.length !== 11) return "";
    return [
      codigoCliente4(c.codigo),
      cpf,
      textoCliente(c.nome),
      digitosCliente(c.celular),
      textoCliente(c.recado1),
      textoCliente(c.recado2),
      textoCliente(c.cnh),
      textoCliente(c.categoria),
      textoCliente(c.vencimento),
      textoCliente(c.ear),
      digitosCliente(c.cep),
      textoCliente(c.municipioUf),
      textoCliente(c.endereco),
      textoCliente(c.dataCadastro),
      textoCliente(c.status || "ATIVO"),
    ].join("\u001f");
  }

  function mapaAssinaturaClientes(lista) {
    const map = new Map();
    (Array.isArray(lista) ? lista : []).forEach((c) => {
      const sig = assinaturaCliente(c);
      if (!sig) return;
      map.set(digitosCliente(c.cpf).slice(0, 11), sig);
    });
    return map;
  }

  function listasClientesIguais(a, b) {
    const ma = mapaAssinaturaClientes(a);
    const mb = mapaAssinaturaClientes(b);
    if (ma.size !== mb.size) return false;
    for (const [cpf, sig] of ma) {
      if (mb.get(cpf) !== sig) return false;
    }
    return true;
  }

  /**
   * Grava a lista de clientes. Se a nuvem responder que a revisão está vazia
   * ou velha, repete com a revisão que ela devolveu.
   */
  async function postarClientesComRevisao(post, lista, revisaoInicial) {
    let revisao = String(revisaoInicial || "");
    let ultimo = null;
    for (let i = 0; i < 3; i += 1) {
      ultimo = await post({ data: lista, base_revision: revisao });
      const nova = String((ultimo && (ultimo.revision || ultimo.updated_at)) || "");
      if (ultimo && ultimo.status === 409 && ultimo.reason === "revisao_conflito" && nova && i < 2) {
        revisao = nova;
        continue;
      }
      return ultimo;
    }
    return ultimo;
  }

  function lerFicheiro(payload, chave, id) {
    if (!payload || !chave || !id) return null;
    if (chave === "dk_cliente_docs_v1") {
      const [cpf, tipo] = String(id).split(":");
      const row = payload.dk_cliente_docs_v1 && payload.dk_cliente_docs_v1[cpf];
      return row && row[tipo] ? row[tipo] : null;
    }
    const lista = payload[chave];
    if (!Array.isArray(lista)) return null;
    return lista.find((r) => idRegisto(r) === String(id)) || null;
  }

  return {
    DIA_KEYS,
    FICHA_KEYS,
    FICHEIRO_CHAVES,
    hojeYmd,
    ymdDoRegisto,
    extrairPacoteDia,
    fundirPacoteDia,
    fundirFicheiro,
    lerFicheiro,
    listasClientesIguais,
    postarClientesComRevisao,
  };
});
