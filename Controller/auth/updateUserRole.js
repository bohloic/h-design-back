import pool from "../../db/db.js";
import { logAuditTrail } from '../../utils/auditLogger.js';

export const updateUserRole = async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        // 1. Sécurité : On vérifie que le rôle demandé existe bien
        const allowedRoles = ['client', 'admin']; // Tu pourras ajouter 'livreur', 'editeur' plus tard
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, message: "Rôle invalide." });
        }

        // Récupération de l'ancien rôle pour l'Audit Trail
        const [oldRows] = await pool.execute('SELECT role, email FROM users WHERE id = ?', [userId]);
        const oldRole = oldRows && oldRows.length > 0 ? oldRows[0].role : null;

        // 2. Mise à jour dans la base de données
        await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

        // 🛡️ Audit Trail traçabilité (OWASP BFLA / Privilege escalation logging)
        await logAuditTrail({
            req,
            action: 'UPDATE_USER_ROLE',
            resourceType: 'user',
            resourceId: userId,
            oldValue: { role: oldRole },
            newValue: { role }
        });

        res.status(200).json({ success: true, message: `L'utilisateur est maintenant ${role} !` });

    } catch (error) {
        console.error("❌ Erreur lors du changement de rôle:", error);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    }
};