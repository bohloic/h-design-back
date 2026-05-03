import pool from '../../db/db.js';

export const getAdminBadges = async (req, res) => {
    try {
        // 1. Compte des designs à valider (Customs) NON VUS
        const [designs] = await pool.execute(`
            SELECT COUNT(DISTINCT o.id) as count 
            FROM orders o
            WHERE o.status IN ('Validation Design', 'Payé - Validation Design', 'À Valider 🎨', 'Payé - À Valider 🎨')
            AND o.is_seen = 0
        `);

        // 2. Compte des commandes à préparer (Standards payées ou validées) NON VUES
        const [orders] = await pool.execute(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE status IN ('Payé', 'En préparation')
            AND is_seen = 0
        `);

        res.json({
            pendingDesigns: designs[0]?.count || 0,
            pendingOrders: orders[0]?.count || 0
        });
    } catch (error) {
        console.error("Erreur badges admin:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

export const markOrderAsSeen = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('UPDATE orders SET is_seen = 1 WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Erreur mark as seen:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
};
