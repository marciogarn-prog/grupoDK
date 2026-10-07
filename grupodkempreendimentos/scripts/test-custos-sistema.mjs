import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { calcularCustos, anotarRedis, anotarSupabase } = require("../lib/dk-custos-sistema.cjs");

const GB = 1024 ** 3;
let failed = 0;
function rec(name, ok, detail) {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const base = calcularCustos({}, {});
rec("mês zerado cobra os planos", base.totalUsd === 45, String(base.totalUsd));
rec("redis grátis no zero", base.itens.find((i) => i.id === "redis").usd === 0);
rec("github zero", base.itens.find((i) => i.id === "github").usd === 0);
rec("total em real", base.totalBrl === 243, String(base.totalBrl));

const pouco = calcularCustos(
  { redis_comandos: 1000, redis_bytes: 1024 * 1024, redis_armazenamento: 1024 * 1024 },
  {}
);
rec("redis dentro da franquia", pouco.itens.find((i) => i.id === "redis").modo === "gratis");

const cheio = calcularCustos({ redis_comandos: 600000, redis_armazenamento: 2 * GB, redis_bytes: 201 * GB }, {});
const redis = cheio.itens.find((i) => i.id === "redis");
rec(
  "redis acima da franquia",
  redis.modo === "payg" && redis.usd === 1.48,
  String(redis.usd)
);

const supa = calcularCustos({ supabase_bytes: 251 * GB, supabase_pedidos: 3 }, {});
rec("supabase cobra 1 GB extra", supa.itens.find((i) => i.id === "supabase").usoUsd === 0.09);

const ver = calcularCustos({ vercel_invocacoes: 2000000, vercel_bytes: 1024 * GB + 2 * GB }, {});
const vercel = ver.itens.find((i) => i.id === "vercel");
rec("vercel cobra milhão extra e 2 GB", vercel.usoUsd === 0.9, String(vercel.usoUsd));

const git = calcularCustos({}, { planoGithubUsd: 4, cambioBrl: 5 });
rec("github segue o plano", git.itens.find((i) => i.id === "github").usd === 4);
rec("câmbio editável", git.cambioBrl === 5);

anotarRedis(["dk:portal:cloud_snapshot:v1", "abc"], null);
anotarSupabase({ a: 1 });
rec("anotar fora de um pedido não quebra", true);

console.log(failed ? `FAIL ${failed}` : "OK custos do sistema");
process.exit(failed ? 1 : 0);
