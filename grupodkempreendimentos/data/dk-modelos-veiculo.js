/**
 * Foto de catálogo do modelo contratado (Termo de Vistoria / Opção Contratada).
 * SHI 175, Honda Bros 160, Yamaha YBR 150 Factor (Normal e DX), Honda CG 160 Start,
 * Renault Kwid, Toyota Etios, Ford Ka, Volkswagen Gol e Hyundai HB20.
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
    {
      match: /FACTOR\s*DX|YBR.*\bDX\b|\bDX\b.*FACTOR/i,
      cores: [
        { cor: /AZUL|BLUE|RACING/i, file: "ybr-150-dx-azul.png", rotulo: "AZUL METÁLICO" },
        { cor: /FOSCO|MATT/i, file: "ybr-150-dx-preto-fosco.png", rotulo: "PRETO FOSCO" },
        { cor: /MET[AÁ]LIC|MIDNIGHT/i, file: "ybr-150-dx-preto-metalico.png", rotulo: "PRETO METÁLICO" },
        { cor: /PRET[OA]|BLACK/i, file: "ybr-150-dx-preto-metalico.png", rotulo: "PRETO METÁLICO" },
      ],
    },
    {
      match: /YBR|FACTOR/i,
      cores: [
        { cor: /BRANC[OA]|WHITE/i, file: "ybr-150-branco.png", rotulo: "BRANCO" },
        { cor: /VERMELH[OA]|RED/i, file: "ybr-150-vermelho.png", rotulo: "VERMELHO" },
        { cor: /PRET[OA]|BLACK/i, file: "ybr-150-preto.png", rotulo: "PRETO" },
      ],
    },
    {
      match: /START/i,
      cores: [
        { cor: /PRATA|PRATEAD|SILVER|CINZ[AO]|GRAY|GREY/i, file: "start-160-prata.png", rotulo: "PRATA" },
        { cor: /VERMELH[OA]|RED/i, file: "start-160-vermelho.png", rotulo: "VERMELHO" },
        { cor: /PRET[OA]|BLACK/i, file: "start-160-preto.png", rotulo: "PRETO" },
        { cor: /AZUL|BLUE/i, file: "start-160-azul.png", rotulo: "AZUL" },
      ],
    },
    {
      match: /KWID/i,
      cores: [
        { cor: /BRANC[OA]|WHITE/i, file: "kwid-branco.png", rotulo: "BRANCO" },
        { cor: /VERMELH[OA]|RED/i, file: "kwid-vermelho.png", rotulo: "VERMELHO" },
        { cor: /PRET[OA]|BLACK/i, file: "kwid-preto.png", rotulo: "PRETO" },
        { cor: /BEGE|CHAMPAGNE|AREIA|CREME/i, file: "kwid-bege.png", rotulo: "BEGE" },
        { cor: /LARANJA|ORANGE/i, file: "kwid-laranja.png", rotulo: "LARANJA" },
      ],
    },
    {
      match: /ETIOS/i,
      cores: [
        { cor: /BRANC[OA]|WHITE/i, file: "etios-branco.png", rotulo: "BRANCO" },
      ],
    },
    {
      match: /\bKA\b/i,
      cores: [
        { cor: /VERMELH[OA]|RED/i, file: "ka-vermelho.png", rotulo: "VERMELHO" },
        { cor: /CINZ[AO]|PRATA|PRATEAD|GRAY|GREY|SILVER/i, file: "ka-cinza.png", rotulo: "CINZA" },
      ],
    },
    {
      match: /\bGOL\b/i,
      cores: [
        { cor: /CINZ[AO]|PRATA|PRATEAD|GRAY|GREY|SILVER/i, file: "gol-cinza.png", rotulo: "CINZA" },
      ],
    },
    {
      match: /HB20/i,
      cores: [
        { cor: /CINZ[AO]|PRATA|PRATEAD|GRAY|GREY|SILVER/i, file: "hb20-cinza.png", rotulo: "CINZA" },
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
