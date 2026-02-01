import  pool  from "../../db/db.js";

export const getDelivery = async (req, res) => {
    try {
        // On récupère tout
        const [rows] = await pool.query('SELECT * FROM deliveries ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur" });
    }
};

export const createDelivery = async (req, res) => {
    try {
        const { order_id, tracking_number, carrier_name, status, estimated_delivery_date } = req.body;

        const sql = `
            INSERT INTO deliveries 
            (order_id, tracking_number, carrier_name, status, estimated_delivery_date) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        // Note: Si la date est vide, on envoie NULL à MySQL
        const dateValue = estimated_delivery_date || null;

        const [result] = await pool.execute(sql, [order_id, tracking_number, carrier_name, status, dateValue]);
        
        res.status(201).json({ message: "Livraison créée", id: result.insertId });
    } catch (error) {
        // Erreur fréquente : order_id qui n'existe pas ou duplicata
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la création (Vérifiez si l'ID commande est valide)" });
    }
};

export const updateDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { order_id, tracking_number, carrier_name, status, estimated_delivery_date } = req.body;

        const sql = `
            UPDATE deliveries 
            SET order_id=?, tracking_number=?, carrier_name=?, status=?, estimated_delivery_date=?
            WHERE id=?
        `;

        const dateValue = estimated_delivery_date || null;

        await pool.execute(sql, [order_id, tracking_number, carrier_name, status, dateValue, id]);
        
        res.json({ message: "Livraison mise à jour" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la modification" });
    }
};

export const deleteDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM deliveries WHERE id = ?', [id]);
        res.json({ message: "Livraison supprimée" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la suppression" });
    }
};