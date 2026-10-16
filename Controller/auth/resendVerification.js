import pool from "../../db/db.js";
import { sendVerificationEmail } from "../../services/emailService.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const resendVerification = async (req, res) => {
    try {
        const rawEmail = req.body?.email;
        const email = String(rawEmail || '').trim().toLowerCase();

        // 1. Validation de l'email en entrée (évite les crashs 500 sur paramètre undefined)
        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: "Veuillez fournir une adresse email valide." 
            });
        }

        // 2. Chercher l'utilisateur dans la base de données
        const [users] = await pool.execute(
            'SELECT id, nom, prenom, email, is_verified FROM users WHERE LOWER(email) = ?', 
            [email]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Aucun compte n'est associé à cette adresse email." 
            });
        }

        const user = users[0];

        // 3. Vérifier s'il n'est pas déjà vérifié
        if (user.is_verified) {
            return res.status(400).json({ 
                success: false, 
                message: "Ce compte est déjà vérifié. Vous pouvez vous connecter directement." 
            });
        }

        // 4. Générer un nouveau code OTP à 6 chiffres
        const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 15 * 60000); // 15 minutes

        // 5. Mettre à jour la base de données
        await pool.execute(
            'UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?',
            [newVerificationCode, expires, user.id]
        );

        // 6. Renvoyer l'email via Mailjet (avec isolation d'erreur pour éviter le crash 500)
        let mailSent = false;
        let mailError = null;
        try {
            await sendVerificationEmail(user.email, user.prenom, newVerificationCode);
            mailSent = true;
        } catch (emailErr) {
            mailError = emailErr.message || emailErr;
            console.error("⚠️ [ResendVerification] Échec envoi email :", mailError);
        }

        if (!mailSent) {
            return res.status(503).json({
                success: false,
                message: "Le code a été généré mais le serveur d'envoi d'emails est temporairement indisponible. Veuillez vérifier vos messages ou réessayer dans un instant.",
                ...(process.env.NODE_ENV !== 'production' || process.env.DEV_OTP_BYPASS === 'true' ? { debugCode: newVerificationCode } : {})
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: "Un nouveau code de sécurité vous a été envoyé par email !" 
        });

    } catch (error) {
        console.error("❌ Erreur Resend Verification:", error.message || error);
        return res.status(500).json({ 
            success: false, 
            message: "Une erreur interne est survenue lors du renvoi du code." 
        });
    }
};