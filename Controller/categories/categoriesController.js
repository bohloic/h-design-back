import db from "../../db/db.js";

// Route GET /api/categories
export const getCategory = async (req, res) => {
    const sql = "SELECT * FROM categories";

    try {
        // 1. On utilise 'await' pour attendre la réponse de la BDD
        // 2. On utilise la déstructuration [results] car mysql2 renvoie un tableau [lignes, champs]
        const [results] = await db.query(sql);

        // 3. Succès : on renvoie les données
        res.status(200).json(results);

    } catch (err) {
        // 4. Erreur : on l'attrape ici
        console.error("Erreur récupération catégories :", err);
        res.status(500).json({ message: "Erreur serveur", error: err.message });
    }
};

// 1. AJOUTER (CREATE)
export const createCategory = async (req, res) => {
    try {
        const { name } = req.body;

        // Validation simple
        if (!name) {
            return res.status(400).json({ message: "Le nom est obligatoire" });
        }

        // On utilise 'await' et on récupère le résultat directement
        const [result] = await db.query("INSERT INTO categories (name) VALUES (?)", [name]);

        res.status(201).json({ 
            message: "Catégorie créée !", 
            id: result.insertId,
            name: name 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur lors de la création" });
    }
};

// 2. MODIFIER (UPDATE)
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Le nouveau nom est requis" });
        }

        const [result] = await db.query("UPDATE categories SET name = ? WHERE id = ?", [name, id]);

        // Vérification si l'ID existait
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Catégorie non trouvée" });
        }

        res.status(200).json({ message: "Catégorie mise à jour avec succès" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur lors de la modification" });
    }
};

// 3. SUPPRIMER (DELETE)
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query("DELETE FROM categories WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Catégorie non trouvée" });
        }

        res.status(200).json({ message: "Catégorie supprimée avec succès" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression" });
    }
};