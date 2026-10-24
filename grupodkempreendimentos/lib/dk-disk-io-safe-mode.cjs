/**
 * Modo seguro manual do Disk IO.
 * Só fica ativo com DK_DISK_IO_SAFE_MODE exatamente igual a "1".
 * Não se desliga sozinho. Sai somente quando a variável for removida ou deixar de ser "1".
 * Não apaga dados e não muda o snapshot só por estar ligado.
 */

function diskIoSafeModeAtivo() {
  return String(process.env.DK_DISK_IO_SAFE_MODE || "") === "1";
}

function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === "object") {
    const out = {};
    for (const chave of Object.keys(valor).sort()) {
      const item = canonico(valor[chave]);
      if (item !== undefined) out[chave] = item;
    }
    return out;
  }
  return valor;
}

function manutencaoSemAlteracaoReal(base, incoming, merge) {
  if (typeof merge !== "function") return false;
  const anterior = Array.isArray(base) ? base : [];
  let merged;
  try {
    merged = merge(anterior, Array.isArray(incoming) ? incoming : []);
  } catch {
    return false;
  }
  if (!Array.isArray(merged)) return false;
  try {
    return JSON.stringify(canonico(anterior)) === JSON.stringify(canonico(merged));
  } catch {
    return false;
  }
}

function devePularGravacaoManutencaoAutomatica({ safeMode, automatico, base, incoming, merge }) {
  if (safeMode !== true || automatico !== true) return false;
  return manutencaoSemAlteracaoReal(base, incoming, merge);
}

module.exports = {
  diskIoSafeModeAtivo,
  canonico,
  manutencaoSemAlteracaoReal,
  devePularGravacaoManutencaoAutomatica,
};
