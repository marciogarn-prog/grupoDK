import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const integrity = require(path.join(root, "lib", "dk-locacoes-integrity.cjs"));
const audit = require(path.join(root, "lib", "dk-locacoes-integrity-audit.cjs"));
const snapshotApi = fs.readFileSync(path.join(root, "api", "dk-cloud-snapshot.js"), "utf8");
const locacoesApi = fs.readFileSync(path.join(root, "api", "cadastro-locacoes.js"), "utf8");
const portalUi = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const syncJs = fs.readFileSync(path.join(root, "portal-supabase-sync.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cron = fs.readFileSync(path.join(root, "api", "cron-daily-backup.js"), "utf8");

const ativa = (protocolo, placa, nome = "Cliente") => ({
  numeroContrato: protocolo,
  placa,
  nome,
  inicio: "01/09/2026",
  fim: "",
  statusLocacao: "ATIVO",
});

const conflito = integrity.findActivePlateConflicts([
  ativa("2026090101", "ABC1D23", "A"),
  ativa("2026090201", "ABC1D23", "B"),
]);
assert.equal(conflito.length, 1);
assert.equal(conflito[0].placa, "ABC1D23");
assert.deepEqual(conflito[0].contratos.map((x) => x.protocolo), ["2026090101", "2026090201"]);

assert.equal(
  integrity.findActivePlateConflicts([
    ativa("2026090101", "ABC1D23"),
    { ...ativa("2026090201", "ABC1D23"), fim: "03/09/2026", statusLocacao: "FINALIZADO" },
    { ...ativa("2026090301", "ABC1D23"), contratoCancelado: true, statusLocacao: "CANCELADO" },
  ]).length,
  0
);
assert.equal(
  integrity.findActivePlateConflicts([
    ativa("2026090101", "ABC1D23"),
    { ...ativa("2026090101", "ABC1D23"), updatedAt: 2 },
  ]).length,
  0
);
assert.equal(
  integrity.canonicalLocacoesDigest([ativa("2026090101", "AAA1A11"), ativa("2026090201", "BBB2B22")]),
  integrity.canonicalLocacoesDigest([ativa("2026090201", "BBB2B22"), ativa("2026090101", "AAA1A11")])
);

class FakeRedisLock {
  constructor() {
    this.values = new Map();
  }
  async set(key, value, opts) {
    if (opts?.nx && this.values.has(key)) return null;
    this.values.set(key, value);
    return "OK";
  }
  async get(key) {
    return this.values.get(key) || null;
  }
  async del(key) {
    return this.values.delete(key) ? 1 : 0;
  }
}

const fakeRedis = new FakeRedisLock();
const concurrentLocks = await Promise.all([
  integrity.acquireLocacoesWriteLock(fakeRedis, { attempts: 1 }),
  integrity.acquireLocacoesWriteLock(fakeRedis, { attempts: 1 }),
]);
assert.equal(concurrentLocks.filter(Boolean).length, 1, "duas gravações não podem adquirir o mesmo lock");
await integrity.releaseLocacoesWriteLock(fakeRedis, concurrentLocks.find(Boolean));
assert.ok(
  await integrity.acquireLocacoesWriteLock(fakeRedis, { attempts: 1 }),
  "o lock deve ser liberado depois da gravação"
);

const pagamento = (id, data = "09/09/2026", valor = 330) => ({
  protocoloLancamento: id,
  data,
  valor,
  createdAt: Number(id.replace(/\D/g, "").slice(0, 13)) || Date.now(),
});
const locPagamentoBase = {
  numeroContrato: "2026090203",
  portalLancamentosAluguel: [pagamento("20260909154418-057")],
};
const locPagamentoDuplicado = {
  ...locPagamentoBase,
  portalLancamentosAluguel: [
    ...locPagamentoBase.portalLancamentosAluguel,
    pagamento("20260911095314-057"),
  ],
};
assert.equal(integrity.findDuplicatePaymentsByProtocol([locPagamentoBase]).length, 0);
assert.equal(integrity.findNewDuplicatePayments([locPagamentoBase], [locPagamentoDuplicado]).length, 1);
assert.equal(
  integrity.findNewDuplicatePayments([locPagamentoDuplicado], [locPagamentoDuplicado]).length,
  0,
  "duplicidade histórica inalterada não deve bloquear outras gravações"
);

const locAluguelMaisCaucao = {
  ...locPagamentoBase,
  portalLancamentosAluguel: [
    ...locPagamentoBase.portalLancamentosAluguel,
    {
      ...locPagamentoBase.portalLancamentosAluguel[0],
      protocoloLancamento: "20260909154419-057",
      tipoMovimento: "CAUCAO",
      createdAt: Number(locPagamentoBase.portalLancamentosAluguel[0].createdAt) + 1,
    },
  ],
};
assert.equal(
  integrity.findDuplicatePaymentsByProtocol([locAluguelMaisCaucao]).length,
  0,
  "caução com o mesmo valor do aluguel no mesmo dia não é duplicidade"
);

const redisLoc = {
  numeroContrato: "2026102101",
  placa: "ABC1D23",
  updatedAt: 100,
  portalLancamentosAluguel: [{ data: "21/10/2026", valor: 10, createdAt: 100 }],
};
const mirrorLoc = {
  numeroContrato: "2026102101",
  placa: "ABC1D23",
  updatedAt: 50,
  portalLancamentosAluguel: [{ data: "21/10/2026", valor: 375, createdAt: 500 }],
};
const merged = audit.mergeLocacoesPorAtualidade([redisLoc], [mirrorLoc]);
assert.equal(merged.length, 1);
assert.equal(merged[0].portalLancamentosAluguel[0].valor, 375);
const empate = audit.mergeLocacoesPorAtualidade(
  [{ numeroContrato: "2026102102", placa: "XYZ1A23", updatedAt: 10, origem: "redis" }],
  [{ numeroContrato: "2026102102", placa: "XYZ1A23", updatedAt: 10, origem: "espelho" }]
);
assert.equal(empate[0].origem, "redis");

const mergeCadastro = require(path.join(root, "lib", "dk-append-only-merge.cjs"));
const criadoEm = Date.parse("2026-08-24T12:57:51Z");
const apagadoEm = Date.parse("2026-10-21T12:20:00Z");
const pagamento6650 = {
  data: "24/08/2026",
  valor: 6650,
  createdAt: criadoEm,
  protocoloLancamento: "20260824095751-098",
  registradoPorCpf: "11111111111",
};
const comApagado = mergeCadastro.mergeLocacoesCadastro(
  [
    {
      numeroContrato: "2026040802",
      cpf: "11111111111",
      placa: "UHN2G97",
      updatedAt: criadoEm,
      portalLancamentosAluguel: [pagamento6650],
    },
  ],
  [
    {
      numeroContrato: "2026040802",
      cpf: "11111111111",
      placa: "UHN2G97",
      updatedAt: apagadoEm,
      portalLancamentosAluguel: [],
      portalLancamentosAluguelRemovidos: [{ ...pagamento6650, removedAt: apagadoEm }],
    },
  ]
);
assert.equal(comApagado[0].portalLancamentosAluguel.length, 0);
const editadoDepois = mergeCadastro.filtrarPortalLancamentosPorRemovidos(
  [{ ...pagamento6650, updatedAt: apagadoEm + 60000 }],
  [{ ...pagamento6650, removedAt: apagadoEm }]
);
assert.equal(editadoDepois.length, 1);
const parecido = mergeCadastro.filtrarPortalLancamentosPorRemovidos(
  [{ data: "24/08/2026", valor: 6650, createdAt: criadoEm, protocoloLancamento: "20260824095751-099" }],
  [{ data: "24/08/2026", valor: 6650, createdAt: criadoEm, removedAt: apagadoEm }]
);
assert.equal(parecido.length, 0);

const pacotes = require(path.join(root, "lib", "dk-pacotes.cjs"));
const unido = pacotes.fundirPacoteDia(
  {
    dk_locacoes_cadastro: [
      {
        numeroContrato: "2026040802",
        cpf: "75020840459",
        placa: "UHN2G97",
        updatedAt: criadoEm,
        portalLancamentosAluguel: [pagamento6650],
      },
    ],
  },
  "2026-10-21",
  {
    dk_locacoes_cadastro: [
      {
        numeroContrato: "2026040802",
        cpf: "75020840459",
        placa: "UHN2G97",
        updatedAt: Date.parse("2026-10-21T12:51:00Z"),
        portalLancamentosAluguel: [
          {
            protocoloLancamento: "20261021101010-001",
            data: "21/10/2026",
            valor: 320,
            createdAt: Date.parse("2026-10-21T12:51:00Z"),
          },
        ],
      },
    ],
  }
);
assert.equal(unido.dk_locacoes_cadastro[0].portalLancamentosAluguel.length, 2);
const semelhante = mergeCadastro.mergeLocacoesCadastro(
  [
    {
      numeroContrato: "2026040802",
      cpf: "75020840459",
      updatedAt: 1,
      portalLancamentosAluguel: [
        { data: "21/10/2026", valor: 320, createdAt: 1000, protocoloLancamento: "20261021095000-001" },
      ],
    },
  ],
  [
    {
      numeroContrato: "2026040802",
      cpf: "75020840459",
      updatedAt: 2,
      portalLancamentosAluguel: [
        {
          data: "21/10/2026",
          valor: 320,
          createdAt: 2000,
          updatedAt: 2000,
          protocoloLancamento: "20261021095100-002",
        },
      ],
    },
  ]
);
assert.equal(semelhante[0].portalLancamentosAluguel.length, 1);
assert.equal(semelhante[0].portalLancamentosAluguel[0].protocoloLancamento, "20261021095100-002");

const checks = [
  ["API antiga lê a fonte canônica", locacoesApi.includes("CANONICAL_SNAPSHOT_KEY") && locacoesApi.includes('canonical: "dk-cloud-snapshot/default"')],
  ["API antiga recusa escrita paralela", locacoesApi.includes('reason: "canonical_snapshot_only"') && !locacoesApi.includes("mergeLocacoesCadastro(existing")],
  ["portal não lê nem escreve mais cadastro-locacoes", !portalUi.includes('dkPortalPushToApi("cadastro-locacoes"') && !portalUi.includes('dkPortalPullOne("cadastro-locacoes"')],
  ["wrapper preserva allowShrink da fonte canônica", portalUi.includes("function dkPortalSaveCadastroWrapped(key, list, opts)") && portalUi.includes("origSave(key, list, opts)")],
  ["snapshot usa lock distribuído", snapshotApi.includes("acquireLocacoesWriteLock(redis)") && snapshotApi.includes("releaseLocacoesWriteLock(redis, locacoesLockToken)")],
  ["duas gravações concorrentes não atravessam o lock", concurrentLocks.filter(Boolean).length === 1],
  ["snapshot rejeita placa ativa duplicada", snapshotApi.includes('reason: "active_plate_conflict"') && snapshotApi.includes("findActivePlateConflicts(payload.dk_locacoes_cadastro)")],
  ["snapshot rejeita novo pagamento duplicado", snapshotApi.includes('reason: "duplicate_payment_same_day_value"') && snapshotApi.includes("findNewDuplicatePayments(")],
  ["pull oficial substitui locações pela fonte canônica", syncJs.includes("o snapshot/default é a fonte canônica") && syncJs.includes("allowShrink: true")],
  ["detecção de pull compara cópia canônica exata", appJs.includes("locações são cópia exata da fonte canônica") && syncJs.includes('hasOwnProperty.call(cloudPayload, "dk_locacoes_cadastro")')],
  ["alerta automático existe no banner", html.includes('id="portalLocacoesIntegridadeAlerta"') && syncJs.includes("refreshLocacoesIntegrityAlert")],
  ["auditoria roda diariamente com o backup", cron.includes("runLocacoesIntegrityAudit") && cron.includes("locacoesIntegrity.ok === true")],
  ["auditoria alinha Redis e Supabase quando o conteúdo diverge", fs.readFileSync(path.join(root, "lib", "dk-locacoes-integrity-audit.cjs"), "utf8").includes("gravarLocacoesAlinhadas")],
  ["cache de integridade atualizado", /portal-supabase-sync\.js\?v=[^"'<>]+/.test(html) && /portal-locadora-ui\.js\?v=[^"'<>]+/.test(html)],
  ["troca de tela compara o ID data/hora e baixa o cadastro inteiro", syncJs.includes("dk_sync_revisao_pagamentos_v1") && syncJs.includes("completo: true")],
  ["locação grava no Redis quando o Supabase não responde", snapshotApi.includes("gravarLocSoRedis")],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FALHOU"} — ${label}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
else console.log(`Integridade de locações no servidor: ${checks.length}/${checks.length}`);
