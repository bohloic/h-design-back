import PDFDocument from 'pdfkit';
import db from '../../db/db.js';

const formatMoney = (amount) => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export const exportReport = async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '30';
    
    // --- 1. REQUÊTES SQL ENRICHIES ---
    let orderQuery = `
      SELECT COUNT(*) as totalOrders, COALESCE(SUM(total_amount), 0) as totalCA 
      FROM orders WHERE status != 'cancelled'
    `;

    let cancelledQuery = `
      SELECT COUNT(*) as cancelledOrders, COALESCE(SUM(total_amount), 0) as lostCA 
      FROM orders WHERE status = 'cancelled'
    `;
    
    // CORRECTION : On prend 'customer' ET 'client'
    let userQuery = `
      SELECT 
        COUNT(*) as totalClients,
        SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verifiedClients
      FROM users 
      WHERE role IN ('customer', 'client')
    `;

    // NOUVEAU : Requête pour le Top 5 des produits
    // ⚠️ ATTENTION : Adapte 'order_items' et les noms de colonnes à ta vraie base de données
    // 1. La requête de base (SANS le GROUP BY ni le LIMIT à l'intérieur)
    let topProductsQuery = `
      SELECT 
        products.name as name, 
        SUM(order_items.quantity) as qty, 
        SUM(products.price * order_items.quantity) as revenue
      FROM order_items 
      JOIN orders ON order_items.order_id = orders.id
      JOIN products ON order_items.product_id = products.id
      WHERE orders.status != 'cancelled'
    `;
    
    let queryParams = [];

    // 2. On ajoute les conditions de dates (les AND)
    if (timeframe !== 'all') {
      const days = parseInt(timeframe, 10);
      const dateFilter = ` AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      
      // Attention à bien préciser la table orders pour éviter les conflits
      const dateFilterOrders = ` AND orders.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      
      orderQuery += dateFilter;
      cancelledQuery += dateFilter;
      userQuery += dateFilter;
      topProductsQuery += dateFilterOrders; // Le AND s'ajoute bien à la fin du WHERE
      
      queryParams = [days]; 
    }

    // 3. SEULEMENT À LA FIN, on ajoute le groupement et la limite
    topProductsQuery += ` GROUP BY products.id ORDER BY qty DESC LIMIT 5`;

    // 4. Exécution simultanée
    const [[orderRows], [cancelledRows], [userRows], [topProductsRows]] = await Promise.all([
      db.query(orderQuery, timeframe !== 'all' ? queryParams : []),
      db.query(cancelledQuery, timeframe !== 'all' ? queryParams : []),
      db.query(userQuery, timeframe !== 'all' ? queryParams : []),
      db.query(topProductsQuery, timeframe !== 'all' ? queryParams : [])
    ]);

    // Extraction des données
    const totalOrders = orderRows[0].totalOrders;
    const totalCA = parseFloat(orderRows[0].totalCA);
    const cancelledOrders = cancelledRows[0].cancelledOrders;
    
    const totalClients = userRows[0].totalClients || 0;
    const verifiedClients = userRows[0].verifiedClients || 0;
    const verifiedRate = totalClients > 0 ? Math.round((verifiedClients / totalClients) * 100) : 0;

    const averageCart = totalOrders > 0 ? (totalCA / totalOrders) : 0;
    const totalGlobalOrders = totalOrders + cancelledOrders;
    const successRate = totalGlobalOrders > 0 ? Math.round((totalOrders / totalGlobalOrders) * 100) : 0;

    // --- 2. PRÉPARATION DE LA RÉPONSE HTTP ---
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="H-designer_Rapport_${timeframe}j.pdf"`);

    // --- 3. DESIGN PROFESSIONNEL DU PDF ---
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const colors = { primary: '#1e293b', secondary: '#64748b', accent: '#dc2626', bg: '#f8fafc' };

    // ================= EN-TÊTE =================
    doc.fontSize(28).font('Helvetica-Bold').fillColor(colors.primary).text('H-designer', { align: 'left' });
    
    doc.fontSize(10).font('Helvetica').fillColor(colors.secondary);
    doc.text('Abidjan - Vente en ligne uniquement', { align: 'left' });
    doc.text('WhatsApp : +225 01 72 32 27 27', { align: 'left' });
    
    doc.y = 40; 
    const periodText = timeframe === 'all' ? 'Historique Complet' : `${timeframe} Derniers Jours`;
    doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.accent).text('RAPPORT ANALYTIQUE', { align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor(colors.secondary).text(`Période : ${periodText}`, { align: 'right' });
    doc.text(`Édité le : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });

    doc.moveDown(3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(1).stroke('#e2e8f0');
    doc.moveDown(2);

    // ================= CARTES STATISTIQUES =================
    doc.fontSize(16).font('Helvetica-Bold').fillColor(colors.primary).text('Performances Globales');
    doc.moveDown(1);

    const drawCard = (x, y, title, value, subtitle) => {
      doc.roundedRect(x, y, 240, 70, 8).fillAndStroke(colors.bg, '#e2e8f0');
      doc.fillColor(colors.secondary).fontSize(10).font('Helvetica').text(title, x + 15, y + 15);
      doc.fillColor(colors.primary).fontSize(18).font('Helvetica-Bold').text(value, x + 15, y + 32);
      if (subtitle) {
        doc.fillColor(colors.accent).fontSize(9).font('Helvetica').text(subtitle, x + 15, y + 52);
      }
    };

    const startY = doc.y;
    
    drawCard(40, startY, "Chiffre d'Affaires Net", `${formatMoney(totalCA)} FCFA`, `${formatMoney(averageCart)} FCFA / panier moyen`);
    drawCard(315, startY, "Commandes Valides", `${totalOrders} commandes`, `${successRate}% de taux de réussite`);
    
    drawCard(40, startY + 85, "Clients Inscrits", `${totalClients} clients`, `${verifiedRate}% de comptes vérifiés`);
    drawCard(315, startY + 85, "Commandes Annulées", `${cancelledOrders} commandes`, `Perte estimée : ${formatMoney(cancelledRows[0].lostCA)} FCFA`);

    doc.y = startY + 185;
    doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(1).stroke('#e2e8f0');
    doc.moveDown(2);

    // ================= TABLEAU TOP 5 PRODUITS =================
    doc.fontSize(16).font('Helvetica-Bold').fillColor(colors.primary).text('Top 5 des Meilleures Ventes');
    doc.moveDown(1);

    const tableTop = doc.y;
    
    // En-têtes du tableau
    doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.secondary);
    doc.text('Produit', 40, tableTop);
    doc.text('Quantité', 300, tableTop, { width: 80, align: 'center' });
    doc.text('Revenu Généré', 400, tableTop, { width: 155, align: 'right' });
    
    // Ligne sous l'en-tête
    doc.moveTo(40, tableTop + 15).lineTo(555, tableTop + 15).lineWidth(1).stroke('#cbd5e1');
    
    let rowY = tableTop + 25;

    // Remplissage des lignes avec les données de la BDD
    if (topProductsRows.length > 0) {
      topProductsRows.forEach((product, index) => {
        // Fond gris clair une ligne sur deux
        if (index % 2 === 0) {
          doc.rect(40, rowY - 5, 515, 20).fill('#f8fafc');
        }

        doc.font('Helvetica').fontSize(10).fillColor(colors.primary);
        doc.text(product.name || 'Produit inconnu', 45, rowY, { width: 250, height: 15, lineBreak: false });
        doc.text(product.qty.toString(), 300, rowY, { width: 80, align: 'center' });
        doc.text(`${formatMoney(product.revenue)} FCFA`, 400, rowY, { width: 150, align: 'right' });
        
        rowY += 20;
      });
    } else {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(colors.secondary);
      doc.text("Aucune vente enregistrée sur cette période.", 40, rowY);
    }

    // ================= PIED DE PAGE =================
    const bottomY = doc.page.height - 50;
    doc.moveTo(40, bottomY - 15).lineTo(555, bottomY - 15).lineWidth(0.5).stroke('#e2e8f0');
    doc.fontSize(9).font('Helvetica-Oblique').fillColor(colors.secondary)
       .text('Document confidentiel généré automatiquement par le système H-designer.', 40, bottomY, { align: 'center', width: 515 });

    doc.end();

  } catch (error) {
    console.error("Erreur génération PDF :", error);
    if (!res.headersSent) res.status(500).json({ error: "Erreur PDF" });
  }
};