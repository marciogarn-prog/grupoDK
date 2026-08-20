/**
 * Sistema MIEL — Relação de Veículos + Status de Veículos (motor célula-a-célula).
 */
(function mielRelacaoStatusVeiculos() {
  const reg = window.__DK_mielRegisterSheet;
  if (!reg) return;

  function veiculos() {
    return (window.__DK_MIEL_CADASTROS && window.__DK_MIEL_CADASTROS.veiculos) || [];
  }

  function fmtMarcaModelo(v) {
    const m = String(v.marca || "").trim();
    const o = String(v.modelo || "").trim();
    if (m && o) return `${m} / ${o}`;
    return m || o || "";
  }

  reg({
    id: "relacao-veiculos",
    sheetName: "Relação_Veículos",
    panelId: "mielPanelRelacaoVeiculos",
    layoutKey: "__DK_MIEL_LAYOUT_RELACAO_VEICULOS_LAYOUT",
    initHook: "__DK_mielInitRelacaoVeiculos",
    patchHeaderCell(cell) {
      if (cell.ref === "B1" && !cell.text) return { text: "# Relação de Veículos Cadastrados no Sistema" };
      if (cell.ref === "A1" && cell.text?.includes("Relação")) return { text: "" };
      return null;
    },
    buildRows() {
      return veiculos().map((v, i) => ({
        ordem: String(i + 1),
        codigo: v.codigo || v.cod || "",
        placa: v.placa || "",
        modalidade: v.categoria || "",
        marcaModelo: fmtMarcaModelo(v),
        cor: v.cor || "",
        chassi: v.chassi || "",
        renavam: v.renavam || "",
        anoModelo: v.anoModelo || "",
        numMotor: v.numMotor || "",
        proprietario: v.proprietario || "",
        cnpjCpf: v.cnpjCpf || "",
        municipioUf: v.municipioUf || "",
      }));
    },
    rowToCells(r) {
      return {
        A: r.ordem,
        B: r.ordem,
        C: r.codigo,
        D: r.placa,
        E: r.modalidade,
        F: r.marcaModelo,
        G: r.cor,
        H: r.chassi,
        I: r.renavam,
        J: r.anoModelo,
        K: r.numMotor,
        L: r.proprietario,
        M: r.cnpjCpf,
        N: r.municipioUf,
      };
    },
    sideButtons: [{ text: "# Cadastro de Veículos", id: "cad-veiculos", label: "Cadastro de Veículos", piece: 13 }],
  });

  reg({
    id: "status-veiculos",
    sheetName: "Status_Veículos",
    panelId: "mielPanelStatusVeiculos",
    layoutKey: "__DK_MIEL_LAYOUT_STATUS_VEICULOS_LAYOUT",
    initHook: "__DK_mielInitStatusVeiculos",
    patchHeaderCell(cell) {
      if (cell.ref === "B1" && !cell.text) return { text: "# Relação de Status de Veículos" };
      if (cell.ref === "A1" && cell.text?.includes("Status")) return { text: "" };
      return null;
    },
    buildRows() {
      return veiculos().map((v, i) => ({
        ordem: String(i + 1),
        status: v.status || "",
        codigo: v.codigo || v.cod || "",
        placa: v.placa || "",
        modalidade: v.categoria || "",
        marcaModelo: fmtMarcaModelo(v),
        cor: v.cor || "",
        emplacada: v.emplacada || "",
        rastreador: v.rastreador || "",
        assegurada: v.assegurada || "",
        observacao: v.observacao || "",
      }));
    },
    rowToCells(r) {
      return {
        A: r.ordem,
        B: r.ordem,
        C: r.status,
        D: r.codigo,
        E: r.placa,
        F: r.modalidade,
        G: r.marcaModelo,
        H: r.cor,
        I: r.emplacada,
        J: r.rastreador,
        K: r.assegurada,
        L: r.observacao,
      };
    },
    cellStyleFn(col, val) {
      if (col === "C" && /LOCADO/i.test(String(val))) return { color: "#C00000", bold: true };
      if (col === "C" && /DISPON/i.test(String(val))) return { color: "#0070C0" };
      return null;
    },
    sideButtons: [{ text: "# Cadastro de Veículos", id: "cad-veiculos", label: "Cadastro de Veículos", piece: 13 }],
  });
})();
