/**
 * Cód. do cliente editável para o titular (CPF 03037897430).
 * Ficheiro separado para resistir a cache parcial do portal-locadora-ui.js.
 */
(function portalClienteCodigoAdminUnlock() {
  const ADMIN_CPF = "03037897430";

  function cpfSessaoDigits() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return "";
      const s = JSON.parse(raw);
      return String(s.cpf || "")
        .replace(/\D/g, "")
        .slice(0, 11);
    } catch {
      return "";
    }
  }

  function adminPodeEditarCodigo() {
    return cpfSessaoDigits() === ADMIN_CPF;
  }

  function unlockClienteCodigoField() {
    if (!adminPodeEditarCodigo()) return false;
    const el = document.getElementById("operacaoClienteCodigo");
    if (!el) return false;
    el.readOnly = false;
    el.disabled = false;
    el.removeAttribute("readonly");
    el.placeholder = "Ex.: CLIENTE 42";
    el.classList.remove("portal-input-immutable");
    el.setAttribute("aria-readonly", "false");
    return true;
  }

  function bindClienteCodigoUnlockHooks() {
    unlockClienteCodigoField();

    const panel = document.getElementById("operacaoInlineCliente");
    if (panel && !panel.__dkCodigoUnlockObs) {
      panel.__dkCodigoUnlockObs = new MutationObserver(() => unlockClienteCodigoField());
      panel.__dkCodigoUnlockObs.observe(panel, { attributes: true, attributeFilter: ["class"] });
    }

    const el = document.getElementById("operacaoClienteCodigo");
    if (el && !el.__dkCodigoUnlockBound) {
      el.__dkCodigoUnlockBound = true;
      ["focus", "click", "mousedown"].forEach((ev) => el.addEventListener(ev, unlockClienteCodigoField));
    }
  }

  document.addEventListener("DOMContentLoaded", bindClienteCodigoUnlockHooks);
  window.addEventListener("pageshow", bindClienteCodigoUnlockHooks);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") bindClienteCodigoUnlockHooks();
  });
  document.addEventListener(
    "click",
    (e) => {
      if (
        e.target.closest(
          "#btn-operacao-cadastro-cliente,#btn-locadora-operacao,#operacaoInlineCliente,#operacaoClienteCodigo"
        )
      ) {
        setTimeout(bindClienteCodigoUnlockHooks, 0);
        setTimeout(bindClienteCodigoUnlockHooks, 250);
      }
    },
    true
  );

  window.__DK_unlockClienteCodigoAdmin = unlockClienteCodigoField;
  window.__DK_adminPodeEditarCodigoCliente = adminPodeEditarCodigo;
})();
