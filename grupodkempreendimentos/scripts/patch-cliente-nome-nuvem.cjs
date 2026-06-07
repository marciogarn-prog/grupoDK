/**
 * Atualiza nome de cliente no snapshot Supabase (dk_cloud_snapshots).
 * Uso: node scripts/patch-cliente-nome-nuvem.cjs --cpf 00000000004 --nome "TESTE 04"
 */
const SUPABASE_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nm-Et1yeL66vgoA2rqD__w_CLtGauk3";
const LABEL = "default";
const CAD_KEY = "dk_clientes_cadastro";

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { cpf: "", codigo: "", nome: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cpf" && args[i + 1]) out.cpf = onlyDigits(args[++i]);
    else if (args[i] === "--codigo" && args[i + 1]) out.codigo = String(args[++i]).trim();
    else if (args[i] === "--nome" && args[i + 1]) out.nome = String(args[++i]).trim();
  }
  return out;
}

async function supabaseFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(typeof data === "object" && data?.message ? data.message : text || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function main() {
  const { cpf, codigo, nome } = parseArgs();
  if (!nome) {
    console.error("Informe --nome");
    process.exit(1);
  }
  if (!cpf && !codigo) {
    console.error("Informe --cpf ou --codigo");
    process.exit(1);
  }

  const rows = await supabaseFetch(
    `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}&select=id,label,payload,updated_at`
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.payload) {
    console.error("Snapshot na nuvem não encontrado (label=default).");
    process.exit(1);
  }

  const payload = row.payload;
  let clientes = payload[CAD_KEY];
  if (!Array.isArray(clientes)) {
    console.error("dk_clientes_cadastro ausente ou inválido no snapshot.");
    process.exit(1);
  }

  const normCodigo = (c) =>
    String(c || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  const targetCodigo = codigo ? normCodigo(codigo) : "";
  const targetCpf = cpf;

  let hits = 0;
  clientes = clientes.map((c) => {
    const matchCpf = targetCpf && onlyDigits(c.cpf) === targetCpf;
    const matchCodigo = targetCodigo && normCodigo(c.codigo) === targetCodigo;
    if (!matchCpf && !matchCodigo) return c;
    hits += 1;
    const prev = String(c.nome || "").trim();
    console.log(`Atualizar: ${c.codigo || "?"} | CPF ${c.cpf} | "${prev}" → "${nome}"`);
    return { ...c, nome };
  });

  if (hits === 0) {
    console.error("Nenhum cliente encontrado com os critérios informados.");
    process.exit(1);
  }

  payload[CAD_KEY] = clientes;
  const updated = {
    label: LABEL,
    payload,
    updated_at: new Date().toISOString(),
  };

  const patched = await supabaseFetch(
    `dk_cloud_snapshots?label=eq.${encodeURIComponent(LABEL)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ payload, updated_at: updated.updated_at }),
    }
  );
  if (!Array.isArray(patched) || !patched.length) {
    console.error("PATCH não atualizou nenhuma linha (label=default).");
    process.exit(1);
  }

  console.log(`OK: ${hits} registo(s) atualizado(s) na nuvem. No site use «Carregar da nuvem» ou F5.`);
}

main().catch((e) => {
  console.error(e.message || e);
  if (e.data) console.error(e.data);
  process.exit(1);
});
