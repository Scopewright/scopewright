/**
 * shared/pdf-export.js — PDF export for submissions
 *
 * Exports the preview content as a landscape Letter PDF via PDFShift API
 * (server-side Chromium rendering through the pdf-export Edge Function).
 *
 * Exported functions:
 *   - exportSubmissionPdf()
 *
 * Required globals (from calculateur.html):
 *   - currentProject, currentSubmission, currentLang
 *   - introConfig (for org_name)
 *   - renderPreview()
 *   - SNAPSHOT_CSS
 *   - escapeHtml()
 *   - authenticatedFetch() (from shared/auth.js)
 *   - SUPABASE_URL (from shared/auth.js)
 *
 * Used by: calculateur.html
 */

async function exportSubmissionPdf() {
    if (!currentSubmission) {
        steleAlert('Aucune soumission ouverte.', 'Erreur');
        return;
    }

    var btn = document.getElementById('btnPdfExport');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'PDF...';
    }

    try {
        // 1. Render preview to get current HTML
        await renderPreview();
        var container = document.getElementById('pvContent');
        if (!container) throw new Error('Preview container not found');

        // 2. Clone content and clean up interactive elements
        var clone = container.cloneNode(true);

        clone.querySelectorAll('.pv-img-delete, .pv-img-badge-client, .pv-page-clause-actions, .pv-clause-dropzone, .pv-optimize-btn, button, .pv-img-ai-ref-badge').forEach(function(el) {
            el.remove();
        });
        clone.querySelectorAll('[contenteditable]').forEach(function(el) {
            el.removeAttribute('contenteditable');
        });
        // Convert textareas to divs
        clone.querySelectorAll('textarea').forEach(function(ta) {
            var div = document.createElement('div');
            div.className = ta.className;
            div.style.cssText = ta.style.cssText;
            div.innerHTML = escapeHtml(ta.value).replace(/\n/g, '<br>');
            ta.parentNode.replaceChild(div, ta);
        });

        // 3. Rebuild total+signature page — 2-column layout matching quote.html
        var acceptPage = clone.querySelector('.pv-page-total');
        if (acceptPage) {
            var isEn = currentLang === 'en';
            var finalTitle = isEn ? 'Your project is ready.' : 'Votre projet est pr\u00eat.';
            var para1 = isEn ? 'This proposal reflects the vision we built together.' : 'Cette proposition refl\u00e8te la vision que nous avons construite ensemble.';
            var para2 = isEn ? 'Each element was designed with precision, respecting Stele standards.' : 'Chaque \u00e9l\u00e9ment a \u00e9t\u00e9 con\u00e7u avec pr\u00e9cision, dans le respect des standards Stele.';
            var para3 = isEn ? 'By confirming, we launch the next stages of production.' : 'En confirmant, nous lan\u00e7ons les prochaines \u00e9tapes de r\u00e9alisation.';
            var sigLabel = isEn ? 'Accepted by' : 'Accept\u00e9 par';
            var dateLabel = 'Date';

            // Extract total data from the existing total box
            var totalBox = acceptPage.querySelector('.pv-total-box');
            var breakdownHtml = '';
            var totalLabelText = '';
            var totalAmountText = '';
            var taxesText = '';
            var installNote = acceptPage.querySelector('.pv-install-total-note');
            var installHtml = installNote ? '<div style="font-size:11px;color:#9A9A9A;letter-spacing:0.3px;margin-bottom:8px;">' + installNote.innerHTML + '</div>' : '';

            if (totalBox) {
                var breakdown = totalBox.querySelector('.pv-total-breakdown');
                if (breakdown) {
                    var lines = breakdown.querySelectorAll('.pv-total-subtotal-line, .pv-total-discount-line');
                    lines.forEach(function(line) {
                        var spans = line.querySelectorAll('span');
                        var isDiscount = line.classList.contains('pv-total-discount-line');
                        var color = isDiscount ? '#ef5350' : '#6F6F6F';
                        breakdownHtml += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:' + color + ';">';
                        spans.forEach(function(s) { breakdownHtml += '<span>' + s.innerHTML + '</span>'; });
                        breakdownHtml += '</div>';
                    });
                    if (breakdownHtml) breakdownHtml = '<div style="margin-bottom:8px;">' + breakdownHtml + '<div style="height:1px;background:#E5E5E5;margin:6px 0;"></div></div>';
                }
                var labelEl = totalBox.querySelector('.total-label');
                var amountEl = totalBox.querySelector('.total-amount');
                var taxesEl = totalBox.querySelector('.total-taxes');
                totalLabelText = labelEl ? labelEl.innerHTML : '';
                totalAmountText = amountEl ? amountEl.innerHTML : '';
                taxesText = taxesEl ? taxesEl.innerHTML : '';
            }

            // Build 2-column layout
            acceptPage.innerHTML =
                '<div style="height:1px;background:rgba(0,0,0,0.14);margin:0 80px;"></div>' +
                '<div style="display:flex;width:100%;height:100%;padding:80px;box-sizing:border-box;align-items:center;">' +

                    // Left column — emotional closing text (55%)
                    '<div style="width:55%;padding-right:48px;">' +
                        '<div style="font-family:Inter,-apple-system,sans-serif;font-size:38px;font-weight:300;line-height:1.25;color:#1A1A1A;letter-spacing:-0.02em;margin-bottom:64px;">' + finalTitle + '</div>' +
                        '<div style="max-width:440px;">' +
                            '<p style="font-size:15px;font-weight:400;line-height:1.75;color:#6F6F6F;margin:0 0 20px 0;">' + para1 + '</p>' +
                            '<p style="font-size:15px;font-weight:400;line-height:1.75;color:#6F6F6F;margin:0 0 20px 0;">' + para2 + '</p>' +
                            '<p style="font-size:15px;font-weight:400;line-height:1.75;color:#6F6F6F;margin:0;">' + para3 + '</p>' +
                        '</div>' +
                    '</div>' +

                    // Vertical separator (1px)
                    '<div style="width:1px;background:#F0F0F0;align-self:stretch;"></div>' +

                    // Right column — total + signature lines
                    '<div style="flex:1;padding-left:48px;">' +
                        // Total block
                        '<div>' +
                            installHtml +
                            breakdownHtml +
                            '<div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.14em;color:#9A9A9A;margin-bottom:8px;">' + totalLabelText + '</div>' +
                            '<div style="font-size:48px;font-weight:300;letter-spacing:-0.02em;color:#111;line-height:1.1;">' + totalAmountText + '</div>' +
                            '<div style="font-size:12.5px;color:#9A9A9A;margin-top:6px;">' + taxesText + '</div>' +
                        '</div>' +

                        // Signature lines
                        '<div style="margin-top:32px;">' +
                            '<div style="border-bottom:1px solid #E5E5E5;height:36px;"></div>' +
                            '<div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.14em;color:#9A9A9A;margin-top:6px;">' + sigLabel + '</div>' +
                        '</div>' +
                        '<div style="max-width:180px;margin-top:32px;">' +
                            '<div style="border-bottom:1px solid #E5E5E5;height:36px;"></div>' +
                            '<div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.14em;color:#9A9A9A;margin-top:6px;">' + dateLabel + '</div>' +
                        '</div>' +
                    '</div>' +

                '</div>';
        }

        // Remove any existing acceptance proof badge (interactive)
        clone.querySelectorAll('[style*="background:#e8f5e9"]').forEach(function(el) {
            el.remove();
        });

        // Resolve relative image URLs to absolute (PDFShift can't resolve relative paths)
        var baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
        clone.querySelectorAll('img').forEach(function(img) {
            var src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('blob:')) {
                img.setAttribute('src', baseUrl + src);
            }
        });

        // Bug 2 fix: sanitize double-escaped HTML entities in descriptions.
        // Some DB descriptions contain literal "&lt;br&gt;" instead of <br> tags.
        var rawHtml = clone.innerHTML;
        rawHtml = rawHtml.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
        rawHtml = rawHtml.replace(/&lt;(\/?(p|strong|em|ul|ol|li|b|i|u|h[1-6]))&gt;/gi, '<$1>');

        // 4. Build self-contained HTML document for PDFShift
        // All overrides use !important to guarantee they beat SNAPSHOT_CSS rules
        // at identical specificity (same class selectors, later in cascade).
        var pdfCss = SNAPSHOT_CSS +
            // Page sizing: landscape Letter = 11×8.5 in. Each .pv-page fills one print page.
            // aspect-ratio removed (caused blank pages) but min-height ensures vertical centering works.
            '\n.pv-content{padding:0!important;gap:0!important}' +
            '\n.pv-page{width:100%!important;box-sizing:border-box!important;height:auto!important;aspect-ratio:unset!important;overflow:visible!important;position:relative!important;min-height:8.5in!important;max-height:none!important}' +
            '\n.pv-page:not(:first-child){page-break-before:always}' +
            // Cover page: restore overflow:hidden for border-radius clip + force full height
            '\n.pv-page-title{overflow:hidden!important;height:8.5in!important;min-height:8.5in!important}' +
            '\n.pv-cover-right{-webkit-border-radius:8px!important;border-radius:8px!important;overflow:hidden!important;height:calc(8.5in - 64px)!important;min-height:calc(8.5in - 64px)!important}' +
            '\n.pv-cover-right img{-webkit-border-radius:0!important;border-radius:0!important;height:100%!important;min-height:100%!important}' +
            // Clauses: force white background (SNAPSHOT_CSS uses #fafafa)
            '\n.pv-page-clause{background:#fff!important}' +
            '\n.pv-page-total{background:#fff!important;color:#1A1A1A!important;display:flex!important;flex-direction:column!important}' +
            '\n.pv-total-box{display:none!important}' +
            // 2-column layouts: constrain overflow, vertical centering via flex
            '\n.pv-page-room-body{overflow:hidden!important;max-width:100%!important;box-sizing:border-box!important}' +
            '\n.pv-page-room-text{overflow:hidden!important;word-wrap:break-word!important;overflow-wrap:break-word!important;min-width:0!important}' +
            '\n.pv-page-room-media{overflow:hidden!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}' +
            '\n.pv-page-room-media .pv-img-wrap{overflow:hidden!important;min-width:0!important;max-width:100%!important}' +
            '\n.pv-page-room-media .pv-img-wrap img{object-fit:contain!important;object-position:center!important;max-width:100%!important}' +
            '\n.pv-page-intro{overflow:hidden!important;max-width:100%!important;box-sizing:border-box!important}' +
            '\n.pv-intro-content{overflow:hidden!important;word-wrap:break-word!important;overflow-wrap:break-word!important;min-width:0!important}' +
            // "Why" page: ensure grid fills page height for image + text centering
            '\n.pv-page-why{overflow:hidden!important;max-width:100%!important;box-sizing:border-box!important;height:8.5in!important}' +
            '\n.pv-why-image{min-height:0!important}' +
            '\n.pv-why-image img{height:100%!important;min-height:100%!important}' +
            '\n.pv-why-content{overflow:hidden!important;word-wrap:break-word!important;overflow-wrap:break-word!important;min-width:0!important}' +
            // Steps page: ensure grid fills page for vertical distribution
            '\n.pv-page-steps{display:flex!important;flex-direction:column!important}';

        var htmlDoc = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=1056">' +
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">' +
            '<style>' + pdfCss + '</style>' +
            '</head><body style="margin:0;padding:0;">' +
            '<div class="pv-content" style="width:1056px;">' + rawHtml + '</div>' +
            '</body></html>';

        // Diagnostic: log HTML size and image sources for debugging
        console.log('[PDF] HTML size:', htmlDoc.length, 'chars');
        console.log('[PDF] Style block present:', htmlDoc.indexOf('.pv-page{') > -1);
        var _imgMatches = htmlDoc.match(/src="([^"]+)"/g) || [];
        console.log('[PDF] Image sources (' + _imgMatches.length + '):', _imgMatches.slice(0, 10).join(' | '));

        // 5. Generate filename
        var orgName = (introConfig && introConfig.org_name) ? introConfig.org_name : 'Stele';
        var projectCode = (currentProject && currentProject.project_code) ? currentProject.project_code : 'PROJ';
        var subNumber = currentSubmission.submission_number || '000';
        var version = currentSubmission.current_version || '1';
        var filename = _sanitizePdfFilename(orgName) + '_' + projectCode + '_' + subNumber + '_v' + version + '.pdf';

        // 6. Call Edge Function
        var resp = await authenticatedFetch(
            SUPABASE_URL + '/functions/v1/pdf-export',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: htmlDoc })
            }
        );

        if (!resp.ok) {
            var errData;
            try { errData = await resp.json(); } catch (e) { errData = {}; }
            console.error('[PDF] PDFShift error:', resp.status, errData);
            // Download the HTML for debugging
            var debugBlob = new Blob([htmlDoc], { type: 'text/html' });
            var debugUrl = URL.createObjectURL(debugBlob);
            var debugA = document.createElement('a');
            debugA.href = debugUrl;
            debugA.download = 'debug-pdf-source.html';
            document.body.appendChild(debugA);
            debugA.click();
            document.body.removeChild(debugA);
            URL.revokeObjectURL(debugUrl);
            throw new Error((errData.error || 'PDF generation failed') + ' (HTTP ' + resp.status + ')' + (errData.detail ? ' — ' + errData.detail : ''));
        }

        // 7. Download the PDF blob
        var blob = await resp.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error('[PDF] Export failed:', err);
        steleAlert('Erreur lors de l\'export PDF : ' + (err.message || err), 'Erreur');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'PDF';
        }
    }
}

function _sanitizePdfFilename(str) {
    return str
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}
