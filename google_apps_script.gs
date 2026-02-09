/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  STELE — Script d'envoi d'estimation par courriel                   ║
 * ║                                                                      ║
 * ║  INSTRUCTIONS DE DÉPLOIEMENT:                                        ║
 * ║  1. Aller sur https://script.google.com                              ║
 * ║  2. Créer un nouveau projet                                          ║
 * ║  3. Coller ce code dans le fichier Code.gs                           ║
 * ║  4. Modifier EMAIL_DESTINATAIRE ci-dessous                           ║
 * ║  5. Cliquer "Déployer" > "Nouveau déploiement"                      ║
 * ║  6. Type: "Application Web"                                          ║
 * ║  7. Exécuter en tant que: "Moi"                                      ║
 * ║  8. Accès: "Tout le monde"                                           ║
 * ║  9. Copier l'URL du déploiement dans le fichier HTML                 ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION — Modifier cette adresse courriel
// ═══════════════════════════════════════════════════════════════════════
const EMAIL_DESTINATAIRE = 'soumissions@stele.ca'; // <-- CHANGER ICI

// ═══════════════════════════════════════════════════════════════════════
// GESTION DES REQUÊTES
// ═══════════════════════════════════════════════════════════════════════

// Gérer les requêtes POST (envoi du formulaire)
function doPost(e) {
  try {
    const raw = e.postData.contents;
    const data = JSON.parse(raw);
    const result = envoyerEstimation(data);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // Logger l'erreur pour débogage dans Apps Script
    console.error('doPost error:', error.message);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Gérer les requêtes GET (test de connexion)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Stele estimation service actif' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════════
// ENVOI DE L'ESTIMATION
// ═══════════════════════════════════════════════════════════════════════

function envoyerEstimation(data) {
  const { projectCode, projectManager, managerEmail, projectDate, description, meubles, total, images } = data;

  // Construire le contenu HTML du courriel
  const htmlBody = genererHtmlCourriel(projectCode, projectManager, projectDate, description, meubles, total);

  // Construire le PDF
  const pdfBlob = genererPdf(htmlBody, projectCode);

  // Préparer les pièces jointes (PDF + images)
  const attachments = [pdfBlob];

  if (images && images.length > 0) {
    images.forEach(function(img, index) {
      var bytes = Utilities.base64Decode(img.data);
      var blob = Utilities.newBlob(bytes, img.mimeType, img.name || ('image_' + (index + 1) + '.png'));
      attachments.push(blob);
    });
  }

  // Envoyer le courriel
  const sujet = `Estimation Stele — ${projectCode} — ${projectManager}`;
  const nbImages = (images && images.length > 0) ? ' (' + images.length + ' image(s) jointe(s))' : '';

  const emailOptions = {
    to: EMAIL_DESTINATAIRE,
    subject: sujet + nbImages,
    htmlBody: htmlBody,
    attachments: attachments,
    name: 'Stele Catalogue'
  };

  // Envoyer une copie au chargé de projet si courriel fourni
  if (managerEmail && managerEmail.trim() !== '') {
    emailOptions.cc = managerEmail.trim();
  }

  MailApp.sendEmail(emailOptions);

  return { success: true, message: 'Estimation envoyée avec succès' };
}

// ═══════════════════════════════════════════════════════════════════════
// GÉNÉRATION DU HTML / PDF
// ═══════════════════════════════════════════════════════════════════════

function genererHtmlCourriel(projectCode, projectManager, projectDate, description, meubles, total) {
  // Générer les sections par meuble
  let meublesHtml = '';

  meubles.forEach(function(meuble) {
    let lignesArticles = '';

    meuble.items.forEach(function(item) {
      if (item.type === 'ajout') {
        const markupDisplay = item.markup > 0 ? '+' + item.markup + '%' : '—';
        lignesArticles += `
          <tr style="background: #eef2ef;">
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 10px; color: #4b6050;">AJOUT</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 11px;">${item.description}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: center; font-size: 11px; color: #4b6050;">${markupDisplay}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right; font-size: 11px;">${item.unitPrice}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: center; font-size: 11px;">${item.qty}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right; font-size: 11px; font-weight: 600;">${item.lineTotal}</td>
          </tr>
        `;
      } else {
        lignesArticles += `
          <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 10px; color: #666;">${item.code}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 11px;">${item.description}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: center; font-size: 11px;">${item.itemType}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right; font-size: 11px;">${item.unitPrice}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: center; font-size: 11px;">${item.qty}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right; font-size: 11px; font-weight: 600;">${item.lineTotal}</td>
          </tr>
        `;
      }
    });

    meublesHtml += `
      <table style="width: 100%; margin-bottom: 4px;">
        <tr>
          <td style="padding: 8px 10px; background-color: #4b6050; color: #ffffff; font-size: 12px; font-weight: bold;">
            ${meuble.name}
          </td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;">
        <thead>
          <tr style="background-color: #0A0203;">
            <th style="padding: 5px 8px; text-align: left; color: #ffffff; font-size: 9px; font-weight: bold;">Code</th>
            <th style="padding: 5px 8px; text-align: left; color: #ffffff; font-size: 9px; font-weight: bold;">Description</th>
            <th style="padding: 5px 8px; text-align: center; color: #ffffff; font-size: 9px; font-weight: bold;">Type</th>
            <th style="padding: 5px 8px; text-align: right; color: #ffffff; font-size: 9px; font-weight: bold;">Prix unit.</th>
            <th style="padding: 5px 8px; text-align: center; color: #ffffff; font-size: 9px; font-weight: bold;">Qté</th>
            <th style="padding: 5px 8px; text-align: right; color: #ffffff; font-size: 9px; font-weight: bold;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lignesArticles}
        </tbody>
      </table>
      <table style="width: 100%; margin-bottom: 16px;">
        <tr>
          <td style="padding: 8px 10px; background-color: #e8ece9; text-align: right; font-size: 11px;">
            <strong>Sous-total ${meuble.name}:</strong>&nbsp;&nbsp;
            <span style="font-size: 13px; font-weight: bold;">${meuble.subtotal}</span>
          </td>
        </tr>
      </table>
    `;
  });

  // Section description si fournie
  const descriptionHtml = description ? `
    <div style="margin-bottom: 20px; padding: 12px 14px; background-color: #f9f9f9; border-left: 3px solid #4b6050; font-size: 12px; color: #333;">
      <strong style="display: block; margin-bottom: 4px; font-size: 11px; color: #666;">Description / Notes:</strong>
      ${description.replace(/\n/g, '<br>')}
    </div>
  ` : '';

  return `
    <div style="font-family: Helvetica, Arial, sans-serif; padding: 30px; width: 100%; max-width: 800px; box-sizing: border-box;">
      <table style="width: 100%; margin-bottom: 30px; border-bottom: 2px solid #0A0203; padding-bottom: 15px;">
        <tr>
          <td style="vertical-align: top;">
            <div style="font-size: 28px; font-weight: bold; color: #0A0203;">stele</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">Estimation budgétaire</div>
          </td>
          <td style="text-align: right; vertical-align: top; font-size: 12px; color: #333;">
            <div style="margin-bottom: 4px;"><strong>Code projet:</strong> ${projectCode}</div>
            <div style="margin-bottom: 4px;"><strong>Chargé(e) de projet:</strong> ${projectManager}</div>
            <div><strong>Date:</strong> ${projectDate}</div>
          </td>
        </tr>
      </table>

      ${descriptionHtml}

      ${meublesHtml}

      <table style="width: 100%; background-color: #0A0203;">
        <tr>
          <td style="padding: 12px 14px; text-align: right;">
            <span style="color: #ffffff; font-size: 12px; font-weight: bold; margin-right: 20px;">TOTAL ESTIMÉ</span>
            <span style="color: #ffffff; font-size: 16px; font-weight: bold;">${total}</span>
          </td>
        </tr>
      </table>

      <div style="margin-top: 25px; padding: 14px; background-color: #f5f5f5; font-size: 11px; color: #666; font-style: italic;">
        Les montants affichés sont fournis à titre indicatif uniquement et peuvent varier selon les spécifications finales du projet. Une soumission détaillée sera requise pour confirmer les prix finaux.
      </div>

      <table style="width: 100%; margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd;">
        <tr>
          <td style="font-size: 10px; color: #999;">stele</td>
          <td style="font-size: 10px; color: #999; text-align: right;">stele.ca</td>
        </tr>
      </table>
    </div>
  `;
}

function genererPdf(htmlContent, projectCode) {
  const htmlComplet = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Estimation - ${projectCode}</title></head>
    <body>${htmlContent}</body>
    </html>
  `;

  const blob = HtmlService.createHtmlOutput(htmlComplet).getBlob();
  blob.setName('Estimation_Stele_' + projectCode + '.pdf');
  return blob.getAs('application/pdf');
}
