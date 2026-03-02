// ═══════════════════════════════════════════════════════════════════════
// shared/utils.js — Utilitaires partagés
// Inclut : escapeHtml, escapeAttr
// Utilisé par : calculateur, catalogue, admin, approbation, clients, quote
// ═══════════════════════════════════════════════════════════════════════

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
