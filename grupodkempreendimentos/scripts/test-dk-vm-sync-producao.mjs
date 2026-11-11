/**
 * Gate de produção: só declara sucesso se o cluster estiver alinhado
 * e o login-espelhar devolver o espelho com manutenção coerente.
 * Exit 1 = NÃO contar como sync OK.
 */
const BASE = (process.env.DK_TEST_BASE_URL || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);

function assert(cond, msg, detail) {
  const d = detail == null ? "" : String(detail).slice(0, 240);
  if (!cond) {
    console.error("FAIL |", msg, d);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log("PASS |", msg, d);
}

const login = await fetch(BASE + "api/dk-portal-auth", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-DK-Client-Protocol": "20260913",
    "X-DK-User-Active": "1",
  },
  body: JSON.stringify({
    tipo: "equipa",
    cpf: "03037897430",
    senha: process.env.DK_OWNER_SENHA || "12345678",
    confirmarUnico: true,
    deviceId: "dk-vm-sync-prod-gate",
  }),
}).then((r) => r.json());

assert(Boolean(login.token), "login CEO produção", JSON.stringify(login).slice(0, 200));

const h = {
  Authorization: "Bearer " + login.token,
  "X-DK-Portal-Token": login.token,
  "X-DK-Client-Protocol": "20260913",
  "X-DK-User-Active": "1",
  "Content-Type": "application/json",
};

const conf = await fetch(BASE + "api/dk-maquina-virtual", {
  method: "POST",
  headers: h,
  body: JSON.stringify({ acao: "conferir" }),
}).then(async (r) => ({ status: r.status, j: await r.json() }));

assert(conf.status === 200 && conf.j.ok === true, "conferir HTTP ok", `status=${conf.status}`);
assert(conf.j.alinhadas === true, "todas as VMs alinhadas", `div=${JSON.stringify(conf.j.divergencias || [])}`);
assert(Number(conf.j.total) >= 2, "há pelo menos 2 VMs no cluster", `total=${conf.j.total}`);
assert(
  Number(conf.j.resumo?.manutencoesAtivas || 0) >= 1,
  "cluster tem manutenções activas",
  `ativas=${conf.j.resumo?.manutencoesAtivas}`
);

const oficinaAntes = Number(conf.j.resumo?.oficinaPropriaAtivas || conf.j.resumo?.manutencoesAtivas || 0);

const esp = await fetch(BASE + "api/dk-maquina-virtual", {
  method: "POST",
  headers: h,
  body: JSON.stringify({
    acao: "login-espelhar",
    cpf: "03037897430",
    nome: "Marcio Santos",
    role: "administrador",
    deviceId: "dk-vm-sync-prod-gate",
    estado: {
      dk_manutencoes_cadastro: [
        {
          id: "probe-nao-deve-encolher",
          placa: "ZZZ9Z99",
          categoriaManutencao: "oficina-propria",
          dataRealSaida: "01/01/2020",
          updatedAt: 1,
        },
      ],
    },
  }),
}).then(async (r) => ({ status: r.status, j: await r.json() }));

assert(esp.status === 200 && esp.j.ok === true, "login-espelhar HTTP ok", `status=${esp.status} err=${esp.j.error || esp.j.reason || ""}`);
assert(esp.j.alinhadas === true, "cluster alinhado após login-espelhar");
assert(Array.isArray(esp.j.estado?.dk_manutencoes_cadastro), "estado espelhado traz manutenções");

const man = esp.j.estado.dk_manutencoes_cadastro;
const oficina = man.filter(
  (m) =>
    !String(m?.dataRealSaida || "").trim() &&
    /oficina.?propria/i.test(String(m?.categoriaManutencao || m?.categoria || ""))
);
assert(
  oficina.length >= Math.max(1, oficinaAntes - 5),
  "espelho não encolheu a oficina própria",
  `antes≈${oficinaAntes} depois=${oficina.length}`
);
assert(
  Number(esp.j.resumo?.manutencoesAtivas || 0) >= 1,
  "resumo do espelho tem activas",
  `ativas=${esp.j.resumo?.manutencoesAtivas}`
);

const conf2 = await fetch(BASE + "api/dk-maquina-virtual", {
  method: "POST",
  headers: h,
  body: JSON.stringify({ acao: "conferir" }),
}).then(async (r) => ({ status: r.status, j: await r.json() }));
assert(conf2.j.alinhadas === true, "continua alinhado após espelho");

const html = await fetch(BASE + "?nocache=" + Date.now(), { cache: "no-store" }).then((r) => r.text());
assert(/portal-maquina-virtual\.js\?v=/.test(html), "HTML serve portal-maquina-virtual com cache-bust");

if (process.exitCode) {
  console.error("\n--- GATE PRODUÇÃO VM: FALHOU — não declarar sucesso ---");
  process.exit(1);
}
console.log("\n--- GATE PRODUÇÃO VM: OK ---");
console.log(
  JSON.stringify(
    {
      totalVms: conf.j.total,
      seq: esp.j.seq,
      manutencoesAtivas: esp.j.resumo?.manutencoesAtivas,
      oficinaPropria: oficina.length,
    },
    null,
    2
  )
);
