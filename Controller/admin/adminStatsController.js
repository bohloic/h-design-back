import pool from '../../db/db.js';

export const getAdminBadges = async (req, res) => {
    try {
        // 1. Compte des designs à valider (Customs)
        const [designs] = await pool.execute(`
            SELECT COUNT(DISTINCT o.id) as count 
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE (
                o.status IN ('Validation Design', 'Payé - Validation Design', 'À Valider', 'Payé - À Valider', 'paid_waiting_validation', 'waiting_validation', 'pending_approval')
                OR o.status LIKE '%Validation%'
                OR o.status LIKE '%Valider%'
                OR (oi.customization IS NOT NULL AND (oi.design_status IS NULL OR oi.design_status NOT IN ('approved', 'Validé', 'validé')))
            )
            AND o.status NOT IN ('Annulé', 'Cancelled', 'cancelled', 'Livré', 'Delivered')
        `);

        // 2. Compte des commandes en attente
        const [orders] = await pool.execute(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE status IN ('Payé', 'En préparation', 'paid', 'processing', 'pending', 'En attente de paiement')
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
