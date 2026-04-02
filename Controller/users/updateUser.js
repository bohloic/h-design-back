import db from "../../db/db.js";



export const UpdateUser = async (req, res) => {
    try {
        // 1. On récupère l'ID
        const { id } = req.params;

        // 2. On récupère les données
        const { nom, prenom, email, phone } = req.body;

        // 3. La requête SQL (Sans 'loyalty_points' pour protéger de la fraude client)
        const sql = "UPDATE users SET nom = ?, prenom = ?, email = ?, phone = ? WHERE id = ?";

        // 4. Les valeurs (Attention à l'ordre !)
        const values = [
            nom,
            prenom,
            email,
            phone,
            id // L'ID va à la fin pour remplacer le dernier '?'
        ];

        // 5. Exécution avec AWAIT (Plus de callback ici !)
        const [result] = await db.query(sql, values);

        // 6. Vérification
        // Si affectedRows vaut 0, c'est que l'ID n'existe pas
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        return res.json({ message: "Utilisateur mis à jour avec succès" });
    } catch (error) {
        console.log(error)
        res.json({ message: "Une error s'est produit" })
    }
}