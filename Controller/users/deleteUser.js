import pool from "../../db/db.js";
import { logAuditTrail } from '../../utils/auditLogger.js';

export const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        // Récupération de l'utilisateur avant suppression pour l'Audit Trail
        const [userRows] = await pool.execute('SELECT id, nom, prenom, email, role FROM users WHERE id = ?', [userId]);
        const oldUser = userRows && userRows.length > 0 ? userRows[0] : null;

        await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        
        // 🛡️ Audit Trail traçabilité
        if (oldUser) {
            await logAuditTrail({
                req,
                action: 'DELETE_USER',
                resourceType: 'user',
                resourceId: userId,
                oldValue: oldUser,
                newValue: null
            });
        }

        res.status(200).json({ message: "Utilisateur supprimé avec succès." });

    } catch (error) {
        console.error("❌ Erreur suppression:", error);
        
        // 🛡️ GESTION DE LA SÉCURITÉ MYSQL (Commandes existantes)
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                message: "Impossible de supprimer ce client car il a déjà passé des commandes. Supprimez d'abord ses commandes." 
            });
        }
        
        res.status(500).json({ message: "Erreur lors de la suppression." });
    }
};