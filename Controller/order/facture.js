import { generateInvoiceBuffer } from "../../utils/pdfGenerator.js";
import pool from "../../db/db.js";

export const facture = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // 🔒 VÉRIFICATION DU PAIEMENT : la commande doit être réglée
        const [rows] = await pool.execute('SELECT status FROM orders WHERE id = ?', [orderId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Commande introuvable" });
        }
        
        const status = (rows[0].status || '').toLowerCase();
        const isPaid = status.includes('payé') || status.includes('paid') || status === 'delivered' || status === 'shipped' || status.includes('préparation');
        
        if (!isPaid) {
            return res.status(403).json({ 
                success: false, 
                message: "La facture est disponible au téléchargement uniquement si la commande a été réglée." 
            });
        }

        // 1. On génère le buffer du PDF
        const { pdfBuffer } = await generateInvoiceBuffer(orderId);

        // 2. On dit au navigateur "Attention, c'est un PDF à télécharger !"
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Facture_H-designer_${orderId}.pdf"`);
        
        // 3. On envoie le fichier brut
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Erreur génération PDF :", error);
        res.status(500).json({ success: false, message: "Impossible de générer la facture" });
    }
};

