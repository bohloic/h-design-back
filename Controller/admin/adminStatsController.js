import pool from '../../db/db.js';

export const getAdminBadges = async (req, res) => {
    try {
        // 1. Compte des designs à valider (Customs non annulés, non refusés, non encore validés)
        const [designs] = await pool.execute(`
            SELECT COUNT(DISTINCT o.id) as count 
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE (
                o.status IN ('Validation Design', 'Payé - Validation Design', 'À Valider', 'Payé - À Valider', 'paid_waiting_validation', 'waiting_validation', 'pending_approval')
                OR o.status LIKE '%Validation%'
                OR o.status LIKE '%Valider%'
                OR (
                    oi.customization IS NOT NULL 
                    AND oi.customization != '' 
                    AND oi.customization != '{}' 
                    AND (oi.design_status IS NULL OR oi.design_status = '' OR oi.design_status NOT IN ('approved', 'Validé', 'validé', 'refusé', 'rejected', 'refuse'))
                )
            )
            AND o.status NOT IN ('Annulé', 'Cancelled', 'cancelled', 'Livré', 'Delivered', 'Refusé', 'Rejected')
            AND (o.payment_status IS NULL OR o.payment_status NOT IN ('cancelled', 'failed', 'refunded'))
        `);

        // 2. Compte des commandes nécessitant une attention admin
        const [orders] = await pool.execute(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE status IN ('Payé', 'En préparation', 'paid', 'processing', 'pending', 'En attente de paiement', 'paid_waiting_validation', 'waiting_validation')
            AND status NOT IN ('Annulé', 'Cancelled', 'cancelled', 'Livré', 'Delivered')
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
