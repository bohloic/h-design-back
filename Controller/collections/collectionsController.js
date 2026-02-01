import  pool  from "../../db/db.js";

// 1. RÉCUPÉRER TOUTES LES COLLECTIONS
export const getAllCollections = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM collections ORDER BY start_date DESC");
        // MySQL renvoie le JSON sous forme d'objet JS automatiquement si le type est JSON,
        // sinon il faut peut-être le parser manuellement.
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. CRÉER UNE COLLECTION
export const createCollection = async (req, res) => {
    try {
        const { name, start_date, end_date, is_active, ui_config } = req.body;
        
        // ui_config est un objet envoyé par React (ex: { primary_color: "#fff", banner: "url" })
        // On doit le transformer en string pour SQL si nécessaire, mais pool.query gère souvent les objets pour les colonnes JSON.
        // Par sécurité, on stringify :
        const configString = JSON.stringify(ui_config);

        const sql = `INSERT INTO collections (name, start_date, end_date, is_active, ui_config) VALUES (?, ?, ?, ?, ?)`;
        
        await pool.query(sql, [name, start_date, end_date, is_active ? 1 : 0, configString]);
        
        res.status(201).json({ message: "Collection créée !" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur création" });
    }
};

// 3. MODIFIER UNE COLLECTION
export const updateCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, start_date, end_date, is_active, ui_config } = req.body;
        const configString = JSON.stringify(ui_config);

        const sql = `
            UPDATE collections 
            SET name = ?, start_date = ?, end_date = ?, is_active = ?, ui_config = ? 
            WHERE id = ?
        `;

        await pool.query(sql, [name, start_date, end_date, is_active ? 1 : 0, configString, id]);
        res.json({ message: "Collection mise à jour !" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. SUPPRIMER
export const deleteCollection = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM collections WHERE id = ?", [id]);
        res.json({ message: "Collection supprimée" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//  Route pour les CATÉGORIES (Collections actives uniquement)
export const collectionActive = async (req, res) => {
    try {
        const sql = "SELECT name FROM collections WHERE is_active = TRUE";
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

