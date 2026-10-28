/**
 * Coordenação na aba: uma leitura de fundo de cada tipo, e a lista ou o detalhe passam à frente.
 * Não grava nada. Não cria fila. O tick que chega ocupado é ignorado.
 */
(function dkBgRead(raiz) {
  const alvo = raiz || (typeof window !== "undefined" ? window : {});
  const state = {
    interactiveReads: 0,
    relogioInFlight: false,
    snapshotRevisionInFlight: false,
    snapshotPullInFlight: false,
  };
  alvo.__DK_BG_READ_STATE = state;

  function interativa() {
    return state.interactiveReads > 0;
  }

  alvo.__DK_bgInterativaEntrar = function () {
    state.interactiveReads += 1;
  };
  alvo.__DK_bgInterativaSair = function () {
    if (state.interactiveReads > 0) state.interactiveReads -= 1;
  };
  alvo.__DK_bgLeituraInterativa = function () {
    return state.interactiveReads > 0;
  };
  alvo.__DK_bgTentarRelogio = function () {
    if (interativa() || state.relogioInFlight) return false;
    state.relogioInFlight = true;
    return true;
  };
  alvo.__DK_bgSoltarRelogio = function () {
    state.relogioInFlight = false;
  };
  alvo.__DK_bgTentarRevisao = function () {
    if (interativa() || state.snapshotRevisionInFlight) return false;
    state.snapshotRevisionInFlight = true;
    return true;
  };
  alvo.__DK_bgSoltarRevisao = function () {
    state.snapshotRevisionInFlight = false;
  };
  alvo.__DK_bgTentarPull = function () {
    if (interativa() || state.snapshotPullInFlight) return false;
    state.snapshotPullInFlight = true;
    return true;
  };
  alvo.__DK_bgSoltarPull = function () {
    state.snapshotPullInFlight = false;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = alvo;
  }
})(typeof window !== "undefined" ? window : {});
