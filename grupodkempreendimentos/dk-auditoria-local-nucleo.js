/**
 * Núcleo puro da auditoria local. Não lê nem grava armazenamento.
 * Não chama rede. A página só entrega os bytes já lidos e recebe o pacote sanitizado.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DK_AUDITORIA_NUCLEO = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CHAVES_SNAPSHOT = {
    dk_clientes_cadastro: 1,
    dk_clientes_validacao_pendente: 1,
    dk_veiculos_cadastro: 1,
    dk_portal_clientes_cadastro: 1,
    dk_portal_veiculos_cadastro: 1,
    dk_veiculos_frota_planilha: 1,
    dk_locacoes_cadastro: 1,
    dk_locacoes_quadro_geral: 1,
    dk_manutencoes_cadastro: 1,
    dk_manutencoes_rapidas_v1: 1,
    dk_manutencao_rapida_sugestao_oleo_v1: 1,
    dk_portal_checklist_historico_v1: 1,
    dk_portal_checklist_movimentacoes_v1: 1,
    dk_portal_setor_movimentacoes_v1: 1,
    dk_cliente_docs_v1: 1,
    dk_lancamentos_aluguel: 1,
    dk_quadro_receita_overrides: 1,
    dk_comprovantes_banco: 1,
    dk_comprovantes_cliente_pendentes: 1,
    dk_cliente_notificacoes: 1,
    dk_financeiro_extratos_v1: 1,
    dk_financeiro_despesas_v1: 1,
    dk_financeiro_ceo_despesas_v1: 1,
    dk_financeiro_ceo_fontes_v1: 1,
    dk_financeiro_ceo_cartoes_v1: 1,
    dk_financeiro_ceo_situacao_pag_v1: 1,
    dk_unidade_financeiro_v1: 1,
    dk_documentos_deposito_v1: 1,
    dk_audit_log: 1,
    dk_funcionarios_access: 1,
    dk_locacao_documentos_v1: 1,
    dk_pagamentos_auditoria_v1: 1,
    dk_comunicacao_operacao_v1: 1,
    dk_protocolo_nc_remap_v1: 1
  };

  var BANCOS_CONHECIDOS = {
    dk_documentos_blobs_v1: 1,
    dk_operacao_offline_v1: 1,
    dk_portal_checklist_fotos: 1,
    dk_patrimonio_fila_v1: 1,
    dk_comprovantes_arquivos_v1: 1
  };

  var CAMPO_SECRETO = /senha|password|passwd|access[_.-]?token|refresh[_.-]?token|id[_.-]?token|jwt|authorization|api[_.-]?key|secret|service[_.-]?role|private[_.-]?key|vapid|cookie|supabase|connectionstring|bearer/i;

  function enc(text) {
    return new TextEncoder().encode(String(text == null ? "" : text));
  }

  function sha256Hex(data) {
    var buf = data instanceof Uint8Array ? data : enc(data);
    var copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return crypto.subtle.digest("SHA-256", copy).then(function (digest) {
      return Array.from(new Uint8Array(digest)).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function crc32(bytes) {
    if (!crc32.table) {
      var table = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
      crc32.table = table;
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = crc32.table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(n) {
    var b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }
  function u32(n) {
    var b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0, true);
    return b;
  }

  function zipStore(entries) {
    var parts = [];
    var central = [];
    var offset = 0;
    entries.forEach(function (entry) {
      var name = enc(entry.name);
      var data = entry.data;
      var crc = crc32(data);
      var local = [
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
        name, data
      ];
      parts.push.apply(parts, local);
      central.push(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), name
      );
      offset += 30 + name.length + data.length;
    });
    var centralBytes = 0;
    central.forEach(function (piece) {
      parts.push(piece);
      centralBytes += piece.length;
    });
    parts.push(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes), u32(offset), u16(0));
    return new Blob(parts, { type: "application/zip" });
  }

  function safeName(nome) {
    return String(nome || "sem-nome").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  }

  function tipoCredencialDoNome(nome) {
    var n = String(nome || "");
    if (/refresh/i.test(n)) return "refresh_token";
    if (/access[_.-]?token|api[_.-]?token/i.test(n)) return "access_token";
    if (/jwt/i.test(n)) return "jwt";
    if (/senha|password|passwd/i.test(n)) return "senha";
    if (/authorization|bearer/i.test(n)) return "authorization";
    if (/cookie/i.test(n)) return "cookie";
    if (/service[_.-]?role|supabase|anon/i.test(n)) return "chave_supabase";
    if (/vapid|private[_.-]?key/i.test(n)) return "chave_privada";
    if (/secret|api[_.-]?key|token/i.test(n)) return "credencial";
    return "credencial";
  }

  function tipoCredencialDoValor(texto) {
    var t = String(texto || "").trim();
    if (/^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/.test(t)) return "jwt";
    if (/^Bearer\s+\S{8,}/i.test(t)) return "authorization";
    if (/sb_secret_|sbp_[A-Za-z0-9]|SUPABASE_SERVICE_ROLE|BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/i.test(t)) return "chave_privada";
    return "";
  }

  function nomeDeCredencial(nome) {
    return CAMPO_SECRETO.test(String(nome || ""));
  }

  function ficha(localizacao, tipo) {
    return {
      credencial_detectada: true,
      localizacao: localizacao,
      tipo: tipo || "credencial",
      valor: "[REDACTED]",
      rotacao_recomendada: true
    };
  }

  function classificarPorEstrutura(valor) {
    var data;
    try { data = typeof valor === "string" ? JSON.parse(valor) : valor; } catch (e) { return ""; }
    var sinalForte = false;
    var sinalFraco = false;
    function walk(v, depth) {
      if (v == null || depth > 4 || sinalForte) return;
      if (Array.isArray(v)) {
        v.forEach(function (item) { walk(item, depth + 1); });
        return;
      }
      if (typeof v !== "object") return;
      var keys = Object.keys(v);
      var temCpf = keys.indexOf("cpf") >= 0;
      var temNome = keys.indexOf("nome") >= 0;
      var temContrato = keys.indexOf("numeroContrato") >= 0 || keys.indexOf("protocolo") >= 0;
      var temPlaca = keys.indexOf("placa") >= 0;
      var temLanc = keys.indexOf("portalLancamentosAluguel") >= 0;
      var temEstoque = keys.indexOf("entradas") >= 0 || keys.indexOf("saidas") >= 0 || keys.indexOf("saldo") >= 0;
      var temDeposito = keys.indexOf("crlv") >= 0 || keys.indexOf("contrato") >= 0;
      var temPendente = keys.indexOf("pendente") >= 0 && temContrato;
      if ((temCpf && (temNome || temContrato || temPlaca)) || temLanc || temEstoque || temDeposito || temPendente) sinalForte = true;
      else if (temCpf || temPlaca || temContrato) sinalFraco = true;
      keys.forEach(function (k) { walk(v[k], depth + 1); });
    }
    walk(data, 0);
    if (sinalForte) return "relacionada";
    if (sinalFraco) return "possivelmente relacionada";
    return "";
  }

  function classificarChave(nome, valor) {
    var n = String(nome || "");
    if (CHAVES_SNAPSHOT[n] || BANCOS_CONHECIDOS[n] || /dk/i.test(n)) return "relacionada";
    var estrutura = classificarPorEstrutura(valor);
    if (estrutura) return estrutura;
    if (/cliente|locacao|veiculo|estoque|protocolo|placa|financeiro|manutencao|checklist|comprovante|patrimonio|offline|snapshot/i.test(n)) {
      return "possivelmente relacionada";
    }
    return "nao relacionada";
  }

  function sanitizarTexto(nome, texto, localizacao) {
    var original = texto == null ? "" : String(texto);
    var credenciais = [];
    var segredos = [];
    function guardar(valor, tipo, onde) {
      var s = String(valor == null ? "" : valor);
      if (s && s !== "[REDACTED]") segredos.push(s);
      credenciais.push(ficha(onde, tipo));
    }
    function varrerPadroes(serial) {
      var reJwt = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
      if (serial.match(reJwt)) {
        credenciais.push(ficha(localizacao, "jwt"));
        serial = serial.replace(reJwt, "[REDACTED]");
      }
      return serial;
    }
    if (nomeDeCredencial(nome) || tipoCredencialDoValor(original)) {
      guardar(original, tipoCredencialDoValor(original) || tipoCredencialDoNome(nome), localizacao);
      return { texto: varrerPadroes(JSON.stringify(ficha(localizacao, tipoCredencialDoValor(original) || tipoCredencialDoNome(nome)))), credenciais: credenciais, redacaoTotal: true };
    }
    var data;
    try { data = JSON.parse(original); } catch (e) { data = null; }
    if (data == null || typeof data !== "object") {
      return { texto: varrerPadroes(original), credenciais: credenciais, redacaoTotal: false };
    }
    function walk(v, caminho) {
      if (Array.isArray(v)) return v.map(function (item, i) { return walk(item, caminho + "[" + i + "]"); });
      if (!v || typeof v !== "object") {
        var tipoValor = tipoCredencialDoValor(v);
        if (tipoValor) {
          guardar(v, tipoValor, caminho);
          return "[REDACTED]";
        }
        return v;
      }
      var out = {};
      Object.keys(v).forEach(function (k) {
        var onde = caminho + "." + k;
        if (nomeDeCredencial(k)) {
          guardar(typeof v[k] === "string" ? v[k] : JSON.stringify(v[k]), tipoCredencialDoNome(k), onde);
          out[k] = "[REDACTED]";
        } else {
          out[k] = walk(v[k], onde);
        }
      });
      return out;
    }
    var limpo = walk(data, localizacao);
    var serial = JSON.stringify(limpo);
    segredos.forEach(function (s) {
      if (s.length >= 6 && serial.indexOf(s) >= 0) serial = serial.split(s).join("[REDACTED]");
    });
    return { texto: varrerPadroes(serial), credenciais: credenciais, redacaoTotal: false };
  }

  function varrerBytes(bytes, segredos) {
    if (!bytes || !segredos.length) return false;
    var texto = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return segredos.some(function (s) { return s.length >= 6 && texto.indexOf(s) >= 0; });
  }

  function resumirJson(texto) {
    var ids = [];
    var datas = [];
    var vistos = {};
    var data;
    try { data = JSON.parse(texto); } catch (e) {
      return { tipo: "texto", quantidade: texto ? 1 : 0, ids: [], dataMaisAntiga: null, dataMaisRecente: null, quantidadeDatas: 0 };
    }
    function pushId(v) {
      var s = String(v == null ? "" : v).trim();
      if (!s || s === "[REDACTED]" || s.length > 80 || ids.length > 4000 || vistos[s]) return;
      vistos[s] = true;
      ids.push(s);
    }
    function walk(v, depth) {
      if (v == null || depth > 5) return;
      if (Array.isArray(v)) { v.forEach(function (item) { walk(item, depth + 1); }); return; }
      if (typeof v !== "object") return;
      Object.keys(v).forEach(function (k) {
        var val = v[k];
        if (/^(id|key|chave|numeroContrato|protocolo|cpf|placa|codigo|codigoCliente)$/i.test(k) && (typeof val === "string" || typeof val === "number")) pushId(val);
        if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val) && val !== "[REDACTED]") datas.push(val);
        else walk(val, depth + 1);
      });
    }
    var tipo = "object";
    var qtd = 1;
    if (Array.isArray(data)) { tipo = "array"; qtd = data.length; }
    else if (data && typeof data === "object") {
      var arrKey = ["itens", "entradas", "saidas", "crlv", "contrato", "multa", "documentos", "fila", "pendentes"].find(function (k) { return Array.isArray(data[k]); });
      qtd = arrKey ? data[arrKey].length : Object.keys(data).length;
      if (arrKey) tipo = "object." + arrKey;
    }
    walk(data, 0);
    datas.sort();
    return { tipo: tipo, quantidade: qtd, ids: ids, dataMaisAntiga: datas[0] || null, dataMaisRecente: datas.length ? datas[datas.length - 1] : null, quantidadeDatas: datas.length };
  }

  function classificarCache(url, contentType) {
    var u = String(url || "");
    if (/dk-auditoria-local/i.test(u)) return "pagina-de-auditoria";
    var ct = String(contentType || "");
    if (/\/api\//i.test(u)) return "possivel-dado-de-negocio";
    if (/json/i.test(ct) && /dk|snapshot|cadastro/i.test(u)) return "possivel-dado-de-negocio";
    return "codigo-ou-asset";
  }

  async function montarPacote(coleta) {
    var arquivos = [];
    var credenciais = [];
    var chavesLs = [];
    var lsBytesExportados = 0;
    for (var i = 0; i < (coleta.localStorage || []).length; i++) {
      var item = coleta.localStorage[i];
      var nome = String(item.nome);
      var valor = item.valor == null ? "" : String(item.valor);
      var classe = classificarChave(nome, valor);
      var base = {
        nome: nome,
        bytes: enc(valor).length,
        classificacao: classe,
        noSnapshotOficial: Boolean(CHAVES_SNAPSHOT[nome])
      };
      var limpo = sanitizarTexto(nome, valor, "localStorage/" + nome);
      credenciais = credenciais.concat(limpo.credenciais);
      if (limpo.redacaoTotal) {
        chavesLs.push(Object.assign(base, { tipo: "credencial", quantidade: 0, credencial_detectada: true, arquivo: null }));
        continue;
      }
      if (classe === "nao relacionada") {
        chavesLs.push(base);
        continue;
      }
      var bytes = enc(limpo.texto);
      var hash = await sha256Hex(bytes);
      var caminho = "bruto/localStorage/" + safeName(nome) + ".txt";
      arquivos.push({ name: caminho, data: bytes });
      var resumo = resumirJson(limpo.texto);
      lsBytesExportados += bytes.length;
      chavesLs.push(Object.assign(base, {
        tipo: resumo.tipo,
        quantidade: resumo.quantidade,
        ids: resumo.ids,
        dataMaisAntiga: resumo.dataMaisAntiga,
        dataMaisRecente: resumo.dataMaisRecente,
        quantidadeDatas: resumo.quantidadeDatas,
        sha256: hash,
        exclusivaDesteArmazenamento: !CHAVES_SNAPSHOT[nome],
        arquivo: caminho,
        credencial_detectada: limpo.credenciais.length > 0
      }));
    }
    var porHash = {};
    chavesLs.forEach(function (c) {
      if (!c.sha256) return;
      if (!porHash[c.sha256]) porHash[c.sha256] = [];
      porHash[c.sha256].push(c.nome);
    });
    chavesLs.forEach(function (c) {
      var grupo = porHash[c.sha256] || [];
      c.duplicada = grupo.length > 1;
      c.duplicadaDe = c.duplicada ? grupo.filter(function (n) { return n !== c.nome; }) : [];
    });

    var bancos = [];
    var idb = coleta.indexedDB || { listagemDisponivel: true, bancos: [] };
    for (var b = 0; b < (idb.bancos || []).length; b++) {
      var banco = idb.bancos[b];
      if (banco.erro) {
        bancos.push({ banco: banco.banco, erro: banco.erro, classificacao: classificarChave(banco.banco, "") });
        continue;
      }
      var storesOut = [];
      var classeBanco = classificarChave(banco.banco, "");
      for (var s = 0; s < (banco.stores || []).length; s++) {
        var store = banco.stores[s];
        if (store.erro) {
          storesOut.push({ store: store.store, erro: store.erro });
          continue;
        }
        var regs = store.registros || [];
        if (classeBanco !== "relacionada") {
          var amostra = JSON.stringify(regs.slice(0, 3));
          var classeReg = classificarPorEstrutura(amostra);
          if (classeReg === "relacionada") classeBanco = "relacionada";
          else if (classeBanco === "nao relacionada" && classeReg) classeBanco = classeReg;
        }
        storesOut.push({ store: store.store, quantidade: regs.length, registros: regs });
      }
      var exportar = classeBanco !== "nao relacionada";
      var storesManifesto = [];
      for (var s2 = 0; s2 < storesOut.length; s2++) {
        var st = storesOut[s2];
        if (st.erro) { storesManifesto.push(st); continue; }
        if (!exportar) {
          storesManifesto.push({ store: st.store, quantidade: st.quantidade, conteudoExportado: false });
          continue;
        }
        var itens = [];
        var bytesStore = 0;
        for (var r = 0; r < st.registros.length; r++) {
          var reg = st.registros[r];
          var blobs = [];
          var plano = {};
          Object.keys(reg || {}).forEach(function (k) {
            if (reg[k] && reg[k].__blob && reg[k].bytes) blobs.push({ campo: k, mime: reg[k].mime || "", bytes: reg[k].bytes });
            else plano[k] = reg[k];
          });
          var serialIn = JSON.stringify(plano);
          var san = sanitizarTexto("registro", serialIn, "indexedDB/" + banco.banco + "/" + st.store + "/" + (r + 1));
          credenciais = credenciais.concat(san.credenciais);
          var jsonBytes = enc(san.texto);
          var jsonPath = "bruto/indexeddb/" + safeName(banco.banco) + "/" + safeName(st.store) + "/" + (r + 1) + ".json";
          arquivos.push({ name: jsonPath, data: jsonBytes });
          bytesStore += jsonBytes.length;
          var bins = [];
          for (var bl = 0; bl < blobs.length; bl++) {
            var textoBlob = new TextDecoder("utf-8", { fatal: false }).decode(blobs[bl].bytes);
            var sanBlob = sanitizarTexto(blobs[bl].campo, textoBlob, "indexedDB/" + banco.banco + "/" + blobs[bl].campo);
            if (sanBlob.credenciais.length || sanBlob.texto.indexOf("[REDACTED]") >= 0 && textoBlob !== sanBlob.texto) {
              credenciais = credenciais.concat(sanBlob.credenciais);
              bins.push({ campo: blobs[bl].campo, credencial_detectada: true, valor: "[REDACTED]" });
            } else {
              var binPath = "bruto/indexeddb/" + safeName(banco.banco) + "/" + safeName(st.store) + "/" + (r + 1) + "-" + safeName(blobs[bl].campo) + ".bin";
              arquivos.push({ name: binPath, data: blobs[bl].bytes });
              bytesStore += blobs[bl].bytes.length;
              bins.push({ campo: blobs[bl].campo, arquivo: binPath, bytes: blobs[bl].bytes.length, mime: blobs[bl].mime, sha256: await sha256Hex(blobs[bl].bytes) });
            }
          }
          var resumoReg = resumirJson(san.texto);
          itens.push({ indice: r + 1, arquivo: jsonPath, bytes: jsonBytes.length, sha256: await sha256Hex(jsonBytes), ids: resumoReg.ids.slice(0, 20), dataMaisAntiga: resumoReg.dataMaisAntiga, dataMaisRecente: resumoReg.dataMaisRecente, binarios: bins });
        }
        storesManifesto.push({ store: st.store, quantidade: st.quantidade, bytes: bytesStore, registros: itens });
      }
      bancos.push({ banco: banco.banco, versao: banco.versao, classificacao: classeBanco, objectStores: storesManifesto });
    }

    var opfsItens = [];
    var opfs = coleta.opfs || { disponivel: false, itens: [] };
    for (var f = 0; f < (opfs.itens || []).length; f++) {
      var arq = opfs.itens[f];
      if (arq.tipo === "diretorio" || arq.erro || !arq.bytes) {
        opfsItens.push({ caminho: arq.caminho, tipo: arq.tipo || "arquivo", erro: arq.erro || null, classificacao: classificarChave(arq.caminho || "", "") });
        continue;
      }
      var comoTexto = new TextDecoder("utf-8", { fatal: false }).decode(arq.bytes);
      var classeArq = classificarChave(arq.caminho || "", comoTexto);
      var sanArq = sanitizarTexto(arq.caminho, comoTexto, "opfs/" + arq.caminho);
      credenciais = credenciais.concat(sanArq.credenciais);
      if (classeArq === "nao relacionada") {
        opfsItens.push({ caminho: arq.caminho, tipo: "arquivo", bytes: arq.bytes.length, classificacao: classeArq, conteudoExportado: false, credencial_detectada: sanArq.credenciais.length > 0 });
        continue;
      }
      var outBytes = sanArq.credenciais.length ? enc(sanArq.texto) : arq.bytes;
      var zipPath = "bruto/opfs/" + String(arq.caminho || "arquivo").split("/").map(safeName).join("/");
      arquivos.push({ name: zipPath, data: outBytes });
      opfsItens.push({
        caminho: arq.caminho,
        tipo: "arquivo",
        nome: arq.nome || "",
        bytes: outBytes.length,
        ultimaModificacao: arq.ultimaModificacao || null,
        sha256: await sha256Hex(outBytes),
        classificacao: classeArq,
        arquivo: zipPath,
        somenteLeitura: true
      });
    }

    var cachesOut = [];
    var caches = coleta.caches || { disponivel: false, caches: [] };
    for (var c = 0; c < (caches.caches || []).length; c++) {
      var cache = caches.caches[c];
      var itens = [];
      var nAsset = 0;
      var nNeg = 0;
      var nPag = 0;
      for (var e = 0; e < (cache.itens || []).length; e++) {
        var ent = cache.itens[e];
        var classeC = classificarCache(ent.url, ent.contentType);
        if (classeC === "possivel-dado-de-negocio") nNeg++;
        else if (classeC === "pagina-de-auditoria") nPag++;
        else nAsset++;
        var meta = { url: ent.url, status: ent.status, contentType: ent.contentType || "", bytes: ent.body ? ent.body.length : 0, classe: classeC };
        if (classeC === "possivel-dado-de-negocio" && ent.body) {
          var textoCache = new TextDecoder("utf-8", { fatal: false }).decode(ent.body);
          var sanC = sanitizarTexto(ent.url, textoCache, "cache/" + cache.cache + "/" + ent.url);
          credenciais = credenciais.concat(sanC.credenciais);
          var cb = enc(sanC.texto);
          var cp = "bruto/cache/" + safeName(cache.cache) + "/" + (e + 1) + ".txt";
          arquivos.push({ name: cp, data: cb });
          meta.arquivo = cp;
          meta.sha256 = await sha256Hex(cb);
        }
        itens.push(meta);
      }
      cachesOut.push({ cache: cache.cache, quantidade: itens.length, codigoOuAssets: nAsset, possivelDadoDeNegocio: nNeg, paginaDeAuditoria: nPag, itens: itens });
    }

    var manifesto = {
      ferramenta: "dk-auditoria-local",
      somenteLeitura: true,
      computador: coleta.computador,
      geradoEm: coleta.geradoEm,
      origem: coleta.origem,
      navegador: coleta.navegador,
      rede: {
        duranteGeracao: "nenhuma chamada fetch, XMLHttpRequest, WebSocket, sendBeacon, POST, PUT, PATCH, DELETE, Supabase ou Redis",
        carregamentoDaPagina: "o navegador só baixa o HTML e dk-auditoria-local-nucleo.js desta origem, antes da geração"
      },
      localStorage: {
        quantidadeTotal: chavesLs.length,
        quantidadeExportada: chavesLs.filter(function (c) { return c.arquivo; }).length,
        bytesExportados: lsBytesExportados,
        chaves: chavesLs
      },
      sessionStorage: {
        status: "nao_capturado",
        motivo: "sessionStorage pertence à aba que o criou. Abrir /dk-auditoria-local em outra aba não enxerga dk_operacao_offline_pending, dk_operacao_offline_mode, dk_lanc_upload_pendente nem o restante da sessão do portal. A aba operacional não foi fechada e nada foi copiado entre abas. IndexedDB dk_operacao_offline_v1 e o OPFS, quando existem, são do perfil e entram no pacote.",
        chavesDeSessaoConhecidasNoCodigo: [
          "dk_operacao_offline_pending",
          "dk_operacao_offline_mode",
          "dk_lanc_upload_pendente",
          "dk_portal_sessao_viva_v1",
          "dk_portal_area_ativa",
          "dk_cliente_app_gate",
          "dk_cliente_app_gate_v1"
        ]
      },
      indexedDB: {
        listagemDisponivel: idb.listagemDisponivel !== false,
        aviso: idb.aviso || "",
        bancos: bancos
      },
      opfs: {
        disponivel: Boolean(opfs.disponivel),
        erro: opfs.erro || "",
        somenteLeitura: true,
        itens: opfsItens
      },
      cache: {
        disponivel: Boolean(caches.disponivel),
        erro: caches.erro || "",
        efeitoServiceWorker: "O service worker já instalado pelo portal pode gravar o HTML desta página no Cache Storage ao abri-la. Esta ferramenta não grava, não apaga e não desregistra esse service worker. Essa entrada, se existir, fica classificada como pagina-de-auditoria e não entra no bruto.",
        caches: cachesOut
      },
      credenciais: credenciais,
      offline: {
        sessionStorage: "nao_capturado",
        indexedDBCompartilhado: bancos.filter(function (b) { return /offline|pendente|fila/i.test(b.banco) || b.classificacao !== "nao relacionada"; }).map(function (b) { return b.banco; })
      }
    };

    function mdEsc(s) { return String(s == null ? "" : s).replace(/\|/g, "/"); }
    var linhas = [];
    linhas.push("# Auditoria local DK — " + manifesto.computador);
    linhas.push("");
    linhas.push("Gerado em " + manifesto.geradoEm + ".");
    linhas.push("Somente leitura. O pacote não sai do computador por esta ferramenta.");
    linhas.push("");
    linhas.push("## sessionStorage");
    linhas.push("");
    linhas.push(manifesto.sessionStorage.motivo);
    linhas.push("");
    linhas.push("## localStorage");
    linhas.push("");
    linhas.push("| Chave | Classe | Bytes | Qtd | Snapshot | Exportada |");
    linhas.push("|---|---|---:|---:|---|---|");
    chavesLs.forEach(function (c) {
      linhas.push("| " + mdEsc(c.nome) + " | " + c.classificacao + " | " + c.bytes + " | " + (c.quantidade == null ? "" : c.quantidade) + " | " + (c.noSnapshotOficial ? "sim" : "não") + " | " + (c.arquivo ? "sim" : "não") + " |");
    });
    linhas.push("");
    linhas.push("Credenciais no manifesto: " + credenciais.length + ". Valor no pacote: [REDACTED].");
    linhas.push("");
    linhas.push("## IndexedDB");
    linhas.push("");
    if (!bancos.length) linhas.push("Nenhum banco listado.");
    bancos.forEach(function (b) {
      linhas.push("- " + b.banco + " — " + (b.classificacao || "erro") + (b.erro ? " (" + b.erro + ")" : ""));
    });
    linhas.push("");
    linhas.push("## OPFS");
    linhas.push("");
    linhas.push(opfs.disponivel ? "Leitura sem criar arquivo nem diretório." : "OPFS indisponível.");
    opfsItens.forEach(function (f) { linhas.push("- " + f.caminho + " — " + (f.classificacao || f.tipo)); });
    linhas.push("");
    linhas.push("## Cache");
    linhas.push("");
    linhas.push(manifesto.cache.efeitoServiceWorker);
    cachesOut.forEach(function (c) {
      linhas.push("- " + c.cache + ": " + c.quantidade + " (assets " + c.codigoOuAssets + ", possível negócio " + c.possivelDadoDeNegocio + ", página de auditoria " + c.paginaDeAuditoria + ")");
    });
    var md = linhas.join("\n") + "\n";
    return { manifesto: manifesto, relatorio: md, arquivos: arquivos };
  }

  return {
    classificarChave: classificarChave,
    sanitizarTexto: sanitizarTexto,
    classificarCache: classificarCache,
    montarPacote: montarPacote,
    zipStore: zipStore,
    sha256Hex: sha256Hex,
    CHAVES_SNAPSHOT: CHAVES_SNAPSHOT
  };
});
