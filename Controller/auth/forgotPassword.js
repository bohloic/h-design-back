import pool from "../../db/db.js";
import crypto from "crypto"; // Outil intégré à Node.js pour créer des codes sécurisés
import { sendPasswordResetEmail } from "../../services/emailService.js";

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // 1. Vérifier si l'email existe en base de données
        const [users] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Aucun compte associé à cet email." });
        }

        // 2. Générer un token unique de 64 caractères
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // 3. Définir l'expiration à dans 1 heure
        const resetExpires = new Date(Date.now() + 3600000); 

        // 4. Sauvegarder le token dans la base de données
        await pool.execute(
            'UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?',
            [resetToken, resetExpires, email]
        );

        // 5. 📧 Envoyer l'email
        await sendPasswordResetEmail(email, resetToken);

        res.status(200).json({ success: true, message: "Lien de réinitialisation envoyé par email." });

    } catch (error) {
        console.error("❌ Erreur forgotPassword:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la demande." });
    }
};