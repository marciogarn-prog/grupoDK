/**
 * Horário de acesso do colaborador (cadastro + aviso 30 min antes do fim).
 */
(function dkPortalColabHorario(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.__DK_horarioColabPadrao = api.horarioPadrao;
    root.__DK_colherHorarioColab = api.colherDoForm;
    root.__DK_aplicarHorarioColab = api.aplicarNoForm;
    root.__DK_aplicarHorarioColabPadrao = api.aplicarPadraoNoForm;
    root.__DK_colabHorarioStatus = api.statusHorario;
    root.__DK_iniciarAvisoHorarioFimColab = api.iniciarAvisoFim;
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DIAS = [
    { key: "seg", label: "segunda", ace: "portalColabDiaSeg", ini: "portalColabIniSeg", fim: "portalColabFimSeg" },
    { key: "ter", label: "terça", ace: "portalColabDiaTer", ini: "portalColabIniTer", fim: "portalColabFimTer" },
    { key: "qua", label: "quarta", ace: "portalColabDiaQua", ini: "portalColabIniQua", fim: "portalColabFimQua" },
    { key: "qui", label: "quinta", ace: "portalColabDiaQui", ini: "portalColabIniQui", fim: "portalColabFimQui" },
    { key: "sex", label: "sexta", ace: "portalColabDiaSex", ini: "portalColabIniSex", fim: "portalColabFimSex" },
    { key: "sab", label: "sábado", ace: "portalColabDiaSab", ini: "portalColabIniSab", fim: "portalColabFimSab" },
    { key: "dom", label: "domingo", ace: "portalColabDiaDom", ini: "portalColabIniDom", fim: "portalColabFimDom" },
  ];
  const UTEIS = new Set(["seg", "ter", "qua", "qui", "sex"]);
  const AVISO_TEXTO = "O SISTEMA FICARA INDISPONIVEL EM 30 MINUTOS";
  let avisoTimer = 0;

  function horarioPadrao() {
    const out = {};
    DIAS.forEach((d) => {
      const util = UTEIS.has(d.key);
      out[d.key] = { ativo: util, inicio: util ? "08:00" : "", fim: util ? "18:00" : "" };
    });
    return out;
  }

  function normalizaHora(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "";
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return "";
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  function horaParaMinutos(raw) {
    const h = normalizaHora(raw);
    if (!h) return null;
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
  }

  function diaKeyDeData(d) {
    return ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][d.getDay()];
  }

  function normalizaHorario(raw) {
    if (!raw || typeof raw !== "object") return null;
    const out = {};
    let algum = false;
    DIAS.forEach((d) => {
      const slot = raw[d.key] || {};
      const ativo = Boolean(slot.ativo);
      const inicio = normalizaHora(slot.inicio);
      const fim = normalizaHora(slot.fim);
      out[d.key] = { ativo, inicio, fim };
      if (ativo) algum = true;
    });
    return algum ? out : null;
  }

  function statusHorario(horario, agora) {
    const now = agora instanceof Date ? agora : new Date();
    const norm = normalizaHorario(horario);
    if (!norm) return { permitido: true, legado: true };
    const key = diaKeyDeData(now);
    const slot = norm[key];
    if (!slot || !slot.ativo) {
      return { permitido: false, motivo: "Fora do horário de acesso. Este dia não está liberado." };
    }
    const ini = horaParaMinutos(slot.inicio);
    const fim = horaParaMinutos(slot.fim);
    if (ini == null || fim == null || fim <= ini) {
      return { permitido: false, motivo: "Fora do horário de acesso." };
    }
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins < ini || mins >= fim) {
      return {
        permitido: false,
        motivo: `Fora do horário de acesso (${slot.inicio} às ${slot.fim}).`,
      };
    }
    const faltam = fim - mins;
    return { permitido: true, faltamMinutos: faltam, avisar30: faltam <= 30, fim: slot.fim };
  }

  function syncLinha(d) {
    const ace = typeof document !== "undefined" ? document.getElementById(d.ace) : null;
    const ini = typeof document !== "undefined" ? document.getElementById(d.ini) : null;
    const fim = typeof document !== "undefined" ? document.getElementById(d.fim) : null;
    if (!ace || !ini || !fim) return;
    const on = Boolean(ace.checked);
    ini.disabled = !on;
    fim.disabled = !on;
    if (on && !normalizaHora(ini.value)) ini.value = "08:00";
    if (on && !normalizaHora(fim.value)) fim.value = "18:00";
  }

  function bindForm() {
    if (typeof document === "undefined") return;
    DIAS.forEach((d) => {
      const ace = document.getElementById(d.ace);
      ace?.addEventListener("change", () => syncLinha(d));
      syncLinha(d);
    });
  }

  function colherDoForm() {
    const out = {};
    DIAS.forEach((d) => {
      const ace = typeof document !== "undefined" ? document.getElementById(d.ace) : null;
      const ini = typeof document !== "undefined" ? document.getElementById(d.ini) : null;
      const fim = typeof document !== "undefined" ? document.getElementById(d.fim) : null;
      const ativo = Boolean(ace?.checked);
      out[d.key] = {
        ativo,
        inicio: ativo ? normalizaHora(ini?.value) || "08:00" : "",
        fim: ativo ? normalizaHora(fim?.value) || "18:00" : "",
      };
    });
    return out;
  }

  function aplicarNoForm(horario) {
    const src = normalizaHorario(horario) || horarioPadrao();
    DIAS.forEach((d) => {
      const ace = typeof document !== "undefined" ? document.getElementById(d.ace) : null;
      const ini = typeof document !== "undefined" ? document.getElementById(d.ini) : null;
      const fim = typeof document !== "undefined" ? document.getElementById(d.fim) : null;
      const slot = src[d.key] || { ativo: false, inicio: "", fim: "" };
      if (ace) ace.checked = Boolean(slot.ativo);
      if (ini) ini.value = slot.inicio || "";
      if (fim) fim.value = slot.fim || "";
      syncLinha(d);
    });
  }

  function aplicarPadraoNoForm() {
    aplicarNoForm(horarioPadrao());
  }

  function chaveAviso(cpf, fim) {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `dk_colab_aviso30_${String(cpf || "").replace(/\D/g, "")}_${ymd}_${String(fim || "")}`;
  }

  function jaAvisou(cpf, fim) {
    try {
      return sessionStorage.getItem(chaveAviso(cpf, fim)) === "1";
    } catch {
      return false;
    }
  }

  function marcarAvisou(cpf, fim) {
    try {
      sessionStorage.setItem(chaveAviso(cpf, fim), "1");
    } catch {
      /* ignore */
    }
  }

  function fecharAviso() {
    const modal = typeof document !== "undefined" ? document.getElementById("portalColabHorarioAvisoModal") : null;
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function abrirAviso() {
    const modal = typeof document !== "undefined" ? document.getElementById("portalColabHorarioAvisoModal") : null;
    const texto = typeof document !== "undefined" ? document.getElementById("portalColabHorarioAvisoTexto") : null;
    if (!modal) return;
    if (texto) texto.textContent = AVISO_TEXTO;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("portalColabHorarioAvisoOkBtn")?.focus();
  }

  function checarAviso(funcionario) {
    if (!funcionario || String(funcionario.role || "").trim() !== "operacao") return;
    const st = statusHorario(funcionario.horarioAcesso);
    if (!st.permitido || !st.avisar30) return;
    const cpf = String(funcionario.cpf || "");
    if (jaAvisou(cpf, st.fim)) return;
    marcarAvisou(cpf, st.fim);
    abrirAviso();
  }

  function iniciarAvisoFim(funcionario) {
    if (avisoTimer) {
      clearInterval(avisoTimer);
      avisoTimer = 0;
    }
    if (!funcionario || String(funcionario.role || "").trim() !== "operacao") return;
    if (!normalizaHorario(funcionario.horarioAcesso)) return;
    checarAviso(funcionario);
    avisoTimer = setInterval(() => checarAviso(funcionario), 15000);
  }

  if (typeof document !== "undefined") {
    const boot = () => {
      bindForm();
      document.getElementById("portalColabHorarioAvisoOkBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        fecharAviso();
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  return {
    DIAS,
    AVISO_TEXTO,
    horarioPadrao,
    normalizaHora,
    normalizaHorario,
    statusHorario,
    colherDoForm,
    aplicarNoForm,
    aplicarPadraoNoForm,
    iniciarAvisoFim,
  };
});
