/**
 * Demo: o Sistema MIEL só mostra os 10 clientes / 10 veículos / 10 protocolos da imagem Locados.
 */
(function portalMielDemoFilter() {
  if (window.__DK_IS_DEMO_DEPLOY__ !== true) return;
  const src = window.__DK_MIEL_CADASTROS;
  if (!src || typeof src !== "object") return;

  const PROTOCOLOS = [
    { protocolo: "2026031302", cpf: "06843309461", placa: "UHQ1B38" },
    { protocolo: "2026031303", cpf: "09505434464", placa: "UHQ1B08" },
    { protocolo: "2026031304", cpf: "11512850489", placa: "SOR1I03" },
    { protocolo: "2026031305", cpf: "07534147409", placa: "SOU2I56" },
    { protocolo: "2026031601", cpf: "05705186444", placa: "UHQ1C68" },
    { protocolo: "2026031602", cpf: "03793589307", placa: "UHR0G21" },
    { protocolo: "2026031701", cpf: "07795468497", placa: "UHQ8D58" },
    { protocolo: "2026031702", cpf: "07771412564", placa: "UHQ1E58" },
    { protocolo: "2026031703", cpf: "08350435410", placa: "UHR0E91" },
    { protocolo: "2026031704", cpf: "70274179440", placa: "UHQ8G38" },
  ];
  const ALLOWED_PLATES = new Set(PROTOCOLOS.map((p) => p.placa));
  const ALLOWED_CPFS = new Set(PROTOCOLOS.map((p) => p.cpf));
  const ALLOWED_PRS = new Set(PROTOCOLOS.map((p) => p.protocolo));

  const nk = (v) =>
    String(v || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  const dig = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);
  const nc = (v) => String(v || "").replace(/\D/g, "");

  const clientes = (src.clientes || []).filter((c) => ALLOWED_CPFS.has(dig(c.cnpjCpf || c.cpf)));
  const veiculos = (src.veiculos || []).filter((v) => ALLOWED_PLATES.has(nk(v.placa)));
  const locacoes = (src.locacoes || []).filter((l) =>
    ALLOWED_PRS.has(nc(l.protocolo || l.numeroContrato))
  );
  locacoes.forEach((l) => {
    l.status = "ATIVO";
    l.dataFim = "";
  });

  const haveCpf = new Set(clientes.map((c) => dig(c.cnpjCpf || c.cpf)));
  ALLOWED_CPFS.forEach((cpf) => {
    if (haveCpf.has(cpf)) return;
    clientes.push({
      id: `demo10_${cpf}`,
      cod: cpf.slice(-4),
      analise: "APROVADO",
      statusProtocolo: "ATIVO",
      cnpjCpf: cpf,
      cliente: "",
      alert: false,
    });
  });

  const veicByPlate = new Map(veiculos.map((v) => [nk(v.placa), v]));
  const cliByCpf = new Map(clientes.map((c) => [dig(c.cnpjCpf || c.cpf), c]));
  const havePr = new Set(locacoes.map((l) => nc(l.protocolo)));
  PROTOCOLOS.forEach((p) => {
    if (havePr.has(p.protocolo)) return;
    const cli = cliByCpf.get(p.cpf);
    const veic = veicByPlate.get(p.placa);
    locacoes.push({
      id: `demo10_loc_${p.protocolo}`,
      protocolo: p.protocolo,
      status: "ATIVO",
      placa: p.placa,
      clienteId: cli?.id || `demo10_${p.cpf}`,
      veiculoId: veic?.id || "",
      clienteNome: cli?.cliente || "",
    });
  });

  const vinculos = (src.vinculos || []).filter((x) => ALLOWED_PRS.has(nc(x.protocolo || x.numeroContrato)));
  const haveVinc = new Set(vinculos.map((x) => nc(x.protocolo)));
  PROTOCOLOS.forEach((p) => {
    if (haveVinc.has(p.protocolo)) return;
    const cli = cliByCpf.get(p.cpf);
    const veic = veicByPlate.get(p.placa);
    vinculos.push({
      id: `demo10_vinc_${p.protocolo}`,
      protocolo: p.protocolo,
      placa: p.placa,
      clienteId: cli?.id,
      veiculoId: veic?.id,
    });
  });

  window.__DK_MIEL_CADASTROS = { ...src, clientes, veiculos, locacoes, vinculos };
})();
