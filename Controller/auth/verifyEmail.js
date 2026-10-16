import pool from "../../db/db.js";
import jwt from "jsonwebtoken";

export const verifyEmailCode = async (req, res) => {
    try {
        let { email, code, otp } = req.body;

        // 1. Normalisation stricte des entrées (gère les payloads array ["1","2"...], string "123456" et number 123456)
        email = String(email || '').trim().toLowerCase();
        const cleanInputCode = Array.isArray(code) 
            ? code.join('').trim() 
            : String(code || otp || '').trim();

        if (!email) {
            return res.status(400).json({ success: false, message: "L'adresse email est requise." });
        }

        if (!cleanInputCode || (!/^\d{6}$/.test(cleanInputCode) && cleanInputCode !== '000000')) {
            return res.status(400).json({ success: false, message: "Code de vérification à 6 chiffres invalide." });
        }

        // 2. Chercher l'utilisateur avec cet email
        const [users] = await pool.execute(
            'SELECT id, nom, prenom, role, verification_code, verification_expires FROM users WHERE LOWER(email) = ?', 
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
        }

        const user = users[0];

        // 3. Vérifier si le code correspond (avec trim et support test code de secours en dev/test)
        const storedCode = String(user.verification_code || '').trim();
        const isMasterTestCode = process.env.NODE_ENV !== 'production' && cleanInputCode === '000000' && (
            process.env.DEV_OTP_BYPASS === 'true' ||
            process.env.ALLOW_TEST_CODE === 'true'
        );

        if (!isMasterTestCode && storedCode !== cleanInputCode) {
            return res.status(400).json({ success: false, message: "Code de vérification incorrect." });
        }

        // 3. Vérifier si le code a expiré
        if (!isMasterTestCode && user.verification_expires && new Date(user.verification_expires) < new Date()) {
            return res.status(400).json({ success: false, message: "Ce code a expiré. Veuillez en demander un nouveau." });
        }

        // 4. ✅ TOUT EST BON : On valide le compte et on efface le code
        await pool.execute(
            'UPDATE users SET is_verified = TRUE, verification_code = NULL, verification_expires = NULL WHERE email = ?',
            [email]
        );

        // 5. On connecte l'utilisateur directement en lui donnant son Token !
        const token = jwt.sign(
            { userId: user.id, email: email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 🛡️ OWASP: Stockage du JWT dans un cookie HttpOnly, Secure, SameSite
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.status(200).json({ 
            success: true, 
            message: "Email vérifié avec succès !",
            token,
            user: { id: user.id, nom: user.nom, prenom: user.prenom, email, role: user.role }
        });

    } catch (error) {
        console.error("❌ Erreur Verify Email:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la vérification." });
    }
};