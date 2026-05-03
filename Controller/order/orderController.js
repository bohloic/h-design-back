import pool from "../../db/db.js";
import { createNotification } from "../notifications/notificationController.js";

// 1. ROUTE POUR RÉCUPÉRER LES COMMANDES
export const getOrder = async (req, res) => {
    try {
        // On fait une jointure (JOIN) pour avoir le nom du client en même temps que la commande
        const sql = `
            SELECT o.id, o.total_amount, o.status, o.created_at, o.is_seen, u.nom, u.prenom, u.email 
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `;
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (err) {
        console.error("❌ Erreur getOrder:", err);
        res.status(500).json({ message: "Une erreur est survenue lors de la récupération des commandes." });
    }
};


export const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. On lit l'état ACTUEL de la commande ET les points utilisés
        const [orderInfo] = await connection.execute(`
            SELECT o.user_id, o.status AS old_status, o.points_awarded, o.points_used,
                   (SELECT SUM(quantity) FROM order_items WHERE order_id = ?) as total_items
            FROM orders o
            WHERE o.id = ?
        `, [id, id]);

        if (orderInfo.length === 0) {
            throw new Error("Commande introuvable");
        }

        const order = orderInfo[0];
        const userId = order.user_id;
        const pointsAwarded = order.points_awarded;
        const totalItems = parseInt(order.total_items, 10) || 0;
        const pointsUsed = parseInt(order.points_used, 10) || 0;

        // 🔥 LE CALCUL MAGIQUE 🔥
        // Si 200 points = 1 t-shirt offert, on divise les points utilisés par 200 pour connaître le nombre d'articles gratuits.
        const freeItems = pointsUsed / 200; 
        
        // On soustrait les articles gratuits du total (Math.max empêche d'avoir un chiffre négatif)
        const paidItems = Math.max(0, totalItems - freeItems);
        
        // Le client ne gagne 20 points QUE sur les articles payés !
        const pointsToGiveOrTake = paidItems * 20;

        // 2. On met à jour le statut
        await connection.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

        // 3. SÉCURITÉ ET ATTRIBUTION DES POINTS
        if (status === 'Livré' && !pointsAwarded && userId) {
            if (pointsToGiveOrTake > 0) {
                await connection.execute(
                    'UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?',
                    [pointsToGiveOrTake, userId]
                );
                await connection.execute('UPDATE orders SET points_awarded = TRUE WHERE id = ?', [id]);
                console.log(`✅ [CLUB VIP] ${pointsToGiveOrTake} points ajoutés au client #${userId} (pour ${paidItems} articles payés).`);
            } else {
                // S'il n'y avait qu'un seul t-shirt et qu'il était gratuit, on verrouille sans donner de points
                await connection.execute('UPDATE orders SET points_awarded = TRUE WHERE id = ?', [id]);
                console.log(`ℹ️ [CLUB VIP] Commande 100% gratuite. 0 point ajouté.`);
            }
        } 
        // CAS B : Correction d'erreur (Ashley retire le statut "Livré")
        else if (order.old_status === 'Livré' && status !== 'Livré' && pointsAwarded && userId) {
            if (pointsToGiveOrTake > 0) {
                await connection.execute(
                    'UPDATE users SET loyalty_points = GREATEST(0, loyalty_points - ?) WHERE id = ?',
                    [pointsToGiveOrTake, userId]
                );
                await connection.execute('UPDATE orders SET points_awarded = FALSE WHERE id = ?', [id]);
                console.log(`⏪ [CORRECTION] ${pointsToGiveOrTake} points repris au client #${userId}.`);
            } else {
                await connection.execute('UPDATE orders SET points_awarded = FALSE WHERE id = ?', [id]);
            }
        }

        // 4. NOTIFICATION EN DB POUR LE CLIENT
        if (userId && status !== order.old_status) {
            let notifType = 'info';
            if (status.includes('Payé') || status === 'Livré') notifType = 'success';
            if (status.includes('Annulé')) notifType = 'error';

            await createNotification({
                userId: userId,
                title: "Mise à jour de votre commande",
                message: `Votre commande #HD-${String(id).padStart(5, '0')} est maintenant : ${status}`,
                type: notifType,
                link: `/dashboard/orders/HD-${String(id).padStart(5, '0')}`
            });
        }

        await connection.commit();
        res.json({ success: true, message: "Statut mis à jour en toute sécurité !" });

    } catch (error) {
        await connection.rollback();
        console.error("❌ Erreur critique lors de la mise à jour:", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour." });
    } finally {
        connection.release();
    }
};


// Récupérer la liste des commandes pour le select
export const commandeSelect = async (req, res) => {
    try {
        // On récupère l'ID et le Total pour afficher "Commande #1 (50€)"
        const [rows] = await pool.query('SELECT id, total_amount FROM orders ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error("❌ Erreur commandeSelect:", error);
        res.status(500).json({ message: "Une erreur est survenue lors de la récupération de la liste des commandes." });
    }
};


// // CRÉER UNE COMMANDE (Checkout) n°1
// export const checkout = async (req, res) => {
//     try {
//         // 1. Récupération des données du Frontend
//         const { cartItems, shippingDetails, paymentMethod, totalAmount } = req.body;
        
//         // Sécurisation (au cas où shippingDetails est vide)
//         const { userId, nom ,prenom , address, phone, city, email } = shippingDetails || {};

//         // 2. Récupération de l'ID utilisateur via le Token (mis par ton middleware auth.js)
//         // Vérifie si ton middleware met l'info dans req.user.id ou req.userId
//         // const userId = req.user ? req.user.id : null; 

//         // 3. La requête SQL alignée avec ta base de données
//         // Note : J'utilise 'shipping_address' car c'est le nom dans ton DESCRIBE orders
//         const sqlInsertOrder = `
//             INSERT INTO orders (
//                 user_id, 
//                 customer_name, 
//                 phone, 
//                 customer_city, 
//                 customer_email, 
//                 shipping_address, 
//                 payment_method, 
//                 total_amount, 
//                 status,
//                 created_at
//             ) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
//         `;

//         console.log("DEBUG VARIABLES :", {
//             userId: userId,
//             name: `${nom} ${prenom}` ,
//             phone: phone,
//             city: city,
//             address: address,
//             payment: paymentMethod,
//             amount: totalAmount
//         });

//         // 4. Exécution
//         const [result] = await pool.execute(sqlInsertOrder, [
//             (userId !== undefined ? userId : null), // Sécurité maximale pour userId
//             `${nom} ${prenom}` || null,
//             phone || null,
//             city || null,
//             email || null,
//             address || null,
//             paymentMethod || null,
//             totalAmount || 0 // Si pas de montant, on met 0 (pas null)
//         ]);

//         const orderId = result.insertId;

//         // ... Ici tu mets ta boucle pour insérer les articles (order_items) ...
//         // N'oublie pas d'utiliser orderId ici

//         res.status(201).json({ message: "Commande enregistrée avec succès !", orderId });

//     } catch (error) {
//         console.error("Erreur Backend :", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// Récupérer les commandes du client (Pour son historique)
export const getOrderByUser = async (req, res) => {
    const { id } = req.params;

    // 🛡️ SÉCURITÉ (IDOR) : L'utilisateur ne peut voir que SES commandes (ou être admin)
    if (req.user.role !== 'admin' && String(req.user.userId) !== String(id)) {
        return res.status(403).json({ message: "Accès interdit : Historique inatteignable." });
    }

    try {
        const [orders] = await pool.execute(
            `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, 
            [id]
        );
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Erreur récupération commandes" });
    }
};

// Récupérer les commandes du client (Pour son historique)
export const getOrderByEmail = async (req, res) => {
    const { email } = req.params;
    try {
        const [orders] = await pool.execute(
            `SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC`, 
            [email]
        );
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Erreur récupération commandes" });
    }
};



export const createOrder = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        console.log("📥 Création de commande avec vérification Design...");
        await connection.beginTransaction();

        const { userId, cartItems, totalAmount, shippingDetails, paymentMethod, useLoyaltyPoints } = req.body;
        
        // 🛡️ SÉCURITÉ : Interdiction du paiement à la livraison
        if (paymentMethod === 'Espèces' || paymentMethod === 'Cash') {
            return res.status(400).json({ message: "Le paiement à la livraison n'est plus accepté. Veuillez payer en ligne." });
        }

        // 1. Vérification ID Utilisateur (Mode Invité = null)
        let finalUserId = userId || req.user?.userId || null;
        if (finalUserId !== null) {
            finalUserId = parseInt(finalUserId, 10);
            if (isNaN(finalUserId)) {
                throw new Error(`ID Utilisateur invalide (Reçu: ${userId})`);
            }
        }

        // 🛡️ SÉCURITÉ : Toutes les commandes commencent par "En attente de paiement"
        // Le statut changera en "Payé - ..." uniquement via le webhook Paystack après succès réel.
        const initialStatus = 'En attente de paiement ⏳';
        const userName = `${shippingDetails.nom} ${shippingDetails.prenom}`;
        const cleanTotal = parseFloat(totalAmount);

        // 🔥 VÉRIFICATION ET DÉDUCTION DES POINTS EN LIGNE 🔥
        if (useLoyaltyPoints && finalUserId !== null) {
            const [userRows] = await connection.execute('SELECT loyalty_points FROM users WHERE id = ? FOR UPDATE', [finalUserId]);
            const currentPoints = userRows[0]?.loyalty_points || 0;

            if (currentPoints < 200) {
                throw new Error("Triche détectée : Points de fidélité insuffisants.");
            }

            // On retire immédiatement les 200 points
            await connection.execute('UPDATE users SET loyalty_points = loyalty_points - 200 WHERE id = ?', [finalUserId]);
            console.log(`🎁 [CLUB VIP] 200 points déduits pour le client #${finalUserId}.`);
        }

        
       const pointsUsedValue = useLoyaltyPoints ? 200 : 0;

        //  Création de la commande principale
        const sqlOrder = `
            INSERT INTO orders 
            (user_id, total_amount, status, customer_name, phone, city, customer_email, shipping_address, payment_method, device_type, points_used, is_seen, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
        `;

        const [result] = await connection.execute(sqlOrder, [
            finalUserId, 
            cleanTotal, 
            initialStatus, 
            userName, 
            shippingDetails.phone, 
            shippingDetails.city, 
            shippingDetails.email, 
            shippingDetails.address, 
            paymentMethod || 'Carte/Mobile Money',
            req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
            pointsUsedValue // <-- On enregistre les points dépensés (200 ou 0)
        ]);

        const newOrderId = result.insertId;
        console.log(`✅ Commande #${newOrderId} créée avec le statut: ${initialStatus}`);

        // 🔥 NOUVEAUTÉ : Sauvegarder l'adresse pour la prochaine fois (Réutilisation dynamique)
        if (finalUserId) {
            await connection.execute(
                'UPDATE users SET phone = ?, city = ?, address = ? WHERE id = ?',
                [shippingDetails.phone, shippingDetails.city, shippingDetails.address, finalUserId]
            );
            console.log(`🏠 [PROFIL] Adresse mise à jour pour le client #${finalUserId}.`);
        }

        // 4. Insertion des articles
        if (cartItems && cartItems.length > 0) {
            
            const itemSql = `
                INSERT INTO order_items 
                (order_id, product_id, quantity, unit_price, customization, size, color, design_status) 
                VALUES ?
            `;
            
            const itemValues = cartItems.map(item => {
                const prodId = item.product_id || item.productId || item.id;
                if (!prodId) throw new Error("ID produit manquant");

                const sizeVal = item.options?.size || item.size || null;
                const colorVal = item.options?.color || item.color || null;

                // 🛠️ OPTIMISATION ANTI-CRASH : Nettoyage des données de design
                let customizationValue = null;
                let itemDesignStatus = 'approved'; // Par défaut approuvé pour les produits standards

                if (item.design) {
                    try {
                        let designObj = typeof item.design === 'string' ? JSON.parse(item.design) : item.design;
                        
                        // Si le design contient des éléments (Canvas), on nettoie les images base64
                        if (designObj.elements && Array.isArray(designObj.elements) && designObj.elements.length > 0) {
                            itemDesignStatus = 'pending'; // Si y'a du design, on passe en attente
                            designObj.elements = designObj.elements.map(el => {
                                // Si c'est une image base64, on la vide car elle est déjà sauvegardée en fichier
                                if (el.type === 'image' && el.content && el.content.startsWith('data:image')) {
                                    return { ...el, content: "base64_removed_for_db_safety" };
                                }
                                return el;
                            });
                        }
                        
                        // On supprime aussi la prévisualisation base64 si elle existe
                        if (designObj.customizationImage && designObj.customizationImage.startsWith('data:image')) {
                             designObj.customizationImage = "base64_removed_for_db_safety";
                        }

                        customizationValue = JSON.stringify(designObj);
                    } catch (e) {
                        // En cas d'erreur de parse, on garde la valeur brute mais on limite sa taille
                        customizationValue = typeof item.design === 'object' ? JSON.stringify(item.design) : item.design;
                    }
                }

                return [
                    newOrderId,
                    parseInt(prodId, 10),
                    parseInt(item.quantity, 10),
                    parseFloat(item.price),
                    customizationValue,
                    sizeVal,
                    colorVal,
                    itemDesignStatus
                ];
            });
            
            await connection.query(itemSql, [itemValues]);
        }

        await connection.commit();

        // 🔔 [NOTIFICATION ADMIN] Informer les admins de la nouvelle commande
        try {
            const [admins] = await connection.execute("SELECT id FROM users WHERE role = 'admin'");
            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: "📦 Nouvelle Commande",
                    message: `Une nouvelle commande (#HD-${String(newOrderId).padStart(5, '0')}) vient d'être passée par ${userName}.`,
                    type: 'info',
                    link: `/admin/orders/${newOrderId}`
                });
            }
        } catch (notifErr) {
            console.error("⚠️ Erreur notification admin:", notifErr);
        }

        res.status(201).json({ success: true, message: "Commande créée avec succès", orderId: newOrderId });

        // 🔔 [NOTIFICATION CLIENT] Confirmation immédiate (Même pour le standard)
        if (finalUserId) {
            try {
                await createNotification({
                    userId: finalUserId,
                    title: "🛍️ Commande Reçue",
                    message: `Votre commande #HD-${String(newOrderId).padStart(5, '0')} est bien enregistrée !`,
                    type: 'success',
                    link: `/dashboard/orders/${newOrderId}`
                });
            } catch (notifErr) {
                console.error("⚠️ Erreur notification client:", notifErr);
            }
        }

    } catch (error) {
        // 🛡️ SÉCURITÉ TRANSACTION : On ne tente le rollback que si la connexion est encore vivante
        try {
            if (connection) {
                await connection.rollback();
            }
        } catch (rollbackErr) {
            console.error("⚠️ Impossible de rollback (Connexion déjà fermée) :", rollbackErr.message);
        }

        console.error("❌ Erreur SQL lors de la commande:", error);
        
        // Diagnostic de la taille si c'est un ECONNRESET
        if (error.code === 'ECONNRESET') {
            const payloadSize = JSON.stringify(req.body).length;
            console.error(`📏 Taille du payload détectée : ${Math.round(payloadSize / 1024)} KB. Augmentez max_allowed_packet si > 4000 KB.`);
        }

        res.status(500).json({ 
            success: false, 
            message: "Une erreur est survenue lors de la création de la commande.", 
            error: error.message 
        });
    } finally {
        if (connection) connection.release();
    }
};


// 8. OBTENIR LES DETAILS DE LA COMMANDE (Mis à jour pour le design granulaire)
export const getOrderItems =  async (req, res) => {
    const orderId = req.params.id;

    try {
        const [orderResult] = await pool.query(
            `SELECT o.*, u.nom, u.prenom, u.email, u.phone 
             FROM orders o 
             LEFT JOIN users u ON o.user_id = u.id 
             WHERE o.id = ?`, 
            [orderId]
        );

        if (orderResult.length === 0) {
            return res.status(404).json({ message: "Commande introuvable" });
        }

        const isClient = String(orderResult[0].user_id) === String(req.user.userId);
        const isAdmin = req.user.role === 'admin';
        
        if (!isAdmin && orderResult[0].user_id !== null && !isClient) {
            return res.status(403).json({ message: "Accès refusé." });
        }

        const [itemsResult] = await pool.query(
            `SELECT oi.*, p.name as product_name, p.image_url as image_url 
             FROM order_items oi 
             LEFT JOIN products p ON oi.product_id = p.id 
             WHERE oi.order_id = ?`,
            [orderId]
        );

        res.json({ ...orderResult[0], items: itemsResult });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur" });
    }
};

// 9. METTRE À JOUR LE DESIGN D'UN ARTICLE (Client corrige un rejet)
export const updateItemDesign = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params; // Item ID
        const { customization, image_url, size, color, unit_price } = req.body;
        const userId = req.user.userId;

        await connection.beginTransaction();

        // 1. Vérif de propriété : l'item appartient-il à une commande de cet utilisateur ?
        const [ownership] = await connection.execute(
            `SELECT oi.order_id FROM order_items oi 
             JOIN orders o ON oi.order_id = o.id 
             WHERE oi.id = ? AND o.user_id = ?`,
            [id, userId]
        );

        if (ownership.length === 0) {
            throw new Error("Vous n'avez pas l'autorisation de modifier cet article.");
        }

        const orderId = ownership[0].order_id;

        // 2. Mise à jour de l'article (on inclut tout : taille, couleur, prix, design)
        await connection.execute(
            `UPDATE order_items 
             SET customization = ?, 
                 size = ?, 
                 color = ?, 
                 unit_price = ?,
                 design_status = 'En attente', 
                 rejection_reason = NULL 
             WHERE id = ?`,
            [customization, size || null, color || null, unit_price || null, id]
        );

        // 3. Mise à jour du statut global si nécessaire
        // Si la commande était en 'Action Requise', on vérifie s'il reste des rejets
        const [remainingRejections] = await connection.execute(
            `SELECT COUNT(*) as count FROM order_items WHERE order_id = ? AND design_status = 'rejected'`,
            [orderId]
        );

        if (remainingRejections[0].count === 0) {
            // 🪄 PRÉSERVATION DU STATUT PAYÉ
            const [currentOrder] = await connection.execute('SELECT status FROM orders WHERE id = ?', [orderId]);
            const currentStatus = currentOrder[0]?.status || '';
            const isPaid = currentStatus.includes('Payé');
            
            const nextStatus = isPaid ? 'Payé - Validation Design' : 'Validation Design';

            await connection.execute(
                `UPDATE orders SET status = ? WHERE id = ?`,
                [nextStatus, orderId]
            );
        }

        await connection.commit();

        // 🔔 [NOTIFICATION ADMIN] Informer les admins de la correction du design
        try {
            const [admins] = await connection.execute("SELECT id FROM users WHERE role = 'admin'");
            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: "🎨 Design Mis à Jour",
                    message: `Le client a corrigé le design de l'article dans la commande #HD-${String(orderId).padStart(5, '0')}.`,
                    type: 'info',
                    link: `/admin/orders/${orderId}`
                });
            }
        } catch (notifErr) {
            console.error("⚠️ Erreur notification admin (correction design):", notifErr);
        }

        res.json({ success: true, message: "Design mis à jour et renvoyé pour validation." });

    } catch (error) {
        await connection.rollback();
        console.error("❌ Erreur update item design:", error);
        res.status(500).json({ message: "Une erreur est survenue lors de la mise à jour du design." });
    } finally {
        connection.release();
    }
};

export const validateOrderDesign = async (req, res) => {
    // ... Gardé pour compatibilité ascendante ...
    const { id } = req.params;
    const { decision, message } = req.body; 
    try {
        const newStatus = (decision === 'approved') ? 'En attente de paiement' : 'Action Requise';
        await pool.query(`UPDATE orders SET status = ?, designer_message = ? WHERE id = ?`, [newStatus, message || null, id]);
        res.json({ success: true, message: `Design ${decision === 'approved' ? 'validé' : 'refusé'}.`, newStatus });
    } catch (err) {
        console.error("❌ Erreur validateOrderDesign:", err);
        res.status(500).json({ message: "Erreur lors de la validation du design." });
    }
};