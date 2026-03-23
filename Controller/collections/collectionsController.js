import pool from "../../db/db.js";

// --- 1. LIRE TOUTES LES COLLECTIONS (Pour le Dashboard Admin) ---
export const getCollections = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM collections ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des collections" });
    }
};

// --- 2. CRÉER UNE COLLECTION ---
export const createCollection = async (req, res) => {
    try {
        const { name, start_date, end_date, is_active, ui_config } = req.body;

        // 🛑 LA MAGIE EST ICI : Si on veut activer cette collection, on désactive toutes les autres d'abord !
        if (is_active) {
            await pool.execute('UPDATE collections SET is_active = 0');
        }

        const sql = `
            INSERT INTO collections (name, start_date, end_date, is_active, ui_config) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        // On s'assure de bien convertir le ui_config en chaîne JSON pour la base de données
        const configString = typeof ui_config === 'object' ? JSON.stringify(ui_config) : ui_config;

        const [result] = await pool.execute(sql, [
            name, 
            start_date || null, 
            end_date || null, 
            is_active ? 1 : 0, 
            configString
        ]);
        
        res.status(201).json({ message: "Collection créée", id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la création de la collection" });
    }
};

// --- 3. MODIFIER UNE COLLECTION ---
export const updateCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, start_date, end_date, is_active, ui_config } = req.body;

        // 🛑 LA MAGIE EST LÀ AUSSI : Si on active celle-ci, on désactive toutes les autres (sauf elle-même)
        if (is_active) {
            await pool.execute('UPDATE collections SET is_active = 0 WHERE id != ?', [id]);
        }

        const sql = `
            UPDATE collections 
            SET name=?, start_date=?, end_date=?, is_active=?, ui_config=?
            WHERE id=?
        `;

        const configString = typeof ui_config === 'object' ? JSON.stringify(ui_config) : ui_config;

        await pool.execute(sql, [
            name, 
            start_date || null, 
            end_date || null, 
            is_active ? 1 : 0, 
            configString, 
            id
        ]);
        
        res.json({ message: "Collection mise à jour avec succès" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la modification de la collection" });
    }
};

// --- 4. SUPPRIMER UNE COLLECTION ---
export const deleteCollection = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM collections WHERE id = ?', [id]);
        res.json({ message: "Collection supprimée" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la suppression de la collection" });
    }
};

// 🎁 BONUS (VITAL POUR LA SUITE) : Récupérer UNIQUEMENT la collection active pour le Frontend Client
export const getActiveCollection = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM collections WHERE is_active = 1 LIMIT 1');
        
        if (rows.length === 0) {
            return res.json(null); // S'il n'y a pas de thème actif, on renvoie null
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur" });
    }
};