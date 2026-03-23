import pool from "../../db/db.js";
import bcrypt from "bcrypt"; // 👈 Indispensable pour hasher le mot de passe

export const createUser = async (req, res) => {
    try {
        const { nom, prenom, email, phone, password, loyalty_points } = req.body;

        // 🛡️ 1. VÉRIFICATION DES CHAMPS OBLIGATOIRES
        if (!nom || !prenom || !email || !password) {
            return res.status(400).json({ 
                message: "Veuillez remplir tous les champs obligatoires (Nom, Prénom, Email, Mot de passe)." 
            });
        }

        // 🛡️ 2. VÉRIFICATION DE L'EMAIL EN DOUBLON
        const [existingUser] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ 
                message: "Cet email est déjà utilisé par un autre client." 
            });
        }

        // 3. Hash du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 4. Insertion en base de données (is_verified = true car créé par l'admin)
        await pool.execute(
            'INSERT INTO users (nom, prenom, email, phone, password, loyalty_points, role, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [nom, prenom, email, phone || null, hashedPassword, loyalty_points || 0, 'customer', true]
        );

        res.status(201).json({ message: "Utilisateur créé avec succès" });

    } catch (error) {
        console.error("❌ Erreur création:", error);
        res.status(500).json({ message: "Erreur serveur lors de la création de l'utilisateur." });
    }
};