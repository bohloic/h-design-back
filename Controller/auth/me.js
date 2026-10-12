// Controller/auth/me.js
import pool from "../../db/db.js";

export const getCurrentUser = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Non authentifié" });
        }

        const [users] = await pool.execute(
            'SELECT id, nom, prenom, email, phone, city, address, role, loyalty_points, is_verified FROM users WHERE id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        res.status(200).json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        console.error("❌ Erreur getCurrentUser:", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération du profil." });
    }
};
