import pool from "../../db/db.js";
import { sendVerificationEmail } from "../../services/emailService.js";

export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        // 1. Chercher l'utilisateur
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
        }

        const user = users[0];

        // 2. Vérifier s'il n'est pas DÉJÀ vérifié
        if (user.is_verified) {
            return res.status(400).json({ success: false, message: "Ce compte est déjà vérifié. Vous pouvez vous connecter." });
        }

        // 3. Générer un NOUVEAU code
        const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 15 * 60000); // Valable 15 minutes

        // 4. Mettre à jour la base de données
        await pool.execute(
            'UPDATE users SET verification_code = ?, verification_expires = ? WHERE email = ?',
            [newVerificationCode, expires, email]
        );

        // 5. Renvoyer l'email
        await sendVerificationEmail(email, user.prenom, newVerificationCode);

        res.status(200).json({ success: true, message: "Un nouveau code a été envoyé !" });

    } catch (error) {
        console.error("❌ Erreur Resend Verification:", error);
        res.status(500).json({ success: false, message: "Erreur lors du renvoi du code." });
    }
};