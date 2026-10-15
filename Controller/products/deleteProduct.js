import pool from "../../db/db.js";
import { logAuditTrail } from '../../utils/auditLogger.js';

export const deleteProduct = async (req, res) => {
    try {
        // 1. On récupère l'ID du produit à supprimer
        const { id } = req.params;

        // Récupération préalable de l'état pour l'Audit Trail
        const [oldRows] = await pool.query("SELECT id, name, price, stock_quantity FROM products WHERE id = ?", [id]);
        const oldProduct = oldRows && oldRows.length > 0 ? oldRows[0] : null;

        // 2. La requête SQL
        // ⚠️ TRES IMPORTANT : Ne jamais oublier le "WHERE"
        const sql = "DELETE FROM products WHERE id = ?";

        // 3. Exécution
        const [result] = await pool.query(sql, [id]);

        // 4. Vérification
        // Si aucune ligne n'a été touchée, c'est que l'ID n'existait pas
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Produit introuvable (déjà supprimé ?)." });
        }

        // 🛡️ Traçabilité de l'action critique
        if (oldProduct) {
            await logAuditTrail({
                req,
                action: 'DELETE_PRODUCT',
                resourceType: 'product',
                resourceId: id,
                oldValue: oldProduct,
                newValue: null
            });
        }

        // 5. Succès
        return res.json({ message: "Produit supprimé avec succès !" });

    } catch (error) {
        // Petit détail pour les boutiques :
        // Si tu essaies de supprimer un produit qui est déjà dans une commande, 
        // MySQL peut bloquer la suppression (Erreur de clé étrangère).
        console.error("Erreur suppression produit :", error);
        
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
             return res.status(400).json({ message: "Impossible de supprimer ce produit car il est lié à des commandes existantes." });
        }

        return res.status(500).json({ message: "Erreur serveur lors de la suppression." });
    }
};