// ═══════════════════════════════════════════════════════════════════════
// shared/presentation-client.js — Fonctions de présentation client
//
// Fonctions exportées :
//   Texte : textToHtml, htmlToText, formatDescriptionForDisplay, toSentenceCase
//   Description : assembleRoomDescription, onAssembleDescription,
//     applyAssembledDescription, editClientDescription, finishEditDescription,
//     refreshDescriptionDisplay, saveClientDescription
//   Clauses : loadClauseLibrary, renderClauseLibrary, showClauseEditor,
//     closeClauseEditor, saveLibraryClause, deleteLibraryClause,
//     getSubmissionClauses, saveSubmissionClauses, addClauseToSubmission,
//     removeClauseFromSubmission, updateClauseText, updateClauseTextEN,
//     saveClauseBackToLibrary, onClauseDragStart, onClauseDropZoneDragOver,
//     onClauseDropZoneDragLeave, onClauseDropZoneDrop
//   Images : toggleImageShowInQuote, toggleImageAiRef
//   Snapshot : generateSnapshotHtml, uploadSnapshot, getSnapshotUrl
//   Status : updateStatusBadge, updateStatusTimeline
//
// Variables globales requises (définies dans calculateur.html) :
//   escapeHtml, escapeAttr (shared/utils.js)
//   authenticatedFetch, SUPABASE_URL (shared/auth.js)
//   currentSubmission, currentProject, CATALOGUE_DATA, roomMap, groupImages
//   clauseLibrary, roomDescHTML, roomDescEN, currentLang, draggedClauseIdx
//   coverImageUrl, introConfig, introConfigEN, projectManagerEmail, SNAPSHOT_CSS
//   STATUS_LABELS, canApproveQuotes, canBypassApproval
//   updateSubmission, updateRoom, showSaveIndicator, saveGroupImages
//   isSubmissionCurrentlyEditable, showConstraintToast, showConstraintModal
//   getDefaultMaterialsForGroup, renderPreview, loadCoverImage
//   copyQuoteLink
//
// Utilisé par : calculateur.html
// ═══════════════════════════════════════════════════════════════════════

// ── Helpers texte ──

// Convert plain text (legacy) to basic HTML; if already HTML, return as-is
function textToHtml(str) {
    if (!str) return '';
    if (str.indexOf('<p>') !== -1 || str.indexOf('<strong>') !== -1 || str.indexOf('<ul>') !== -1 || str.indexOf('<br') !== -1) {
        return str; // already HTML
    }
    // Legacy plain text: escape then convert newlines to <br>
    return escapeHtml(str).replace(/\n/g, '<br>');
}

// Convert HTML to plain text for textarea display
function htmlToText(str) {
    if (!str) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = str;
    return tmp.textContent || tmp.innerText || '';
}

function toSentenceCase(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Format description text for display (MAJUSCULES → sentence case, bold keywords, lists)
function formatDescriptionForDisplay(text) {
    if (!text || !text.trim()) return '';
    var lines = text.split('\n');
    var keywords = [
        'CAISSON', 'PANNEAUX', 'FAÇADES',
        'TIROIRS LEGRABOX', 'TIROIRS', 'POIGNÉES', 'ÉCLAIRAGE',
        'DÉTAILS', 'EXCLUSIONS', 'COMPTOIR', 'QUINCAILLERIE',
        'FINITION', 'ÉLECTRO', 'RANGEMENT', 'DIMENSIONS',
        'NOTES', 'PARTICULARITÉS'
    ];
    var hasKeyword = lines.some(function(l) {
        var upper = l.trim().toUpperCase();
        return keywords.some(function(k) { return upper.startsWith(k); });
    });
    if (!hasKeyword) return escapeHtml(text).replace(/\n/g, '<br>');
    var html = '';
    var inList = false;
    lines.forEach(function(line) {
        var trimmed = line.trim();
        if (!trimmed) { if (inList) { html += '</ul>'; inList = false; } return; }
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
            if (!inList) { html += '<ul>'; inList = true; }
            html += '<li>' + escapeHtml(trimmed.replace(/^[-•]\s*/, '')) + '</li>';
            return;
        }
        if (inList) { html += '</ul>'; inList = false; }
        var matched = false;
        var upper = trimmed.toUpperCase();
        for (var i = 0; i < keywords.length; i++) {
            if (upper.startsWith(keywords[i])) {
                var colonIdx = trimmed.indexOf(':');
                if (colonIdx !== -1) {
                    var label = trimmed.substring(0, colonIdx).trim();
                    var value = trimmed.substring(colonIdx + 1).trim();
                    html += '<p><strong>' + escapeHtml(toSentenceCase(label)) + ' :</strong> ' + escapeHtml(value) + '</p>';
                } else {
                    html += '<p><strong>' + escapeHtml(toSentenceCase(trimmed)) + '</strong></p>';
                }
                matched = true;
                break;
            }
        }
        if (!matched) html += '<p>' + escapeHtml(trimmed) + '</p>';
    });
    if (inList) html += '</ul>';
    return html;
}

// ── Description client ──

function editClientDescription(groupId) {
    var display = document.getElementById(groupId + '-clientDescDisplay');
    var editor = document.getElementById(groupId + '-clientDesc');
    if (!display || !editor) return;
    if (currentSubmission && !isSubmissionCurrentlyEditable()) return;
    display.style.display = 'none';
    // Populate contenteditable from cached HTML
    editor.innerHTML = roomDescHTML[groupId] || '';
    editor.style.display = '';
    editor.focus();
}

function finishEditDescription(groupId) {
    saveClientDescription(groupId);
    var display = document.getElementById(groupId + '-clientDescDisplay');
    var editor = document.getElementById(groupId + '-clientDesc');
    if (!display || !editor) return;
    editor.style.display = 'none';
    display.style.display = '';
    refreshDescriptionDisplay(groupId);
}

function refreshDescriptionDisplay(groupId) {
    var display = document.getElementById(groupId + '-clientDescDisplay');
    if (!display) return;
    var html = (typeof roomDescHTML !== 'undefined') ? roomDescHTML[groupId] : '';
    if (!html) {
        display.innerHTML = '<span class="desc-placeholder">Description visible par le client...</span>';
    } else {
        display.innerHTML = html;
    }
}

function saveClientDescription(groupId) {
    if (!roomMap[groupId]) return;
    var editor = document.getElementById(groupId + '-clientDesc');
    if (!editor) return;
    // Read HTML directly from contenteditable — no textToHtml conversion needed
    var html = editor.innerHTML;
    // Clean empty contenteditable artifacts
    if (html === '<br>' || html === '<div><br></div>') html = '';
    roomDescHTML[groupId] = html;
    if (roomDescEN[groupId]) {
        roomDescEN[groupId] = '';
        updateRoom(roomMap[groupId], { client_description: html, client_description_en: '' });
    } else {
        updateRoom(roomMap[groupId], { client_description: html });
    }
    showSaveIndicator();
}

/**
 * Assemble a structured room description from presentation_rule of catalogue items.
 * Deterministic: no AI call, uses sections from each item's presentation_rule.
 */
function assembleRoomDescription(groupId) {
    var group = document.getElementById(groupId);
    if (!group) return '';

    // Default materials (room-level only)
    var dm = getDefaultMaterialsForGroup(groupId);

    // Collect articles with their presentation_rule
    var articlesBySection = {};
    var detailTexts = [];
    var excludeSet = {};
    var detailBullets = [];

    group.querySelectorAll('.calc-row').forEach(function(row) {
        var sel = row.querySelector('.item-select');
        if (!sel || !sel.value || sel.value === '__AJOUT__' || sel.value === '__PROPOSER__') return;
        var item = CATALOGUE_DATA.find(function(i) { return i.id === sel.value; });
        if (!item) return;

        if (item.presentation_rule) {
            // Collect exclude terms
            if (Array.isArray(item.presentation_rule.exclude)) {
                item.presentation_rule.exclude.forEach(function(term) {
                    excludeSet[term.toLowerCase()] = true;
                });
            }
            // Collect detail_bullets
            if (Array.isArray(item.presentation_rule.detail_bullets)) {
                item.presentation_rule.detail_bullets.forEach(function(b) {
                    if (detailBullets.indexOf(b) === -1) detailBullets.push(b);
                });
            }
        }

        if (item.presentation_rule && item.presentation_rule.sections) {
            item.presentation_rule.sections.forEach(function(sec) {
                if (!articlesBySection[sec.key]) articlesBySection[sec.key] = [];
                var text = (sec.template || '{client_text}').replace('{client_text}', item.client_text || item.description);
                // Avoid duplicates
                var exists = articlesBySection[sec.key].some(function(a) { return a.text === text; });
                if (!exists) articlesBySection[sec.key].push({ text: text, label: sec.label });
            });
        } else if (item.client_text) {
            if (detailTexts.indexOf(item.client_text) === -1) detailTexts.push(item.client_text);
        }
    });

    // Apply exclude filter — remove articles whose text matches an exclude term
    var excludeTerms = Object.keys(excludeSet);
    if (excludeTerms.length > 0) {
        Object.keys(articlesBySection).forEach(function(key) {
            articlesBySection[key] = articlesBySection[key].filter(function(a) {
                var lower = a.text.toLowerCase();
                return !excludeTerms.some(function(term) { return lower.indexOf(term) !== -1; });
            });
        });
        detailTexts = detailTexts.filter(function(t) {
            var lower = t.toLowerCase();
            return !excludeTerms.some(function(term) { return lower.indexOf(term) !== -1; });
        });
    }

    var SECTION_ORDER = ['CAISSON', 'FAÇADES', 'PANNEAUX', 'COMPTOIR', 'TIROIRS', 'POIGNÉES',
        'QUINCAILLERIE', 'ÉCLAIRAGE', 'FINITION', 'RANGEMENT', 'DÉTAILS',
        'EXCLUSIONS', 'NOTES', 'PARTICULARITÉS'];
    var lines = [];

    // Default materials first
    dm.forEach(function(d) {
        if (d.catalogue_item_id && d.description) {
            var sectionKey = (d.type || '').toUpperCase();
            if (!articlesBySection[sectionKey]) {
                lines.push(toSentenceCase(d.type || '') + ' : ' + d.description);
            }
        }
    });

    // Sections from presentation_rule
    SECTION_ORDER.forEach(function(key) {
        if (articlesBySection[key] && articlesBySection[key].length > 0) {
            var label = articlesBySection[key][0].label || key;
            var texts = articlesBySection[key].map(function(a) { return a.text; });
            if (texts.length === 1) {
                lines.push(toSentenceCase(label) + ' : ' + texts[0]);
            } else {
                lines.push(toSentenceCase(label) + ' :');
                texts.forEach(function(t) { lines.push('- ' + t); });
            }
        }
    });

    // Fallback details for items without presentation_rule
    if (detailTexts.length > 0 && !articlesBySection['DÉTAILS']) {
        lines.push('Détails :');
        detailTexts.forEach(function(d) { lines.push('- ' + d); });
    }

    // Inject detail_bullets into Détails section
    if (detailBullets.length > 0) {
        if (!lines.some(function(l) { return l.indexOf('Détails') === 0; })) {
            lines.push('Détails :');
        }
        detailBullets.forEach(function(b) { lines.push('- ' + b); });
    }

    return lines.join('\n');
}

function onAssembleDescription(groupId) {
    var assembled = assembleRoomDescription(groupId);
    if (!assembled) {
        showConstraintToast('Aucun article avec texte client dans cette pièce');
        return;
    }

    var existing = roomDescHTML[groupId] || '';
    if (existing) {
        showConstraintModal('Remplacer la description ?',
            'La description actuelle sera remplacée par la version assemblée.',
            [{ key: 'replace', label: 'Remplacer', primary: true },
             { key: 'cancel', label: 'Annuler', primary: false }]
        ).then(function(choice) {
            if (choice === 'replace') applyAssembledDescription(groupId, assembled);
        });
    } else {
        applyAssembledDescription(groupId, assembled);
    }
}

function applyAssembledDescription(groupId, text) {
    var html = textToHtml(text);
    roomDescHTML[groupId] = html;
    refreshDescriptionDisplay(groupId);
    roomDescEN[groupId] = '';
    if (roomMap[groupId]) {
        updateRoom(roomMap[groupId], { client_description: html, client_description_en: '' });
    }
    showSaveIndicator();
}

// ── Image toggles ──

async function toggleImageShowInQuote(groupId, index, checked) {
    if (!groupImages[groupId] || !groupImages[groupId][index]) return;
    var img = groupImages[groupId][index];
    img.showInQuote = checked;

    if (!img.isLegacy && img.mediaId) {
        // Update tags in room_media
        var newTags = checked
            ? Array.from(new Set((img.tags || []).concat(['presentation_soumission'])))
            : (img.tags || []).filter(function(t) { return t !== 'presentation_soumission'; });
        img.tags = newTags;
        try {
            await authenticatedFetch(SUPABASE_URL + '/rest/v1/room_media?id=eq.' + img.mediaId, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ tags: newTags })
            });
        } catch (e) { console.error('Update room_media tags error:', e); }
        showSaveIndicator();
    } else {
        saveGroupImages(groupId);
    }
}

async function toggleImageAiRef(groupId, index, checked) {
    if (!groupImages[groupId] || !groupImages[groupId][index]) return;
    var img = groupImages[groupId][index];
    img.aiReference = checked;

    if (!img.isLegacy && img.mediaId) {
        var newTags = checked
            ? Array.from(new Set((img.tags || []).concat(['ai_reference'])))
            : (img.tags || []).filter(function(t) { return t !== 'ai_reference'; });
        img.tags = newTags;
        try {
            await authenticatedFetch(SUPABASE_URL + '/rest/v1/room_media?id=eq.' + img.mediaId, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ tags: newTags })
            });
        } catch (e) { console.error('Update room_media AI tag error:', e); }
        showSaveIndicator();
    } else {
        saveGroupImages(groupId);
    }
}

// ── Clause Library ──

async function loadClauseLibrary() {
    try {
        var r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/quote_clauses?order=sort_order.asc,title.asc&select=*', {});
        if (r.ok) clauseLibrary = await r.json();
    } catch (e) { console.error('loadClauseLibrary error:', e); }
}

function renderClauseLibrary() {
    var container = document.getElementById('pvClauseList');
    if (!container) return;

    if (clauseLibrary.length === 0) {
        container.innerHTML = '<p class="pv-clause-empty">Aucune clause dans la biblioth\u00e8que. Cliquez + pour en cr\u00e9er.</p>';
        return;
    }

    var html = '';
    clauseLibrary.forEach(function(clause, idx) {
        html += '<div class="pv-clause-item" draggable="true" data-clause-idx="' + idx + '"';
        html += ' ondragstart="onClauseDragStart(event, ' + idx + ')">';
        html += '<div class="pv-clause-item-header">';
        html += '<span class="pv-clause-item-title">' + escapeHtml(clause.title) + '</span>';
        html += '<span class="pv-clause-item-btns">';
        html += '<button class="pv-clause-item-btn add-to-sub" onclick="event.stopPropagation(); addClauseToSubmission(' + idx + ')" title="Ajouter \u00e0 la soumission">+</button>';
        html += '<button class="pv-clause-item-btn" onclick="showClauseEditor(\'' + clause.id + '\')" title="Modifier">\u270E</button>';
        html += '<button class="pv-clause-item-btn delete" onclick="deleteLibraryClause(\'' + clause.id + '\')" title="Supprimer">\u2715</button>';
        html += '</span>';
        html += '</div>';
        var preview = (clause.content_fr || '').substring(0, 120);
        if (preview) html += '<div class="pv-clause-item-preview">' + escapeHtml(preview) + '</div>';
        html += '</div>';
    });
    container.innerHTML = html;
}

function showClauseEditor(clauseId) {
    var zone = document.getElementById('pvClauseEditZone');
    if (!zone) return;

    var clause = clauseId ? clauseLibrary.find(function(c) { return c.id === clauseId; }) : null;
    var isNew = !clause;

    zone.innerHTML = '<div class="pv-clause-edit">' +
        '<label>Titre</label>' +
        '<input type="text" id="ceTitle" value="' + escapeAttr(clause ? clause.title : '') + '" placeholder="Ex: Dessins d\'atelier">' +
        '<label>Contenu</label>' +
        '<textarea id="ceFr" rows="5" placeholder="Texte de la clause...">' + escapeHtml(clause ? clause.content_fr : '') + '</textarea>' +
        '<div class="pv-clause-edit-btns">' +
        '<button class="cancel" onclick="closeClauseEditor()">Annuler</button>' +
        '<button class="save" onclick="saveLibraryClause(' + (isNew ? 'null' : "'" + clauseId + "'") + ')">' + (isNew ? 'Cr\u00e9er' : 'Sauvegarder') + '</button>' +
        '</div></div>';

    zone.querySelector('#ceTitle').focus();
}

function closeClauseEditor() {
    var zone = document.getElementById('pvClauseEditZone');
    if (zone) zone.innerHTML = '';
}

async function saveLibraryClause(clauseId) {
    var title = document.getElementById('ceTitle').value.trim();
    var fr = document.getElementById('ceFr').value.trim();
    if (!title) { document.getElementById('ceTitle').focus(); return; }

    var payload = { title: title, content_fr: fr };

    try {
        var r;
        if (clauseId) {
            r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/quote_clauses?id=eq.' + clauseId, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(payload)
            });
        } else {
            r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/quote_clauses', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(payload)
            });
        }

        if (r.ok) {
            closeClauseEditor();
            await loadClauseLibrary();
            renderClauseLibrary();
            showSaveIndicator();
        }
    } catch (e) { console.error('saveLibraryClause error:', e); }
}

async function deleteLibraryClause(clauseId) {
    if (!confirm('Supprimer cette clause de la biblioth\u00e8que ?')) return;
    try {
        var r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/quote_clauses?id=eq.' + clauseId, { method: 'DELETE' });
        if (r.ok) {
            await loadClauseLibrary();
            renderClauseLibrary();
            showSaveIndicator();
        }
    } catch (e) { console.error('deleteLibraryClause error:', e); }
}

// ── Submission Clauses (JSONB on submissions) ──

function getSubmissionClauses() {
    if (!currentSubmission) return [];
    return currentSubmission.clauses || [];
}

async function saveSubmissionClauses(clauses) {
    if (!currentSubmission) return;
    currentSubmission.clauses = clauses;
    await updateSubmission(currentSubmission.id, { clauses: clauses });
    showSaveIndicator();
}

async function addClauseToSubmission(clauseIdx) {
    var lib = clauseLibrary[clauseIdx];
    if (!lib) return;
    var clauses = getSubmissionClauses().slice();
    // Avoid duplicate by id
    if (clauses.some(function(c) { return c.clause_id === lib.id; })) return;
    clauses.push({
        clause_id: lib.id,
        title: lib.title,
        content: lib.content_fr,
        content_en: lib.content_en || '',
        sort_order: clauses.length
    });
    await saveSubmissionClauses(clauses);
    renderPreview();
}

async function removeClauseFromSubmission(idx) {
    var clauses = getSubmissionClauses().slice();
    clauses.splice(idx, 1);
    // Re-index sort_order
    clauses.forEach(function(c, i) { c.sort_order = i; });
    await saveSubmissionClauses(clauses);
    renderPreview();
}

async function updateClauseText(idx, newText) {
    var clauses = getSubmissionClauses().slice();
    if (clauses[idx]) {
        clauses[idx].content = newText;
        await saveSubmissionClauses(clauses);
    }
}

async function updateClauseTextEN(idx, newText) {
    var clauses = getSubmissionClauses().slice();
    if (clauses[idx]) {
        clauses[idx].content_en = newText;
        await saveSubmissionClauses(clauses);
    }
}

async function saveClauseBackToLibrary(idx) {
    var clauses = getSubmissionClauses();
    var c = clauses[idx];
    if (!c) return;

    // If came from library, update it; otherwise create new
    if (c.clause_id) {
        var existing = clauseLibrary.find(function(lib) { return lib.id === c.clause_id; });
        if (existing) {
            await authenticatedFetch(SUPABASE_URL + '/rest/v1/quote_clauses?id=eq.' + c.clause_id, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ title: c.title, content_fr: c.content, content_en: c.content_en || '' })
            });
            await loadClauseLibrary();
            renderClauseLibrary();
            showSaveIndicator();
            return;
        }
    }

    // Create new in library
    await authenticatedFetch(SUPABASE_URL + '/rest/v1/quote_clauses', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ title: c.title, content_fr: c.content, content_en: c.content_en || '' })
    });
    await loadClauseLibrary();
    renderClauseLibrary();
    showSaveIndicator();
}

// ── Drag and Drop ──

function onClauseDragStart(e, idx) {
    draggedClauseIdx = idx;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', idx.toString());
    e.target.classList.add('dragging');
    setTimeout(function() { e.target.classList.remove('dragging'); }, 200);
}

function onClauseDropZoneDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

function onClauseDropZoneDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function onClauseDropZoneDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    var idx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(idx)) addClauseToSubmission(idx);
    draggedClauseIdx = null;
}

// ── Snapshot ──

function generateSnapshotHtml(pagesHtml) {
    return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n' +
        '<meta charset="UTF-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<title>Soumission #' + escapeHtml((currentSubmission ? currentSubmission.submission_number : '') + '') + '</title>\n' +
        '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">\n' +
        '<style>\n' + SNAPSHOT_CSS + '\n</style>\n' +
        '</head>\n<body>\n' +
        '<div class="pv-content">\n' + pagesHtml + '\n</div>\n' +
        '</body>\n</html>';
}

async function uploadSnapshot(submissionId) {
    if (!submissionId) return;
    try {
        // Render preview to get HTML
        await loadCoverImage();
        await renderPreview();
        var container = document.getElementById('pvContent');
        if (!container) return;
        var pagesHtml = container.innerHTML;

        // Remove interactive elements from snapshot
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = pagesHtml;
        // Remove edit buttons, delete buttons, dropzones, optimize buttons
        tempDiv.querySelectorAll('.pv-img-delete, .pv-img-badge-client, .pv-page-clause-actions, .pv-clause-dropzone, .pv-optimize-btn, button').forEach(function(el) { el.remove(); });
        // Make contenteditable divs static
        tempDiv.querySelectorAll('[contenteditable]').forEach(function(el) { el.removeAttribute('contenteditable'); });
        // Make textareas into divs
        tempDiv.querySelectorAll('textarea').forEach(function(ta) {
            var div = document.createElement('div');
            div.className = ta.className;
            div.textContent = ta.value;
            ta.parentNode.replaceChild(div, ta);
        });
        var cleanHtml = tempDiv.innerHTML;

        var snapshotHtml = generateSnapshotHtml(cleanHtml);
        var blob = new Blob([snapshotHtml], { type: 'text/html' });

        // Upload to Storage
        var filePath = submissionId + '.html';
        var r = await authenticatedFetch(SUPABASE_URL + '/storage/v1/object/submission-snapshots/' + filePath, {
            method: 'PUT',
            headers: { 'Content-Type': 'text/html', 'x-upsert': 'true' },
            body: blob
        });
        if (!r.ok) {
            // Try POST if PUT fails
            r = await authenticatedFetch(SUPABASE_URL + '/storage/v1/object/submission-snapshots/' + filePath, {
                method: 'POST',
                headers: { 'Content-Type': 'text/html', 'x-upsert': 'true' },
                body: blob
            });
        }
        if (r.ok) {
            console.log('Snapshot saved for submission', submissionId);
        } else {
            console.warn('Snapshot upload failed:', await r.text());
        }
    } catch (e) {
        console.warn('Error creating snapshot:', e);
    }
}

function getSnapshotUrl(submissionId) {
    return SUPABASE_URL + '/storage/v1/object/public/submission-snapshots/' + submissionId + '.html';
}

// ── Status UI ──

function updateStatusBadge(status) {
    var badge = document.getElementById('subStatusBadge');
    if (!badge) return;
    var label = STATUS_LABELS[status] || status;
    badge.className = 'status-badge status-' + status;
    var locked = !isSubmissionCurrentlyEditable();
    var prefix = locked ? '\uD83D\uDD12 ' : '';
    if (currentSubmission && currentSubmission.bypass_approval) {
        badge.innerHTML = escapeHtml(prefix + label) + ' <span class="bypass-badge">BYPASS</span>';
    } else {
        badge.textContent = prefix + label;
    }
}

function updateStatusTimeline() {
    var container = document.getElementById('statusTimeline');
    if (!container || !currentSubmission) {
        if (container) container.innerHTML = '';
        return;
    }

    var status = currentSubmission.status;

    // Define 6 timeline steps (last step is dynamic: Vendue or Perdue)
    var lastStep = status === 'lost'
        ? { key: 'lost', label: 'Perdue' }
        : { key: 'accepted', label: 'Vendue' };
    var steps = [
        { key: 'draft', label: 'Brouillon' },
        { key: 'pending_internal', label: 'En approbation' },
        { key: 'returned', label: 'Retourn\u00e9e' },
        { key: 'approved_internal', label: 'Pr\u00eate \u00e0 envoyer' },
        { key: 'sent_client', label: 'Envoy\u00e9e' },
        lastStep
    ];

    // Determine step state for each step
    function getStepState(stepKey) {
        if (stepKey === status) return 'active';

        // Special: "returned" is only active when status is returned, otherwise always future
        if (stepKey === 'returned') {
            return (status === 'returned') ? 'active' : 'future';
        }

        // Linear progression for other steps
        switch (status) {
            case 'draft':
                return 'future';
            case 'pending_internal':
                return (stepKey === 'draft') ? 'completed' : 'future';
            case 'returned':
                return (stepKey === 'draft' || stepKey === 'pending_internal') ? 'completed' : 'future';
            case 'approved_internal':
                return (stepKey === 'draft' || stepKey === 'pending_internal') ? 'completed' : 'future';
            case 'sent_client':
                return (stepKey === 'draft' || stepKey === 'pending_internal' || stepKey === 'approved_internal') ? 'completed' : 'future';
            case 'accepted':
                return (stepKey === 'draft' || stepKey === 'pending_internal' || stepKey === 'approved_internal' || stepKey === 'sent_client') ? 'completed' : 'future';
            case 'lost':
                return (stepKey === 'draft' || stepKey === 'pending_internal' || stepKey === 'approved_internal' || stepKey === 'sent_client') ? 'completed' : 'future';
            default:
                return 'future';
        }
    }

    var html = '';
    steps.forEach(function(step) {
        var stepState = getStepState(step.key);
        var classNames = 'timeline-step ' + stepState;
        if (step.key === 'returned' && stepState === 'active') classNames += ' returned';
        if (step.key === 'lost' && stepState === 'active') classNames += ' lost';

        // Rendre "Envoyée" cliquable pour copier le lien client
        var isClickable = (status === 'sent_client' && step.key === 'sent_client');
        if (isClickable) classNames += ' clickable';

        var onclick = isClickable ? ' onclick="copyQuoteLink()" title="Cliquer pour copier le lien client"' : '';

        html += '<div class="' + classNames + '"' + onclick + '>';
        html += '<div class="timeline-circle">';
        if (stepState === 'completed') {
            html += '\u2713'; // checkmark
        } else {
            html += '&nbsp;';
        }
        html += '</div>';
        html += '<span class="timeline-label">' + escapeHtml(step.label) + '</span>';
        html += '</div>';
    });

    // CTA button at the end
    var cta = null;
    if (status === 'draft' || status === 'returned') {
        if (canBypassApproval) {
            cta = { text: 'Envoyer au client', action: 'bypassApproval()', className: '', secondaryText: status === 'returned' ? 'Resoumettre' : 'Soumettre', secondaryAction: 'openSubmitModal()', secondaryClassName: status === 'returned' ? 'btn-outline-orange' : 'btn-outline' };
        } else {
            cta = { text: status === 'returned' ? 'Resoumettre' : 'Soumettre', action: 'openSubmitModal()', className: status === 'returned' ? 'btn-orange' : '' };
        }
    } else if (status === 'pending_internal' && canApproveQuotes) {
        cta = { text: 'Approuver', action: 'approveSubmission()', className: '', secondaryText: 'Retourner', secondaryAction: 'returnSubmission()', secondaryClassName: 'btn-outline-orange' };
    } else if (status === 'approved_internal') {
        cta = { text: 'Envoyer au client', action: 'sendToClient()', className: '' };
    } else if (status === 'sent_client') {
        cta = { text: 'Confirmer la vente', action: 'offlineAcceptance()', className: '', secondaryText: 'Marquer comme perdu', secondaryAction: 'openLostModal()', secondaryClassName: 'btn-outline-red' };
    } else if (status === 'lost') {
        cta = { text: 'Rouvrir', action: 'reopenLostSubmission()', className: 'btn-outline' };
    }

    if (cta) {
        html += '<div class="timeline-cta">';
        if (cta.secondaryText) {
            html += '<button onclick="' + cta.secondaryAction + '" class="' + (cta.secondaryClassName || '') + '">' + escapeHtml(cta.secondaryText) + '</button> ';
        }
        html += '<button onclick="' + cta.action + '" class="' + (cta.className || '') + '">' + escapeHtml(cta.text) + '</button>';
        html += '</div>';
    }

    container.innerHTML = html;
}
