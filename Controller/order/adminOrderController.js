import pool from "../../db/db.js"; // Ajuste le chemin vers ta connexion DB

// Route : GET /api/orders (ou /api/admin/orders)
export const getAllOrdersWithItems = async (req, res) => {
    try {
        // 1. La requête SQL magique avec des JOIN
        // On récupère la commande (o), les articles (oi) et le nom du produit (p)
        const sql = `
            SELECT 
                o.id AS order_id, 
                o.status, 
                o.customer_name, 
                o.total_amount, 
                o.created_at,
                oi.quantity, 
                oi.unit_price, 
                oi.customization,
                p.name AS product_name
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            ORDER BY o.created_at DESC
        `;

        const [rows] = await pool.execute(sql);

        // 2. Le Groupement (Transformation des lignes SQL plates en objets imbriqués)
        const ordersMap = {};

        rows.forEach(row => {
            // Si la commande n'existe pas encore dans notre dictionnaire, on la crée
            if (!ordersMap[row.order_id]) {
                ordersMap[row.order_id] = {
                    id: row.order_id,
                    status: row.status,
                    customer_name: row.customer_name,
                    total_amount: row.total_amount,
                    created_at: row.created_at,
                    items: [] // 🪄 On prépare le tableau vide pour les articles !
                };
            }

            // Si la ligne contient un article, on l'ajoute dans le tableau 'items' de cette commande
            if (row.product_name) {
                ordersMap[row.order_id].items.push({
                    name: row.product_name,
                    quantity: row.quantity,
                    unit_price: row.unit_price,
                    customization: row.customization // 🪄 C'est ici que le design passe au Frontend !
                });
            }
        });

        // 3. On transforme le dictionnaire en un simple tableau pour le Frontend
        const ordersList = Object.values(ordersMap);

        // 4. On envoie le résultat final
        res.status(200).json(ordersList);

    } catch (error) {
        console.error("❌ Erreur lors de la récupération des commandes :", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération des commandes." });
    }
};

// Route : PUT /api/admin/orders/:id/validate-design
export const validateDesign = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { action, reason } = req.body; // 'approve' ou 'reject'

        if (action === 'approve') {
            // ✅ Le design est valide : on passe la commande en préparation
            await pool.execute(
                `UPDATE orders SET status = 'En préparation' WHERE id = ?`,
                [orderId]
            );
            
            // (Optionnel) Ici, tu pourrais envoyer un email au client : "Bonne nouvelle, votre design a été validé par nos ateliers !"
            
            return res.status(200).json({ success: true, message: "Design approuvé." });
        } 
        
        else if (action === 'reject') {
            // ❌ Le design pose problème : on met en attente et on note le motif
            // Note : Il te faudra peut-être une colonne "admin_notes" dans ta table orders pour stocker le "reason"
            await pool.execute(
                `UPDATE orders SET status = 'Action Requise', admin_notes = ? WHERE id = ?`,
                [reason, orderId]
            );

            // ⚠️ TRÈS IMPORTANT : Envoyer un email au client pour lui dire que son design est refusé (et lui donner la raison) pour qu'il le modifie.

            return res.status(200).json({ success: true, message: "Design rejeté." });
        }

        res.status(400).json({ success: false, message: "Action invalide." });

    } catch (error) {
        console.error("Erreur lors de la validation du design :", error);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    }
};