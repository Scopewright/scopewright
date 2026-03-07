// ═══════════════════════════════════════════════════════════════════════
// shared/pricing.js — Calcul de prix composé
// Dépend de : tauxHoraires[] et expenseCategories[] (variables globales)
// Utilisé par : calculateur, catalogue, approbation
// ═══════════════════════════════════════════════════════════════════════

// Prix composé pour le calculateur (material_costs = flat numbers)
// Retourne null si aucun prix composé n'est défini
function computeComposedPrice(item, includeInstallation) {
    var laborMinutes = item.labor_minutes || {};
    var materialCosts = item.material_costs || {};
    var hasComposed = false;

    // Main-d'œuvre
    var laborTotal = 0;
    for (var i = 0; i < tauxHoraires.length; i++) {
        var dept = tauxHoraires[i].department;
        var minutes = laborMinutes[dept] || 0;
        if (minutes > 0) {
            hasComposed = true;
            if (!includeInstallation && dept === 'Installation') continue;
            laborTotal += (minutes / 60) * (tauxHoraires[i].taux_horaire || 0);
        }
    }

    // Matériaux
    var materialTotal = 0;
    for (var j = 0; j < expenseCategories.length; j++) {
        var cat = expenseCategories[j].name;
        var cost = materialCosts[cat] || 0;
        if (cost > 0) {
            var markup = (expenseCategories[j].markup || 0) / 100;
            var waste = (item.loss_override_pct != null ? item.loss_override_pct : (expenseCategories[j].waste || 0)) / 100;
            materialTotal += cost * (1 + waste) * (1 + markup);
            hasComposed = true;
        }
    }

    if (!hasComposed) return null;
    return laborTotal + materialTotal;
}

// Prix composé pour catalogue/approbation (material_costs = objects {cost, qty})
// Retourne toujours un nombre (0 si aucun composant)
function computeCatItemPrice(item) {
    var total = 0;
    if (item.labor_minutes && tauxHoraires) {
        for (var dept in item.labor_minutes) {
            var mins = item.labor_minutes[dept] || 0;
            var th = tauxHoraires.find(function(t) { return t.department === dept; });
            var rate = th ? th.taux_horaire : 0;
            total += (mins / 60) * rate;
        }
    }
    if (item.material_costs) {
        for (var cat in item.material_costs) {
            var mc = item.material_costs[cat];
            if (!mc || !mc.cost) continue;
            var cost = mc.cost * (mc.qty || 1);
            var ec = (expenseCategories || []).find(function(e) { return e.name === cat; });
            var markup = ec ? (ec.markup || 0) : 0;
            var waste = item.loss_override_pct != null ? item.loss_override_pct : (ec ? (ec.waste || 0) : 0);
            total += cost * (1 + waste / 100) * (1 + markup / 100);
        }
    }
    return total;
}
