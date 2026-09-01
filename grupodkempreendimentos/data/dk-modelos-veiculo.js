/**
 * Foto de catálogo do modelo contratado (Termo de Vistoria / Opção Contratada).
 * SHI 175: preto, vermelho, azul e cinza — a cor do cadastro escolhe a imagem.
 */
(function dkModelosVeiculo() {
  "use strict";

  const CATALOGO_SHI_175 = [
    { cor: /PRET[OA]|BLACK/i, file: "shi-175-preto.png", rotulo: "PRETO" },
    { cor: /VERMELH[OA]|RED/i, file: "shi-175-vermelho.png", rotulo: "VERMELHO" },
    { cor: /AZUL|BLUE/i, file: "shi-175-azul.png", rotulo: "AZUL" },
    { cor: /CINZ[AO]|GRAY|GREY/i, file: "shi-175-cinza.png", rotulo: "CINZA" },
  ];

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

  function ehShi175(marcaModelo) {
    return /SHI\s*175/i.test(String(marcaModelo || ""));
  }

  function acharShi175(cor) {
    const c = String(cor || "");
    return CATALOGO_SHI_175.find((m) => m.cor.test(c)) || null;
  }

  function resolveModeloContratadoFoto(veiculo, marcaModeloHint) {
    const obj = veiculo && typeof veiculo === "object" ? veiculo : { cor: veiculo };
    const mm = marcaModeloDe(obj, marcaModeloHint);
    if (!ehShi175(mm)) return "";
    const hit = acharShi175(obj.cor);
    return hit ? absUrl(`images/modelos/${hit.file}`) : "";
  }

  function modeloContratadoFotoHtml(veiculo, marcaModeloHint, alt) {
    const obj = veiculo && typeof veiculo === "object" ? veiculo : { cor: veiculo };
    const src = resolveModeloContratadoFoto(obj, marcaModeloHint);
    if (!src) return "";
    const mm = marcaModeloDe(obj, marcaModeloHint) || "Modelo contratado";
    const hit = acharShi175(obj.cor);
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
