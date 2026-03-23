import pool from "../../db/db.js";
import bcrypt from "bcrypt";
import { sendVerificationEmail } from "../../services/emailService.js";

export const register = async (req, res) => {
    try {
        const { nom, prenom, email, password, phone } = req.body;

        // 1. Vérifier si l'utilisateur existe déjà
        const [existingUser] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }

        // 2. Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. 🔐 GÉNÉRER LE CODE DE VÉRIFICATION À 6 CHIFFRES
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Date d'expiration (Dans 15 minutes)
        const expires = new Date(Date.now() + 15 * 60000); 

        // 4. Insérer l'utilisateur (Non vérifié par défaut)
        const sql = `
            INSERT INTO users (nom, prenom, email, password, phone, role, is_verified, verification_code, verification_expires) 
            VALUES (?, ?, ?, ?, ?, 'customer', FALSE, ?, ?)
        `;
        
        await pool.execute(sql, [
            nom, prenom, email, hashedPassword, phone || null, verificationCode, expires
        ]);

        // 5. 📧 ENVOYER LE CODE PAR EMAIL
        await sendVerificationEmail(email, prenom, verificationCode);

        // 6. Répondre au Frontend de passer à l'écran de vérification
        res.status(201).json({ 
            success: true, 
            message: "Compte créé ! Veuillez vérifier votre email.",
            requireVerification: true,
            email: email // On renvoie l'email pour le stocker côté React
        });

    } catch (error) {
        console.error("❌ Erreur Register:", error);
        res.status(500).json({ message: "Erreur lors de l'inscription." });
    }
};