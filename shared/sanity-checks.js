/**
 * shared/sanity-checks.js — Deterministic sanity checks (no AI)
 *
 * Exported globals:
 *   runSanityChecks(checks)  — run selected checks, update badge
 *   SANITY_CHECKS            — check registry
 *
 * Depends on: shared/master-agent.js (masterSanityReport)
 *
 * Used by: calculateur.html, catalogue_prix_stele_complet.html
 */

/* jshint esversion: 6 */
/* global masterSanityReport, cascadeParentMap, roomDescHTML */

(function() {
    'use strict';

    // Valid presentation_rule JSON keys
    var VALID_PRES_KEYS = ['sections', 'exclude', 'detail_bullets'];

    // Valid section key values
    var VALID_SECTION_KEYS = [
        'CAISSON', 'FAÇADES', 'FACADES', 'PANNEAUX', 'PANNEAUX APPARENTS',
        'TIROIRS', 'POIGNÉES', 'POIGNEES', 'DÉTAILS', 'DETAILS',
        'FINITION', 'EXCLUSIONS'
    ];

    // ── Check: presentation_rule JSON has only valid keys ──
    function checkPresRuleKeys(item) {
        var issues = [];
        if (!item || !item.presentation_rule) return issues;
        var rule = item.presentation_rule;
        if (typeof rule === 'string') {
            try { rule = JSON.parse(rule); } catch(e) { return issues; }
        }
        if (typeof rule !== 'object' || rule === null) return issues;

        var keys = Object.keys(rule);
        for (var i = 0; i < keys.length; i++) {
            if (VALID_PRES_KEYS.indexOf(keys[i]) < 0) {
                issues.push({
                    level: 'warning',
                    message: 'Cl\u00e9 invalide "' + keys[i] + '" dans presentation_rule de ' + (item.id || '?')
                });
            }
        }

        // Check section keys
        if (rule.sections && Array.isArray(rule.sections)) {
            for (var j = 0; j < rule.sections.length; j++) {
                var sec = rule.sections[j];
                if (sec && sec.key) {
                    var upper = sec.key.toUpperCase();
                    if (VALID_SECTION_KEYS.indexOf(upper) < 0) {
                        issues.push({
                            level: 'warning',
                            message: 'Cl\u00e9 section invalide "' + sec.key + '" dans ' + (item.id || '?')
                        });
                    }
                }
            }
        }
        return issues;
    }

    // ── Check: description client non vide before send ──
    function checkDescriptionsNotEmpty(rooms) {
        var issues = [];
        if (!rooms || !Array.isArray(rooms)) return issues;
        for (var i = 0; i < rooms.length; i++) {
            var room = rooms[i];
            var desc = '';
            if (typeof roomDescHTML !== 'undefined' && roomDescHTML[room.groupId]) {
                desc = roomDescHTML[room.groupId];
            }
            if (!desc || desc.trim().length === 0) {
                issues.push({
                    level: 'warning',
                    message: 'Description vide pour la pi\u00e8ce "' + (room.name || '?') + '"'
                });
            }
        }
        return issues;
    }

    // ── Check: total soumission non z&eacute;ro ──
    function checkTotalNotZero(grandTotal) {
        var issues = [];
        if (grandTotal === 0 || grandTotal === null || grandTotal === undefined) {
            issues.push({
                level: 'critical',
                message: 'Total de la soumission est z\u00e9ro'
            });
        }
        return issues;
    }

    // ── Check: no orphan cascade children ──
    function checkCascadeOrphans() {
        var issues = [];
        if (typeof cascadeParentMap === 'undefined') return issues;
        var childIds = Object.keys(cascadeParentMap);
        for (var i = 0; i < childIds.length; i++) {
            var childId = childIds[i];
            var parentId = cascadeParentMap[childId];
            if (parentId && !document.getElementById(parentId)) {
                issues.push({
                    level: 'warning',
                    message: 'Enfant cascade orphelin: ' + childId + ' (parent ' + parentId + ' introuvable)'
                });
            }
        }
        return issues;
    }

    // ── Public API ──
    window.SANITY_CHECKS = {
        presRuleKeys: checkPresRuleKeys,
        descriptionsNotEmpty: checkDescriptionsNotEmpty,
        totalNotZero: checkTotalNotZero,
        cascadeOrphans: checkCascadeOrphans
    };

    /**
     * Run a set of sanity checks and report to the master agent badge.
     * @param {Object} opts — { presRuleItems, rooms, grandTotal, checkCascade }
     */
    window.runSanityChecks = function(opts) {
        opts = opts || {};
        var allIssues = [];

        // Presentation rule checks (catalogue)
        if (opts.presRuleItems && Array.isArray(opts.presRuleItems)) {
            for (var i = 0; i < opts.presRuleItems.length; i++) {
                allIssues = allIssues.concat(checkPresRuleKeys(opts.presRuleItems[i]));
            }
        }

        // Description checks (calculateur — before send)
        if (opts.rooms) {
            allIssues = allIssues.concat(checkDescriptionsNotEmpty(opts.rooms));
        }

        // Total check (calculateur — before send)
        if (opts.grandTotal !== undefined) {
            allIssues = allIssues.concat(checkTotalNotZero(opts.grandTotal));
        }

        // Cascade orphan check (calculateur — after cascade)
        if (opts.checkCascade) {
            allIssues = allIssues.concat(checkCascadeOrphans());
        }

        // Report to master agent badge
        if (typeof masterSanityReport === 'function') {
            masterSanityReport(allIssues);
        }

        return allIssues;
    };

})();
