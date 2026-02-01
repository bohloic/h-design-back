import pool from "../../db/db.js";

export const getOneProduct = async (req, res) => {
    try {
        // 1. On récupère l'ID depuis l'URL (ex: /api/products/42)
        const { id } = req.params;

        // 2. La requête SQL
        // On sélectionne tout (*) dans la table products OÙ l'id correspond
        const sql = "SELECT * FROM products WHERE id = ?";

        // 3. Exécution
        const [rows] = await pool.query(sql, [id]);

        // 4. Vérification
        // Si le tableau 'rows' est vide, le produit n'existe pas
        if (rows.length === 0) {
            return res.status(404).json({ message: "Produit non trouvé" });
        }

        // 5. Succès
        // IMPORTANT : MySQL renvoie toujours un tableau [ {id:1...} ]
        // Nous on veut juste l'objet à l'intérieur, donc on prend l'index 0
        return res.json(rows[0]);

    } catch (error) {
        console.error("Erreur lors de la récupération du produit :", error);
        return res.status(500).json({ message: "Erreur serveur" });
    }
};