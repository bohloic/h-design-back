import pool from "../../db/db.js";
import jwt from "jsonwebtoken";

export const verifyEmailCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        // 1. Chercher l'utilisateur avec cet email
        const [users] = await pool.execute(
            'SELECT id, nom, prenom, role, verification_code, verification_expires FROM users WHERE email = ?', 
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
        }

        const user = users[0];

        // 2. Vérifier si le code correspond
        if (user.verification_code !== code) {
            return res.status(400).json({ success: false, message: "Code incorrect." });
        }

        // 3. Vérifier si le code a expiré
        if (new Date(user.verification_expires) < new Date()) {
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