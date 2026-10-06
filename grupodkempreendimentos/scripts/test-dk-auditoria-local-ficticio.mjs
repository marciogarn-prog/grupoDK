/**
 * Teste da auditoria local com dados fictícios.
 * Não abre o portal, não lê o perfil do navegador e não chama Redis nem Supabase.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..");
const nucleo = require(path.join(raiz, "dk-auditoria-local-nucleo.js"));

const SENHA = "FICTICIO-SENHA-9f3a";
const ACCESS = "FICTICIO-ACCESS-TOKEN-9f3a";
const REFRESH = "FICTICIO-REFRESH-TOKEN-9f3a";
const JWT = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmaWN0aWNpbyJ9.FICTICIOASSINATURA";
const NAO_DK = "COR-FICTICIA-NAO-DK";
const UI = "COR-UI-NAO-DK";
const CLIENTE = "Cliente Ficticio Auditoria";
const PROTOCOLO = "2099010199";
const SEGREDOS = [SENHA, ACCESS, REFRESH, JWT];

function falha(msg) {
  console.error("FALHOU: " + msg);
  process.exitCode = 1;
}

const html = fs.readFileSync(path.join(raiz, "dk-auditoria-local.html"), "utf8");
const js = fs.readFileSync(path.join(raiz, "dk-auditoria-local-nucleo.js"), "utf8");
const scripts = html.split("<script").slice(1).map(function (p) { return p.split("</script>")[0]; }).join("\n");
const proibidos = [
  ["fetch(", "fetch"],
  ["XMLHttpRequest", "XMLHttpRequest"],
  ["WebSocket", "WebSocket"],
  ["sendBeacon", "sendBeacon"],
  ["localStorage.setItem", "localStorage.setItem"],
  ["sessionStorage.setItem", "gravação de sessionStorage"],
  ["sessionStorage.removeItem", "remoção de sessionStorage"],
  ["sessionStorage.clear", "limpeza de sessionStorage"],
  ["postMessage", "cópia entre abas"],
  ["window.open", "nova janela"],
  ["readwrite", "transação de escrita"],
  ["create: true", "OPFS create"],
  ["create:true", "OPFS create"],
  ["createWritable", "OPFS escrita"],
  ["getFileHandle", "criação de arquivo OPFS"],
  ["deleteDatabase", "apagar IndexedDB"],
  ["caches.delete", "apagar cache"],
  ["supabase", "SDK Supabase"]
];
proibidos.forEach(function (par) {
  if (scripts.indexOf(par[0]) >= 0) falha("a página de auditoria contém " + par[1]);
});
["fetch(", "new XMLHttpRequest", "new WebSocket", "sendBeacon(", "localStorage.setItem", ".readwrite", "createWritable(", "deleteDatabase(", "caches.delete("].forEach(function (trecho) {
  if (js.indexOf(trecho) >= 0) falha("o núcleo contém " + trecho);
});
if (js.indexOf("sessionStorage.getItem") >= 0 || js.indexOf("sessionStorage.key") >= 0 || js.indexOf("sessionStorage.setItem") >= 0) {
  falha("o núcleo acessa sessionStorage; a leitura fica só na página");
}
if (scripts.indexOf("sessionStorage.getItem") < 0 && scripts.indexOf(".getItem") < 0) {
  falha("a página não lê o sessionStorage da aba atual");
}
if (scripts.indexOf("sessionStorage") < 0) falha("a página não enumera o sessionStorage");
if (scripts.indexOf("indexedDB.open") < 0 || scripts.indexOf("onupgradeneeded") < 0 || scripts.indexOf("transaction.abort") < 0) {
  falha("a abertura do IndexedDB não cancela criação de banco");
}
if (scripts.indexOf('"readonly"') < 0) falha("IndexedDB não está em somente leitura");
if (scripts.indexOf("caches.keys") < 0) falha("a página não lista caches existentes");

const coleta = {
  computador: "DK-PC-TESTE-FICTICIO",
  geradoEm: "2026-10-06T12:00:00.000Z",
  origem: "http://ficticio.local",
  navegador: "teste-ficticio",
  localStorage: [
    {
      nome: "dk_clientes_cadastro",
      valor: JSON.stringify([{ nome: CLIENTE, cpf: "00000000000", senha: SENHA }])
    },
    {
      nome: "dk_locacoes_cadastro",
      valor: JSON.stringify([{
        numeroContrato: PROTOCOLO,
        nome: CLIENTE,
        cpf: "00000000000",
        placa: "AAA0A00",
        portalLancamentosAluguel: []
      }])
    },
    {
      nome: "operacao_clientes_ficticios",
      valor: JSON.stringify([{ nome: CLIENTE, cpf: "00000000000", numeroContrato: PROTOCOLO }])
    },
    { nome: "access_token_ficticio", valor: ACCESS },
    { nome: "refresh_token_ficticio", valor: REFRESH },
    { nome: "jwt_ficticio", valor: JWT },
    { nome: "senha_avulsa_ficticia", valor: SENHA },
    { nome: "preferencia_tema_ficticia", valor: NAO_DK }
  ],
  sessionStorage: [
    {
      nome: "dk_operacao_offline_pending",
      valor: JSON.stringify([{ protocolo: PROTOCOLO, pendente: true, nome: CLIENTE }])
    },
    { nome: "dk_operacao_offline_mode", valor: "modo-ficticio-offline" },
    { nome: "teste_sessao_dk", valor: "SESSAO-FICTICIA-VISIVEL" },
    { nome: "teste_access_token", valor: ACCESS },
    { nome: "teste_refresh_token", valor: REFRESH },
    { nome: "teste_senha_ficticia", valor: SENHA },
    { nome: "teste_jwt_ficticio", valor: JWT },
    { nome: "preferencia_aba_ficticia", valor: "COR-SESSAO-NAO-DK" }
  ],
  indexedDB: {
    listagemDisponivel: true,
    bancos: [
      {
        banco: "fila_offline_ficticia",
        versao: 1,
        stores: [{
          store: "fila",
          registros: [{
            id: "fila-ficticia-1",
            pendente: true,
            protocolo: PROTOCOLO,
            nome: CLIENTE,
            access_token: ACCESS
          }]
        }]
      },
      {
        banco: "preferencias_ui_ficticias",
        versao: 1,
        stores: [{ store: "ui", registros: [{ tema: UI }] }]
      }
    ]
  },
  opfs: { disponivel: true, itens: [] },
  caches: {
    disponivel: true,
    caches: [{
      cache: "dk-corporativo-teste",
      itens: [
        {
          url: "https://grupodkempreendimentos.com.br/dk-auditoria-local",
          status: 200,
          contentType: "text/html",
          body: new TextEncoder().encode("PAGINA-AUDITORIA-FICTICIA-NAO-NEGOCIO")
        },
        {
          url: "https://grupodkempreendimentos.com.br/app.js",
          status: 200,
          contentType: "text/javascript",
          body: new TextEncoder().encode("CODIGO-ASSET-FICTICIO")
        },
        {
          url: "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot",
          status: 200,
          contentType: "application/json",
          body: new TextEncoder().encode(JSON.stringify({ nome: CLIENTE, access_token: ACCESS }))
        }
      ]
    }]
  }
};

const pacote = await nucleo.montarPacote(coleta);
const chaves = pacote.manifesto.localStorage.chaves;
const semDk = chaves.find(function (c) { return c.nome === "operacao_clientes_ficticios"; });
if (!semDk || semDk.classificacao !== "relacionada" || !semDk.arquivo) {
  falha("chave sem dk no nome não foi classificada como relacionada: " + JSON.stringify(semDk));
}
const tema = chaves.find(function (c) { return c.nome === "preferencia_tema_ficticia"; });
if (!tema || tema.classificacao !== "nao relacionada" || tema.arquivo) {
  falha("chave não relacionada entrou no bruto");
}
if (chaves.length !== 8) falha("nem todas as chaves de localStorage foram inventariadas");

const bancoFila = pacote.manifesto.indexedDB.bancos.find(function (b) { return b.banco === "fila_offline_ficticia"; });
const bancoUi = pacote.manifesto.indexedDB.bancos.find(function (b) { return b.banco === "preferencias_ui_ficticias"; });
if (!bancoFila || bancoFila.classificacao !== "relacionada") falha("IndexedDB sem dk no nome não foi classificado");
if (!bancoUi || bancoUi.classificacao !== "nao relacionada") falha("IndexedDB não relacionado foi classificado como DK");
if (JSON.stringify(bancoUi).indexOf(UI) >= 0) falha("conteúdo não relacionado do IndexedDB entrou no manifesto");

const sessao = pacote.manifesto.sessionStorage;
if (!sessao || sessao.status !== "capturado" || sessao.contexto !== "mesma_aba_mesma_origem" || sessao.quantidade_chaves !== 8) {
  falha("sessionStorage não foi capturado no formato esperado: " + JSON.stringify(sessao && { status: sessao.status, contexto: sessao.contexto, quantidade_chaves: sessao.quantidade_chaves }));
}
const sessaoVisivel = sessao.chaves.find(function (c) { return c.nome === "teste_sessao_dk"; });
if (!sessaoVisivel || sessaoVisivel.classificacao !== "relacionada" || !sessaoVisivel.arquivo) {
  falha("dado normal de sessionStorage não entrou no pacote");
}
const sessaoToken = sessao.chaves.find(function (c) { return c.nome === "teste_access_token"; });
if (!sessaoToken || !sessaoToken.credencial_detectada || sessaoToken.arquivo) {
  falha("access token de sessionStorage foi exportado");
}
const sessaoFora = sessao.chaves.find(function (c) { return c.nome === "preferencia_aba_ficticia"; });
if (!sessaoFora || sessaoFora.classificacao !== "nao relacionada" || sessaoFora.arquivo) {
  falha("chave de sessão não relacionada entrou no bruto");
}

const cache = pacote.manifesto.cache.caches[0];
if (!cache || cache.quantidade !== 3) falha("cache não listou as três entradas");
const classes = cache.itens.map(function (i) { return i.classe; }).sort().join(",");
if (classes !== "codigo-ou-asset,pagina-de-auditoria,possivel-dado-de-negocio") {
  falha("classificação do cache inesperada: " + classes);
}
if (!pacote.manifesto.cache.efeitoServiceWorker) falha("efeito do service worker não documentado");

if (!pacote.manifesto.credenciais.length) falha("nenhuma credencial registrada");
pacote.manifesto.credenciais.forEach(function (c) {
  if (c.valor !== "[REDACTED]" || c.credencial_detectada !== true || c.rotacao_recomendada !== true) {
    falha("ficha de credencial fora do formato");
  }
  if (SEGREDOS.some(function (s) { return JSON.stringify(c).indexOf(s) >= 0; })) {
    falha("ficha de credencial contém o valor original");
  }
});

const pasta = "dk-audit-DK-PC-TESTE-FICTICIO-2026-10-06T12-00-00-000Z";
const nomes = pacote.arquivos.map(function (a) { return pasta + "/" + a.name; });
const dados = pacote.arquivos.map(function (a) { return a.data; });
nomes.push(pasta + "/RELATORIO.md");
dados.push(new TextEncoder().encode(pacote.relatorio));
nomes.push(pasta + "/manifesto.json");
dados.push(new TextEncoder().encode(JSON.stringify(pacote.manifesto, null, 2)));
const blob = nucleo.zipStore(nomes.map(function (nome, idx) { return { name: nome, data: dados[idx] }; }));
const zip = Buffer.from(await blob.arrayBuffer());
if (zip[0] !== 0x50 || zip[1] !== 0x4b) falha("ZIP inválido");
const textoZip = zip.toString("latin1");

SEGREDOS.forEach(function (s) {
  if (textoZip.indexOf(s) >= 0) falha("segredo presente no ZIP: " + s.slice(0, 12) + "…");
});
if (textoZip.indexOf(NAO_DK) >= 0) falha("conteúdo não relacionado de localStorage entrou no ZIP");
if (textoZip.indexOf(UI) >= 0) falha("conteúdo não relacionado de IndexedDB entrou no ZIP");
if (textoZip.indexOf("PAGINA-AUDITORIA-FICTICIA-NAO-NEGOCIO") >= 0) falha("HTML da auditoria entrou no bruto");
if (textoZip.indexOf("CODIGO-ASSET-FICTICIO") >= 0) falha("asset completo entrou no bruto");
if (textoZip.indexOf(CLIENTE) < 0) falha("cliente fictício não entrou no pacote");
if (textoZip.indexOf(PROTOCOLO) < 0) falha("locação fictícia não entrou no pacote");
if (textoZip.indexOf("fila-ficticia-1") < 0) falha("fila offline fictícia não entrou no pacote");
if (textoZip.indexOf("[REDACTED]") < 0) falha("redação ausente");
if (textoZip.indexOf("capturado") < 0 || textoZip.indexOf("mesma_aba_mesma_origem") < 0) falha("status do sessionStorage ausente");
if (textoZip.indexOf("SESSAO-FICTICIA-VISIVEL") < 0) falha("sessão normal não entrou no ZIP");
if (textoZip.indexOf("modo-ficticio-offline") < 0) falha("modo offline fictício não entrou no ZIP");
if (textoZip.indexOf("COR-SESSAO-NAO-DK") >= 0) falha("conteúdo de sessão não relacionado entrou no ZIP");
if (textoZip.indexOf("operacao_clientes_ficticios") < 0) falha("chave sem dk ausente do inventário");

if (process.exitCode) {
  console.error("teste fictício reprovou");
} else {
  console.log("teste fictício ok");
  console.log("credenciais redigidas: " + pacote.manifesto.credenciais.length);
  console.log("arquivos no bruto: " + pacote.arquivos.length);
  console.log("zip bytes: " + zip.length);
}
