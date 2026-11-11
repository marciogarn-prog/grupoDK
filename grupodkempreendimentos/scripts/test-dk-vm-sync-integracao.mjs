/**
 * Prova de sincronismo VM↔VM e VM↔PC (sem rede).
 * Falha = NÃO publicar / NÃO declarar sucesso.
 *
 * Cenário do titular: máquina A com 1 moto, B com 23 → após sync ambas = união (23).
 * Pingue-pongue 1↔23 é regressão fatal.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const core = require("../lib/dk-vm-sync-core.cjs");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL |", msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log("PASS |", msg);
}

function placa(i) {
  return `PLT${String(i).padStart(4, "0")}`;
}

function estadoOficina(placas, updatedAtBase = 1000) {
  return {
    dk_manutencoes_cadastro: placas.map((pl, i) => ({
      id: `m-${pl}`,
      placa: pl,
      categoriaManutencao: "oficina-propria",
      updatedAt: updatedAtBase + i,
    })),
    dk_clientes_cadastro: [],
    dk_veiculos_cadastro: [],
  };
}

const CPF_A = "11111111111";
const CPF_B = "22222222222";

const placas23 = Array.from({ length: 23 }, (_, i) => placa(i + 1));
const estadoB = estadoOficina(placas23, 2000);
const estadoA = estadoOficina([placas23[15]], 3000); /* 1 placa, updatedAt mais novo */

/* --- União pura --- */
{
  const u = core.unirDoisEstados(estadoA, estadoB);
  assert(core.placasOficinaAtivas(u).length === 23, "união A(1)+B(23) = 23 placas oficina");
  const u2 = core.unirDoisEstados(estadoB, estadoA);
  assert(core.placasOficinaAtivas(u2).length === 23, "união B(23)+A(1) = 23 (ordem irrelevante)");
}

/* --- Pingue-pongue proibido: A sincroniza primeiro (incompleto), depois B --- */
{
  let vms = {
    [CPF_A]: {},
    [CPF_B]: estadoB,
  };
  /* A sobe com 1 placa — não pode apagar as 23 da B */
  let r = core.cicloSyncPcComCluster(vms, CPF_A, estadoA);
  vms = r.vms;
  assert(
    core.placasOficinaAtivas(r.cluster).length === 23,
    "após sync do PC incompleto o cluster mantém 23"
  );
  assert(
    core.placasOficinaAtivas(vms[CPF_B]).length === 23,
    "VM B não pode cair para 1 quando A salva"
  );

  /* B sobe com 23 — cluster permanece 23; A ao espelhar recebe 23 */
  r = core.cicloSyncPcComCluster(vms, CPF_B, estadoB);
  vms = r.vms;
  assert(core.placasOficinaAtivas(r.cluster).length === 23, "após sync B cluster = 23");
  assert(core.placasOficinaAtivas(vms[CPF_A]).length === 23, "VM A espelha 23 após sync B");

  /* Login na máquina A (tinha 1 local) → PC espelhado tem 23 */
  const loginA = core.cicloSyncPcComCluster(vms, CPF_A, estadoA);
  assert(
    core.placasOficinaAtivas(loginA.pc).length === 23,
    "login na máquina A (local=1) espelha 23 da VM"
  );
  assert(
    core.resumosIguais(core.resumirEstado(loginA.pc), core.resumirEstado(loginA.cluster)),
    "resumo do PC A igual ao cluster após login"
  );
}

/* --- Ordem invertida: B primeiro, A depois --- */
{
  let vms = { [CPF_A]: estadoA, [CPF_B]: {} };
  let r = core.cicloSyncPcComCluster(vms, CPF_B, estadoB);
  vms = r.vms;
  assert(core.placasOficinaAtivas(r.cluster).length === 23, "B primeiro → cluster 23");
  r = core.cicloSyncPcComCluster(vms, CPF_A, estadoA);
  assert(core.placasOficinaAtivas(r.cluster).length === 23, "A depois não reduz para 1");
  assert(core.placasOficinaAtivas(r.pc).length === 23, "PC A após sync tem 23");
}

/* --- aplicarEstadoVmNoPc: cloud=1, local=23 → união 23 --- */
{
  const pc = core.aplicarEstadoVmNoPc(estadoB, estadoA);
  assert(
    core.placasOficinaAtivas(pc).length === 23,
    "aplicar VM incompleta no PC rico não apaga placas"
  );
}

/* --- Fingerprint: duas VMs com o mesmo cluster são iguais --- */
{
  const cluster = core.unirCluster([estadoA, estadoB]);
  const ra = core.resumirEstado(cluster);
  const rb = core.resumirEstado({ ...cluster });
  assert(core.resumosIguais(ra, rb), "fingerprints idênticos no cluster gémeo");
  assert(ra.oficinaPropriaAtivas === 23, "resumo.oficinaPropriaAtivas = 23");
}

if (process.exitCode) {
  console.error("\n--- FALHA: sincronismo VM NÃO comprovado ---");
  process.exit(1);
}
console.log("\n--- 11/11 provas sync VM integração OK ---");
