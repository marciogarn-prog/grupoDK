/**
 * Valida na produção o vínculo protocolo ↔ CPF (2026010101 José, 2026010102 Marcus).
 * node grupodkempreendimentos/scripts/test-protocolo-2026010102-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const SNAPSHOT_URL = `${BASE}api/dk-cloud-snapshot`;
const OWNER_SENHA = process.env.DK_OWNER_SENHA || "110499@Gb";
const OWNER_CPF = "03037897430";

const EXPECT = {
  "2026010101": { cpf: "19174403400", nomeIncludes: "JOSÉ" },
  "2026010102": { cpf: "06523244440", nomeIncludes: "MARCUS" },
};

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function normProto(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function testCloudSnapshot() {
  const res = await fetch(SNAPSHOT_URL);
  const data = await res.json().catch(() => ({}));
  record("API snapshot responde ok", res.ok && data?.ok !== false, `status=${res.status}`);
  const locs = Array.isArray(data?.payload?.dk_locacoes_cadastro)
    ? data.payload.dk_locacoes_cadastro
    : [];
  const clientes = Array.isArray(data?.payload?.dk_clientes_cadastro)
    ? data.payload.dk_clientes_cadastro
    : [];
  const comprovantes = Array.isArray(data?.payload?.dk_comprovantes_cliente_pendentes)
    ? data.payload.dk_comprovantes_cliente_pendentes
    : [];

  for (const [proto, exp] of Object.entries(EXPECT)) {
    const hits = locs.filter((l) => normProto(l.numeroContrato) === proto);
    record(`nuvem: existe locação ${proto}`, hits.length >= 1, `n=${hits.length}`);
    const loc = hits[0];
    if (loc) {
      record(
        `nuvem: ${proto} CPF correto`,
        onlyDigits(loc.cpf).slice(0, 11) === exp.cpf,
        `cpf=${onlyDigits(loc.cpf)} esperado=${exp.cpf}`
      );
      record(
        `nuvem: ${proto} nome coerente`,
        String(loc.nome || "")
          .toUpperCase()
          .includes(exp.nomeIncludes),
        loc.nome || "—"
      );
      const wrongCpf = hits.filter((l) => onlyDigits(l.cpf).slice(0, 11) !== exp.cpf);
      record(`nuvem: ${proto} sem locação com CPF errado`, wrongCpf.length === 0);
    }

    const cli = clientes.find((c) => onlyDigits(c.cpf).slice(0, 11) === exp.cpf);
    record(`nuvem: cadastro cliente ${exp.cpf}`, Boolean(cli), cli?.nome || "ausente");

    const ccProto = comprovantes.filter((r) => normProto(r.protocolo) === proto);
    if (ccProto.length) {
      const cpfs = [...new Set(ccProto.map((r) => onlyDigits(r.cpf).slice(0, 11)))];
      record(
        `nuvem: comprovantes ${proto} só CPF ${exp.cpf}`,
        cpfs.length === 1 && cpfs[0] === exp.cpf,
        `cpfs=${cpfs.join(",")}`
      );
    } else {
      record(`nuvem: comprovantes ${proto} (opcional)`, true, "nenhum na nuvem");
    }
  }

  const joseOn102 = locs.some(
    (l) =>
      normProto(l.numeroContrato) === "2026010102" &&
      onlyDigits(l.cpf).slice(0, 11) === "19174403400"
  );
  record("nuvem: José NÃO está no 2026010102", !joseOn102);
}

async function loginOwner(page) {
  await page.goto(`${BASE}#locadora/empresa/administrador`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1200);
  await page.locator("#login-cpf").fill(OWNER_CPF);
  await page.locator("#login-senha").fill(OWNER_SENHA);
  await page.locator("#form-login button[type=submit]").click();
  await page.waitForSelector("#panel-logado:not(.hidden)", { timeout: 20000 });
}

async function testPortalAfterCloudPull(page) {
  await page.evaluate(async () => {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
      await window.__DK_pullCloudSnapshotSilentMerge();
    }
  });
  await page.waitForTimeout(4000);

  const ls = await page.evaluate(() => {
    const norm = (s) =>
      String(s ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const dig = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 11);
    let locs = [];
    try {
      locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
    } catch {
      locs = [];
    }
    const out = {};
    for (const proto of ["2026010101", "2026010102"]) {
      const hit = locs.filter((l) => norm(l.numeroContrato) === proto);
      out[proto] = hit.map((l) => ({ cpf: dig(l.cpf), nome: l.nome, placa: l.placa }));
    }
    return out;
  });

  for (const [proto, exp] of Object.entries(EXPECT)) {
    const rows = ls[proto] || [];
    record(`portal LS: locação ${proto} presente`, rows.length >= 1, JSON.stringify(rows));
    const row = rows[0];
    if (row) {
      record(`portal LS: ${proto} CPF`, row.cpf === exp.cpf, row.cpf);
      record(
        `portal LS: ${proto} nome`,
        String(row.nome || "")
          .toUpperCase()
          .includes(exp.nomeIncludes),
        row.nome
      );
    }
  }

  await page.locator("text=Operação").first().click();
  await page.waitForTimeout(600);
  await page.locator("text=Cadastro de locação").first().click();
  await page.waitForTimeout(800);

  const cpfMarcus = "06523244440";
  const cpfJose = "19174403400";
  const cpfIn = page.locator("#operacaoLocacaoCpf");
  await cpfIn.waitFor({ state: "visible", timeout: 10000 });

  for (const [label, cpf, proto] of [
    ["Marcus", cpfMarcus, "2026010102"],
    ["José", cpfJose, "2026010101"],
  ]) {
    await cpfIn.fill(cpf);
    await cpfIn.dispatchEvent("input", { bubbles: true });
    await cpfIn.dispatchEvent("change", { bubbles: true });
    await page.waitForTimeout(1200);

    const picker = await page.evaluate((expectedProto) => {
      const norm = (s) =>
        String(s ?? "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
      const opts = sel
        ? Array.from(sel.options).map((o) => ({
            value: norm(o.value),
            label: String(o.textContent || "").trim(),
          }))
        : [];
      return { disabled: Boolean(sel?.disabled), opts };
    }, proto);

    record(
      `portal picker (${label}): select ativo`,
      !picker.disabled,
      picker.disabled ? "desabilitado" : "ok"
    );
    record(
      `portal picker (${label}): lista ${proto}`,
      picker.opts.some((o) => o.value === proto),
      picker.opts.map((o) => o.value).filter(Boolean).join(", ") || "—"
    );
  }
}

async function main() {
  await testCloudSnapshot();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await loginOwner(page);
    record("portal: login administrador", true);
    await testPortalAfterCloudPull(page);
  } catch (e) {
    record("portal: fluxo completo", false, e.message || String(e));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} testes passaram (${BASE}) ---`);
  if (failed.length) {
    console.log("Falhas:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
