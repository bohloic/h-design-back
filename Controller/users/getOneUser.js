// 1. On importe { pool } (car c'est un export nommé dans votre fichier db.js)
// ⚠️ Vérifiez bien que le chemin "../../db/db.js" est correct par rapport à l'emplacement de ce fichier
import db from "../../db/db.js"; 

export const GetOneUser = async (req, res) => {
    try {
        // 1. Récupérer l'ID
        const { id } = req.params; // (Syntaxe plus propre que req.params.id)

        // 2. La requête SQL (🛡️ OWASP: Ne jamais extraire les hashes ou tokens sensibles)
        const sql = "SELECT id, nom, prenom, email, phone, city, address, role, loyalty_points, is_verified, created_at FROM users WHERE id = ?";

        // 3. Exécution avec AWAIT
        const [rows] = await db.query(sql, [id]);

        // Sécurité : Si le tableau est vide, l'utilisateur n'existe pas
        if (rows.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        // 4. On renvoie les informations de l'utilisateur
        return res.json(rows[0]);

    } catch (error) {
        console.error(error);
        // On renvoie une erreur 500 (serveur) au lieu de juste un message JSON
        res.status(500).json({ message: "Erreur serveur lors de la récupération de l'utilisateur" });
    }
}