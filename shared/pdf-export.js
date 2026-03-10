/**
 * shared/pdf-export.js — PDF export for submissions
 *
 * Exports the preview content as a landscape 8.5x11 PDF using html2pdf.js.
 * Replaces the interactive signature box with a printable signature line.
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
 *
 * Used by: calculateur.html
 */

async function exportSubmissionPdf() {
    if (typeof html2pdf === 'undefined') {
        steleAlert('La librairie PDF n\'est pas chargée. Vérifiez votre connexion et rafraîchissez la page.', 'Erreur');
        return;
    }
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

        // 2. Clone content and clean up
        var clone = container.cloneNode(true);

        // Remove interactive elements
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
            div.textContent = ta.value;
            ta.parentNode.replaceChild(div, ta);
        });

        // 3. Rebuild total+signature page — 2-column layout matching quote.html "Votre projet est prêt"
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

            // Build 2-column layout (same as quote.html pv-page-final)
            acceptPage.innerHTML =
                '<div style="height:1px;background:rgba(0,0,0,0.14);margin:0 80px;"></div>' +
                '<div style="flex:1;display:grid;grid-template-columns:55% 1px 1fr;padding:80px;gap:0;min-height:0;">' +

                    // Left column — emotional closing text
                    '<div style="display:flex;flex-direction:column;justify-content:center;padding-right:64px;">' +
                        '<div style="font-family:Inter,-apple-system,sans-serif;font-size:38px;font-weight:300;line-height:1.25;color:#1A1A1A;letter-spacing:-0.02em;margin-bottom:64px;">' + finalTitle + '</div>' +
                        '<div style="max-width:440px;">' +
                            '<p style="font-size:15px;font-weight:400;line-height:1.75;color:#6F6F6F;margin:0 0 20px 0;">' + para1 + '</p>' +
                            '<p style="font-size:15px;font-weight:400;line-height:1.75;color:#6F6F6F;margin:0 0 20px 0;">' + para2 + '</p>' +
                            '<p style="font-size:15px;font-weight:400;line-height:1.75;color:#6F6F6F;margin:0;">' + para3 + '</p>' +
                        '</div>' +
                    '</div>' +

                    // Vertical separator
                    '<div style="width:1px;background:#F0F0F0;align-self:stretch;"></div>' +

                    // Right column — total + signature lines
                    '<div style="display:flex;flex-direction:column;justify-content:center;padding-left:48px;gap:32px;">' +
                        // Total block
                        '<div>' +
                            installHtml +
                            breakdownHtml +
                            '<div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.14em;color:#9A9A9A;margin-bottom:8px;">' + totalLabelText + '</div>' +
                            '<div style="font-size:48px;font-weight:300;letter-spacing:-0.02em;color:#111;line-height:1.1;">' + totalAmountText + '</div>' +
                            '<div style="font-size:12.5px;color:#9A9A9A;margin-top:6px;">' + taxesText + '</div>' +
                        '</div>' +

                        // Signature lines
                        '<div>' +
                            '<div style="border-bottom:1px solid #E5E5E5;height:36px;"></div>' +
                            '<div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.14em;color:#9A9A9A;margin-top:6px;">' + sigLabel + '</div>' +
                        '</div>' +
                        '<div style="max-width:180px;">' +
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

        // 3b. Convert cross-origin images to base64 data URLs
        //     Supabase Storage images are cross-origin — html2canvas renders them
        //     as blank unless they are inlined as data URLs.
        await _convertImagesToBase64(clone);

        // 4. Inject SNAPSHOT_CSS into document.head so html2canvas can read computed styles.
        //    html2canvas reads from document.styleSheets, not inline <style> in the target.
        var styleEl = document.createElement('style');
        styleEl.id = 'pdf-export-snapshot-css';
        styleEl.textContent = SNAPSHOT_CSS +
            '\n.pv-content{padding:0;gap:0}' +
            '\n.pv-page{width:100%;box-sizing:border-box;height:auto;overflow:visible}' +
            '\n.pv-page:not(:first-child){page-break-before:always}' +
            '\n.pv-page-total{background:#fff;color:#1A1A1A;display:flex;flex-direction:column}' +
            '\n.pv-total-box{display:none}';
        document.head.appendChild(styleEl);

        // 5. Build element for html2pdf — do NOT append to DOM manually.
        //    html2pdf.toContainer() creates its own overlay and moves the element into it.
        //    Manual DOM insertion causes conflicts (double-parenting, cleanup race).
        var pdfRoot = document.createElement('div');
        pdfRoot.className = 'pv-content';
        pdfRoot.style.width = '1056px';
        pdfRoot.innerHTML = clone.innerHTML;

        // 6. Generate filename
        var orgName = (introConfig && introConfig.org_name) ? introConfig.org_name : 'Stele';
        var projectCode = (currentProject && currentProject.project_code) ? currentProject.project_code : 'PROJ';
        var subNumber = currentSubmission.submission_number || '000';
        var version = currentSubmission.current_version || '1';
        var filename = _sanitizePdfFilename(orgName) + '_' + projectCode + '_' + subNumber + '_v' + version + '.pdf';

        // 7. Generate PDF — html2pdf manages the DOM lifecycle (overlay create/destroy)
        var opt = {
            margin: 0,
            filename: filename,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                width: 1056,
                windowWidth: 1056
            },
            jsPDF: {
                unit: 'in',
                format: 'letter',
                orientation: 'landscape'
            },
            pagebreak: { mode: 'css' }
        };

        await html2pdf().set(opt).from(pdfRoot).save();

    } catch (err) {
        console.error('[PDF] Export failed:', err);
        steleAlert('Erreur lors de l\'export PDF : ' + (err.message || err), 'Erreur');
    } finally {
        // Cleanup injected stylesheet
        var injectedStyle = document.getElementById('pdf-export-snapshot-css');
        if (injectedStyle) injectedStyle.remove();
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

/**
 * Convert all <img> elements with external src to base64 data URLs.
 * This prevents blank images in the PDF caused by html2canvas
 * failing to capture cross-origin resources (Supabase Storage).
 */
async function _convertImagesToBase64(container) {
    var imgs = container.querySelectorAll('img[src]');
    var promises = [];
    imgs.forEach(function(img) {
        var src = img.getAttribute('src');
        // Skip already-inlined images and empty src
        if (!src || src.startsWith('data:')) return;
        promises.push(
            _fetchImageAsBase64(src).then(function(dataUrl) {
                if (dataUrl) img.setAttribute('src', dataUrl);
            }).catch(function() {
                // Leave original src — html2canvas will try useCORS as fallback
            })
        );
    });
    await Promise.all(promises);
}

/**
 * Fetch an image URL and return a base64 data URL.
 * Returns null if the fetch fails.
 */
async function _fetchImageAsBase64(url) {
    try {
        var resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) return null;
        var blob = await resp.blob();
        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onloadend = function() { resolve(reader.result); };
            reader.onerror = function() { resolve(null); };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return null;
    }
}
