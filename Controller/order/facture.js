import { generateInvoiceBuffer } from "../../utils/pdfGenerator.js";

export const facture = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // 1. On génère le buffer du PDF grâce à ta super fonction
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

