// 1. Importez { pool } (Adaptez le chemin vers votre config/db.js ou db/db.js)
import db  from '../../db/db.js'; 

export const createUser = async (req, res) => {
    try {
        // 2. Récupérer les données
        const { nom, prenom, email, password } = req.body;

        // Validation basique (Optionnel mais recommandé)
        if (!nom || !email || !password) {
            return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires." });
        }

        // 3. La requête SQL
        const sql = "INSERT INTO users (`nom`, `prenom`, `email`, `password`) VALUES (?, ?, ?, ?)";
        const values = [nom, prenom, email, password];

        // 4. Exécution avec AWAIT
        // pool.query avec INSERT retourne un tableau [resultat, champs]
        // 'result' contient des infos comme insertId (l'ID du nouvel utilisateur)
        const [result] = await db.query(sql, values);

        // 5. Succès
        return res.status(201).json({ 
            message: "Utilisateur créé avec succès !",
            userId: result.insertId // On renvoie l'ID créé, c'est souvent utile au front-end
        });

    } catch (error) {
        console.error("Erreur lors de la création :", error);

        // Gestion spécifique : Si l'email existe déjà (Erreur MySQL code 'ER_DUP_ENTRY')
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Cet email est déjà utilisé." });
        }

        return res.status(500).json({ message: "Erreur serveur lors de la création de l'utilisateur." });
    }
};