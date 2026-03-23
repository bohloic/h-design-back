import pool from "../../db/db.js";

// 🔄 NOUVEAU : Fonction pour synchroniser le statut de la livraison avec celui de la commande
const mapDeliveryStatusToOrderStatus = (deliveryStatus) => {
    switch(deliveryStatus) {
        case 'pending': return 'processing'; // En préparation
        case 'in_transit': return 'shipped'; // Expédié
        case 'delivered': return 'delivered';// Livré
        case 'returned': return 'returned';  // Retourné
        default: return 'paid';
    }
};

export const getDelivery = async (req, res) => {
    try {
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
        
        const dateValue = estimated_delivery_date || null;
        const [result] = await pool.execute(sql, [order_id, tracking_number, carrier_name, status, dateValue]);
        
        // 🔴 NOUVEAU : On met à jour le statut de la commande associée !
        const orderStatus = mapDeliveryStatusToOrderStatus(status);
        await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [orderStatus, order_id]);
        
        res.status(201).json({ message: "Livraison créée et commande mise à jour", id: result.insertId });
    } catch (error) {
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
        
        // 🔴 NOUVEAU : On met à jour le statut de la commande associée ici aussi !
        const orderStatus = mapDeliveryStatusToOrderStatus(status);
        await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [orderStatus, order_id]);
        
        res.json({ message: "Livraison et commande mises à jour" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la modification" });
    }
};

export const deleteDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Optionnel : Si tu veux, tu peux remettre la commande en 'paid' si tu supprimes sa livraison
        // Mais ce n'est pas strictement obligatoire, ça dépend de ta façon de gérer.
        
        await pool.execute('DELETE FROM deliveries WHERE id = ?', [id]);
        res.json({ message: "Livraison supprimée" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la suppression" });
    }
};