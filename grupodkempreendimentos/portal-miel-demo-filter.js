/**
 * Demo: o Sistema MIEL só mostra os 10 clientes / 10 veículos / 10 protocolos da imagem Locados.
 */
(function portalMielDemoFilter() {
  if (window.__DK_IS_DEMO_DEPLOY__ !== true) return;
  const src = window.__DK_MIEL_CADASTROS;
  if (!src || typeof src !== "object") return;

  const ALLOWED_PLATES = new Set([
    "UHQ1B38",
    "UHQ1B08",
    "SOR1I03",
    "SOU2I56",
    "UHQ1C68",
    "UHR0G21",
    "UHQ8D58",
    "UHQ1E58",
    "UHR0E91",
    "UHQ8G38",
  ]);
  const ALLOWED_CPFS = new Set([
    "06843309461",
    "09505434464",
    "11512850489",
    "07534147409",
    "05705186444",
    "03793589307",
    "07795468497",
    "07771412564",
    "08350435410",
    "70274179440",
  ]);
  const ALLOWED_PRS = new Set([
    "2026031302",
    "2026031303",
    "2026031304",
    "2026031305",
    "2026031601",
    "2026031602",
    "2026031701",
    "2026031702",
    "2026031703",
    "2026031704",
  ]);

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
  const keepCliente = new Set(clientes.map((c) => c.id));
  const keepVeiculo = new Set(veiculos.map((v) => v.id));
  const vinculos = (src.vinculos || []).filter(
    (x) =>
      ALLOWED_PRS.has(nc(x.protocolo || x.numeroContrato)) ||
      (keepCliente.has(x.clienteId) && keepVeiculo.has(x.veiculoId))
  );

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

  window.__DK_MIEL_CADASTROS = { ...src, clientes, veiculos, locacoes, vinculos };
})();
