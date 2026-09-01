/**
 * Foto de catálogo do modelo contratado (Termo de Vistoria / Opção Contratada).
 * SHI 175: preto, vermelho, azul e cinza.
 * Honda Bros 160: preto, vermelho, branco e cinza.
 * A cor do cadastro escolhe a imagem; cor desconhecida não usa foto de outra cor.
 */
(function dkModelosVeiculo() {
  "use strict";

  const CATALOGOS = [
    {
      match: /SHI\s*175/i,
      cores: [
        { cor: /PRET[OA]|BLACK/i, file: "shi-175-preto.png", rotulo: "PRETO" },
        { cor: /VERMELH[OA]|RED/i, file: "shi-175-vermelho.png", rotulo: "VERMELHO" },
        { cor: /AZUL|BLUE/i, file: "shi-175-azul.png", rotulo: "AZUL" },
        { cor: /CINZ[AO]|GRAY|GREY/i, file: "shi-175-cinza.png", rotulo: "CINZA" },
      ],
    },
    {
      match: /BROS|NXR\s*160/i,
      cores: [
        { cor: /PRET[OA]|BLACK/i, file: "bros-160-preto.png", rotulo: "PRETO" },
        { cor: /VERMELH[OA]|RED/i, file: "bros-160-vermelho.png", rotulo: "VERMELHO" },
        { cor: /BRANC[OA]|WHITE/i, file: "bros-160-branco.png", rotulo: "BRANCO" },
        { cor: /CINZ[AO]|PRATA|GRAY|GREY|SILVER/i, file: "bros-160-cinza.png", rotulo: "CINZA" },
      ],
    },
  ];

  const CATALOGO_SHI_175 = CATALOGOS[0].cores;

  function escAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function absUrl(rel) {
    try {
      return new URL(rel, window.location.href).href;
    } catch {
      return rel;
    }
  }

  function marcaModeloDe(veiculo, hint) {
    if (hint && String(hint).trim()) return String(hint).trim();
    const obj = veiculo && typeof veiculo === "object" ? veiculo : {};
    const marca = String(obj.marca || "").trim();
    const modelo = String(obj.modelo || obj.marcaModelo || "").trim();
    if (marca && modelo) return `${marca} ${modelo}`;
    return modelo || marca;
  }

  function acharCatalogo(marcaModelo) {
    const mm = String(marcaModelo || "");
    return CATALOGOS.find((cat) => cat.match.test(mm)) || null;
  }

  function acharCor(catalogo, cor) {
    if (!catalogo) return null;
    const c = String(cor || "");
    return catalogo.cores.find((m) => m.cor.test(c)) || null;
  }

  function resolveModeloContratadoFoto(veiculo, marcaModeloHint) {
    const obj = veiculo && typeof veiculo === "object" ? veiculo : { cor: veiculo };
    const mm = marcaModeloDe(obj, marcaModeloHint);
    const cat = acharCatalogo(mm);
    if (!cat) return "";
    const hit = acharCor(cat, obj.cor);
    return hit ? absUrl(`images/modelos/${hit.file}`) : "";
  }

  function modeloContratadoFotoHtml(veiculo, marcaModeloHint, alt) {
    const obj = veiculo && typeof veiculo === "object" ? veiculo : { cor: veiculo };
    const src = resolveModeloContratadoFoto(obj, marcaModeloHint);
    if (!src) return "";
    const mm = marcaModeloDe(obj, marcaModeloHint) || "Modelo contratado";
    const cat = acharCatalogo(mm);
    const hit = acharCor(cat, obj.cor);
    const label = alt || `${mm} — ${hit ? hit.rotulo : String(obj.cor || "").toUpperCase()}`.trim();
    return `<img src="${escAttr(src)}" alt="${escAttr(label)}" crossorigin="anonymous">`;
  }

  window.__DK_MODELOS_SHI_175 = CATALOGO_SHI_175.map((m) => ({
    file: m.file,
    src: `images/modelos/${m.file}`,
  }));
  window.__DK_resolveModeloContratadoFoto = resolveModeloContratadoFoto;
  window.__DK_modeloContratadoFotoHtml = modeloContratadoFotoHtml;
})();
