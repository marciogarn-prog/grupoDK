const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../portal-locadora-ui.js");
let s = fs.readFileSync(file, "utf8");

const needle =
  "panel.innerHTML = `<div class=\"portal-placa-dropdown__empty\">Nenhum veículo livre: sem contrato ativo nesta placa (sem protocolo em curso no cadastro ou na Receita 2026). Cadastre o veículo ou finalize a locação aberta.</motion>`;";

const replacement = `const totalLivre = portalLocacaoPlacasLivresCache.length;
    const qPlate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(queryRaw || ""))
        : String(queryRaw || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    if (!items.length) {
      let msg;
      if (totalLivre === 0) {
        if (typeof seedVeiculosDatabaseIfNeeded === "function") seedVeiculosDatabaseIfNeeded();
        const nCad =
          typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined"
            ? loadCadastro(CAD_VEICULOS_KEY).filter((v) => {
                const pl =
                  typeof normalizePlate === "function"
                    ? normalizePlate(v.placa)
                    : String(v.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                return pl.length >= 7;
              }).length
            : 0;
        msg = !nCad
          ? "Não há veículos neste navegador. Use Cadastro de veículo ou Carregar da nuvem / importar backup."
          : \`Há \${nCad} veículo(s) cadastrado(s), mas nenhum está livre (locação ativa ou manutenção). Finalize a locação aberta na placa.\`;
      } else if (qPlate.length >= 3) {
        msg = \`A placa \${qPlate} não está entre as \${totalLivre} livre(s). Apague o campo e clique de novo para ver a lista.\`;
      } else {
        msg = \`\${totalLivre} veículo(s) livre(s): apague o filtro e abra a lista novamente.\`;
      }
      panel.innerHTML = \`<div class="portal-placa-dropdown__empty">\${msg}</div>\`;`;

// Fix: needle should end with </div> not </motion>
const needle2 =
  'panel.innerHTML = `<div class="portal-placa-dropdown__empty">Nenhum veículo livre: sem contrato ativo nesta placa (sem protocolo em curso no cadastro ou na Receita 2026). Cadastre o veículo ou finalize a locação aberta.</div>`;';

if (!s.includes(needle2)) {
  console.error("needle not found");
  process.exit(1);
}

const blockOld = `    const items = filterPlacasLivresForDropdown(queryRaw);
    if (!items.length) {
      ${needle2}`;
const blockNew = `    const items = filterPlacasLivresForDropdown(queryRaw);
    ${replacement}
    } else if (false) {
      ${needle2}`;

// Simpler: replace needle2 only with logic that includes if (!items.length)
const insertBefore = "    const items = filterPlacasLivresForDropdown(queryRaw);\n    if (!items.length) {\n      " + needle2;

const insertAfter = `    const items = filterPlacasLivresForDropdown(queryRaw);
    const totalLivre = portalLocacaoPlacasLivresCache.length;
    const qPlate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(queryRaw || ""))
        : String(queryRaw || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    if (!items.length) {
      let msg;
      if (totalLivre === 0) {
        if (typeof seedVeiculosDatabaseIfNeeded === "function") seedVeiculosDatabaseIfNeeded();
        const nCad =
          typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined"
            ? loadCadastro(CAD_VEICULOS_KEY).filter((v) => {
                const pl =
                  typeof normalizePlate === "function"
                    ? normalizePlate(v.placa)
                    : String(v.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                return pl.length >= 7;
              }).length
            : 0;
        msg = !nCad
          ? "Não há veículos neste navegador. Use Cadastro de veículo ou Carregar da nuvem / importar backup."
          : \`Há \${nCad} veículo(s) cadastrado(s), mas nenhum está livre (locação ativa ou manutenção). Finalize a locação aberta na placa.\`;
      } else if (qPlate.length >= 3) {
        msg = \`A placa \${qPlate} não está entre as \${totalLivre} livre(s). Apague o campo e clique de novo para ver a lista.\`;
      } else {
        msg = \`\${totalLivre} veículo(s) livre(s): apague o filtro e abra a lista novamente.\`;
      }
      panel.innerHTML = \`<div class="portal-placa-dropdown__empty">\${msg}</motion>\`;`;

if (!s.includes(insertBefore)) {
  console.error("block not found");
  process.exit(1);
}

s = s.replace(insertBefore, insertAfter.replace(/<motion /g, "<div ").replace(/<\/motion>/g, "</motion>"));

// fix locacao button - sync datalists
s = s.replace(
  `    syncOperacaoLocacaoValorPlano();
    portalRefreshOperacaoDeferred(["locacao"]);`,
  `    syncOperacaoLocacaoValorPlano();
    refreshOperacaoLocacaoDatalists();`
);

// placa focus - clear example placeholder
const focusOld = `    inpPlaca?.addEventListener("focus", () => {
      refreshOperacaoLocacaoDatalists();
      renderOperacaoLocacaoPlacaDropdown(String(inpPlaca.value || ""));
    });`;

const focusNew = `    inpPlaca?.addEventListener("focus", () => {
      refreshOperacaoLocacaoDatalists();
      const val = String(inpPlaca.value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (val === "ABC1D23" && !portalLocacaoPlacasLivresCache.some((x) => x.placa === val)) {
        inpPlaca.value = "";
      }
      renderOperacaoLocacaoPlacaDropdown(String(inpPlaca.value || ""));
    });`;

if (s.includes(focusOld)) s = s.replace(focusOld, focusNew);

fs.writeFileSync(file, s);
console.log("patched ok");
