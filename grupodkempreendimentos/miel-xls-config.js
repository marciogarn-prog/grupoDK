/**
 * Sistema MIEL XLS — link para a planilha real na nuvem (OneDrive / SharePoint).
 *
 * Após upload de miel-sistema.xlsm:
 * 1. Partilhe com permissão de EDIÇÃO
 * 2. Copie o link «Abrir no Excel Online»
 * 3. Cole em editUrl abaixo OU defina MIEL_XLS_EDIT_URL na Vercel (tem prioridade via /api/miel-xls-config)
 */
window.__DK_MIEL_XLS = {
  editUrl: "",
  fileName: "miel-sistema.xlsm",
};
