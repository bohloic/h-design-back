// Controller/auth/login.js

import db from '../../db/db.js'; // Votre import corrigé
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const Login = async (req, res) => {
    console.log("--- DÉBUT DE LA TENTATIVE DE LOGIN ---"); // Mouchard 1

    try {
        const { email, password } = req.body;
        console.log("Données reçues :", email, password); // Mouchard 2

        // Vérification SQL (Adaptez selon votre vraie table, ex: 'users' ou 'utilisateur')
        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        
        console.log("Résultat DB :", rows); // Mouchard 3

        if (rows.length === 0) {
            console.log("Utilisateur non trouvé"); // Mouchard 4
            return res.status(401).json({ message: "Utilisateur inconnu" });
        }

        const user = rows[0];
        console.log("Utilisateur trouvé :", user); // Mouchard 5

        // Vérification Mot de passe
        const isValid = await bcrypt.compare(password, user.password);
        console.log("Mot de passe valide ?", isValid); // Mouchard 6

        if (!isValid) {
            return res.status(401).json({ message: "Mauvais mot de passe" });
        }

                // 1. D'ABORD : On génère le token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 2. ENSUITE : On l'utilise (console.log ou réponse au client)
        console.log("Token généré avec succès");

        res.status(200).json({
            userId: user.id,
            token: token, // Maintenant, la variable 'token' existe !
            user: {
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role
            }
        });

        
    } catch (error) {
        console.error("!!! ERREUR FATALE !!!");
        console.error(error); // <--- C'EST ICI QUE LA VRAIE ERREUR S'AFFICHERA
        res.status(500).json({ message: error.message });
    }
};