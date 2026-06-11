/**
 * Check-list para manutenção / reparações — tela «Lançamento de manutenção».
 * Cabeçalho preenchido pelo protocolo (cliente + veículo); operador preenche
 * troca de óleo, odômetro (próx. troca = +1000 km), pagou e mecânico;
 * itens 1–29 ficam ocultos atrás do botão «Detalhamento da manutenção»;
 * assinaturas cliente/supervisor no tablet (S-pen); PDF replica o papel
 * «CHECK-LIST PARA MANUTENÇÃO / REPARAÇÕES» (2 páginas, com a foto da moto).
 */
(function portalManutencaoChecklist() {
  "use strict";

  /* Itens exatamente como no formulário em papel (incluindo grafia original). */
  const ITENS = [
    "Condição do Kit de Transmissão",
    "Condição do disco de freio trazeiro",
    "Condição das pastilhas de freio trazeiro",
    "Condição das lonas de freio trazeiro",
    "Condição do disco de freio dianteiro",
    "Condição das pastilhas de freio dianteiro",
    "Condição do pneu dianteiro",
    "Condição do pneu trazeiro",
    "Condição da câmara de ar (pneu dianteiro)",
    "Condição da câmara de ar (pneu trazeiro)",
    "Condição da mesa de direção",
    "Condição do sistema elétrico",
    "Condição da placa",
    "Condição do suporte de placa",
    "Condição da luz de freio",
    "Condição do Acelerador",
    "Condição do cabo do acelerador",
    "Condição do cabo de embreagem",
    "Condição do cabo de velocímetro",
    "Condição da capa do banco",
    "Condição do banco",
    "Condição da vela de ignição",
    "Condição da Ignição",
    "Condição do Painel",
    "Condição dos rolamentos (roda dianteira)",
    "Condição dos rolamentos (roda trazeira)",
    "Condição da buzina",
    "Condição do Kit de Embreagem",
    "Condição da Junta do Motor",
  ];
  const LINHAS_EXTRA = [30, 31, 32, 33];
  const SUPERVISOR_PADRAO = "IRINALDO TORRES";
  const MECANICOS = ["TALISON CAMARGO", "SAMUEL VICTOR", "Mecânico II"];

  /* Imagens dos veículos por marca/modelo + cor (mais imagens serão adicionadas). */
  const IMAGENS_VEICULO = [
    { match: /SHI\s*175/i, cor: /VERMELH/i, src: "images/manutencao/shineray-shi-175-vermelha.png" },
  ];

  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

  function loadLs(key) {
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function normNc(raw) {
    return String(raw || "").trim().replace(/\s+/g, "");
  }

  function normPlaca(raw) {
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
  }

  function fmtCpf(digits) {
    const d = onlyDigits(digits).slice(0, 11);
    if (d.length !== 11) return d;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function fmtCelular(raw) {
    const d = onlyDigits(raw);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return String(raw || "").trim();
  }

  function parseDataBr(raw) {
    const s = String(raw || "").trim();
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    /* formatos tipo "sex 21/03/2025" */
    m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return null;
  }

  function fmtDataSemana(d) {
    if (!d || Number.isNaN(d.getTime())) return "";
    const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${semana}, ${dd}/${mm}/${d.getFullYear()}`;
  }

  function fmtKm(raw) {
    const n = parseInt(onlyDigits(raw), 10);
    if (!Number.isFinite(n)) return "";
    return `${String(n).padStart(6, "0")} Km(s)`;
  }

  /** Plano → cor do papel: DK MINHA MOTO=verde, DK MEU TRANSPORTE=azul, carro=marrom. */
  function corDoPlano(plano, isCarro) {
    if (isCarro) return "#a06b3f";
    const k = String(plano || "").toUpperCase();
    if (k.includes("MINHA") && k.includes("MOTO")) return "#92d050";
    if (k.includes("TRANSPORTE")) return "#5b9bd5";
    return "#92d050";
  }

  function getContexto() {
    const cpf = onlyDigits(document.getElementById("operacaoLancManutencaoCpf")?.value).slice(0, 11);
    const nc = normNc(document.getElementById("operacaoLancManutencaoProtocoloSelect")?.value);
    const placa = normPlaca(document.getElementById("operacaoLancManutencaoPlaca")?.value);
    return { cpf, nc, placa };
  }

  function resolverDados() {
    const { cpf, nc, placa } = getContexto();
    if (!nc || cpf.length !== 11) return null;

    const loc =
      loadLs("dk_locacoes_cadastro").find(
        (l) => normNc(l?.numeroContrato) === nc && onlyDigits(l?.cpf).slice(0, 11) === cpf
      ) || null;

    const cliente = loadLs("dk_clientes_cadastro").find((c) => onlyDigits(c?.cpf).slice(0, 11) === cpf) || null;

    const placaKey = placa || normPlaca(loc?.placa);
    const veiculo = loadLs("dk_veiculos_cadastro").find((v) => normPlaca(v?.placa) === placaKey) || null;

    const marca = String(veiculo?.marca || "").trim();
    const modelo = String(veiculo?.modelo || veiculo?.marcaModelo || loc?.marcaModelo || loc?.modelo || "").trim();
    const marcaModelo = marca && modelo && !modelo.toUpperCase().includes(marca.toUpperCase())
      ? `${marca} / ${modelo}`
      : modelo || marca;

    const tipoV = String(veiculo?.tipo || "").toUpperCase();
    const isCarro = tipoV.includes("CARRO") || String(veiculo?.tag || "").toUpperCase().includes("DKCR");

    const cor = String(veiculo?.cor || "").trim();
    const img = IMAGENS_VEICULO.find((m) => m.match.test(marcaModelo) && m.cor.test(cor)) || null;

    return {
      protocolo: nc,
      plano: String(loc?.plano || loc?.opcaoContrato || "").trim(),
      isCarro,
      inicio: parseDataBr(loc?.inicio),
      codCliente: String(cliente?.codigo || "").trim(),
      nomeCliente: String(cliente?.nome || loc?.nome || "").trim(),
      cpf,
      celular: String(cliente?.celular || "").trim(),
      placa: placaKey,
      anoModelo: String(veiculo?.anoModelo || "").trim(),
      corVeiculo: cor,
      marcaModelo,
      imgVeiculo: img ? img.src : "",
    };
  }

  /* ---------------- detalhamento (itens 1–29) ---------------- */

  function buildDetalheHtml() {
    const linhas = ITENS.map((label, i) => {
      const n = i + 1;
      return `<tr>
        <td class="portal-manut-check-tbl__num">${n}</td>
        <td class="portal-manut-check-tbl__desc">${esc(label)}</td>
        <td class="portal-manut-check-tbl__ar"><input type="radio" name="manutChecklistItem${n}" value="A" aria-label="Item ${n} aprovado"></td>
        <td class="portal-manut-check-tbl__ar"><input type="radio" name="manutChecklistItem${n}" value="R" aria-label="Item ${n} reprovado"></td>
        <td class="portal-manut-check-tbl__obs"><input type="text" id="manutChecklistObs${n}" maxlength="120" autocomplete="off" aria-label="Observações item ${n}"></td>
      </tr>`;
    }).join("");
    return `
      <p class="subtext">Legenda: <strong class="portal-manut-check-leg portal-manut-check-leg--a">A</strong> Aprovado ·
      <strong class="portal-manut-check-leg portal-manut-check-leg--r">R</strong> Reprovado &mdash; pode deixar em branco para preencher à mão no papel.</p>
      <table class="portal-manut-check-tbl" aria-label="Itens de manutenção 1 a 29">
        <thead><tr><th>#</th><th>Item</th><th>A</th><th>R</th><th>Observações</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;
  }

  function lerDetalhe() {
    return ITENS.map((label, i) => {
      const n = i + 1;
      const sel = document.querySelector(`input[name="manutChecklistItem${n}"]:checked`);
      return {
        n,
        label,
        estado: sel ? sel.value : "",
        obs: String(document.getElementById(`manutChecklistObs${n}`)?.value || "").trim(),
      };
    });
  }

  /* ---------------- assinaturas (S-pen / touch / rato) ---------------- */

  const assinaturasComTraco = new Set();

  function bindAssinatura(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas.__dkAssinaturaBound) return;
    canvas.__dkAssinaturaBound = true;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#102040";
    let desenhando = false;

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * canvas.width,
        y: ((e.clientY - r.top) / r.height) * canvas.height,
      };
    };

    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      desenhando = true;
      canvas.setPointerCapture(e.pointerId);
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      assinaturasComTraco.add(canvasId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!desenhando) return;
      e.preventDefault();
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    const fim = (e) => {
      if (!desenhando) return;
      desenhando = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    canvas.addEventListener("pointerup", fim);
    canvas.addEventListener("pointercancel", fim);
    canvas.addEventListener("pointerleave", fim);
  }

  function limparAssinatura(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    assinaturasComTraco.delete(canvasId);
  }

  function assinaturaDataUrl(canvasId) {
    if (!assinaturasComTraco.has(canvasId)) return "";
    const canvas = document.getElementById(canvasId);
    if (!canvas) return "";
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  }

  /* ---------------- PDF (layout do papel) ---------------- */

  function marcado(cond) {
    return cond ? "X" : "&nbsp;";
  }

  function buildChecklistPrintHtml(dados, form) {
    const corPlano = corDoPlano(dados.plano, dados.isCarro);
    const agora = new Date();
    const horaEntrada = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    const dataEntrada = fmtDataSemana(agora);
    const inicioContrato = dados.inicio ? fmtDataSemana(dados.inicio) : "";

    const itensRows = form.itens
      .map(
        (it) => `<tr>
          <td class="num">${it.n}</td>
          <td class="desc">${esc(it.label)}</td>
          <td class="ar"><span class="cb">${marcado(it.estado === "A")}</span></td>
          <td class="ar"><span class="cb">${marcado(it.estado === "R")}</span></td>
          <td class="obs">${esc(it.obs)}</td>
        </tr>`
      )
      .join("");
    const extraRows = LINHAS_EXTRA.map(
      (n) => `<tr>
        <td class="num">${n}</td>
        <td class="desc">&nbsp;</td>
        <td class="ar"><span class="cb">&nbsp;</span></td>
        <td class="ar"><span class="cb">&nbsp;</span></td>
        <td class="obs">&nbsp;</td>
      </tr>`
    ).join("");

    const mecanicosHtml = MECANICOS.map(
      (m) => `<p class="mec-linha"><span class="cb">${marcado(form.mecanico === m)}</span> ${esc(m)}</p>`
    ).join("");

    const assinaturaClienteImg = form.assinaturaCliente
      ? `<img class="assinatura-img" src="${form.assinaturaCliente}" alt="Assinatura do cliente">`
      : "";
    const assinaturaSupervisorImg = form.assinaturaSupervisor
      ? `<img class="assinatura-img" src="${form.assinaturaSupervisor}" alt="Assinatura do supervisor">`
      : "";

    const imgVeiculoHtml = dados.imgVeiculo
      ? `<img class="veiculo-img" src="${esc(dados.imgVeiculo)}" alt="Veículo">`
      : '<div class="veiculo-img veiculo-img--vazia"><span>FOTO DO VEÍCULO<br>AINDA NÃO CADASTRADA</span></div>';

    const linhasAnotacoes = Array.from({ length: 40 }, () => '<div class="anot-linha"></div>').join("");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Check-list manutenção ${esc(dados.protocolo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 10mm 9mm; font-size: 10.2px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #222; padding: 2px 4px; vertical-align: middle; }
  .pagina { page-break-after: always; position: relative; min-height: 270mm; }
  .pagina:last-child { page-break-after: auto; }

  .cab-tabela td { border: 1.5px solid #111; }
  .cab-logo { width: 26%; background: #0c0c0c; text-align: center; padding: 4px; }
  .cab-logo img { max-width: 90%; max-height: 52px; }
  .cab-titulo { text-align: center; font-weight: 700; font-size: 13px; }
  .cab-plano { text-align: center; font-weight: 700; background: ${corPlano}; }
  .cab-inicio { text-align: center; font-weight: 600; }
  .cab-proto { text-align: center; font-weight: 700; }
  .cab-entrada td { font-size: 10px; padding: 1px 4px; }
  .entrada-data { background: ${corPlano}; font-weight: 700; text-align: center; }
  .cab-dir { width: 24%; padding: 0; }
  .cab-dir table { height: 100%; }
  .cab-dir td { border-width: 1px; }

  .cliente-box { margin-top: 4px; }
  .cliente-box .titulo { text-align: center; font-weight: 700; }
  .cliente-box .nome { text-align: center; font-weight: 700; font-size: 11px; }
  .cliente-box .cel-h { text-align: center; font-weight: 700; width: 22%; }
  .cliente-box .cel { text-align: center; font-weight: 700; }

  .veiculo-tabela { margin-top: 4px; }
  .veiculo-foto { width: 30%; text-align: center; padding: 3px; }
  .veiculo-img { max-width: 100%; max-height: 80px; }
  .veiculo-img--vazia { height: 80px; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; text-align: center; color: #777; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; }
  .veiculo-h { text-align: center; font-weight: 700; background: #f2f2f2; }
  .veiculo-v { text-align: center; font-weight: 700; }
  .oleo-h { background: #c00000; color: #fff; font-weight: 700; text-align: center; }
  .oleo-v { background: #5b9bd5; color: #fff; font-weight: 700; text-align: center; letter-spacing: 1px; }
  .pagou-ops { text-align: center; font-weight: 700; }
  .pagou-ops .cb { margin: 0 1px; }

  .legenda { margin: 5px 0 3px; font-size: 10.5px; display: flex; align-items: center; gap: 6px; }
  .leg-box { display: inline-block; width: 13px; height: 13px; line-height: 13px; text-align: center; font-weight: 700; color: #fff; border: 1px solid #222; }
  .leg-a { background: #2e7d32; }
  .leg-r { background: #c00000; }

  .itens-tabela th { background: #f2f2f2; font-size: 10px; padding: 2px; }
  .itens-tabela .falso-h { color: #c00000; font-weight: 700; }
  .itens-tabela .num { width: 5%; text-align: center; font-weight: 700; }
  .itens-tabela .desc { width: 44%; font-weight: 600; }
  .itens-tabela .ar { width: 4%; text-align: center; }
  .itens-tabela .obs { width: 43%; }
  .cb { display: inline-block; width: 11px; height: 11px; line-height: 11px; border: 1.2px solid #222; text-align: center; font-size: 9px; font-weight: 700; vertical-align: middle; background: #fff; color: #111; }

  .rodape-tabela { margin-top: 6px; }
  .rodape-tabela td { border: 1.5px solid #111; vertical-align: top; }
  .ass-box { width: 62%; padding: 4px 6px; }
  .ass-nome { font-weight: 700; margin: 0 0 2px; }
  .ass-area { position: relative; height: 44px; border-bottom: 1px solid #111; margin-bottom: 6px; }
  .assinatura-img { position: absolute; left: 8px; bottom: 0; max-height: 42px; max-width: 80%; }
  .mec-box { padding: 4px 6px; }
  .mec-titulo { font-weight: 700; margin: 0 0 4px; }
  .mec-linha { margin: 5px 0; font-weight: 600; }

  .pe-pagina { display: flex; justify-content: space-between; font-size: 9.5px; border-top: 1px solid #444; margin-top: 8px; padding-top: 2px; }

  .anotacoes-caixa { border: 1px solid #222; min-height: 250mm; padding: 0 6px 6px; }
  .anotacoes-titulo { font-weight: 700; background: linear-gradient(#fff, #d9d9d9); border-bottom: 1px solid #222; margin: 0 -6px 4px; padding: 3px 6px; }
  .anot-linha { border-bottom: 1px solid #999; height: 6mm; }

  .barra-acoes { position: sticky; top: 0; background: #fff; padding: 6px 0; text-align: right; }
  .barra-acoes button { font-size: 13px; padding: 6px 14px; cursor: pointer; }
  @media print { .barra-acoes { display: none; } body { padding: 6mm 8mm; } }
  @page { size: A4 portrait; margin: 8mm; }
</style>
</head>
<body>
  <div class="barra-acoes"><button type="button" onclick="window.print()">Imprimir / guardar PDF</button></div>

  <div class="pagina">
    <table class="cab-tabela">
      <tr>
        <td class="cab-logo" rowspan="4"><img src="images/dk-locadora-logo.png" alt="DK Locadora"></td>
        <td class="cab-titulo">CHECK-LIST PARA MANUTENÇÃO / REPARAÇÕES</td>
        <td class="cab-dir" rowspan="4">
          <table>
            <tr class="cab-entrada"><td style="border-left:none;border-top:none"><strong>Entrada:</strong></td><td><strong>Hora:</strong> ${esc(horaEntrada)}</td></tr>
            <tr class="cab-entrada"><td colspan="2" class="entrada-data">${esc(dataEntrada)}</td></tr>
            <tr class="cab-entrada"><td><strong>Saída:</strong></td><td><strong>Hora:</strong> ___:___</td></tr>
            <tr class="cab-entrada"><td colspan="2" style="text-align:center">_____ / _____ / _____</td></tr>
          </table>
        </td>
      </tr>
      <tr><td class="cab-plano">Plano:&nbsp; ${esc(dados.plano || "—")}</td></tr>
      <tr><td class="cab-inicio">Início do Contrato Oficial:&nbsp; ${esc(inicioContrato || "—")}</td></tr>
      <tr><td class="cab-proto">Protocolo Nº:&nbsp; ${esc(dados.protocolo)}</td></tr>
    </table>

    <table class="cliente-box">
      <tr><td class="titulo">Cliente</td><td class="cel-h" rowspan="2">Nº do Celular<br><span class="cel">${esc(fmtCelular(dados.celular) || "—")}</span></td></tr>
      <tr><td class="nome">Cód.: ${esc(dados.codCliente || "—")} - ${esc(dados.nomeCliente || "—")} - CPF: ${esc(fmtCpf(dados.cpf))}</td></tr>
    </table>

    <table class="veiculo-tabela">
      <tr>
        <td class="veiculo-foto" rowspan="4">${imgVeiculoHtml}</td>
        <td class="veiculo-h" style="width:23%">Placa</td>
        <td class="veiculo-h" style="width:23%">Ano / Modelo</td>
        <td class="veiculo-h" style="width:24%">Cor</td>
      </tr>
      <tr>
        <td class="veiculo-v">${esc(dados.placa || "—")}</td>
        <td class="veiculo-v">${esc(dados.anoModelo || "—")}</td>
        <td class="veiculo-v">${esc(dados.corVeiculo || "—")}</td>
      </tr>
      <tr><td class="veiculo-h" colspan="3">Marca / Modelo</td></tr>
      <tr><td class="veiculo-v" colspan="3">${esc(dados.marcaModelo || "—")}</td></tr>
    </table>

    <table class="veiculo-tabela">
      <tr>
        <td class="oleo-h" style="width:18%">Troca de Óleo?</td>
        <td class="veiculo-h" style="width:28%">Odômetro</td>
        <td class="veiculo-h" style="width:28%">Próx. Troca de Óleo</td>
        <td class="veiculo-h" style="width:26%">Pagou?</td>
      </tr>
      <tr>
        <td class="oleo-v">${form.oleo === "sim" ? "SIM" : form.oleo === "nao" ? "NÃO" : "&nbsp;"}</td>
        <td class="veiculo-v">${fmtKm(form.odometro) ? esc(fmtKm(form.odometro)) : "&nbsp;"}</td>
        <td class="veiculo-v">${fmtKm(form.proximaTroca) ? esc(fmtKm(form.proximaTroca)) : "&nbsp;"}</td>
        <td class="pagou-ops">S <span class="cb">${marcado(form.pagou === "S")}</span>&nbsp; N <span class="cb">${marcado(form.pagou === "N")}</span>&nbsp; N/A <span class="cb">${marcado(form.pagou === "NA")}</span></td>
      </tr>
    </table>

    <p class="legenda"><strong>Legenda:</strong> <span class="leg-box leg-a">A</span> Aprovado <span class="leg-box leg-r">R</span> Reprovado</p>

    <table class="itens-tabela">
      <thead>
        <tr><th class="num">&nbsp;</th><th class="falso-h">FALSO</th><th>A</th><th>R</th><th>Observações</th></tr>
      </thead>
      <tbody>
        ${itensRows}
        ${extraRows}
      </tbody>
    </table>

    <table class="rodape-tabela">
      <tr>
        <td class="ass-box">
          <p class="ass-nome">Cliente:&nbsp; ${esc(dados.nomeCliente || "—")}</p>
          <div class="ass-area">${assinaturaClienteImg}</div>
          <p class="ass-nome">Supervisor:&nbsp; ${esc(SUPERVISOR_PADRAO)}</p>
          <div class="ass-area">${assinaturaSupervisorImg}</div>
        </td>
        <td class="mec-box">
          <p class="mec-titulo">Mecânico:</p>
          ${mecanicosHtml}
        </td>
      </tr>
    </table>

    <div class="pe-pagina"><span># DK - SISLOC - Sistema de Controle de Locações</span><span>Pág.: 1 / 2</span></div>
  </div>

  <div class="pagina">
    <div class="anotacoes-caixa">
      <p class="anotacoes-titulo">Anotações</p>
      ${linhasAnotacoes}
    </div>
    <div class="pe-pagina"><span># DK - SISLOC - Sistema de Controle de Locações</span><span>Pág.: 2 / 2</span></div>
  </div>
</body>
</html>`;
  }

  function gerarPdf() {
    const msg = document.getElementById("manutChecklistMsg");
    const dados = resolverDados();
    if (!dados) {
      if (msg) msg.textContent = "Confirme a pesquisa e selecione um protocolo antes de gerar o check-list.";
      return;
    }
    const oleo = document.querySelector('input[name="manutChecklistOleo"]:checked')?.value || "";
    const pagou = document.querySelector('input[name="manutChecklistPagou"]:checked')?.value || "";
    const mecanico = document.querySelector('input[name="manutChecklistMecanico"]:checked')?.value || "";
    const odometro = onlyDigits(document.getElementById("manutChecklistOdometro")?.value);
    const proximaTroca = onlyDigits(document.getElementById("manutChecklistProximaTroca")?.value);

    const form = {
      oleo,
      pagou,
      mecanico,
      odometro,
      proximaTroca,
      itens: lerDetalhe(),
      assinaturaCliente: assinaturaDataUrl("manutChecklistAssinaturaCliente"),
      assinaturaSupervisor: assinaturaDataUrl("manutChecklistAssinaturaSupervisor"),
    };

    const html = buildChecklistPrintHtml(dados, form);
    const popup = window.open("", "_blank", "width=900,height=1000");
    if (!popup) {
      if (msg) msg.textContent = "O navegador bloqueou a janela do PDF — permita pop-ups para este site.";
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    if (msg) msg.textContent = `Check-list do protocolo ${dados.protocolo} gerado — confira a janela de impressão.`;
  }

  /* ---------------- visibilidade / refresh ---------------- */

  function limparFormChecklist() {
    document.querySelectorAll('input[name="manutChecklistOleo"], input[name="manutChecklistPagou"], input[name="manutChecklistMecanico"]').forEach((r) => {
      r.checked = false;
    });
    const od = document.getElementById("manutChecklistOdometro");
    const px = document.getElementById("manutChecklistProximaTroca");
    if (od) od.value = "";
    if (px) px.value = "";
    ITENS.forEach((_, i) => {
      const n = i + 1;
      document.querySelectorAll(`input[name="manutChecklistItem${n}"]`).forEach((r) => {
        r.checked = false;
      });
      const o = document.getElementById(`manutChecklistObs${n}`);
      if (o) o.value = "";
    });
    limparAssinatura("manutChecklistAssinaturaCliente");
    limparAssinatura("manutChecklistAssinaturaSupervisor");
    const msg = document.getElementById("manutChecklistMsg");
    if (msg) msg.textContent = "";
  }

  function esconderChecklist() {
    const sec = document.getElementById("operacaoLancManutencaoChecklistPanel");
    if (!sec) return;
    sec.classList.add("hidden");
    sec.setAttribute("hidden", "");
  }

  function refreshChecklist() {
    const sec = document.getElementById("operacaoLancManutencaoChecklistPanel");
    if (!sec) return;
    const ctx = getContexto();
    const visivel = Boolean(ctx.nc) && ctx.cpf.length === 11;
    if (!visivel) {
      esconderChecklist();
      return;
    }
    const protocoloAnterior = sec.dataset.dkProtocolo || "";
    if (protocoloAnterior !== ctx.nc) {
      limparFormChecklist();
      sec.dataset.dkProtocolo = ctx.nc;
    }
    sec.classList.remove("hidden");
    sec.removeAttribute("hidden");
  }

  /* ---------------- bind ---------------- */

  function bindOnce() {
    if (window.__dkManutChecklistBound) return;
    window.__dkManutChecklistBound = true;

    const detalheWrap = document.getElementById("manutChecklistDetalheWrap");
    if (detalheWrap) detalheWrap.innerHTML = buildDetalheHtml();

    document.getElementById("manutChecklistDetalharBtn")?.addEventListener("click", () => {
      const wrap = document.getElementById("manutChecklistDetalheWrap");
      const btn = document.getElementById("manutChecklistDetalharBtn");
      if (!wrap) return;
      const abrir = wrap.classList.contains("hidden");
      wrap.classList.toggle("hidden", !abrir);
      if (abrir) wrap.removeAttribute("hidden");
      else wrap.setAttribute("hidden", "");
      btn?.setAttribute("aria-expanded", abrir ? "true" : "false");
    });

    document.getElementById("manutChecklistOdometro")?.addEventListener("input", () => {
      const od = document.getElementById("manutChecklistOdometro");
      const px = document.getElementById("manutChecklistProximaTroca");
      if (!od || !px) return;
      const n = parseInt(onlyDigits(od.value), 10);
      px.value = Number.isFinite(n) && n >= 0 ? String(n + 1000) : "";
    });

    bindAssinatura("manutChecklistAssinaturaCliente");
    bindAssinatura("manutChecklistAssinaturaSupervisor");
    document.querySelectorAll("[data-manut-assinatura-limpar]").forEach((btn) => {
      btn.addEventListener("click", () => limparAssinatura(btn.getAttribute("data-manut-assinatura-limpar")));
    });

    document.getElementById("manutChecklistGerarPdfBtn")?.addEventListener("click", gerarPdf);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindOnce, { once: true });
  } else {
    bindOnce();
  }

  window.__DK_refreshLancManutencaoChecklist = refreshChecklist;
  window.__DK_hideLancManutencaoChecklist = esconderChecklist;
  window.__DK_buildManutChecklistPrintHtml = buildChecklistPrintHtml;
})();
