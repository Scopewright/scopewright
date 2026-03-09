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

        // 3. Replace acceptance/signature section with printable signature line
        var acceptPage = clone.querySelector('.pv-page-total');
        if (acceptPage) {
            // Add printable signature block after the total box
            var totalBox = acceptPage.querySelector('.pv-total-box');
            if (totalBox) {
                var sigBlock = document.createElement('div');
                sigBlock.style.cssText = 'margin-top:48px;padding:0 56px;width:100%;';
                var sigLabel = currentLang === 'en' ? 'Accepted by' : 'Accept\u00e9 par';
                var dateLabel = currentLang === 'en' ? 'Date' : 'Date';
                sigBlock.innerHTML =
                    '<div style="display:flex;gap:64px;justify-content:center;margin-top:24px;">' +
                        '<div style="flex:1;max-width:300px;">' +
                            '<div style="border-bottom:1px solid #333;height:40px;"></div>' +
                            '<div style="font-size:11px;color:#888;margin-top:6px;text-transform:uppercase;letter-spacing:1px;">' + sigLabel + '</div>' +
                        '</div>' +
                        '<div style="flex:0 0 180px;">' +
                            '<div style="border-bottom:1px solid #333;height:40px;"></div>' +
                            '<div style="font-size:11px;color:#888;margin-top:6px;text-transform:uppercase;letter-spacing:1px;">' + dateLabel + '</div>' +
                        '</div>' +
                    '</div>';
                totalBox.parentNode.insertBefore(sigBlock, totalBox.nextSibling);
            }
        }

        // Remove any existing acceptance proof badge (interactive)
        clone.querySelectorAll('[style*="background:#e8f5e9"]').forEach(function(el) {
            el.remove();
        });

        // 3b. Convert cross-origin images to base64 data URLs
        //     Supabase Storage images are cross-origin — html2canvas renders them
        //     as blank unless they are inlined as data URLs.
        await _convertImagesToBase64(clone);

        // 4. Build standalone HTML document for PDF rendering
        var pdfHtml = '<!DOCTYPE html><html><head>' +
            '<meta charset="UTF-8">' +
            '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">' +
            '<style>' + SNAPSHOT_CSS +
            '\n.pv-content{padding:0;gap:0}' +
            '\n.pv-page{page-break-after:always;aspect-ratio:11/8.5;width:100%;box-sizing:border-box}' +
            '\n.pv-page:last-child{page-break-after:auto}' +
            '</style>' +
            '</head><body>' +
            '<div class="pv-content">' + clone.innerHTML + '</div>' +
            '</body></html>';

        // 5. Create temporary container for html2pdf
        var tempContainer = document.createElement('div');
        tempContainer.innerHTML = '<div class="pv-content">' + clone.innerHTML + '</div>';
        tempContainer.style.cssText = 'position:fixed;left:-9999px;top:0;width:1056px;';
        // Apply SNAPSHOT_CSS via a style tag inside
        var styleEl = document.createElement('style');
        styleEl.textContent = SNAPSHOT_CSS +
            '\n.pv-content{padding:0;gap:0}' +
            '\n.pv-page{page-break-after:always;aspect-ratio:auto;width:100%;box-sizing:border-box;height:auto;overflow:visible}' +
            '\n.pv-page:last-child{page-break-after:auto}';
        tempContainer.prepend(styleEl);
        document.body.appendChild(tempContainer);

        // 6. Generate filename
        var orgName = (introConfig && introConfig.org_name) ? introConfig.org_name : 'Stele';
        var projectCode = (currentProject && currentProject.project_code) ? currentProject.project_code : 'PROJ';
        var subNumber = currentSubmission.submission_number || '000';
        var version = currentSubmission.current_version || '1';
        var filename = _sanitizePdfFilename(orgName) + '_' + projectCode + '_' + subNumber + '_v' + version + '.pdf';

        // 7. Generate PDF
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
            pagebreak: { mode: ['css', 'legacy'], before: '.pv-page' }
        };

        await html2pdf().set(opt).from(tempContainer).save();

        // 8. Cleanup
        document.body.removeChild(tempContainer);

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
