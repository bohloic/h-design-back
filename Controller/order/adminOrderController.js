import pool from "../../db/db.js";
import { createNotification } from "../notifications/notificationController.js";

// Route : GET /api/admin/orders
export const getAllOrdersWithItems = async (req, res) => {
    try {
        const sql = `
            SELECT 
                o.id AS order_id, 
                o.status, 
                o.customer_name, 
                o.total_amount, 
                o.created_at,
                oi.id AS item_id,
                oi.quantity, 
                oi.unit_price, 
                oi.customization,
                oi.design_status,
                oi.rejection_reason,
                p.name AS product_name,
                p.image_url
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.status IN ('Validation Design', 'Payé - Validation Design', 'À Valider', 'Payé - À Valider', 'Payé - Validation Design')
            ORDER BY o.created_at DESC
        `;

        const [rows] = await pool.execute(sql);
        const ordersMap = {};

        rows.forEach(row => {
            if (!ordersMap[row.order_id]) {
                ordersMap[row.order_id] = {
                    id: row.order_id,
                    status: row.status,
                    customer_name: row.customer_name,
                    total_amount: row.total_amount,
                    created_at: row.created_at,
                    items: [] 
                };
            }

            if (row.item_id) {
                ordersMap[row.order_id].items.push({
                    id: row.item_id,
                    name: row.product_name,
                    quantity: row.quantity,
                    unit_price: row.unit_price,
                    customization: row.customization,
                    design_status: row.design_status,
                    rejection_reason: row.rejection_reason,
                    image_url: row.image_url
                });
            }
        });

        res.status(200).json(Object.values(ordersMap));
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des commandes :", error);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    }
};

// Route : PUT /api/admin/orders/:id/validate-items
export const validateItemsDesign = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const orderId = req.params.id;
        const { decisions } = req.body; // [{ id, status, reason }]

        await connection.beginTransaction();

        // 1. On récupère le statut actuel pour savoir si c'est payé
        const [currentOrder] = await connection.execute('SELECT status FROM orders WHERE id = ?', [orderId]);
        const oldStatus = currentOrder[0]?.status || '';
        const isPaid = oldStatus.includes('Payé');

        // 2. Mise à jour de chaque article
        for (const dec of decisions) {
            // ✅ Normalisation des statuts (supporte FR et EN)
            let finalItemStatus = dec.status;
            if (dec.status === 'Validé') finalItemStatus = 'approved';
            if (dec.status === 'Refusé') finalItemStatus = 'rejected';

            await connection.execute(
                `UPDATE order_items SET design_status = ?, rejection_reason = ? WHERE id = ?`,
                [finalItemStatus, dec.reason || null, dec.id]
            );
        }

        // 3. Calcul du nouveau statut global
        const [items] = await connection.execute(
            `SELECT design_status FROM order_items WHERE order_id = ?`,
            [orderId]
        );

        let finalStatus = oldStatus;
        const hasRejected = items.some(i => ['rejected', 'Refusé', 'refusé'].includes(i.design_status));
        const allApproved = items.every(i => ['approved', 'Validé', 'validé'].includes(i.design_status));

        if (hasRejected) {
            finalStatus = isPaid ? 'Payé - Action Requise' : 'Action Requise';
        } else if (allApproved) {
            finalStatus = 'En préparation';
        }

        await connection.execute(
            `UPDATE orders SET status = ? WHERE id = ?`,
            [finalStatus, orderId]
        );

        // 4. NOTIFICATION EN DB POUR LE CLIENT
        const [orderUser] = await connection.execute('SELECT user_id FROM orders WHERE id = ?', [orderId]);
        const targetUserId = orderUser[0]?.user_id;

        if (targetUserId) {
            if (hasRejected) {
                await createNotification({
                    userId: targetUserId,
                    title: "⚠️ Action Requise : Design",
                    message: `Le design de certains articles de votre commande #HD-${String(orderId).padStart(5, '0')} a été refusé. Veuillez le corriger.`,
                    type: 'warning',
                    link: `/dashboard/orders/HD-${String(orderId).padStart(5, '0')}`
                });
            } else if (allApproved) {
                await createNotification({
                    userId: targetUserId,
                    title: "✅ Design Validé",
                    message: `Félicitations ! L'ensemble des designs de votre commande #HD-${String(orderId).padStart(5, '0')} a été validé. La production commence !`,
                    type: 'success',
                    link: `/dashboard/orders/HD-${String(orderId).padStart(5, '0')}`
                });
            }
        }

        // 🔔 [NOTIFICATION ADMIN] Informer les autres admins de la décision
        try {
            const [admins] = await connection.execute("SELECT id FROM users WHERE role = 'admin'");
            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: hasRejected ? "🚫 Design Refusé" : "🎉 Design Validé",
                    message: hasRejected 
                        ? `La commande #HD-${String(orderId).padStart(5, '0')} a été marquée 'Action Requise' (Design refusé).`
                        : `La commande #HD-${String(orderId).padStart(5, '0')} est passée en préparation (Design validé).`,
                    type: hasRejected ? 'warning' : 'success',
                    link: `/admin/orders/${orderId}`
                });
            }
        } catch (notifErr) {
            console.error("⚠️ Erreur notification admin validation:", notifErr);
        }

        await connection.commit();
        res.status(200).json({ success: true, message: "Décision enregistrée avec succès.", newStatus: finalStatus });

    } catch (error) {
        await connection.rollback();
        console.error("Erreur validation :", error);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    } finally {
        connection.release();
    }
};


// Route : PUT /api/admin/orders/:id/validate-design (Compatibilité ancienne version globale)
export const validateDesign = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { action, reason } = req.body; 

        if (action === 'approve') {
            await pool.execute(`UPDATE orders SET status = 'En préparation' WHERE id = ?`, [orderId]);
            await pool.execute(`UPDATE order_items SET design_status = 'approved' WHERE order_id = ?`, [orderId]);
            
            // 🔔 Notification rapide
            const [orderUser] = await pool.execute('SELECT user_id FROM orders WHERE id = ?', [orderId]);
            if (orderUser[0]?.user_id) {
                await createNotification({
                    userId: orderUser[0].user_id,
                    title: "✅ Design Validé",
                    message: "Votre design a été approuvé par notre équipe !",
                    type: 'success',
                    link: `/dashboard/orders`
                });
            }
            return res.status(200).json({ success: true, message: "Design approuvé." });
        } 
        else if (action === 'reject') {
            await pool.execute(
                `UPDATE orders SET status = 'Action Requise', admin_notes = ? WHERE id = ?`,
                [reason, orderId]
            );
            await pool.execute(`UPDATE order_items SET design_status = 'rejected', rejection_reason = ? WHERE order_id = ?`, [reason, orderId]);
            
            // 🔔 Notification rapide
            const [orderUser] = await pool.execute('SELECT user_id FROM orders WHERE id = ?', [orderId]);
            if (orderUser[0]?.user_id) {
                await createNotification({
                    userId: orderUser[0].user_id,
                    title: "⚠️ Design Refusé",
                    message: "Votre design nécessite une correction. Voir détails dans vos commandes.",
                    type: 'warning',
                    link: `/dashboard/orders`
                });
            }
            return res.status(200).json({ success: true, message: "Design rejeté." });
        }

        res.status(400).json({ success: false, message: "Action invalide." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    }
};