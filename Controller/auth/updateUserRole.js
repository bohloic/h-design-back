import pool from "../../db/db.js";

export const updateUserRole = async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        // 1. Sécurité : On vérifie que le rôle demandé existe bien
        const allowedRoles = ['client', 'admin']; // Tu pourras ajouter 'livreur', 'editeur' plus tard
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, message: "Rôle invalide." });
        }

        // 2. Mise à jour dans la base de données
        await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

        res.status(200).json({ success: true, message: `L'utilisateur est maintenant ${role} !` });

    } catch (error) {
        console.error("❌ Erreur lors du changement de rôle:", error);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    }
};