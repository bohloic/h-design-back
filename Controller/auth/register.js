// Controller/auth/register.js (ou le fichier où vous gérez l'inscription)
import db from '../../db/db.js';
import bcrypt from 'bcryptjs';

export const register = async (req, res) => {
    try {
        const { nom, prenom, email, password } = req.body;

        // 1. Validation basique
        if (!email || !password || !nom || !prenom) {
            return res.status(400).json({ message: "Tous les champs sont requis." });
        }

        // 2. Vérifier si l'utilisateur existe déjà
        const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(409).json({ message: "Cet email est déjà utilisé." });
        }

        // ---------------------------------------------------------
        // 3. LE HACHAGE (C'est ici que la magie opère)
        // ---------------------------------------------------------
        
        // On définit la "complexité" du cryptage (10 est le standard actuel)
        const saltRounds = 10;
        
        // On crypte le mot de passe
        // "password" (clair) devient "hashedPassword" (crypté)
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        console.log("Mot de passe en clair :", password);      // ex: "123456"
        console.log("Mot de passe crypté :", hashedPassword);  // ex: "$2b$10$Az..."

        // ---------------------------------------------------------
        // 4. Enregistrement en Base de Données
        // ---------------------------------------------------------
        
        // ATTENTION : On insère 'hashedPassword', PAS 'password' !
        const sql = "INSERT INTO users (nom, prenom, email, password) VALUES (?, ?, ?, ?)";
        
        await db.query(sql, [nom,prenom, email, hashedPassword]);

        res.status(201).json({ message: "Utilisateur créé avec succès !" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de l'inscription" });
    }
};