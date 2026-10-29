/**
 * Lista leve e detalhe de uma locação. Sem cutover e sem a lista pesada.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pg = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "../lib/dk-locacao-pg.cjs"));

const PROIBIDOS = [
  "portalLancamentosAluguel",
  "portalLancamentosAluguelRemovidos",
  "campos",
  "documentos",
  "anexos",
];

function temProibido(obj) {
  const texto = JSON.stringify(obj);
  return PROIBIDOS.some((chave) => texto.includes(`"${chave}"`));
}

async function main() {
  let chamadas = 0;
  const desligado = await pg.listarResumo("", {
    flag: "snapshot",
    rest: async () => {
      chamadas += 1;
      return { ok: true, data: [] };
    },
  });
  assert.strictEqual(chamadas, 0);
  assert.strictEqual(desligado.ativado, false);
  assert.deepStrictEqual(desligado.locacoes, []);

  const resumo = await pg.listarResumo("", {
    flag: "dk_locacao",
    rest: async (pedido) => {
      const texto = String(pedido || "");
      assert.ok(texto.includes("marca_modelo"));
      assert.ok(texto.includes("valor_locacao"));
      assert.ok(texto.includes("inicio"));
      assert.equal(texto.includes("portalLancamentosAluguel"), false);
      return {
      ok: true,
      data: [
        {
          numero_contrato: "2026102701",
          cpf: "90000000175",
          placa: "AAA1A11",
          status_locacao: "ATIVO",
          nome: "CURSOR1",
          contrato_cancelado: false,
          fim: null,
          data_fim: null,
          data_finalizacao: null,
          dt_fim: null,
          finalizado_em_ms: null,
          status_json: "ATIVO",
          inicio: "27/10/2026",
          marca_modelo: "HONDA / CG 160 START",
          valor_locacao: "R$ 270,00",
          valor_investimento: "R$ 0,00",
          valor_semanal: "R$ 270,00",
          plano: "DK MEU TRANSPORTE (MOTO)",
          modalidade: "MOTO",
          dia_pagto: "segunda-feira",
          km_inicial: "41",
          cliente_codigo: "0108",
          finalizado_por_nome: "",
          executado_por_nome: "OPERADOR",
          executado_em_ms: "1790000000000",
        },
        {
          numero_contrato: "2025111403",
          cpf: "11111111111",
          placa: "XYZ1B23",
          status_locacao: "FINALIZADO",
          nome: "CLIENTE HISTORICO",
          contrato_cancelado: false,
          fim: "01/01/2026",
          data_fim: null,
          data_finalizacao: null,
          dt_fim: null,
          finalizado_em_ms: null,
          status_json: "FINALIZADO",
        },
      ],
    };
    },
  });
  assert.strictEqual(resumo.ok, true);
  assert.strictEqual(resumo.source, "dk_locacao");
  assert.strictEqual(resumo.quantidade, 2);
  assert.strictEqual(resumo.fallback, false);
  assert.strictEqual(temProibido(resumo), false);
  assert.strictEqual(resumo.locacoes[0].numeroContrato, "2026102701");
  assert.strictEqual(resumo.locacoes[0].marcaModelo, "HONDA / CG 160 START");
  assert.strictEqual(resumo.locacoes[0].valorLocacao, "R$ 270,00");
  assert.strictEqual(resumo.locacoes[0].valorSemanal, "R$ 270,00");
  assert.strictEqual(resumo.locacoes[0].inicio, "27/10/2026");
  assert.strictEqual(resumo.locacoes[0].plano, "DK MEU TRANSPORTE (MOTO)");
  assert.strictEqual(resumo.locacoes[1].fim, "01/01/2026");
  assert.strictEqual(resumo.locacoes[1].marcaModelo, "");
  assert.strictEqual(resumo.locacoes[1].valorLocacao, "");

  const falha = await pg.listarResumo("", {
    flag: "dk_locacao",
    rest: async () => ({ ok: false, status: 504, data: { reason: "supabase_timeout" } }),
  });
  assert.strictEqual(falha.ok, false);
  assert.strictEqual(falha.reason, "leitura");
  assert.strictEqual(falha.fallback, false);
  assert.deepStrictEqual(falha.locacoes, []);

  const semContrato = await pg.lerDetalhe("", { flag: "dk_locacao", rest: async () => ({ ok: true, data: [] }) });
  assert.strictEqual(semContrato.status, 400);
  assert.strictEqual(semContrato.reason, "contrato_obrigatorio");

  const detalhe = await pg.lerDetalhe("2025111403", {
    flag: "dk_locacao",
    rest: async (path) => {
      assert.ok(String(path).includes("numero_contrato=eq.2025111403"));
      assert.ok(String(path).includes("limit=1"));
      return {
        ok: true,
        data: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            numero_contrato: "2025111403",
            cpf: "11111111111",
            placa: "XYZ1B23",
            status_locacao: "FINALIZADO",
            version: 1,
            campos: {
              numeroContrato: "2025111403",
              portalLancamentosAluguel: new Array(23).fill({ protocoloLancamento: "x" }),
              portalLancamentosAluguelRemovidos: new Array(3).fill({ protocoloLancamento: "y" }),
            },
          },
        ],
      };
    },
  });
  assert.strictEqual(detalhe.ok, true);
  assert.strictEqual(detalhe.quantidade, 1);
  assert.strictEqual(detalhe.locacao.portalLancamentosAluguel.length, 23);
  assert.strictEqual(detalhe.locacao.portalLancamentosAluguelRemovidos.length, 3);
  assert.strictEqual(detalhe.fallback, false);

  const falhaDetalhe = await pg.lerDetalhe("2025111403", {
    flag: "dk_locacao",
    rest: async () => ({ ok: false, status: 504, data: { reason: "supabase_timeout" } }),
  });
  assert.strictEqual(falhaDetalhe.ok, false);
  assert.strictEqual(falhaDetalhe.reason, "leitura");
  assert.strictEqual(falhaDetalhe.fallback, false);
  assert.strictEqual(falhaDetalhe.locacao, undefined);

  const lista = resumo.locacoes;
  assert.strictEqual(pg.pesquisarResumo(lista, { protocolo: "2026102701" }).placa, "AAA1A11");
  assert.strictEqual(pg.pesquisarResumo(lista, { protocolo: "2025111403" }).numeroContrato, "2025111403");
  assert.strictEqual(pg.pesquisarResumo(lista, { nome: "cursor" }).numeroContrato, "2026102701");
  assert.strictEqual(pg.pesquisarResumo(lista, { cpf: "11111111111" }).numeroContrato, "2025111403");
  assert.strictEqual(pg.pesquisarResumo(lista, { placa: "XYZ1" }).numeroContrato, "2025111403");
  assert.strictEqual(pg.pesquisarResumo(lista, { placa: "AAA", protocolo: "2025111403" }).numeroContrato, "2026102701");

  const negado = pg.decidirAcessoLocacao({ ok: true, role: "employee", acessos: { locacao: false } });
  assert.strictEqual(negado.status, 403);
  assert.strictEqual(negado.reason, "module_forbidden");

  console.log("lista leve ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
