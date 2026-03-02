// ═══════════════════════════════════════════════════════════════════════
// shared/auth.js — Authentification Supabase partagée
// Inclut : constantes Supabase, refresh token, authenticatedFetch
// Utilisé par : calculateur, catalogue, admin, approbation, clients, fiche, app
// ═══════════════════════════════════════════════════════════════════════

var SUPABASE_URL = 'https://rplzbtjfnwahqodrhpny.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbHpidGpmbndhaHFvZHJocG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDU2MDEsImV4cCI6MjA4NjIyMTYwMX0.OQAZhc029PbRDSe1b02NDAuOUE8yn-_h3QqSnUDpLeU';

// ── Token refresh ──

var _refreshPromise = null;

function isTokenExpiringSoon(token, bufferSec) {
    if (!token) return true;
    try { var p = JSON.parse(atob(token.split('.')[1])); return p.exp < (Date.now() / 1000 + (bufferSec || 300)); }
    catch(e) { return true; }
}

function _tokenDebug(token) {
    if (!token) return 'null';
    try { var p = JSON.parse(atob(token.split('.')[1])); var ttl = Math.round(p.exp - Date.now() / 1000); return 'exp in ' + ttl + 's'; }
    catch(e) { return 'invalid'; }
}

async function refreshAccessToken() {
    if (_refreshPromise) { console.log('[auth] Refresh already in progress, reusing promise'); return _refreshPromise; }
    _refreshPromise = (async function() {
        var rt = localStorage.getItem('sb_refresh_token');
        if (!rt) { console.warn('[auth] No refresh token in localStorage'); return false; }
        try {
            var r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
                body: JSON.stringify({ refresh_token: rt })
            });
            if (!r.ok) {
                var errBody = await r.text().catch(function() { return ''; });
                console.warn('[auth] Refresh failed:', r.status, errBody.substring(0, 200));
                return false;
            }
            var d = await r.json();
            if (d.access_token) {
                localStorage.setItem('sb_access_token', d.access_token);
                localStorage.setItem('sb_refresh_token', d.refresh_token);
                console.log('[auth] Token refreshed OK —', _tokenDebug(d.access_token));
                return true;
            }
            console.warn('[auth] Refresh response missing access_token');
            return false;
        } catch(e) { console.warn('[auth] Refresh exception:', e.message); return false; }
    })();
    var result = await _refreshPromise;
    _refreshPromise = null;
    return result;
}

async function authenticatedFetch(url, options) {
    options = options || {};
    var token = localStorage.getItem('sb_access_token');
    var endpoint = url.split('/').pop().split('?')[0];

    // Proactive refresh if token expires within 5 minutes
    if (isTokenExpiringSoon(token, 300)) {
        console.log('[auth]', endpoint, '— token expiring soon (' + _tokenDebug(token) + '), refreshing...');
        if (await refreshAccessToken()) token = localStorage.getItem('sb_access_token');
    }

    var headers = Object.assign({}, options.headers || {}, {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + token
    });
    var resp = await fetch(url, Object.assign({}, options, { headers: headers }));

    // Retry loop on 401/403
    if (resp.status === 401 || resp.status === 403) {
        console.warn('[auth]', endpoint, '— got', resp.status, '(token:', _tokenDebug(token) + '). Refreshing...');
        for (var attempt = 1; attempt <= 2; attempt++) {
            if (attempt === 2) {
                console.warn('[auth]', endpoint, '— attempt 2: waiting 1s before retry...');
                await new Promise(function(r) { setTimeout(r, 1000); });
                _refreshPromise = null; // force a fresh refresh
            }
            if (await refreshAccessToken()) {
                token = localStorage.getItem('sb_access_token');
                headers['Authorization'] = 'Bearer ' + token;
                resp = await fetch(url, Object.assign({}, options, { headers: headers }));
                if (resp.status !== 401 && resp.status !== 403) {
                    console.log('[auth]', endpoint, '— retry', attempt, 'succeeded:', resp.status);
                    return resp;
                }
                console.warn('[auth]', endpoint, '— retry', attempt, 'still', resp.status);
            } else {
                console.warn('[auth]', endpoint, '— refresh failed on attempt', attempt, '— redirecting to login');
                localStorage.removeItem('sb_access_token');
                localStorage.removeItem('sb_refresh_token');
                window.location.href = 'login.html';
                return resp;
            }
        }
    }
    return resp;
}
