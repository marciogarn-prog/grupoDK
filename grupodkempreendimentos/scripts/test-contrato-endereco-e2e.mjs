/**
 * E2E: endereço do locatário no HTML do contrato (demo).
 * node grupodkempreendimentos/scripts/test-contrato-endereco-e2e.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF = "11377276406";
const ESPERADO = "RUA M, 71 - N10";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(
    () =>
      typeof window.__DK_resolverEnderecoClienteContrato === "function" &&
      typeof window.__DK_contratoLocacaoBuildHtml === "function"
  );

  await page.waitForFunction(
    () => {
      try {
        const raw = localStorage.getItem("dk_clientes_cadastro");
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) && arr.length > 50;
      } catch {
        return false;
      }
    },
    { timeout: 90000 }
  );

  const diag = await page.evaluate(
    ({ cpf, esperado }) => {
      const d = String(cpf).replace(/\D/g, "");
      const key = "dk_clientes_cadastro";
      let cad = [];
      try {
        cad = JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        cad = [];
      }
      let local = cad.find((c) => String(c.cpf || "").replace(/\D/g, "") === d);
      if (!local) {
        local = {
          cpf: d,
          nome: "MIQUEIAS RODRIGUES MARTINS",
          endereco: "(Endereço do Cliente)",
          municipioUf: "",
          cep: "",
          origemPortal: true,
          id: Date.now(),
        };
        cad.push(local);
        localStorage.setItem(key, JSON.stringify(cad));
      } else {
        local.endereco = "(Endereço do Cliente)";
        localStorage.setItem(key, JSON.stringify(cad));
      }

      document.getElementById("operacaoLocacaoCpf").value = "113.772.764-06";
      document.getElementById("operacaoLocacaoCliente").value = "MIQUEIAS RODRIGUES MARTINS";
      document.getElementById("operacaoLocacaoProtocolo").value = "2026021301";
      document.getElementById("operacaoLocacaoPlaca").value = "ABC1D23";
      document.getElementById("operacaoLocacaoModelo").value = "HONDA CG 160";
      document.getElementById("operacaoLocacaoDataInicio").value = "13/02/2026";
      document.getElementById("operacaoLocacaoTipoPlano").value = "DK MEU TRANSPORTE";
      document.getElementById("operacaoClienteEndereco").value = "RUA M, 71 - N10";
      document.getElementById("operacaoClienteMunicipioUf").value = "PETROLINA/PE";
      document.getElementById("operacaoClienteCep").value = "56.353-700";
      document.getElementById("operacaoClienteCpf").value = "113.772.764-06";

      const banco = window.DK_BANCO_CADASTRO?.clientes?.find((c) => String(c.cpf || "").replace(/\D/g, "") === d);
      const enderecoFn = window.__DK_resolverEnderecoClienteContrato?.(d);
      const dados = window.__DK_contratoLocacaoResolverFromForm?.();
      const html = window.__DK_contratoLocacaoBuildHtml?.(window.__DK_contratoLocacaoResolverFromForm?.());

      return {
        isDemo: window.__DK_IS_DEMO_DEPLOY__ === true,
        bancoClientesLen: window.DK_BANCO_CADASTRO?.clientes?.length || 0,
        bancoEndereco: banco?.endereco || "",
        cadastroLocalLen: cad.length,
        localEnderecoPlaceholder: local?.endereco || "",
        enderecoFn,
        dadosEndereco: dados?.endereco || "",
        htmlTemRua: html.includes(esperado),
        htmlTemPlaceholder:
          html.includes("(Endereço do Cliente)") || html.includes("endereço não cadastrado"),
        htmlSnippet: (html.match(/domiciliado no\(a\)[^<]{0,160}/i) || [""])[0],
      };
    },
    { cpf: CPF, esperado: ESPERADO }
  );

  const congelado = await page.evaluate(({ cpf }) => {
    const d = String(cpf).replace(/\D/g, "");
    const key = "dk_clientes_cadastro";
    let cad = [];
    try {
      cad = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      cad = [];
    }
    let alvo = cad.find((c) => String(c.cpf || "").replace(/\D/g, "") === d);
    if (!alvo) {
      alvo = {
        cpf: d,
        nome: "CLIENTE TESTE ENDERECO",
        endereco: "AV. MANOEL DO ARROZ, 85 - BLOCO 06",
        municipioUf: "PETROLINA/PE",
        cep: "56306385",
        origemPortal: true,
        id: Date.now(),
      };
      cad.push(alvo);
    } else {
      alvo.endereco = "AV. MANOEL DO ARROZ, 85 - BLOCO 06";
      alvo.municipioUf = "PETROLINA/PE";
    }
    localStorage.setItem(key, JSON.stringify(cad));

    document.getElementById("operacaoLocacaoCpf").value = "113.772.764-06";
    document.getElementById("operacaoLocacaoCliente").value = alvo.nome;
    document.getElementById("operacaoLocacaoProtocolo").value = "2026021302";
    document.getElementById("operacaoLocacaoPlaca").value = "ABC1D23";
    document.getElementById("operacaoLocacaoModelo").value = "HONDA CG 160";
    document.getElementById("operacaoLocacaoDataInicio").value = "13/02/2026";
    document.getElementById("operacaoLocacaoTipoPlano").value = "DK MEU TRANSPORTE";
    document.getElementById("operacaoClienteEndereco").value =
      "TRAV. ANTÔNIO LUIZ FERREIRA, 511-A - CENTRO Juazeiro-BA";
    document.getElementById("operacaoClienteMunicipioUf").value = "JUAZEIRO/BA";
    document.getElementById("operacaoClienteCep").value = "48904-570";
    document.getElementById("operacaoClienteCpf").value = "";

    const enderecoFn = window.__DK_resolverEnderecoClienteContrato?.(d);
    const dados = window.__DK_contratoLocacaoResolverFromForm?.();
    return {
      enderecoFn,
      dadosEndereco: dados?.endereco || "",
      usaCadastro: String(enderecoFn || "").includes("MANOEL DO ARROZ"),
      rejeitaCongelado: !String(dados?.endereco || "").includes("ANTÔNIO LUIZ FERREIRA"),
    };
  }, { cpf: CPF });

  console.log(JSON.stringify(diag, null, 2));
  console.log("congelado:", JSON.stringify(congelado, null, 2));

  let ok = true;
  if (diag.isDemo) {
    console.log("PASS | ambiente demo");
  } else {
    console.error("FAIL | não está em demo");
    ok = false;
  }
  if (diag.enderecoFn && diag.enderecoFn.includes(ESPERADO)) {
    console.log(`PASS | resolver = ${diag.enderecoFn}`);
  } else {
    console.error(`FAIL | resolver = ${diag.enderecoFn}`);
    ok = false;
  }
  if (diag.dadosEndereco.includes(ESPERADO)) {
    console.log(`PASS | dados.endereco = ${diag.dadosEndereco}`);
  } else {
    console.error(`FAIL | dados.endereco = ${diag.dadosEndereco}`);
    ok = false;
  }
  if (diag.htmlTemRua && !diag.htmlTemPlaceholder) {
    console.log("PASS | HTML do contrato contém endereço real");
  } else {
    console.error(`FAIL | html snippet: ${diag.htmlSnippet}`);
    ok = false;
  }
  if (congelado.usaCadastro && congelado.rejeitaCongelado) {
    console.log("PASS | ignora endereço congelado e usa cadastro do cliente");
  } else {
    console.error("FAIL | endereço congelado do relatório anterior");
    ok = false;
  }

  console.log(ok ? "CONTRATO ENDERECO E2E OK" : "CONTRATO ENDERECO E2E FAIL");
  process.exit(ok ? 0 : 1);
} finally {
  await browser.close();
}
