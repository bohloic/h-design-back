import pool from "../../db/db.js";
import bcrypt from "bcrypt";

export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // 1. Chercher un utilisateur avec ce token qui n'a pas encore expiré
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ success: false, message: "Le lien est invalide ou a expiré." });
        }

        // 2. Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 3. Mettre à jour le mot de passe et effacer le token de sécurité
        await pool.execute(
            'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
            [hashedPassword, users[0].id]
        );

        res.status(200).json({ success: true, message: "Mot de passe modifié avec succès. Vous pouvez vous connecter." });

    } catch (error) {
        console.error("❌ Erreur resetPassword:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la réinitialisation." });
    }
};