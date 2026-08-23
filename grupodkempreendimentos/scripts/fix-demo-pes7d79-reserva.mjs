/**
 * Demo: corrige PES7D79 (→ 4 Pronto) e AAA0A01 (→ 5.2 Pátio); remove 5.1 órfão.
 * node grupodkempreendimentos/scripts/fix-demo-pes7d79-reserva.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const PLACA_LOCADA = "PES7D79";
const PLACA_RESERVA = "AAA0A01";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => null));

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin Demo" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);

  const resultado = await page.evaluate(
    async ({ placaLocada, placaReserva }) => {
      const nk = (p) =>
        String(p || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      const locada = nk(placaLocada);
      const reserva = nk(placaReserva);
      const hoje =
        typeof todayBrDate === "function"
          ? todayBrDate()
          : new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const patchVeiculo = (placa, patch) => {
        const keys = [];
        if (typeof CAD_VEICULOS_KEY !== "undefined") keys.push(CAD_VEICULOS_KEY);
        if (typeof PORTAL_VEICULOS_KEY !== "undefined") keys.push(PORTAL_VEICULOS_KEY);
        if (typeof FROTA_VEICULOS_KEY !== "undefined") keys.push(FROTA_VEICULOS_KEY);
        let found = false;
        keys.forEach((key) => {
          const list = loadCadastro(key);
          const idx = list.findIndex((v) => nk(v.placa) === placa);
          if (idx < 0) return;
          found = true;
          list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
          saveCadastro(key, list, { bypassImmutabilidadeCadastro: true });
        });
        return found;
      };

      /* Manutenção: garantir saída (sem registo ativo). */
      if (typeof CAD_MANUTENCOES_KEY !== "undefined") {
        const manut = loadCadastro(CAD_MANUTENCOES_KEY);
        let manutChanged = false;
        const nextManut = manut.map((m) => {
          if (nk(m.placa) !== locada) return m;
          if (String(m.dataRealSaida || "").trim()) return m;
          manutChanged = true;
          return {
            ...m,
            dataRealSaida: hoje,
            destinoPortal: "pronto-para-alugar",
            origemPortalChecklistLiberacao: true,
          };
        });
        if (manutChanged) saveCadastro(CAD_MANUTENCOES_KEY, nextManut);
      }

      /* Locações: encerrar contrato na placa reparada e limpar vínculo reserva. */
      if (typeof CAD_LOCACOES_KEY !== "undefined") {
        const locs = loadCadastro(CAD_LOCACOES_KEY);
        let locChanged = false;
        const nextLocs = locs.map((loc) => {
          const placa = nk(loc.placa);
          const fim = String(loc.fim || loc.dataFim || "").trim();
          const ativa = !fim || fim === "...";
          if (!ativa) return loc;
          const vincReserva = nk(loc.placaReserva);
          const encerra =
            placa === locada ||
            (placa === reserva && nk(loc.placaLocadaOriginal) === locada) ||
            (placa === locada && vincReserva === reserva);
          if (!encerra) return loc;
          locChanged = true;
          return {
            ...loc,
            fim: hoje,
            dataFim: hoje,
            placaReserva: "",
            reservaNaoDisponibilizada: false,
            updatedAt: Date.now(),
          };
        });
        if (locChanged) saveCadastro(CAD_LOCACOES_KEY, nextLocs, { bypassImmutabilidadeCadastro: true });
      }

      const okLocada = patchVeiculo(locada, {
        disponivelCategoria: "prontos",
        categoriaDisponivel: "prontos",
        planoUltimaLocacao: "minha-moto",
      });
      const okReserva = patchVeiculo(reserva, {
        disponivelCategoria: "reserva-patio",
        categoriaDisponivel: "reserva-patio",
      });

      if (typeof refreshOperacaoVeiculoPlacasCache === "function") {
        try {
          refreshOperacaoVeiculoPlacasCache();
        } catch {
          /* ignore */
        }
      }

      const estLocada =
        typeof portalResolverEstadoExclusivoPlaca === "function"
          ? portalResolverEstadoExclusivoPlaca(locada)
          : null;
      const estReserva =
        typeof portalResolverEstadoExclusivoPlaca === "function"
          ? portalResolverEstadoExclusivoPlaca(reserva)
          : null;
      const cob =
        typeof portalResolverCoberturaReservaOperacao === "function"
          ? portalResolverCoberturaReservaOperacao(reserva)
          : null;

      let pushOk = false;
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        const r = await window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => null);
        pushOk = Boolean(r?.ok ?? r);
      }

      return {
        okLocada,
        okReserva,
        estLocada: estLocada?.label || "",
        estReserva: estReserva?.label || "",
        cobertura51: cob?.placaLocada || "",
        pushOk,
      };
    },
    { placaLocada: PLACA_LOCADA, placaReserva: PLACA_RESERVA }
  );

  console.log("Correção demo:", JSON.stringify(resultado, null, 2));

  const ok =
    resultado.okLocada &&
    resultado.okReserva &&
    /4.*Pronto|DISPONÍVEIS.*4/i.test(resultado.estLocada) &&
    /5\.2|pátio|patio/i.test(resultado.estReserva) &&
    !resultado.cobertura51;

  if (!ok) {
    console.error("Verificação falhou — estado ainda inconsistente.");
    process.exit(1);
  }
  console.log("OK — PES7D79 em 4 Pronto; AAA0A01 em 5.2; 5.1 sem cobertura.");
} catch (e) {
  console.error("Erro:", e?.message || e);
  process.exit(1);
} finally {
  await browser.close();
}
