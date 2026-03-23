import PDFDocument from 'pdfkit';
import pool from '../db/db.js';

const formatMoney = (amount) => Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export const generateInvoiceBuffer = async (orderId) => {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. On récupère address et phone en plus !
            const [orderRows] = await pool.execute(
                `SELECT id, customer_name, customer_email, total_amount, created_at, shipping_address, phone 
                 FROM orders WHERE id = ?`,
                [orderId]
            );

            if (orderRows.length === 0) return reject(new Error("Commande introuvable."));
            const order = orderRows[0];

            const [itemsRows] = await pool.execute(
                `SELECT oi.quantity, oi.unit_price AS price, p.name as name 
                 FROM order_items oi 
                 JOIN products p ON oi.product_id = p.id 
                 WHERE oi.order_id = ?`,
                [orderId]
            );

            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                resolve({ pdfBuffer: Buffer.concat(buffers), orderData: order, itemsData: itemsRows });
            });
            doc.on('error', reject);

            const colors = { primary: '#0f172a', secondary: '#64748b', accent: '#dc2626' };

            // En-tête
            doc.fontSize(28).font('Helvetica-Bold').fillColor(colors.primary).text('H-designer', { align: 'right' });
            doc.fontSize(10).font('Helvetica').fillColor(colors.secondary).text('Abidjan - Vente en ligne uniquement', { align: 'right' });
            doc.text('WhatsApp : +225 01 72 32 27 27', { align: 'right' });
            
            doc.moveDown(2);
            doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.accent).text('FACTURE', { align: 'left' });
            doc.moveDown(0.5);
            doc.fontSize(11).font('Helvetica').fillColor(colors.primary);
            doc.text(`Facture N° : HD-${String(order.id).padStart(5, '0')}`);
            doc.text(`Date : ${new Date(order.created_at || Date.now()).toLocaleDateString('fr-FR')}`);
            
            doc.moveDown(1.5);
            
            // INFOS CLIENT AVEC ADRESSE ET TÉLÉPHONE
            doc.font('Helvetica-Bold').text('Facturé et Livré à :');
            doc.font('Helvetica').fillColor(colors.secondary);
            doc.text(order.customer_name);
            doc.text(order.customer_email);
            if (order.phone) doc.text(`Tél : ${order.phone}`);
            if (order.shipping_address) doc.text(`Adresse : ${order.shipping_address}`);
            
            doc.moveDown(2);

            // Tableau
            const tableTop = doc.y;
            doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primary);
            doc.text('Description', 50, tableTop);
            doc.text('Prix Unitaire', 280, tableTop, { width: 90, align: 'right' });
            doc.text('Qté', 380, tableTop, { width: 50, align: 'center' });
            doc.text('Total', 440, tableTop, { width: 100, align: 'right' });
            
            doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).lineWidth(1).stroke('#cbd5e1');
            
            let rowY = tableTop + 25;
            let subtotal = 0;

            itemsRows.forEach((item) => {
                const itemTotal = item.price * item.quantity;
                subtotal += itemTotal;
                
                doc.font('Helvetica').fontSize(10).fillColor(colors.secondary);
                doc.text(item.name || 'T-shirt', 50, rowY, { width: 220 });
                doc.text(`${formatMoney(item.price)} FCFA`, 280, rowY, { width: 90, align: 'right' });
                doc.text(item.quantity.toString(), 380, rowY, { width: 50, align: 'center' });
                doc.text(`${formatMoney(itemTotal)} FCFA`, 440, rowY, { width: 100, align: 'right' });
                rowY += 20;
            });

            doc.moveTo(50, rowY).lineTo(540, rowY).lineWidth(1).stroke('#cbd5e1');
            rowY += 15;

            // Calcul Frais de livraison (Différence)
            const deliveryCost = order.total_amount - subtotal;
            order.shipping_fee = deliveryCost; // Passé à l'email
            
            doc.font('Helvetica').fontSize(10).fillColor(colors.primary);
            doc.text('Sous-total articles :', 280, rowY, { width: 150, align: 'right' });
            doc.text(`${formatMoney(subtotal)} FCFA`, 440, rowY, { width: 100, align: 'right' });
            rowY += 20;

            doc.text('Frais de livraison :', 280, rowY, { width: 150, align: 'right' });
            doc.text(`${formatMoney(deliveryCost)} FCFA`, 440, rowY, { width: 100, align: 'right' });
            rowY += 20;

            doc.moveTo(380, rowY - 5).lineTo(540, rowY - 5).lineWidth(0.5).stroke('#cbd5e1');

            doc.font('Helvetica-Bold').fontSize(14).fillColor(colors.primary);
            doc.text('Total Payé :', 280, rowY, { width: 150, align: 'right' });
            doc.fillColor(colors.accent).text(`${formatMoney(order.total_amount)} FCFA`, 440, rowY, { width: 100, align: 'right' });

            const bottomY = doc.page.height - 70;
            doc.moveTo(50, bottomY - 15).lineTo(540, bottomY - 15).lineWidth(0.5).stroke('#e2e8f0');
            doc.fontSize(9).font('Helvetica-Oblique').fillColor(colors.secondary)
               .text('Merci pour votre confiance. WhatsApp : +225 01 72 32 27 27', 50, bottomY, { align: 'center', width: 490 });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};