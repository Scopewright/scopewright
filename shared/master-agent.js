/**
 * shared/master-agent.js — Agent Maître global drawer
 *
 * Exported globals:
 *   masterAgentOpen()        — open the drawer
 *   masterAgentClose()       — close the drawer
 *   masterAgentSendMessage() — send a user message
 *   masterAgentClearChat()   — reset conversation
 *   masterAgentSyncDocs()    — sync docs to app_config
 *   masterSanityReport(issues) — display sanity check results
 *   _masterSanityIssues      — current issues array
 *
 * Required globals (from shared/auth.js):
 *   SUPABASE_URL, authenticatedFetch
 *
 * Required globals (from shared/utils.js):
 *   escapeHtml
 *
 * Each page should define:
 *   window.getMasterContext = function() { return { page, ... }; }
 *
 * Used by: calculateur.html, catalogue_prix_stele_complet.html,
 *          admin.html, approbation.html, clients.html
 */

/* jshint esversion: 6 */
/* global SUPABASE_URL, authenticatedFetch, escapeHtml */

(function() {
    'use strict';

    // ══════════════════════════════════════════
    // CSS injection
    // ══════════════════════════════════════════
    var css = document.createElement('style');
    css.textContent = `
/* Master Agent — FAB button */
.ma-fab {
    position: fixed; bottom: 24px; right: 24px; z-index: 9000;
    width: 30px; height: 30px; border-radius: 50%;
    background: #0B1220; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    opacity: 0.28; transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
}
.ma-fab:hover { opacity: 1; width: 44px; height: 44px; }
.ma-fab svg { width: 15px; height: 15px; color: #fff; transition: all 0.2s ease; }
.ma-fab:hover svg { width: 22px; height: 22px; }
.ma-fab-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 18px; height: 18px; padding: 0 5px;
    background: #EF4444; color: #fff; font-size: 10px; font-weight: 700;
    border-radius: 9px; display: none;
    align-items: center; justify-content: center; line-height: 18px;
}
.ma-fab-badge.visible { display: flex; }

/* Master Agent — Drawer overlay */
.ma-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.25); z-index: 9500;
    opacity: 0; pointer-events: none;
    transition: opacity 0.25s;
}
.ma-overlay.open { opacity: 1; pointer-events: auto; }

/* Master Agent — Drawer */
.ma-drawer {
    position: fixed; top: 0; right: -440px; bottom: 0;
    width: 420px; max-width: 100vw; z-index: 9600;
    background: #fff; box-shadow: -4px 0 20px rgba(0,0,0,0.1);
    display: flex; flex-direction: column;
    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
.ma-drawer.open { right: 0; }

/* Drawer header */
.ma-header {
    display: flex; align-items: center; gap: 10px;
    padding: 16px 20px; border-bottom: 1px solid #E2E8F0;
    flex-shrink: 0;
}
.ma-header-title { font-size: 15px; font-weight: 700; color: #0F172A; flex: 1; }
.ma-header-btn {
    width: 32px; height: 32px; border-radius: 8px;
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #94A3B8; transition: background 0.12s, color 0.12s;
}
.ma-header-btn:hover { background: #F1F5F9; color: #0F172A; }

/* Sync bar */
.ma-sync-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 20px; border-bottom: 1px solid #F1F5F9;
    flex-shrink: 0;
}
.ma-sync-btn {
    background: none; border: 1px solid #E2E8F0;
    padding: 4px 10px; font-size: 11px; font-weight: 500;
    border-radius: 6px; cursor: pointer; font-family: inherit;
    color: #64748B; transition: all 0.12s; white-space: nowrap;
}
.ma-sync-btn:hover { border-color: #0B1220; color: #0B1220; }
.ma-sync-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ma-sync-status { font-size: 10px; color: #94A3B8; flex: 1; text-align: right; }

/* Sanity issues bar */
.ma-sanity-bar {
    display: none; padding: 8px 20px;
    border-bottom: 1px solid #FDE68A;
    background: #FFFBEB; flex-shrink: 0;
    cursor: pointer; transition: background 0.12s;
}
.ma-sanity-bar:hover { background: #FEF3C7; }
.ma-sanity-bar.visible { display: flex; align-items: center; gap: 8px; }
.ma-sanity-icon { font-size: 14px; }
.ma-sanity-text { font-size: 12px; color: #92400E; font-weight: 500; flex: 1; }
.ma-sanity-details {
    display: none; padding: 0 20px 12px;
    background: #FFFBEB; border-bottom: 1px solid #FDE68A;
    flex-shrink: 0;
}
.ma-sanity-details.visible { display: block; }
.ma-sanity-item {
    padding: 4px 0; font-size: 12px; color: #78350F;
    display: flex; align-items: flex-start; gap: 6px;
}
.ma-sanity-item-dot {
    width: 6px; height: 6px; border-radius: 50%;
    margin-top: 5px; flex-shrink: 0;
}
.ma-sanity-item-dot.critical { background: #EF4444; }
.ma-sanity-item-dot.warning { background: #F59E0B; }
.ma-sanity-item-dot.info { background: #3B82F6; }

/* Messages area */
.ma-messages {
    flex: 1; overflow-y: auto; padding: 16px 20px;
    display: flex; flex-direction: column; gap: 14px;
    scrollbar-width: thin; scrollbar-color: #d1d5db transparent;
}
.ma-messages::-webkit-scrollbar { width: 5px; }
.ma-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
.ma-msg {
    max-width: 90%; padding: 10px 14px;
    font-size: 13px; line-height: 1.6;
    border-radius: 12px; word-wrap: break-word;
}
.ma-msg.user {
    align-self: flex-end;
    background: #0B1220; color: #fff;
    border-bottom-right-radius: 4px;
}
.ma-msg.assistant {
    align-self: flex-start;
    background: #F1F5F9; color: #0F172A;
    border-bottom-left-radius: 4px;
}
.ma-msg.system {
    align-self: center; text-align: center;
    background: none; color: #94A3B8;
    font-size: 11px; font-style: italic; padding: 4px 8px;
}
/* Markdown in assistant messages */
.ma-msg.assistant h1,.ma-msg.assistant h2,.ma-msg.assistant h3,.ma-msg.assistant h4 {
    margin: 10px 0 4px; font-weight: 700;
}
.ma-msg.assistant h1,.ma-msg.assistant h2 { font-size: 14px; }
.ma-msg.assistant h3,.ma-msg.assistant h4 { font-size: 13px; }
.ma-msg.assistant h1:first-child,.ma-msg.assistant h2:first-child,.ma-msg.assistant h3:first-child { margin-top: 0; }
.ma-msg.assistant ul,.ma-msg.assistant ol { margin: 4px 0; padding-left: 18px; }
.ma-msg.assistant li { margin: 2px 0; }
.ma-msg.assistant code {
    background: rgba(0,0,0,0.06); padding: 1px 5px;
    border-radius: 4px; font-size: 12px;
    font-family: 'SF Mono','Cascadia Code','Consolas',monospace;
}
.ma-msg.assistant pre {
    background: #1E293B; color: #E2E8F0;
    padding: 10px 12px; border-radius: 6px;
    overflow-x: auto; margin: 6px 0; font-size: 11px;
}
.ma-msg.assistant pre code { background: none; padding: 0; color: inherit; }
.ma-msg.assistant table { border-collapse: collapse; margin: 6px 0; font-size: 11px; width: 100%; }
.ma-msg.assistant th,.ma-msg.assistant td { border: 1px solid #d1d5db; padding: 3px 6px; text-align: left; }
.ma-msg.assistant th { background: #E2E8F0; font-weight: 600; }
.ma-msg.assistant strong { font-weight: 700; }
.ma-msg.assistant blockquote {
    border-left: 3px solid #CBD5E1; padding: 4px 10px; margin: 6px 0;
    color: #475569; font-size: 12px;
}
/* Tool approval buttons */
.ma-tool-bar {
    display: flex; gap: 8px; margin-top: 8px;
}
.ma-tool-btn {
    padding: 5px 12px; font-size: 12px; font-weight: 500;
    border-radius: 6px; cursor: pointer; font-family: inherit;
    border: 1px solid; transition: opacity 0.12s;
}
.ma-tool-btn.apply { background: #0B1220; color: #fff; border-color: #0B1220; }
.ma-tool-btn.apply:hover { opacity: 0.85; }
.ma-tool-btn.dismiss { background: #fff; color: #64748B; border-color: #E2E8F0; }
.ma-tool-btn.dismiss:hover { background: #F1F5F9; }

/* Typing indicator */
.ma-typing {
    align-self: flex-start; padding: 10px 14px;
    background: #F1F5F9; border-radius: 12px;
    border-bottom-left-radius: 4px;
    display: flex; gap: 4px; align-items: center;
}
.ma-typing-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #94A3B8;
    animation: maTyping 1.4s ease-in-out infinite;
}
.ma-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.ma-typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes maTyping {
    0%,60%,100% { opacity: 0.3; transform: scale(0.8); }
    30% { opacity: 1; transform: scale(1); }
}

/* Input bar */
.ma-input-bar {
    display: flex; gap: 8px; padding: 12px 20px;
    border-top: 1px solid #E2E8F0; align-items: flex-end;
    flex-shrink: 0;
}
.ma-input {
    flex: 1; padding: 8px 12px;
    border: 1px solid #E2E8F0; border-radius: 10px;
    font-family: inherit; font-size: 13px;
    resize: none; min-height: 38px; max-height: 100px;
    line-height: 1.5; color: #0F172A;
    transition: border-color 0.15s;
}
.ma-input:focus { outline: none; border-color: #0B1220; }
.ma-send-btn {
    width: 38px; height: 38px; flex-shrink: 0;
    background: #0B1220; color: #fff; border: none;
    border-radius: 10px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: opacity 0.12s;
}
.ma-send-btn:hover { opacity: 0.85; }
.ma-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
`;
    document.head.appendChild(css);

    // ══════════════════════════════════════════
    // DOM creation
    // ══════════════════════════════════════════
    var _messages = [];
    var _busy = false;
    var _contextSent = false;
    var _sanityDetailsOpen = false;
    var _pendingTools = [];

    window._masterSanityIssues = [];

    function createDOM() {
        // FAB button
        var fab = document.createElement('button');
        fab.className = 'ma-fab';
        fab.id = 'maFab';
        fab.title = 'Agent Ma\u00eetre';
        fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2a7 7 0 017 7c0 2.8-1.6 5.2-4 6.3V17a1 1 0 01-1 1h-4a1 1 0 01-1-1v-1.7A7 7 0 0112 2z"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="10" y1="24" x2="14" y2="24"/></svg>' +
            '<span class="ma-fab-badge" id="maFabBadge"></span>';
        fab.onclick = function() { masterAgentOpen(); };
        document.body.appendChild(fab);

        // Overlay
        var overlay = document.createElement('div');
        overlay.className = 'ma-overlay';
        overlay.id = 'maOverlay';
        overlay.onclick = function() { masterAgentClose(); };
        document.body.appendChild(overlay);

        // Drawer
        var drawer = document.createElement('div');
        drawer.className = 'ma-drawer';
        drawer.id = 'maDrawer';
        drawer.innerHTML =
            '<div class="ma-header">' +
                '<span class="ma-header-title">Agent Ma\u00eetre</span>' +
                '<button class="ma-header-btn" onclick="masterAgentSyncDocs()" title="Synchroniser les docs">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' +
                '</button>' +
                '<button class="ma-header-btn" onclick="masterAgentClearChat()" title="Nouvelle conversation">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
                '<button class="ma-header-btn" onclick="masterAgentClose()" title="Fermer">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="ma-sync-bar" id="maSyncBar">' +
                '<span class="ma-sync-status" id="maSyncStatus"></span>' +
            '</div>' +
            '<div class="ma-sanity-bar" id="maSanityBar" onclick="masterAgentToggleSanity()">' +
                '<span class="ma-sanity-icon">\u26a0</span>' +
                '<span class="ma-sanity-text" id="maSanityText"></span>' +
            '</div>' +
            '<div class="ma-sanity-details" id="maSanityDetails"></div>' +
            '<div class="ma-messages" id="maMessages"></div>' +
            '<div class="ma-input-bar">' +
                '<textarea class="ma-input" id="maInput" placeholder="Posez une question..." rows="1" onkeydown="masterAgentKeydown(event)"></textarea>' +
                '<button class="ma-send-btn" id="maSendBtn" onclick="masterAgentSendMessage()" title="Envoyer">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
                '</button>' +
            '</div>';
        document.body.appendChild(drawer);
    }

    // ══════════════════════════════════════════
    // Open / Close
    // ══════════════════════════════════════════
    window.masterAgentOpen = function() {
        document.getElementById('maOverlay').classList.add('open');
        document.getElementById('maDrawer').classList.add('open');
        // Inject page context on first open (silent — no auto-question)
        if (!_contextSent) {
            _contextSent = true;
            var ctx = {};
            if (typeof window.getMasterContext === 'function') {
                try { ctx = window.getMasterContext(); } catch(e) { console.warn('getMasterContext error:', e); }
            }
            if (ctx && Object.keys(ctx).length > 0) {
                _messages.push({ role: 'user', content: '[CONTEXTE PAGE]\n' + JSON.stringify(ctx, null, 2), hidden: true });
            }
        }
        setTimeout(function() {
            var input = document.getElementById('maInput');
            if (input) input.focus();
        }, 300);
    };

    window.masterAgentClose = function() {
        document.getElementById('maOverlay').classList.remove('open');
        document.getElementById('maDrawer').classList.remove('open');
    };

    // ══════════════════════════════════════════
    // Markdown → HTML
    // ══════════════════════════════════════════
    function mdToHtml(md) {
        var html = escapeHtml(md);
        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
            return '<pre><code>' + code.trim() + '</code></pre>';
        });
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        // Tables
        html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, function(_, hLine, sep, body) {
            var hs = hLine.split('|').filter(function(c) { return c.trim(); });
            var rs = body.trim().split('\n');
            var t = '<table><thead><tr>';
            hs.forEach(function(h) { t += '<th>' + h.trim() + '</th>'; });
            t += '</tr></thead><tbody>';
            rs.forEach(function(row) {
                var cs = row.split('|').filter(function(c) { return c.trim(); });
                t += '<tr>';
                cs.forEach(function(c) { t += '<td>' + c.trim() + '</td>'; });
                t += '</tr>';
            });
            t += '</tbody></table>';
            return t;
        });
        // Blockquotes
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');
        // Lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
        html = html.replace(/<\/ul>\s*<ul>/g, '');
        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/\n/g, '<br>');
        html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, function(m, code) {
            return '<pre><code>' + code.replace(/<br>/g, '\n') + '</code></pre>';
        });
        return html;
    }

    // ══════════════════════════════════════════
    // Render messages
    // ══════════════════════════════════════════
    function renderMessages() {
        var container = document.getElementById('maMessages');
        if (!container) return;
        var html = '';
        for (var i = 0; i < _messages.length; i++) {
            var m = _messages[i];
            if (m.hidden) continue;
            if (m.role === 'user') {
                html += '<div class="ma-msg user">' + escapeHtml(m.content) + '</div>';
            } else if (m.role === 'assistant') {
                html += '<div class="ma-msg assistant">' + mdToHtml(m.content) + '</div>';
                // Tool approval buttons
                if (m.tools && m.tools.length > 0 && !m.toolsHandled) {
                    html += '<div class="ma-tool-bar" id="maToolBar-' + i + '">';
                    html += '<button class="ma-tool-btn apply" onclick="masterAgentApplyTools(' + i + ')">Appliquer</button>';
                    html += '<button class="ma-tool-btn dismiss" onclick="masterAgentDismissTools(' + i + ')">Ignorer</button>';
                    html += '</div>';
                }
            } else if (m.role === 'system') {
                html += '<div class="ma-msg system">' + escapeHtml(m.content) + '</div>';
            }
        }
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    function showTyping() {
        var container = document.getElementById('maMessages');
        if (!container) return;
        var el = document.createElement('div');
        el.className = 'ma-typing';
        el.id = 'maTypingIndicator';
        el.innerHTML = '<div class="ma-typing-dot"></div><div class="ma-typing-dot"></div><div class="ma-typing-dot"></div>';
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
    }

    function hideTyping() {
        var el = document.getElementById('maTypingIndicator');
        if (el) el.remove();
    }

    // ══════════════════════════════════════════
    // Send message
    // ══════════════════════════════════════════
    window.masterAgentSendMessage = function() {
        if (_busy) return;
        var input = document.getElementById('maInput');
        var text = (input.value || '').trim();
        if (!text) return;
        _messages.push({ role: 'user', content: text });
        input.value = '';
        input.style.height = 'auto';
        renderMessages();
        callApi();
    };

    async function callApi() {
        _busy = true;
        var sendBtn = document.getElementById('maSendBtn');
        if (sendBtn) sendBtn.disabled = true;
        showTyping();

        try {
            // Build API messages (user + assistant only, exclude hidden context for display but include for API)
            var apiMessages = [];
            for (var i = 0; i < _messages.length; i++) {
                var m = _messages[i];
                if (m.role === 'user' || m.role === 'assistant') {
                    if (m.role === 'assistant' && m.toolResults) {
                        // Include tool_result blocks
                        apiMessages.push({ role: 'assistant', content: m.rawContent || m.content });
                        for (var t = 0; t < m.toolResults.length; t++) {
                            apiMessages.push({ role: 'user', content: [m.toolResults[t]] });
                        }
                    } else {
                        apiMessages.push({ role: m.role, content: m.content });
                    }
                }
            }

            // Capture page context for the API
            var pageContext = null;
            if (typeof window.getMasterContext === 'function') {
                try { pageContext = window.getMasterContext(); } catch(e) {}
            }

            var resp = await authenticatedFetch(SUPABASE_URL + '/functions/v1/ai-master', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    page_context: pageContext
                })
            });

            hideTyping();

            if (!resp.ok) {
                var errText = '';
                try { errText = await resp.text(); } catch(e) {}
                if (resp.status === 429 || resp.status === 529) {
                    _messages.push({ role: 'system', content: 'Le serveur est occup\u00e9. R\u00e9essayez dans quelques secondes.' });
                } else {
                    _messages.push({ role: 'system', content: 'Erreur ' + resp.status });
                }
                renderMessages();
                return;
            }

            var result = await resp.json();
            var textParts = [];
            var toolUses = [];

            if (result.content && Array.isArray(result.content)) {
                for (var j = 0; j < result.content.length; j++) {
                    var block = result.content[j];
                    if (block.type === 'text') textParts.push(block.text);
                    if (block.type === 'tool_use') toolUses.push(block);
                }
            }

            var assistantMsg = {
                role: 'assistant',
                content: textParts.join('\n'),
                rawContent: result.content,
                tools: toolUses.length > 0 ? toolUses : null,
                toolsHandled: false
            };
            _messages.push(assistantMsg);

            // Auto-execute read-only tools
            if (toolUses.length > 0) {
                var readOnlyTools = ['list_learnings', 'read_prompt', 'list_all_prompts'];
                var allReadOnly = toolUses.every(function(tu) { return readOnlyTools.indexOf(tu.name) >= 0; });
                if (allReadOnly) {
                    assistantMsg.toolsHandled = true;
                    // Execute server-side tools were already handled, result is in response
                    if (result.tool_results) {
                        assistantMsg.toolResults = result.tool_results;
                        renderMessages();
                        // Send tool results back to get the final response
                        callApi();
                        return;
                    }
                }
            }

            renderMessages();

        } catch (err) {
            hideTyping();
            _messages.push({ role: 'system', content: 'Erreur r\u00e9seau : ' + err.message });
            renderMessages();
        } finally {
            _busy = false;
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    // ══════════════════════════════════════════
    // Tool approval (Apply / Dismiss)
    // ══════════════════════════════════════════
    window.masterAgentApplyTools = async function(msgIndex) {
        var msg = _messages[msgIndex];
        if (!msg || !msg.tools) return;
        msg.toolsHandled = true;

        var toolBar = document.getElementById('maToolBar-' + msgIndex);
        if (toolBar) toolBar.innerHTML = '<span style="font-size:11px;color:#16a34a;">Appliqu\u00e9 \u2713</span>';

        for (var i = 0; i < msg.tools.length; i++) {
            var tool = msg.tools[i];
            await executeToolClientSide(tool.name, tool.input, tool.id);
        }
    };

    window.masterAgentDismissTools = function(msgIndex) {
        var msg = _messages[msgIndex];
        if (!msg) return;
        msg.toolsHandled = true;
        var toolBar = document.getElementById('maToolBar-' + msgIndex);
        if (toolBar) toolBar.innerHTML = '<span style="font-size:11px;color:#94a3b8;">Ignor\u00e9</span>';
    };

    async function executeToolClientSide(toolName, input, toolId) {
        try {
            if (toolName === 'update_learning') {
                var r = await authenticatedFetch(
                    SUPABASE_URL + '/rest/v1/ai_learnings?id=eq.' + input.id,
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rule: input.rule })
                    }
                );
                _messages.push({ role: 'system', content: r.ok ? 'R\u00e8gle mise \u00e0 jour.' : 'Erreur mise \u00e0 jour.' });
            } else if (toolName === 'delete_learning') {
                var r2 = await authenticatedFetch(
                    SUPABASE_URL + '/rest/v1/ai_learnings?id=eq.' + input.id,
                    { method: 'DELETE' }
                );
                _messages.push({ role: 'system', content: r2.ok ? 'R\u00e8gle supprim\u00e9e.' : 'Erreur suppression.' });
            } else if (toolName === 'update_prompt_section') {
                // Read current prompt, apply diff, save
                var rp = await authenticatedFetch(
                    SUPABASE_URL + '/rest/v1/app_config?key=eq.' + encodeURIComponent(input.prompt_key) + '&select=value',
                    {}
                );
                if (rp.ok) {
                    var data = await rp.json();
                    var currentValue = (data && data[0] && data[0].value) ? data[0].value : '';
                    if (typeof currentValue !== 'string') currentValue = '';

                    if (input.old_text && input.new_text) {
                        var newValue = currentValue.replace(input.old_text, input.new_text);
                        if (newValue === currentValue) {
                            _messages.push({ role: 'system', content: 'Texte \u00e0 remplacer introuvable dans le prompt.' });
                        } else {
                            var rs = await authenticatedFetch(
                                SUPABASE_URL + '/rest/v1/app_config',
                                {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
                                    body: JSON.stringify({ key: input.prompt_key, value: JSON.stringify(newValue) })
                                }
                            );
                            if (rs.ok) {
                                _messages.push({ role: 'system', content: 'Prompt mis \u00e0 jour : ' + escapeHtml(input.prompt_key) });
                                // Log the change
                                logPromptChange(input.prompt_key, input.old_text, input.new_text, input.reason || '');
                            } else {
                                _messages.push({ role: 'system', content: 'Erreur sauvegarde prompt.' });
                            }
                        }
                    }
                }
            }
            renderMessages();
        } catch (err) {
            _messages.push({ role: 'system', content: 'Erreur outil : ' + err.message });
            renderMessages();
        }
    }

    async function logPromptChange(promptKey, oldText, newText, reason) {
        try {
            // Read current log
            var r = await authenticatedFetch(
                SUPABASE_URL + '/rest/v1/app_config?key=eq.prompt_change_log&select=value',
                {}
            );
            var log = [];
            if (r.ok) {
                var data = await r.json();
                if (data && data[0] && data[0].value) {
                    try { log = JSON.parse(data[0].value); } catch(e) {}
                    if (!Array.isArray(log)) log = [];
                }
            }
            // Append entry
            log.push({
                date: new Date().toISOString().slice(0, 10),
                prompt_key: promptKey,
                old_text: (oldText || '').substring(0, 200),
                new_text: (newText || '').substring(0, 200),
                reason: reason || ''
            });
            // Save
            await authenticatedFetch(
                SUPABASE_URL + '/rest/v1/app_config',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify({ key: 'prompt_change_log', value: JSON.stringify(log) })
                }
            );
        } catch(e) {
            console.warn('logPromptChange error:', e);
        }
    }

    // ══════════════════════════════════════════
    // Keyboard + auto-resize
    // ══════════════════════════════════════════
    window.masterAgentKeydown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            masterAgentSendMessage();
        }
        setTimeout(function() {
            var ta = document.getElementById('maInput');
            if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; }
        }, 0);
    };

    // ══════════════════════════════════════════
    // Clear chat
    // ══════════════════════════════════════════
    window.masterAgentClearChat = function() {
        _messages = [];
        _contextSent = false;
        _pendingTools = [];
        var container = document.getElementById('maMessages');
        if (container) container.innerHTML = '';
    };

    // ══════════════════════════════════════════
    // Sync docs
    // ══════════════════════════════════════════
    window.masterAgentSyncDocs = async function() {
        // Find status element — drawer (#maSyncStatus) or admin panel (#masterSyncStatus)
        var status = document.getElementById('maSyncStatus') || document.getElementById('masterSyncStatus');
        var btn = document.getElementById('masterSyncBtn');

        // Show feedback immediately
        if (status) { status.textContent = 'Synchronisation en cours...'; status.style.color = '#64748B'; }
        if (btn) btn.disabled = true;

        try {
            var docs = {};
            var baseUrl = window.location.origin + '/';

            try {
                var r1 = await fetch(baseUrl + 'docs/MASTER_CONTEXT.md');
                if (r1.ok) {
                    docs.master_context = await r1.text();
                } else {
                    console.warn('[masterAgentSyncDocs] MASTER_CONTEXT.md fetch failed:', r1.status);
                }
            } catch(e) { console.warn('[masterAgentSyncDocs] MASTER_CONTEXT.md fetch error:', e.message); }
            try {
                var r2 = await fetch(baseUrl + 'CLAUDE.md');
                if (r2.ok) {
                    docs.master_claude_md = await r2.text();
                } else {
                    console.warn('[masterAgentSyncDocs] CLAUDE.md fetch failed:', r2.status);
                }
            } catch(e) { console.warn('[masterAgentSyncDocs] CLAUDE.md fetch error:', e.message); }

            var saved = 0;
            var keys = Object.keys(docs);
            if (keys.length === 0) {
                if (status) { status.textContent = 'Aucun document trouv\u00e9'; status.style.color = '#d97706'; }
                return;
            }
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var val = docs[key];
                if (!val || !val.trim()) continue;
                var r = await authenticatedFetch(
                    SUPABASE_URL + '/rest/v1/app_config',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
                        body: JSON.stringify({ key: key, value: JSON.stringify(val) })
                    }
                );
                if (!r.ok) console.warn('[masterAgentSyncDocs] Save failed for', key, ':', r.status);
                if (r.ok) saved++;
            }

            // Save sync timestamp
            var now = new Date();
            var isoTs = now.toISOString();
            try {
                await authenticatedFetch(
                    SUPABASE_URL + '/rest/v1/app_config',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
                        body: JSON.stringify({ key: 'master_context_synced_at', value: JSON.stringify(isoTs) })
                    }
                );
                saved++;
            } catch(e) { console.warn('[masterAgentSyncDocs] Timestamp save error:', e.message); }

            var ts = now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
            console.log('[masterAgentSyncDocs] Done:', saved + '/' + (keys.length + 1), 'items saved');
            if (status) {
                status.textContent = saved + '/' + (keys.length + 1) + ' docs sync \u2014 ' + ts;
                status.style.color = saved === (keys.length + 1) ? '#16a34a' : '#d97706';
            }
        } catch (err) {
            console.error('[masterAgentSyncDocs] Error:', err);
            if (status) { status.textContent = 'Erreur : ' + err.message; status.style.color = '#dc2626'; }
        } finally {
            if (btn) btn.disabled = false;
        }
    };

    // ══════════════════════════════════════════
    // Sanity checks display
    // ══════════════════════════════════════════
    window.masterSanityReport = function(issues) {
        window._masterSanityIssues = issues || [];
        var badge = document.getElementById('maFabBadge');
        var bar = document.getElementById('maSanityBar');
        var text = document.getElementById('maSanityText');

        if (!issues || issues.length === 0) {
            if (badge) { badge.classList.remove('visible'); badge.textContent = ''; }
            if (bar) bar.classList.remove('visible');
            return;
        }

        if (badge) { badge.classList.add('visible'); badge.textContent = issues.length; }
        if (bar) bar.classList.add('visible');
        if (text) text.textContent = issues.length + ' avertissement' + (issues.length > 1 ? 's' : '');

        // Render details
        var details = document.getElementById('maSanityDetails');
        if (details) {
            var html = '';
            for (var i = 0; i < issues.length; i++) {
                var issue = issues[i];
                var level = issue.level || 'warning';
                html += '<div class="ma-sanity-item">' +
                    '<span class="ma-sanity-item-dot ' + level + '"></span>' +
                    '<span>' + escapeHtml(issue.message) + '</span>' +
                    '</div>';
            }
            details.innerHTML = html;
        }
    };

    window.masterAgentToggleSanity = function() {
        _sanityDetailsOpen = !_sanityDetailsOpen;
        var details = document.getElementById('maSanityDetails');
        if (details) details.classList.toggle('visible', _sanityDetailsOpen);
    };

    // ══════════════════════════════════════════
    // Init
    // ══════════════════════════════════════════
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createDOM);
    } else {
        createDOM();
    }

})();
