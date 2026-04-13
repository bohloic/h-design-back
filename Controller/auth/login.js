import pool from "../../db/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendVerificationEmail } from "../../services/emailService.js"; // 👈 N'oublie pas cet import !

export const login = async (req, res) => {
    try {
        const { email, password, devBypass, captchaToken } = req.body;

        // 🛡️ BARRAGE ANTI-BOTS (Validation du Captcha Token)
        if (!devBypass && !captchaToken) {
            return res.status(403).json({ message: "Action bloquée : Validation reCAPTCHA manquante ou expirée." });
        }

        // 1. Chercher l'utilisateur
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: "Email ou mot de passe incorrect." });
        }

        const user = users[0];


        // 2. Vérifier le mot de passe
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Email ou mot de passe incorrect." });
        }

        // 🛡️ 3. LE BARRAGE : Vérifier si le compte est validé
        // (On vérifie s'il vaut 0, false, ou null)
        if (!user.is_verified) {
            // On génère un nouveau code
            const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = new Date(Date.now() + 15 * 60000);

            // On met à jour la base de données
            await pool.execute(
                'UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?',
                [newVerificationCode, expires, user.id]
            );

            // On envoie le mail
            await sendVerificationEmail(user.email, user.prenom, newVerificationCode);

            // On dit au frontend de bloquer et d'afficher les 6 cases
            return res.status(200).json({ 
                success: true, 
                requireVerification: true, // 👈 Le signal magique pour ton Frontend
                email: user.email,
                message: "Votre compte n'a jamais été sécurisé. Un code vient de vous être envoyé par email !" 
            });
        }

        // 4. Si tout est bon (Mot de passe OK + Compte Vérifié) -> Connexion normale
        if (!process.env.JWT_SECRET) {
            console.error('🔴 FATAL: JWT_SECRET manquant dans .env !');
            return res.status(500).json({ message: "Erreur de configuration serveur." });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            success: true,
            message: "Connexion réussie !",
            token,
            user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error("❌ Erreur Login:", error);
        res.status(500).json({ message: "Erreur lors de la connexion." });
    }
};