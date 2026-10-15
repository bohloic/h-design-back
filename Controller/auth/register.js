import pool from "../../db/db.js";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "../../services/emailService.js";

// Regex de validation stricte (Audit OWASP / Insecure Design)
const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'-]{2,50}$/;
const PHONE_REGEX = /^(\+225)?(01|05|07)[0-9]{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = async (req, res) => {
    try {
        let { nom, prenom, email, password, phone } = req.body;

        // 1. Normalisation & Validation des entrées
        nom = String(nom || '').trim();
        prenom = String(prenom || '').trim();
        email = String(email || '').trim().toLowerCase();
        phone = String(phone || '').trim().replace(/\s+/g, '');
        password = String(password || '');

        if (!nom || !NAME_REGEX.test(nom)) {
            return res.status(400).json({ 
                success: false, 
                message: "Le nom doit comporter entre 2 et 50 caractères alphabétiques (lettres, accents, tirets)." 
            });
        }

        if (!prenom || !NAME_REGEX.test(prenom)) {
            return res.status(400).json({ 
                success: false, 
                message: "Le prénom doit comporter entre 2 et 50 caractères alphabétiques (lettres, accents, tirets)." 
            });
        }

        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: "Veuillez fournir une adresse email valide." 
            });
        }

        if (phone && !PHONE_REGEX.test(phone)) {
            return res.status(400).json({ 
                success: false, 
                message: "Le numéro de téléphone doit être un numéro mobile ivoirien valide à 10 chiffres (Orange, MTN, Moov débutant par 01, 05 ou 07)." 
            });
        }

        if (!password || password.length < 8) {
            return res.status(400).json({ 
                success: false, 
                message: "Le mot de passe doit comporter au moins 8 caractères." 
            });
        }

        // 2. Vérifier si l'utilisateur existe déjà
        const [existingUser] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: "Cet email est déjà associé à un compte." });
        }

        // 3. Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. 🔐 GÉNÉRER LE CODE DE VÉRIFICATION À 6 CHIFFRES
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Date d'expiration (Dans 15 minutes)
        const expires = new Date(Date.now() + 15 * 60000); 

        // 5. Insérer l'utilisateur (Non vérifié par défaut)
        const sql = `
            INSERT INTO users (nom, prenom, email, password, phone, role, is_verified, verification_code, verification_expires) 
            VALUES (?, ?, ?, ?, ?, 'customer', FALSE, ?, ?)
        `;
        
        await pool.execute(sql, [
            nom, prenom, email, hashedPassword, phone || null, verificationCode, expires
        ]);

        // 6. 📧 ENVOYER LE CODE PAR EMAIL (protégé pour ne pas crasher si l'email échoue)
        try {
            await sendVerificationEmail(email, prenom, verificationCode);
        } catch (emailErr) {
            console.error("⚠️ Échec envoi email de vérification (register):", emailErr.message);
        }

        // 7. Répondre au Frontend de passer à l'écran de vérification
        res.status(201).json({ 
            success: true, 
            message: "Compte créé ! Veuillez vérifier votre email.",
            requireVerification: true,
            email: email
        });

    } catch (error) {
        console.error("❌ Erreur Register:", error);
        res.status(500).json({ success: false, message: "Erreur lors de l'inscription." });
    }
};