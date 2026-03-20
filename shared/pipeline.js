/**
 * shared/pipeline.js — Pipeline commercial : vues, filtres, rendu projets
 *
 * Fonctions exportées (window.*) :
 *   loadProjects, createProject, updateProject, deleteProject,
 *   loadUserFollows, toggleFollow, toggleFollowsFilter,
 *   getPipelineStatus, getContactByRole, openPriorityDropdown,
 *   openStatusDropdown, openDatePicker, switchPipelineView,
 *   populateFilterDropdowns, applyPipelineFilters, filterProjects,
 *   renderCurrentView, TABLE_COLUMNS, renderTableView,
 *   openProjectDrawer, closeProjectDrawer, renderCardView,
 *   renderSubmissionsView, renderProjectList, toggleArchiveProjectFilter,
 *   toggleArchiveProject, handleDeleteProject
 *
 * Globals requises :
 *   SUPABASE_URL, authenticatedFetch — depuis shared/auth.js
 *   escapeHtml, escapeAttr — depuis shared/utils.js
 *   pipelineStatuses, projectSources, projectTypes — chargés depuis app_config
 *   currentPipelineView, cachedProjects, pipelineSortColumn, pipelineSortDir,
 *   pipelineFilters, userFollows — state vars (déclarées dans calculateur.html)
 *   EMPLOYEES_DATA — chargé au démarrage
 *   STATUS_LABELS — labels de statut soumission
 *   openSubmission — navigation vers soumission (calculateur.html)
 *   steleConfirm, steleAlert — modales UI (calculateur.html)
 *   showSaveIndicator — indicateur sauvegarde (calculateur.html)
 *
 * Utilisé par : calculateur.html
 */

    async function loadProjects() {
        const userId = localStorage.getItem('sb_user_id');
        // Try enriched query with pipeline columns + contacts
        var r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/projects?user_id=eq.' + userId + '&order=updated_at.desc&select=*,submissions(id,submission_number,title,status,current_version,updated_at,bypass_approval,approved_total,estimateur,vendeur_cp,approbateur,internal_deadline,client_deadline,estimateur_accepted_at,is_archived),project_contacts(role,is_primary,contacts(first_name,last_name,contact_companies(companies(name))))', {});
        if (!r.ok) {
            // Fallback: basic query without pipeline columns (migrations not yet run)
            r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/projects?user_id=eq.' + userId + '&order=updated_at.desc&select=*,submissions(id,submission_number,title,status,current_version,updated_at,bypass_approval,is_archived)', {});
            if (!r.ok) return [];
        }
        var projects = await r.json();
        projects.forEach(function(p) {
            if (p.submissions) p.submissions.sort(function(a, b) { return b.submission_number - a.submission_number; });
        });
        return projects;
    }

    async function createProject(name, clientName) {
        const userId = localStorage.getItem('sb_user_id');
        const r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify({ user_id: userId, name: name, client_name: clientName || '' })
        });
        if (!r.ok) throw new Error('Erreur création projet: ' + r.status);
        const data = await r.json();
        return data[0];
    }

    async function updateProject(projectId, fields) {
        const r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/projects?id=eq.' + projectId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(fields)
        });
        return r.ok;
    }

    async function deleteProject(projectId) {
        const r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/projects?id=eq.' + projectId, {
            method: 'DELETE'
        });
        return r.ok;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PROJECT FOLLOWS (★)
    // ═══════════════════════════════════════════════════════════════════════

    async function loadUserFollows() {
        var userId = localStorage.getItem('sb_user_id');
        try {
            var r = await authenticatedFetch(SUPABASE_URL + '/rest/v1/project_follows?user_id=eq.' + userId + '&select=project_id', {});
            if (!r.ok) return;
            var rows = await r.json();
            userFollows = {};
            rows.forEach(function(row) { userFollows[row.project_id] = true; });
        } catch (e) {
            console.warn('loadUserFollows error (table may not exist yet):', e);
        }
    }

    async function toggleFollow(projectId, evt) {
        evt.stopPropagation();
        var userId = localStorage.getItem('sb_user_id');
        if (userFollows[projectId]) {
            await authenticatedFetch(SUPABASE_URL + '/rest/v1/project_follows?project_id=eq.' + projectId + '&user_id=eq.' + userId, { method: 'DELETE' });
            delete userFollows[projectId];
        } else {
            await authenticatedFetch(SUPABASE_URL + '/rest/v1/project_follows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ project_id: projectId, user_id: userId })
            });
            userFollows[projectId] = true;
        }
        renderCurrentView();
    }

    function toggleFollowsFilter() {
        pipelineFilters.followsOnly = !pipelineFilters.followsOnly;
        var btn = document.getElementById('filterFollowsBtn');
        if (btn) btn.classList.toggle('active', pipelineFilters.followsOnly);
        applyPipelineFilters();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SOUMISSIONS — CRUD SUPABASE
    // ═══════════════════════════════════════════════════════════════════════

function getPipelineStatus(slug) {
    return pipelineStatuses.find(function(s) { return s.slug === slug; }) || { slug: slug, label: slug || '—', color: '#9e9e9e' };
}

function getContactByRole(proj, role) {
    if (!proj.project_contacts) return '';
    var candidates = proj.project_contacts.filter(function(pc) { return pc.role === role && pc.contacts; });
    if (candidates.length === 0) return '';
    // Prefer is_primary; if none marked, take first
    var match = candidates.find(function(pc) { return pc.is_primary; }) || candidates[0];
    var c = match.contacts;
    // If contact has a company, show company name
    var companies = (c.contact_companies || []).map(function(cc) { return cc.companies ? cc.companies.name : ''; }).filter(Boolean);
    if (companies.length > 0) return companies[0];
    return ((c.first_name || '') + ' ' + (c.last_name || '')).trim();
}

// Full tooltip: contact name + company
function getContactTooltipByRole(proj, role) {
    if (!proj.project_contacts) return '';
    var candidates = proj.project_contacts.filter(function(pc) { return pc.role === role && pc.contacts; });
    if (candidates.length === 0) return '';
    var match = candidates.find(function(pc) { return pc.is_primary; }) || candidates[0];
    var c = match.contacts;
    var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim();
    var companies = (c.contact_companies || []).map(function(cc) { return cc.companies ? cc.companies.name : ''; }).filter(Boolean);
    if (companies.length > 0) return name + ' — ' + companies[0];
    return name;
}

function getClosestDeadline(proj) {
    var dates = [];
    if (proj.internal_deadline) dates.push(proj.internal_deadline);
    if (proj.client_deadline) dates.push(proj.client_deadline);
    (proj.submissions || []).forEach(function(s) {
        if (s.internal_deadline) dates.push(s.internal_deadline);
        if (s.client_deadline) dates.push(s.client_deadline);
    });
    if (dates.length === 0) return null;
    dates.sort();
    return dates[0];
}

function formatMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return parseFloat(n).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDateShort(d) {
    if (!d) return '\u2014';
    var parts = d.split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1];
    return d;
}

var MONTH_NAMES_FR = ['janv.','f\u00e9vr.','mars','avr.','mai','juin','juil.','ao\u00fbt','sept.','oct.','nov.','d\u00e9c.'];
function formatMonthYear(m) {
    if (!m) return '\u2014';
    var parts = m.split('-');
    if (parts.length >= 2) {
        var mi = parseInt(parts[1], 10) - 1;
        return (MONTH_NAMES_FR[mi] || parts[1]) + ' ' + parts[0];
    }
    return m;
}

// Returns { value: number|null, isOverride: boolean } for a project's display amount
function getProjectDisplayAmount(p) {
    if (p.amount_override != null) return { value: parseFloat(p.amount_override), isOverride: true };
    // Sum approved_total across submissions
    var total = 0; var hasAny = false;
    (p.submissions || []).forEach(function(s) {
        if (s.approved_total) { total += parseFloat(s.approved_total); hasAny = true; }
    });
    if (hasAny) return { value: total, isOverride: false };
    if (p.estimated_amount != null) return { value: parseFloat(p.estimated_amount), isOverride: false };
    return { value: null, isOverride: false };
}

function renderAmountCell(p) {
    var da = getProjectDisplayAmount(p);
    if (da.isOverride) {
        return '<span class="amount-override" data-tooltip="Montant estim\u00e9 manuellement">' + formatMoney(da.value) + '</span>';
    }
    return formatMoney(da.value);
}

function startAmountEdit(td, projectId, evt) {
    evt.stopPropagation();
    if (td.querySelector('.amount-inline-input')) return;
    var proj = cachedProjects.find(function(p) { return p.id === projectId; });
    var current = proj && proj.amount_override != null ? String(Math.round(proj.amount_override)) : '';
    td.innerHTML = '<input class="amount-inline-input" type="text" value="' + current + '" placeholder="Montant...">';
    var input = td.querySelector('input');
    input.focus();
    input.select();
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { input.blur(); }
        if (e.key === 'Escape') { renderCurrentView(); }
    });
    input.addEventListener('blur', function() {
        saveAmountOverride(projectId, input.value.trim());
    });
}

async function saveAmountOverride(projectId, rawValue) {
    var val = rawValue.replace(/[^0-9.,]/g, '').replace(',', '.');
    var numericVal = val === '' ? null : parseFloat(val);
    if (val !== '' && isNaN(numericVal)) { renderCurrentView(); return; }
    var proj = cachedProjects.find(function(p) { return p.id === projectId; });
    if (proj) proj.amount_override = numericVal;
    renderCurrentView();
    await updateProject(projectId, { amount_override: numericVal });
}

// ── Inline edit helpers ──

function inlineEditSelect(td, projectId, field, options, currentVal, evt) {
    evt.stopPropagation();
    if (td.querySelector('select')) return;
    var html = '<select class="inline-edit-select">';
    options.forEach(function(opt) {
        var val = typeof opt === 'object' ? opt.value : opt;
        var label = typeof opt === 'object' ? opt.label : opt;
        html += '<option value="' + escapeAttr(val) + '"' + (val === currentVal ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    });
    html += '</select>';
    td.innerHTML = html;
    var sel = td.querySelector('select');
    sel.focus();
    sel.addEventListener('change', function() { saveInlineField(projectId, field, sel.value); });
    sel.addEventListener('blur', function() { saveInlineField(projectId, field, sel.value); });
    sel.addEventListener('keydown', function(e) { if (e.key === 'Escape') renderCurrentView(); });
}

function inlineEditText(td, projectId, field, currentVal, inputType, evt) {
    evt.stopPropagation();
    if (td.querySelector('input')) return;
    td.innerHTML = '<input class="inline-edit-input" type="' + (inputType || 'text') + '" value="' + escapeAttr(currentVal || '') + '">';
    var input = td.querySelector('input');
    input.focus();
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') renderCurrentView();
    });
    input.addEventListener('blur', function() { saveInlineField(projectId, field, input.value.trim() || null); });
}

function openPriorityDropdown(el, projectId, evt) {
    evt.stopPropagation();
    evt.preventDefault();
    // Close any existing dropdown
    var existing = document.querySelector('.prio-dropdown');
    if (existing) existing.remove();

    var container = el.closest('.name-cell-inner');
    if (!container) return;

    var dd = document.createElement('div');
    dd.className = 'prio-dropdown';
    dd.innerHTML =
        '<div class="prio-dropdown-item" data-val="normal"><span class="prio-dropdown-dot" style="background:#ccc;"></span> Normal</div>' +
        '<div class="prio-dropdown-item" data-val="haute"><span class="prio-dropdown-dot" style="background:#F59E0B;"></span> Haute</div>' +
        '<div class="prio-dropdown-item" data-val="urgente"><span class="prio-dropdown-dot" style="background:#EF4444;"></span> Urgente</div>';
    container.appendChild(dd);

    dd.querySelectorAll('.prio-dropdown-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            var val = item.getAttribute('data-val');
            var proj = cachedProjects.find(function(p) { return p.id === projectId; });
            if (proj) proj.priority = val;
            dd.remove();
            renderCurrentView();
            updateProject(projectId, { priority: val });
        });
    });

    // Close on outside click
    setTimeout(function() {
        document.addEventListener('click', function closePrio(e) {
            if (!dd.contains(e.target)) {
                dd.remove();
                document.removeEventListener('click', closePrio);
            }
        });
    }, 0);
}

function openStatusDropdown(td, projectId, currentSlug, evt) {
    evt.stopPropagation();
    // Close any existing status dropdown
    var existing = document.querySelector('.status-dropdown');
    if (existing) existing.remove();

    var badge = td.querySelector('.pipeline-badge') || td;
    var rect = badge.getBoundingClientRect();

    var dd = document.createElement('div');
    dd.className = 'status-dropdown';
    dd.setAttribute('tabindex', '-1');

    var focusIdx = -1;
    var items = [];

    pipelineStatuses.forEach(function(s, idx) {
        var isActive = s.slug === currentSlug;
        if (isActive) focusIdx = idx;
        var item = document.createElement('div');
        item.className = 'status-dropdown-item' + (isActive ? ' sd-focused' : '');
        item.setAttribute('data-val', s.slug);
        item.setAttribute('data-idx', idx);
        item.innerHTML =
            '<span class="sd-dot" style="background:' + s.color + ';"></span>' +
            '<span class="sd-label">' + escapeHtml(s.label) + '</span>' +
            '<span class="sd-check">' + (isActive ? '✓' : '') + '</span>';
        dd.appendChild(item);
        items.push(item);

        item.addEventListener('click', function(e) {
            e.stopPropagation();
            closeDD();
            if (s.slug !== currentSlug) saveInlineField(projectId, 'pipeline_status', s.slug);
        });
        item.addEventListener('mouseenter', function() {
            setFocus(idx);
        });
    });

    function setFocus(idx) {
        items.forEach(function(it) { it.classList.remove('sd-focused'); });
        if (idx >= 0 && idx < items.length) {
            focusIdx = idx;
            items[idx].classList.add('sd-focused');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    }

    function closeDD() {
        dd.remove();
        document.removeEventListener('click', onOutsideClick);
        document.removeEventListener('keydown', onKeyDown);
    }

    function onOutsideClick(e) {
        if (!dd.contains(e.target)) closeDD();
    }

    function onKeyDown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocus(Math.min(focusIdx + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocus(Math.max(focusIdx - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusIdx >= 0 && items[focusIdx]) items[focusIdx].click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeDD();
        }
    }

    document.body.appendChild(dd);

    // Position: below badge, flip up if near bottom
    var ddRect = dd.getBoundingClientRect();
    var top = rect.bottom + 4;
    var left = rect.left;
    if (top + ddRect.height > window.innerHeight - 8) {
        top = rect.top - ddRect.height - 4;
    }
    if (left + ddRect.width > window.innerWidth - 8) {
        left = window.innerWidth - ddRect.width - 8;
    }
    dd.style.top = top + 'px';
    dd.style.left = left + 'px';

    dd.focus();

    setTimeout(function() {
        document.addEventListener('click', onOutsideClick);
        document.addEventListener('keydown', onKeyDown);
    }, 0);
}

// ── Generic inline dropdown (same style as status) ──
function openInlineDropdown(td, projectId, field, options, currentVal, evt) {
    evt.stopPropagation();
    var existing = document.querySelector('.status-dropdown');
    if (existing) existing.remove();

    var rect = td.getBoundingClientRect();

    var dd = document.createElement('div');
    dd.className = 'status-dropdown';
    dd.setAttribute('tabindex', '-1');

    var focusIdx = -1;
    var items = [];

    options.forEach(function(opt, idx) {
        var val = typeof opt === 'object' ? opt.value : opt;
        var label = typeof opt === 'object' ? opt.label : opt;
        var isActive = val === currentVal;
        if (isActive) focusIdx = idx;
        var item = document.createElement('div');
        item.className = 'status-dropdown-item' + (isActive ? ' sd-focused' : '');
        item.setAttribute('data-val', val);
        item.setAttribute('data-idx', idx);
        item.innerHTML =
            '<span class="sd-label">' + escapeHtml(label) + '</span>' +
            '<span class="sd-check">' + (isActive ? '\u2713' : '') + '</span>';
        dd.appendChild(item);
        items.push(item);

        item.addEventListener('click', function(e) {
            e.stopPropagation();
            closeDD();
            if (val !== currentVal) saveInlineField(projectId, field, val);
        });
        item.addEventListener('mouseenter', function() {
            setFocus(idx);
        });
    });

    function setFocus(idx) {
        items.forEach(function(it) { it.classList.remove('sd-focused'); });
        if (idx >= 0 && idx < items.length) {
            focusIdx = idx;
            items[idx].classList.add('sd-focused');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    }

    function closeDD() {
        dd.remove();
        document.removeEventListener('click', onOutsideClick);
        document.removeEventListener('keydown', onKeyDown);
    }

    function onOutsideClick(e) {
        if (!dd.contains(e.target)) closeDD();
    }

    function onKeyDown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocus(Math.min(focusIdx + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocus(Math.max(focusIdx - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusIdx >= 0 && items[focusIdx]) items[focusIdx].click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeDD();
        }
    }

    document.body.appendChild(dd);

    var ddRect = dd.getBoundingClientRect();
    var top = rect.bottom + 4;
    var left = rect.left;
    if (top + ddRect.height > window.innerHeight - 8) {
        top = rect.top - ddRect.height - 4;
    }
    if (left + ddRect.width > window.innerWidth - 8) {
        left = window.innerWidth - ddRect.width - 8;
    }
    dd.style.top = top + 'px';
    dd.style.left = left + 'px';

    dd.focus();
    setTimeout(function() {
        document.addEventListener('click', onOutsideClick);
        document.addEventListener('keydown', onKeyDown);
    }, 0);
}

// ── Date Picker (Apple/Linear style) ──
var DP_MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
var DP_MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DP_DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
var DP_DAYS_EN = ['Mo','Tu','We','Th','Fr','Sa','Su'];

// ── Date picker global state (for inline onclick handlers) ──
var _dp = null; // { el, projectId, field, selectedDate, viewDate, onOutside, onKey }

function _dpClose() {
    if (!_dp) return;
    _dp.el.remove();
    document.removeEventListener('mousedown', _dp.onOutside);
    document.removeEventListener('keydown', _dp.onKey);
    _dp = null;
}

function _dpNav(dir) {
    if (!_dp) return;
    _dp.viewDate.setMonth(_dp.viewDate.getMonth() + dir);
    _dpRender();
}

function _dpSelect(iso) {
    if (!_dp) return;
    var projectId = _dp.projectId;
    var field = _dp.field;
    _dpClose();
    saveInlineField(projectId, field, iso);
}

function _dpToday() {
    var d = new Date();
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    _dpSelect(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()));
}

function _dpClear() {
    if (!_dp) return;
    var projectId = _dp.projectId;
    var field = _dp.field;
    _dpClose();
    saveInlineField(projectId, field, null);
}

function _dpRender() {
    if (!_dp) return;
    var y = _dp.viewDate.getFullYear();
    var m = _dp.viewDate.getMonth();
    var months = DP_MONTHS_FR;
    var dayNames = DP_DAYS_FR;
    var today = new Date();
    var sel = _dp.selectedDate;

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function isSameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

    var html = '<div class="dp-header">';
    html += '<span class="dp-header-title">' + escapeHtml(months[m]) + ' ' + y + '</span>';
    html += '<div class="dp-nav">';
    html += '<button type="button" class="dp-nav-btn" onclick="_dpNav(-1);event.stopPropagation()">&#8249;</button>';
    html += '<button type="button" class="dp-nav-btn" onclick="_dpNav(1);event.stopPropagation()">&#8250;</button>';
    html += '</div></div>';

    html += '<div class="dp-weekdays">';
    dayNames.forEach(function(d) { html += '<span>' + d + '</span>'; });
    html += '</div>';

    html += '<div class="dp-grid">';

    var firstDay = new Date(y, m, 1).getDay();
    var startOffset = (firstDay + 6) % 7;
    var daysInMonth = new Date(y, m + 1, 0).getDate();

    // Previous month days
    for (var i = startOffset - 1; i >= 0; i--) {
        var dt = new Date(y, m, -i);
        html += '<button type="button" class="dp-day outside" onclick="_dpSelect(\'' + toISO(dt) + '\');event.stopPropagation()">' + dt.getDate() + '</button>';
    }

    // Current month days
    for (var d = 1; d <= daysInMonth; d++) {
        var dt = new Date(y, m, d);
        var cls = 'dp-day';
        if (isSameDay(dt, today)) cls += ' today';
        if (isSameDay(dt, sel)) cls += ' selected';
        html += '<button type="button" class="' + cls + '" onclick="_dpSelect(\'' + toISO(dt) + '\');event.stopPropagation()">' + d + '</button>';
    }

    // Next month days
    var totalCells = startOffset + daysInMonth;
    var remaining = (7 - (totalCells % 7)) % 7;
    for (var d = 1; d <= remaining; d++) {
        var dt = new Date(y, m + 1, d);
        html += '<button type="button" class="dp-day outside" onclick="_dpSelect(\'' + toISO(dt) + '\');event.stopPropagation()">' + d + '</button>';
    }

    html += '</div>';

    // Footer
    html += '<div class="dp-footer">';
    html += '<button type="button" class="dp-footer-btn dp-today-btn" onclick="_dpToday();event.stopPropagation()">Aujourd\'hui</button>';
    if (sel) {
        html += '<button type="button" class="dp-footer-btn" onclick="_dpClear();event.stopPropagation()">Effacer</button>';
    }
    html += '</div>';

    _dp.el.innerHTML = html;
}

function openDatePicker(td, projectId, currentVal, field, evt) {
    evt.stopPropagation();
    _dpClose(); // close any existing

    var selectedDate = currentVal ? new Date(currentVal + 'T00:00:00') : null;
    var viewDate = selectedDate ? new Date(selectedDate) : new Date();
    viewDate.setDate(1);

    var dp = document.createElement('div');
    dp.className = 'dp-popover';
    dp.setAttribute('tabindex', '-1');
    document.body.appendChild(dp);

    function onOutside(e) {
        if (!dp.contains(e.target)) _dpClose();
    }
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); _dpClose(); }
    }

    _dp = { el: dp, projectId: projectId, field: field, selectedDate: selectedDate, viewDate: viewDate, onOutside: onOutside, onKey: onKey };

    _dpRender();

    // Position
    var rect = td.getBoundingClientRect();
    var dpRect = dp.getBoundingClientRect();
    var top = rect.bottom + 4;
    var left = rect.left;
    if (top + dpRect.height > window.innerHeight - 8) {
        top = rect.top - dpRect.height - 4;
    }
    if (left + dpRect.width > window.innerWidth - 8) {
        left = window.innerWidth - dpRect.width - 8;
    }
    dp.style.top = top + 'px';
    dp.style.left = left + 'px';

    dp.focus();
    setTimeout(function() {
        document.addEventListener('mousedown', onOutside);
        document.addEventListener('keydown', onKey);
    }, 0);
}

async function saveInlineField(projectId, field, value) {
    var proj = cachedProjects.find(function(p) { return p.id === projectId; });
    if (proj) proj[field] = value;
    renderCurrentView();
    var patch = {};
    if (field === 'probability') {
        patch[field] = value ? parseInt(value) : 0;
    } else {
        patch[field] = value || null;
    }
    await updateProject(projectId, patch);
}

// ── Pipeline view switching ──

function switchPipelineView(view) {
    // Auto-switch to cards on mobile if table requested
    if (view === 'table' && window.innerWidth < 768) view = 'cards';
    currentPipelineView = view;
    document.querySelectorAll('.pipeline-tab').forEach(function(t) {
        t.classList.toggle('active', t.getAttribute('data-view') === view);
    });
    document.getElementById('viewTableContainer').style.display = view === 'table' ? '' : 'none';
    document.getElementById('projectGrid').style.display = view === 'cards' ? '' : 'none';
    document.getElementById('viewSubmissions').style.display = view === 'submissions' ? '' : 'none';
    // Clean up colgroup when leaving table view to avoid stale widths
    if (view !== 'table') {
        var cg = document.querySelector('#pipelineTable colgroup');
        if (cg) cg.remove();
    }
    populateFilterDropdowns();
    renderCurrentView();
}

function populateFilterDropdowns() {
    // Status filter
    var sf = document.getElementById('pipelineStatusFilter');
    var currentVal = sf.value;
    sf.innerHTML = '<option value="">Tous les statuts</option>';
    if (currentPipelineView === 'submissions') {
        var subStatuses = [['draft','Brouillon'],['pending_internal','En approbation'],['returned','Retourn\u00e9e'],['approved_internal','Pr\u00eate'],['sent_client','Envoy\u00e9e'],['accepted','Vendue'],['lost','Perdue']];
        subStatuses.forEach(function(s) { sf.innerHTML += '<option value="' + s[0] + '">' + escapeHtml(s[1]) + '</option>'; });
    } else {
        pipelineStatuses.forEach(function(s) { sf.innerHTML += '<option value="' + escapeAttr(s.slug) + '">' + escapeHtml(s.label) + '</option>'; });
    }
    sf.value = currentVal;

    // Assigned filter
    var af = document.getElementById('pipelineAssignedFilter');
    var aVal = af.value;
    af.innerHTML = '<option value="">Tous les responsables</option>';
    EMPLOYEES_DATA.forEach(function(e) { af.innerHTML += '<option value="' + escapeAttr(e.name) + '">' + escapeHtml(e.name) + '</option>'; });
    af.value = aVal;

    // Type filter
    var tf = document.getElementById('pipelineTypeFilter');
    var tVal = tf.value;
    tf.innerHTML = '<option value="">Tous les types</option>';
    projectTypes.forEach(function(t) { tf.innerHTML += '<option value="' + escapeAttr(t) + '">' + escapeHtml(t) + '</option>'; });
    tf.value = tVal;

    // Hide type filter for submissions view
    tf.style.display = currentPipelineView === 'submissions' ? 'none' : '';
}

function applyPipelineFilters() {
    pipelineFilters.search = (document.getElementById('pipelineSearch').value || '').toLowerCase();
    pipelineFilters.status = document.getElementById('pipelineStatusFilter').value;
    pipelineFilters.assigned = document.getElementById('pipelineAssignedFilter').value;
    pipelineFilters.type = document.getElementById('pipelineTypeFilter').value;
    renderCurrentView();
}

function filterProjects(projects) {
    return projects.filter(function(p) {
        // #221: hide archived projects unless filter active
        if (p.is_archived && !pipelineFilters.showArchivedProjects) return false;
        if (pipelineFilters.search) {
            var s = pipelineFilters.search;
            var haystack = [p.name, p.client_name, p.project_code, p.project_city, p.assigned_to].filter(Boolean).join(' ').toLowerCase();
            if (haystack.indexOf(s) === -1) return false;
        }
        if (pipelineFilters.status && (p.pipeline_status || 'a_contacter') !== pipelineFilters.status) return false;
        if (pipelineFilters.assigned && p.assigned_to !== pipelineFilters.assigned) return false;
        if (pipelineFilters.type && p.project_type !== pipelineFilters.type) return false;
        if (pipelineFilters.followsOnly && !userFollows[p.id]) return false;
        return true;
    });
}

function renderCurrentView() {
    var filtered = filterProjects(cachedProjects);
    var empty = document.getElementById('projectEmpty');
    if (cachedProjects.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    // #221: update archived projects counter on filter button
    var archivedProjCount = cachedProjects.filter(function(p) { return p.is_archived; }).length;
    var archProjBtn = document.getElementById('filterArchiveProjBtn');
    if (archProjBtn) {
        archProjBtn.textContent = 'Projets archiv\u00e9s' + (archivedProjCount > 0 ? ' (' + archivedProjCount + ')' : '');
        archProjBtn.style.display = archivedProjCount > 0 || pipelineFilters.showArchivedProjects ? '' : 'none';
    }

    if (currentPipelineView === 'table') renderTableView(filtered);
    else if (currentPipelineView === 'cards') renderCardView(filtered);
    else if (currentPipelineView === 'submissions') renderSubmissionsView(filtered);
}

// ── Table view ──

// Column definitions: hide = CSS class that hides at breakpoint, wCls = width class
var TABLE_COLUMNS = [
    { key: 'follow',          label: '★',          wCls: 'col-w-follow',   hide: '' },
    { key: 'name',            label: 'Nom',        wCls: 'col-w-name',     hide: '' },
    { key: 'architecte',      label: 'Archit.',    wCls: 'col-w-contact',  hide: 'col-hide-md', computed: true },
    { key: 'entrepreneur',    label: 'Entrep.',    wCls: 'col-w-contact',  hide: 'col-hide-lg', computed: true },
    { key: 'display_amount',  label: 'Montant',    wCls: 'col-w-amount',   hide: '',            cls: 'col-amount' },
    { key: 'probability',     label: 'Prob%',      wCls: 'col-w-prob',     hide: 'col-always-hidden', cls: 'col-amount' },
    { key: 'pipeline_status', label: 'Statut',     wCls: 'col-w-status',   hide: '' },
    { key: 'deadline',        label: 'Remise',     wCls: 'col-w-deadline', hide: 'col-hide-lg', computed: true },
    { key: 'assigned_to',     label: 'Resp.',      wCls: 'col-w-resp',     hide: 'col-hide-lg' },
    { key: 'project_type',    label: 'Type',       wCls: 'col-w-type',     hide: 'col-hide-xl' }
];

function renderTableView(projects) {
    var tbl = document.getElementById('pipelineTable');

    // Colgroup
    var cg = tbl.querySelector('colgroup');
    if (cg) cg.remove();
    var cgHtml = '<colgroup>';
    TABLE_COLUMNS.forEach(function(col) { cgHtml += '<col class="' + col.wCls + (col.hide ? ' ' + col.hide : '') + '">'; });
    cgHtml += '<col class="col-w-more">';
    cgHtml += '</colgroup>';
    tbl.insertAdjacentHTML('afterbegin', cgHtml);

    // Header
    var head = document.getElementById('pipelineTableHead');
    var hHtml = '<tr>';
    TABLE_COLUMNS.forEach(function(col) {
        var arrow = '';
        var sorted = pipelineSortColumn === col.key ? ' sorted' : '';
        if (pipelineSortColumn === col.key) {
            arrow = pipelineSortDir === 'asc' ? '\u25B2' : '\u25BC';
        }
        hHtml += '<th class="' + sorted + (col.hide ? ' ' + col.hide : '') + '" onclick="sortPipelineTable(\'' + col.key + '\')"><span>' + col.label + '</span><span class="sort-arrow">' + arrow + '</span></th>';
    });
    hHtml += '<th class="col-w-more"></th>';
    hHtml += '</tr>';
    head.innerHTML = hHtml;

    // Sort
    var sorted = sortProjects(projects.slice());

    // Body
    var body = document.getElementById('pipelineTableBody');
    var bHtml = '';
    sorted.forEach(function(p) {
        var ps = getPipelineStatus(p.pipeline_status);
        var prob = p.probability || 0;
        var architecte = getContactByRole(p, 'Architecte');
        var architecteTip = getContactTooltipByRole(p, 'Architecte');
        var entrepreneur = getContactByRole(p, 'Entrepreneur');
        var entrepreneurTip = getContactTooltipByRole(p, 'Entrepreneur');
        var isFollowed = userFollows[p.id] ? ' active' : '';

        var pid = escapeAttr(p.id);

        var respOpts = [{value:'', label:'\u2014'}].concat(EMPLOYEES_DATA.map(function(e) { return {value: e.name, label: e.name}; }));
        var typeOpts = [{value:'', label:'\u2014'}].concat(projectTypes.map(function(t) { return {value: t, label: t}; }));

        // Priority indicator class
        var prioCls = p.priority === 'urgente' ? ' urgente' : (p.priority === 'haute' ? ' haute' : ' normal');
        var prioTitle = p.priority === 'urgente' ? 'Urgente' : (p.priority === 'haute' ? 'Haute' : '');

        var tblAlert = getProjectAlerts(p, (localStorage.getItem('sb_user_email') || '').toLowerCase());
        bHtml += '<tr onclick="pipelineRowClick(\'' + pid + '\')"' + (p.is_archived ? ' class="project-row-archived"' : '') + '>';
        // ★ Follow
        bHtml += '<td><span class="follow-star' + isFollowed + '" onclick="toggleFollow(\'' + pid + '\',event)">\u2605</span></td>';
        // Nom with priority indicator + alert dot
        bHtml += '<td class="col-name"><div class="name-cell-inner">';
        bHtml += '<span class="prio-indicator' + prioCls + '" onclick="openPriorityDropdown(this,\'' + pid + '\',event)"' + (prioTitle ? ' title="' + prioTitle + '"' : '') + '></span>';
        if (tblAlert) bHtml += '<span class="project-alert-dot project-alert-dot--' + tblAlert.top.level + '" title="' + escapeAttr(tblAlert.top.msg) + '"></span>';
        bHtml += '<span title="' + escapeAttr(p.name || '') + '">' + escapeHtml(p.name || '\u2014') + '</span>';
        bHtml += '</div></td>';
        // Architecte
        bHtml += '<td class="col-hide-md" title="' + escapeAttr(architecteTip) + '">' + escapeHtml(architecte || '\u2014') + '</td>';
        // Entrepreneur
        bHtml += '<td class="col-hide-lg" title="' + escapeAttr(entrepreneurTip) + '">' + escapeHtml(entrepreneur || '\u2014') + '</td>';
        // Montant
        bHtml += '<td class="col-amount amount-cell" onclick="startAmountEdit(this,\'' + pid + '\',event)">' + renderAmountCell(p) + '</td>';
        // Prob% (always hidden in table, visible in drawer)
        bHtml += '<td class="col-always-hidden">' + (prob || '\u2014') + '</td>';
        // Statut pipeline
        bHtml += '<td class="inline-editable" onclick="openStatusDropdown(this,\'' + pid + '\',\'' + escapeAttr(p.pipeline_status || 'a_contacter') + '\',event)"><span class="pipeline-badge" style="background:' + ps.color + '20;color:' + ps.color + ';">' + escapeHtml(ps.label) + '</span></td>';
        // Remise
        var projDeadline = p.client_deadline || '';
        bHtml += '<td class="col-hide-lg inline-editable' + (projDeadline ? ' project-card-deadline' : '') + '" onclick="openDatePicker(this,\'' + pid + '\',\'' + escapeAttr(projDeadline) + '\',\'client_deadline\',event)">' + formatDateShort(projDeadline) + '</td>';
        // Responsable
        bHtml += '<td class="col-hide-lg inline-editable" onclick="openInlineDropdown(this,\'' + pid + '\',\'assigned_to\',' + escapeAttr(JSON.stringify(respOpts)) + ',\'' + escapeAttr(p.assigned_to || '') + '\',event)">' + escapeHtml(p.assigned_to || '\u2014') + '</td>';
        // Type
        bHtml += '<td class="col-hide-xl inline-editable" onclick="openInlineDropdown(this,\'' + pid + '\',\'project_type\',' + escapeAttr(JSON.stringify(typeOpts)) + ',\'' + escapeAttr(p.project_type || '') + '\',event)">' + escapeHtml(p.project_type || '\u2014') + '</td>';
        // More button
        bHtml += '<td class="col-w-more"><button class="tbl-more-btn" onclick="openProjectDrawer(\'' + pid + '\',event)" title="D\u00e9tails">\u2026</button></td>';
        bHtml += '</tr>';
    });
    body.innerHTML = bHtml || '<tr><td colspan="' + (TABLE_COLUMNS.length + 1) + '" style="text-align:center;color:#888;padding:24px;">Aucun projet ne correspond aux filtres.</td></tr>';
}

function sortProjects(arr) {
    var col = pipelineSortColumn;
    var dir = pipelineSortDir === 'asc' ? 1 : -1;
    return arr.sort(function(a, b) {
        var va, vb;
        if (col === 'follow') {
            va = userFollows[a.id] ? 0 : 1;
            vb = userFollows[b.id] ? 0 : 1;
        } else if (col === 'priority') {
            var prioOrder = { urgente: 0, haute: 1, normal: 2 };
            va = prioOrder[a.priority] != null ? prioOrder[a.priority] : 2;
            vb = prioOrder[b.priority] != null ? prioOrder[b.priority] : 2;
        } else if (col === 'display_amount') {
            va = (getProjectDisplayAmount(a).value || 0);
            vb = (getProjectDisplayAmount(b).value || 0);
        } else if (col === 'deadline') {
            va = a.client_deadline || 'zzzz';
            vb = b.client_deadline || 'zzzz';
        } else if (col === 'architecte') {
            va = getContactByRole(a, 'Architecte') || '';
            vb = getContactByRole(b, 'Architecte') || '';
        } else if (col === 'entrepreneur') {
            va = getContactByRole(a, 'Entrepreneur') || '';
            vb = getContactByRole(b, 'Entrepreneur') || '';
        } else {
            va = a[col]; vb = b[col];
        }
        if (va == null) va = '';
        if (vb == null) vb = '';
        if (typeof va === 'string') return va.localeCompare(vb) * dir;
        return (va - vb) * dir;
    });
}

function sortPipelineTable(col) {
    if (pipelineSortColumn === col) {
        pipelineSortDir = pipelineSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        pipelineSortColumn = col;
        pipelineSortDir = 'asc';
    }
    renderCurrentView();
}

function pipelineRowClick(projectId) {
    var proj = cachedProjects.find(function(p) { return p.id === projectId; });
    if (!proj) return;
    var subs = proj.submissions || [];
    if (subs.length > 0) {
        openSubmission(subs[0].id);
    } else {
        openProject(projectId);
    }
}

// ── Project detail drawer ──

var _drawerProjectId = null;

function drawerSave(field, value) {
    if (!_drawerProjectId) return;
    var proj = cachedProjects.find(function(p) { return p.id === _drawerProjectId; });
    if (proj) proj[field] = value;
    var patch = {};
    if (field === 'probability') patch[field] = value ? parseInt(value) : 0;
    else patch[field] = value || null;
    updateProject(_drawerProjectId, patch).then(function() { renderCurrentView(); });
}

function drawerSaveCity(value) {
    if (!_drawerProjectId) return;
    var proj = cachedProjects.find(function(p) { return p.id === _drawerProjectId; });
    if (!proj) return;
    proj.project_city = value;
    var newName = proj.project_code ? (value ? proj.project_code + ' ' + value : proj.project_code) : proj.name;
    proj.name = newName;
    document.getElementById('drawerProjectName').textContent = newName || 'Projet';
    var patch = { project_city: value || null, name: newName };
    updateProject(_drawerProjectId, patch).then(function() { renderCurrentView(); });
}

function openProjectDrawer(projectId, evt) {
    evt.stopPropagation();
    var p = cachedProjects.find(function(pr) { return pr.id === projectId; });
    if (!p) return;
    _drawerProjectId = projectId;
    document.getElementById('drawerProjectName').textContent = p.name || 'Projet';
    var ps = getPipelineStatus(p.pipeline_status);
    var da = getProjectDisplayAmount(p);
    var deadline = getClosestDeadline(p);
    var entrepreneur = getContactTooltipByRole(p, 'Entrepreneur');
    var architecte = getContactTooltipByRole(p, 'Architecte');
    var prob = p.probability || 0;

    // Build select options
    var statusOptions = pipelineStatuses.map(function(s) {
        return '<option value="' + escapeAttr(s.slug) + '"' + (s.slug === p.pipeline_status ? ' selected' : '') + '>' + escapeHtml(s.label) + '</option>';
    }).join('');

    var respOptions = '<option value="">—</option>' + EMPLOYEES_DATA.map(function(e) {
        return '<option value="' + escapeAttr(e.name) + '"' + (e.name === p.assigned_to ? ' selected' : '') + '>' + escapeHtml(e.name) + '</option>';
    }).join('');

    var prioOptions = ['normal', 'haute', 'urgente'].map(function(v) {
        var lbl = v === 'urgente' ? 'Urgente' : (v === 'haute' ? 'Haute' : 'Normal');
        return '<option value="' + v + '"' + (v === (p.priority || 'normal') ? ' selected' : '') + '>' + lbl + '</option>';
    }).join('');

    var typeOptions = '<option value="">—</option>' + projectTypes.map(function(t) {
        return '<option value="' + escapeAttr(t) + '"' + (t === p.project_type ? ' selected' : '') + '>' + escapeHtml(t) + '</option>';
    }).join('');

    var html = '';

    // Code (readonly)
    html += '<div class="drawer-field"><div class="drawer-field-label">Code</div><div class="drawer-field-value readonly">' + escapeHtml(p.project_code || '—') + '</div></div>';
    // Client (readonly — via contacts)
    html += '<div class="drawer-field"><div class="drawer-field-label">Client</div><div class="drawer-field-value readonly">' + escapeHtml(p.client_name || '—') + '</div></div>';
    // Entrepreneur (readonly — via contacts)
    html += '<div class="drawer-field"><div class="drawer-field-label">Entrepreneur</div><div class="drawer-field-value readonly">' + escapeHtml(entrepreneur || '—') + '</div></div>';
    // Architecte (readonly — via contacts)
    html += '<div class="drawer-field"><div class="drawer-field-label">Architecte</div><div class="drawer-field-value readonly">' + escapeHtml(architecte || '—') + '</div></div>';
    // Montant (readonly — calculated)
    html += '<div class="drawer-field"><div class="drawer-field-label">Montant</div><div class="drawer-field-value readonly">' + (da.value != null ? formatMoney(da.value) + (da.isOverride ? ' (estim\u00e9)' : '') : '—') + '</div></div>';
    // Probabilité
    html += '<div class="drawer-field"><div class="drawer-field-label">Probabilit\u00e9</div><input type="number" class="drawer-edit" min="0" max="100" value="' + (prob || '') + '" onchange="drawerSave(\'probability\',this.value)"></div>';
    // Responsable
    html += '<div class="drawer-field"><div class="drawer-field-label">Responsable</div><select class="drawer-edit" onchange="drawerSave(\'assigned_to\',this.value)">' + respOptions + '</select></div>';
    // Priorité
    html += '<div class="drawer-field"><div class="drawer-field-label">Priorit\u00e9</div><select class="drawer-edit" onchange="drawerSave(\'priority\',this.value)">' + prioOptions + '</select></div>';
    // Statut pipeline
    html += '<div class="drawer-field"><div class="drawer-field-label">Statut pipeline</div><select class="drawer-edit" onchange="drawerSave(\'pipeline_status\',this.value)">' + statusOptions + '</select></div>';
    // Type
    html += '<div class="drawer-field"><div class="drawer-field-label">Type</div><select class="drawer-edit" onchange="drawerSave(\'project_type\',this.value)">' + typeOptions + '</select></div>';
    // Ville
    html += '<div class="drawer-field"><div class="drawer-field-label">Ville</div><input type="text" class="drawer-edit" value="' + escapeAttr(p.project_city || '') + '" onchange="drawerSaveCity(this.value.trim())"></div>';
    // Source
    html += '<div class="drawer-field"><div class="drawer-field-label">Source</div><input type="text" class="drawer-edit" value="' + escapeAttr(p.source || '') + '" onchange="drawerSave(\'source\',this.value.trim())"></div>';
    // Livraison
    html += '<div class="drawer-field"><div class="drawer-field-label">Livraison</div><input type="month" class="drawer-edit" value="' + escapeAttr(p.delivery_month || '') + '" onchange="drawerSave(\'delivery_month\',this.value)"></div>';
    // Deadline interne
    html += '<div class="drawer-field"><div class="drawer-field-label">Deadline interne</div><input type="date" class="drawer-edit" value="' + escapeAttr(p.internal_deadline || '') + '" onchange="drawerSave(\'internal_deadline\',this.value)"></div>';
    // Deadline client
    html += '<div class="drawer-field"><div class="drawer-field-label">Deadline client</div><input type="date" class="drawer-edit" value="' + escapeAttr(p.client_deadline || '') + '" onchange="drawerSave(\'client_deadline\',this.value)"></div>';
    // Date remise (readonly — computed)
    if (deadline) {
        html += '<div class="drawer-field"><div class="drawer-field-label">Date remise</div><div class="drawer-field-value readonly">' + formatDateShort(deadline) + '</div></div>';
    }

    document.getElementById('drawerBody').innerHTML = html;
    document.getElementById('projectDrawerOverlay').classList.add('open');
    document.getElementById('projectDrawer').classList.add('open');
}

function closeProjectDrawer() {
    document.getElementById('projectDrawerOverlay').classList.remove('open');
    document.getElementById('projectDrawer').classList.remove('open');
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('projectDrawer').classList.contains('open')) {
        closeProjectDrawer();
    }
});

// ── Deadline alert engine ──

function getSubAlerts(sub, userEmail, today) {
    var alerts = [];
    if (!sub || !userEmail) return alerts;
    var s = sub.status;
    if (s === 'accepted' || s === 'lost' || sub.is_archived) return alerts;

    var email = userEmail.toLowerCase();
    var isEst = (sub.estimateur || '').toLowerCase() === email;
    var isVen = (sub.vendeur_cp || '').toLowerCase() === email;
    var isApp = (sub.approbateur || '').toLowerCase() === email;

    function daysDiff(dateStr) {
        if (!dateStr) return null;
        var d = new Date(dateStr + 'T00:00:00');
        return Math.ceil((d - today) / 86400000);
    }
    function fmtDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' });
    }

    // Estimateur alerts
    if (isEst) {
        if (!sub.estimateur_accepted_at) {
            alerts.push({ level: 'orange', msg: 'Nouvelle assignation', detail: 'Soumission #' + sub.submission_number + ' — nouvelle assignation' });
        }
        var dInt = daysDiff(sub.internal_deadline);
        if (dInt !== null) {
            if (dInt < 0) alerts.push({ level: 'red', msg: 'En retard', detail: 'Remise interne d\u00e9pass\u00e9e (' + fmtDate(sub.internal_deadline) + ')' });
            else if (dInt === 0) alerts.push({ level: 'red', msg: 'Remise aujourd\'hui', detail: 'Remise interne aujourd\'hui' });
            else if (dInt <= 3) alerts.push({ level: 'orange', msg: 'Remise dans ' + dInt + 'j', detail: 'Remise interne dans ' + dInt + ' jour' + (dInt > 1 ? 's' : '') + ' (' + fmtDate(sub.internal_deadline) + ')' });
        }
    }

    // Vendeur alerts
    if (isVen) {
        var dInt2 = daysDiff(sub.internal_deadline);
        if (dInt2 !== null && dInt2 === 0) {
            alerts.push({ level: 'orange', msg: 'V\u00e9rifier soumission', detail: 'Remise interne aujourd\'hui \u2014 v\u00e9rifier #' + sub.submission_number });
        }
        var dCli = daysDiff(sub.client_deadline);
        if (dCli !== null) {
            if (dCli < 0) alerts.push({ level: 'red', msg: 'Remise client d\u00e9pass\u00e9e', detail: 'Remise client d\u00e9pass\u00e9e (' + fmtDate(sub.client_deadline) + ')' });
            else if (dCli <= 1) alerts.push({ level: 'red', msg: 'Remise client imminente', detail: 'Remise client ' + (dCli === 0 ? 'aujourd\'hui' : 'demain') + ' (' + fmtDate(sub.client_deadline) + ')' });
        }
    }

    // Approbateur alerts
    if (isApp && s === 'pending_internal') {
        alerts.push({ level: 'orange', msg: 'En attente d\'approbation', detail: 'Soumission #' + sub.submission_number + ' en attente d\'approbation' });
    }

    return alerts;
}

function getProjectAlerts(proj, userEmail) {
    var subs = proj.submissions || [];
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var all = [];
    subs.forEach(function(sub) {
        all = all.concat(getSubAlerts(sub, userEmail, today));
    });
    if (all.length === 0) return null;
    // Sort: red first, then orange
    all.sort(function(a, b) {
        return (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1);
    });
    return { top: all[0], all: all };
}

function buildAlertBadgeHtml(projAlert) {
    if (!projAlert) return '';
    var top = projAlert.top;
    var tooltipLines = projAlert.all.map(function(a) { return escapeHtml(a.detail); }).join('<br>');
    return '<div class="project-alert-badge project-alert-badge--' + top.level + '">' +
        escapeHtml(top.msg) +
        '<div class="alert-tooltip">' + tooltipLines + '</div>' +
        '</div>';
}

// ── Card view (enriched) ──

function renderCardView(projects) {
    var grid = document.getElementById('projectGrid');
    grid.innerHTML = '';

    projects.forEach(function(proj) {
        var card = document.createElement('div');
        card.className = 'project-card' + (proj.priority === 'urgente' ? ' project-card-urgent' : '') + (proj.is_archived ? ' project-card-archived' : '');

        var subs = proj.submissions || [];
        var ps = getPipelineStatus(proj.pipeline_status);
        var deadline = proj.client_deadline || '';

        var subsHtml = '';
        var archivedCount = 0;
        subs.forEach(function(sub) {
            if (sub.is_archived && !pipelineFilters.showArchived) { archivedCount++; return; }
            var label = STATUS_LABELS[sub.status] || sub.status || 'Brouillon';
            var lineClass = 'sub-line' + (sub.is_archived ? ' archived' : '');
            subsHtml += '<div class="' + lineClass + '" data-subid="' + escapeAttr(sub.id) + '" data-projid="' + escapeAttr(proj.id) + '">' +
                '<span class="sub-number">#' + escapeHtml(String(sub.submission_number)) + '</span> ' +
                '<span class="sub-title">' + escapeHtml(sub.title || 'Sans titre') + '</span>' +
                '<span class="project-status-badge status-' + escapeAttr(sub.status) + '">' + escapeHtml(label) + (sub.bypass_approval ? ' <span class="bypass-badge">BYPASS</span>' : '') + '</span>' +
                '</div>';
        });
        if (archivedCount > 0) {
            subsHtml += '<div style="font-size:11px;color:#999;padding:2px 10px;">' + archivedCount + ' archiv\u00e9e(s)</div>';
        }

        var cardDa = getProjectDisplayAmount(proj);
        var cardAmountHtml = '';
        if (cardDa.value != null) {
            cardAmountHtml = cardDa.isOverride
                ? '<span class="project-card-amount" style="color:#c62828;" title="Montant estim\u00e9 manuellement">' + formatMoney(cardDa.value) + '</span>'
                : '<span class="project-card-amount">' + formatMoney(cardDa.value) + '</span>';
        }
        var metaHtml = '';
        var metaParts = [];
        if (proj.assigned_to) metaParts.push(escapeHtml(proj.assigned_to));
        if (proj.project_type) metaParts.push(escapeHtml(proj.project_type));
        if (deadline) metaParts.push('<span class="project-card-deadline">' + formatDateShort(deadline) + '</span>');
        if (metaParts.length) metaHtml = '<div class="project-card-meta-row">' + metaParts.join(' &middot; ') + '</div>';

        var followCls = userFollows[proj.id] ? ' active' : '';

        var followStarHtml = '<span class="follow-star card-follow' + followCls + '" onclick="toggleFollow(\'' + escapeAttr(proj.id) + '\',event)" title="Suivre">\u2605</span>';
        var pipelineWithStar = '<div class="project-card-pipeline">' +
            followStarHtml +
            '<span class="pipeline-badge" style="background:' + ps.color + '20;color:' + ps.color + ';">' + escapeHtml(ps.label) + '</span>' +
            cardAmountHtml +
            '</div>';

        var projAlert = getProjectAlerts(proj, (localStorage.getItem('sb_user_email') || '').toLowerCase());
        var alertBadgeHtml = buildAlertBadgeHtml(projAlert);

        var archiveBtnHtml = proj.is_archived
            ? '<button class="project-card-archive" onclick="toggleArchiveProject(\'' + escapeAttr(proj.id) + '\', event)" title="D\u00e9sarchiver" style="right:28px;">&#128451;</button>' +
              '<button class="project-card-delete" onclick="handleDeleteProject(\'' + escapeAttr(proj.id) + '\', event)" title="Supprimer d\u00e9finitivement">&times;</button>'
            : '<button class="project-card-archive" onclick="toggleArchiveProject(\'' + escapeAttr(proj.id) + '\', event)" title="Archiver">&#128451;</button>';
        card.innerHTML =
            archiveBtnHtml +
            alertBadgeHtml +
            pipelineWithStar +
            '<div class="project-card-name">' + escapeHtml(proj.name || 'Sans nom') + '</div>' +
            '<div class="project-card-client">' + escapeHtml(proj.client_name || '') + '</div>' +
            metaHtml +
            '<div class="project-subs">' + (subsHtml || '<div class="sub-empty">Aucune soumission</div>') + '</div>' +
            '<button class="btn-add-sub" onclick="handleAddSubmission(\'' + escapeAttr(proj.id) + '\', event)">+ Nouvelle soumission</button>';

        card.addEventListener('click', function(e) {
            if (e.target.closest('.project-card-delete') || e.target.closest('.project-card-archive') || e.target.closest('.btn-add-sub') || e.target.closest('.follow-star') || e.target.closest('.project-alert-badge')) return;
            var subLine = e.target.closest('.sub-line');
            if (subLine) {
                openSubmission(subLine.getAttribute('data-subid'));
                return;
            }
            if (subs.length > 0) openSubmission(subs[0].id);
            else openProject(proj.id);
        });

        grid.appendChild(card);
    });
}

// ── Submissions view ──

var SUB_STATUSES_ORDER = ['draft', 'pending_internal', 'returned', 'approved_internal', 'sent_client', 'accepted'];

var SUB_STATUS_LABELS = {
    draft: 'Brouillon',
    pending_internal: 'En approbation interne',
    returned: 'Retourné',
    approved_internal: 'Approuvé',
    sent_client: 'Envoyé au client',
    accepted: 'Accepté',
    lost: 'Perdue'
};

function buildMiniTimeline(status) {
    var isLost = (status === 'lost');
    var idx = isLost ? (SUB_STATUSES_ORDER.length - 1) : SUB_STATUSES_ORDER.indexOf(status);
    if (idx === -1) idx = 0;
    var html = '<span class="pipeline-mini-timeline">';
    for (var i = 0; i < SUB_STATUSES_ORDER.length; i++) {
        var isFilled = (i <= idx);
        var isLastAndLost = isLost && (i === SUB_STATUSES_ORDER.length - 1);
        if (i > 0) html += '<span class="tl-line' + (isFilled ? ' filled' : '') + '"></span>';
        var label = isLastAndLost ? 'Perdue' : (SUB_STATUS_LABELS[SUB_STATUSES_ORDER[i]] || '');
        html += '<span class="tl-dot' + (isFilled ? ' filled' : '') + (isLastAndLost ? ' lost' : '') + '" data-label="' + label + '"></span>';
    }
    html += '</span>';
    return html;
}

function renderSubmissionsView(projects) {
    // Flatten all submissions
    var allSubs = [];
    projects.forEach(function(p) {
        (p.submissions || []).forEach(function(s) {
            s._project = p;
            allSubs.push(s);
        });
    });

    // Apply submission-specific filters
    if (pipelineFilters.search) {
        var q = pipelineFilters.search;
        allSubs = allSubs.filter(function(s) {
            var haystack = [s.title, s._project.name, s._project.client_name, String(s.submission_number)].filter(Boolean).join(' ').toLowerCase();
            return haystack.indexOf(q) !== -1;
        });
    }
    if (pipelineFilters.status) {
        allSubs = allSubs.filter(function(s) { return s.status === pipelineFilters.status; });
    }
    if (pipelineFilters.assigned) {
        allSubs = allSubs.filter(function(s) { return s.estimateur === pipelineFilters.assigned || s.vendeur_cp === pipelineFilters.assigned; });
    }
    if (!pipelineFilters.showArchived) {
        allSubs = allSubs.filter(function(s) { return !s.is_archived; });
    }

    // Sort by updated_at desc
    allSubs.sort(function(a, b) { return (b.updated_at || '').localeCompare(a.updated_at || ''); });

    // Header
    var head = document.getElementById('submissionsTableHead');
    head.innerHTML = '<tr><th>#</th><th>Titre</th><th>Projet</th><th>Client</th><th>Montant</th><th>Estimateur</th><th>Vendeur</th><th>Statut</th><th>Remise</th></tr>';

    // Body
    var body = document.getElementById('submissionsTableBody');
    var html = '';
    var subUserEmail = (localStorage.getItem('sb_user_email') || '').toLowerCase();
    var subToday = new Date(); subToday.setHours(0, 0, 0, 0);
    allSubs.forEach(function(s) {
        var deadline = s.internal_deadline || s.client_deadline || '';
        var subAlerts = getSubAlerts(s, subUserEmail, subToday);
        var subDot = '';
        if (subAlerts.length > 0) {
            var topLevel = subAlerts.some(function(a) { return a.level === 'red'; }) ? 'red' : 'orange';
            subDot = '<span class="project-alert-dot project-alert-dot--' + topLevel + '" title="' + escapeAttr(subAlerts[0].msg) + '"></span>';
        }
        html += '<tr onclick="openSubmission(\'' + escapeAttr(s.id) + '\')">';
        html += '<td style="font-weight:700;color:var(--sw-navy);">' + subDot + '#' + escapeHtml(String(s.submission_number)) + '</td>';
        html += '<td class="col-name">' + escapeHtml(s.title || 'Sans titre') + '</td>';
        html += '<td>' + escapeHtml(s._project.name || '—') + '</td>';
        html += '<td>' + escapeHtml(s._project.client_name || '—') + '</td>';
        html += '<td class="col-amount">' + (s.approved_total ? formatMoney(s.approved_total) : '—') + '</td>';
        html += '<td>' + escapeHtml(s.estimateur || '—') + '</td>';
        html += '<td>' + escapeHtml(s.vendeur_cp || '—') + '</td>';
        html += '<td>' + buildMiniTimeline(s.status) + '</td>';
        html += '<td' + (deadline ? ' class="project-card-deadline"' : '') + '>' + formatDateShort(deadline) + '</td>';
        html += '</tr>';
    });
    body.innerHTML = html || '<tr><td colspan="9" style="text-align:center;color:#888;padding:24px;">Aucune soumission ne correspond aux filtres.</td></tr>';
}

// ── Main renderProjectList — loads data then renders current view ──

async function renderProjectList() {
    cachedProjects = await loadProjects();
    await loadUserFollows();
    populateFilterDropdowns();
    renderCurrentView();
}
function toggleArchiveProjectFilter() {
    pipelineFilters.showArchivedProjects = !pipelineFilters.showArchivedProjects;
    var btn = document.getElementById('filterArchiveProjBtn');
    if (btn) btn.classList.toggle('active', pipelineFilters.showArchivedProjects);
    renderCurrentView();
}

async function toggleArchiveProject(projectId, event) {
    if (event) event.stopPropagation();
    var proj = cachedProjects.find(function(p) { return p.id === projectId; });
    if (!proj) return;
    var newVal = !proj.is_archived;
    var msg = newVal ? 'Archiver ce projet ?' : 'D\u00e9sarchiver ce projet ?';
    if (!(await steleConfirm(msg, newVal ? 'Archiver' : 'D\u00e9sarchiver', newVal ? 'Archiver' : 'D\u00e9sarchiver'))) return;
    try {
        await authenticatedFetch(SUPABASE_URL + '/rest/v1/projects?id=eq.' + projectId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ is_archived: newVal })
        });
        proj.is_archived = newVal;
        renderCurrentView();
        showSaveIndicator();
        showConstraintToast(newVal ? 'Projet archiv\u00e9' : 'Projet d\u00e9sarchiv\u00e9');
    } catch (e) {
        console.error('Erreur archivage projet:', e);
        steleAlert('Erreur: ' + e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// SUPPRIMER UN PROJET
// ═══════════════════════════════════════════════════════════════════════

async function handleDeleteProject(projectId, event) {
    event.stopPropagation();
    // #221: deletion only from archived view
    var proj = cachedProjects.find(function(p) { return p.id === projectId; });
    if (proj && !proj.is_archived) {
        steleAlert('Archivez ce projet avant de le supprimer.');
        return;
    }
    // Block deletion for projects with sold/invoiced submissions
    var PROTECTED_STATUSES = ['accepted', 'invoiced'];
    try {
        var chk = await authenticatedFetch(
            SUPABASE_URL + '/rest/v1/submissions?project_id=eq.' + projectId
            + '&status=in.(' + PROTECTED_STATUSES.join(',') + ')&select=id&limit=1', {}
        );
        if (chk.ok) {
            var rows = await chk.json();
            if (rows.length > 0) {
                steleAlert('Ce projet contient une soumission vendue et ne peut pas \u00eatre supprim\u00e9.');
                return;
            }
        }
    } catch (e) { /* continue to normal flow */ }
    if (!(await steleConfirm('Supprimer d\u00e9finitivement ce projet et toutes ses donn\u00e9es\u00a0? Cette action est irr\u00e9versible.', 'Supprimer le projet', 'Supprimer d\u00e9finitivement', true))) return;
    if (!(await steleConfirm('\u00cates-vous certain\u00a0? Cette action est irr\u00e9versible.', 'Confirmation', 'Oui, supprimer', true))) return;
    var ok = await deleteProject(projectId);
    if (!ok) {
        steleAlert('Ce projet contient des donn\u00e9es. Supprimez d\u2019abord les soumissions.');
        return;
    }
    showConstraintToast('Projet supprim\u00e9');
    renderProjectList();
}
