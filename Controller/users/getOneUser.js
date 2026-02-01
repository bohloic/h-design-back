// 1. On importe { pool } (car c'est un export nommé dans votre fichier db.js)
// ⚠️ Vérifiez bien que le chemin "../../db/db.js" est correct par rapport à l'emplacement de ce fichier
import db from "../../db/db.js"; 

export const GetOneUser = async (req, res) => {
    try {
        // 1. Récupérer l'ID
        const { id } = req.params; // (Syntaxe plus propre que req.params.id)

        // 2. La requête SQL
        const sql = "SELECT * FROM users WHERE id = ?";

        // 3. Exécution avec AWAIT (plus de callback ici !)
        // On récupère directement les lignes (rows)
        const [rows] = await db.query(sql, [id]);

        // Sécurité : Si le tableau est vide, l'utilisateur n'existe pas
        if (rows.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        // 4. On renvoie le premier résultat trouvé
        if (rows.length > 0) {
            const user = rows[0];
            
            // ❌ SUPPRIME LE MOT DE PASSE AVANT D'ENVOYER
            delete user.password; 
            
            return res.json(user);
        }

    } catch (error) {
        console.error(error);
        // On renvoie une erreur 500 (serveur) au lieu de juste un message JSON
        res.status(500).json({ message: "Erreur serveur lors de la récupération de l'utilisateur" });
    }
}