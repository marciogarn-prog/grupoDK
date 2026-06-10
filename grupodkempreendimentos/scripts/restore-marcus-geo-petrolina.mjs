/**
 * Restaura posição GPS do Marcus (06523244440) em Petrolina-PE — último acesso real do cliente.
 * Executar antes do deploy que exige source=cliente_app na API.
 */
const BASE = process.env.DK_BASE_URL || "https://grupodkempreendimentos.com.br";
const CPF = "06523244440";

/** Centro Petrolina-PE (último acesso conhecido do cliente, não Recife/admin). */
const PETROLINA = { lat: -9.3953, lng: -40.5009, accuracy: 45 };
/** 06/06/2026 ~18:00 BRT — anterior à corrupção pelo admin (~22:39). */
const TS = new Date("2026-06-06T18:00:00-03:00").getTime();

const body = {
  cpf: CPF,
  nome: "MARCUS VINICIUS SIQUEIRA DOS SANTOS",
  placa: "BBB0B00",
  protocolo: "2026010102",
  ...PETROLINA,
  ts: TS,
};

const res = await fetch(`${BASE}/api/dk-cliente-geo`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const data = await res.json().catch(() => ({}));
console.log(res.status, JSON.stringify(data, null, 2));

const check = await fetch(`${BASE}/api/dk-cliente-geo`, { cache: "no-store" }).then((r) => r.json());
const marcus = (check.clientes || []).find((c) => c.cpf === CPF);
console.log("Marcus após restore:", marcus ? `${marcus.lat}, ${marcus.lng} @ ${new Date(marcus.ts).toLocaleString("pt-BR")}` : "(não encontrado)");
process.exit(res.ok && data.ok !== false ? 0 : 1);
