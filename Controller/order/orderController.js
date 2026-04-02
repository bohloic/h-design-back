import  pool  from "../../db/db.js";

// 1. ROUTE POUR RÉCUPÉRER LES COMMANDES
export const getOrder = async (req, res) => {
    try {
        // On fait une jointure (JOIN) pour avoir le nom du client en même temps que la commande
        const sql = `
            SELECT o.id, o.total_amount, o.status, o.created_at, u.nom, u.prenom, u.email 
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `;
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        if (status === 'delivered' && !pointsAwarded && userId) {
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
        else if (order.old_status === 'delivered' && status !== 'delivered' && pointsAwarded && userId) {
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
        res.status(500).json({ error: error.message });
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

        // 1. Vérification ID Utilisateur (Mode Invité = null)
        let finalUserId = userId || req.user?.userId || null;
        if (finalUserId !== null) {
            finalUserId = parseInt(finalUserId, 10);
            if (isNaN(finalUserId)) {
                throw new Error(`ID Utilisateur invalide (Reçu: ${userId})`);
            }
        }

        // 2. DÉTECTION INTELLIGENTE DU DESIGN (Pour le statut)
        const hasCustomization = cartItems.some(item => {
            if (!item.design) return false;
            // Si ancien format (tableau)
            if (Array.isArray(item.design)) return item.design.length > 0;
            // Si nouveau format (objet)
            if (item.design.elements || item.design.customizationImage) return true;
            return false;
        });

        const initialStatus = hasCustomization ? 'waiting_validation' : 'pending';
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
            (user_id, total_amount, status, customer_name, phone, city, customer_email, shipping_address, payment_method, device_type, points_used, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
            paymentMethod || 'Espèces',
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
                (order_id, product_id, quantity, unit_price, customization, size, color) 
                VALUES ?
            `;
            
            const itemValues = cartItems.map(item => {
                const prodId = item.product_id || item.productId || item.id;
                if (!prodId) throw new Error("ID produit manquant");

                const sizeVal = item.options?.size || item.size || null;
                const colorVal = item.options?.color || item.color || null;

                // 🔥 LA CORRECTION CRITIQUE EST ICI 🔥
                let customizationValue = null;
                if (item.design) {
                    if (Array.isArray(item.design) && item.design.length > 0) {
                        customizationValue = JSON.stringify(item.design);
                    } else if (!Array.isArray(item.design) && (item.design.elements || item.design.customizationImage)) {
                        customizationValue = JSON.stringify(item.design); // L'objet complet est sauvegardé !
                    }
                }

                return [
                    newOrderId,
                    parseInt(prodId, 10),
                    parseInt(item.quantity, 10),
                    parseFloat(item.price),
                    customizationValue, // On insère la bonne valeur
                    sizeVal,
                    colorVal
                ];
            });
            
            await connection.query(itemSql, [itemValues]);
        }

        await connection.commit();
        res.status(201).json({ success: true, message: "Commande créée avec succès", orderId: newOrderId });

    } catch (error) {
        await connection.rollback();
        console.error("❌ Erreur SQL:", error);
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    } finally {
        connection.release();
    }
};


// obtenir les details de  la commande
export const getOrderItems =  async (req, res) => {
    const orderId = req.params.id;

    try {
        // 1. Infos Commande + Client (Jointure)
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

        // 🛡️ SÉCURITÉ (IDOR) : Vérifier que celui qui demande a bien le droit de voir la facture
        const isClient = String(orderResult[0].user_id) === String(req.user.userId);
        const isAdmin = req.user.role === 'admin';
        
        // Si la commande n'a pas d'user_id (mode invité), on pourrait filtrer via l'email ou un token invité.
        // Ici on protège au moins les comptes connectés :
        if (!isAdmin && orderResult[0].user_id !== null && !isClient) {
            return res.status(403).json({ message: "Grave : Vous tentez de lire une facture qui ne vous appartient pas." });
        }

        // 2. Infos Articles (Jointure avec Products pour avoir l'image et le nom)
        const [itemsResult] = await pool.query(
            `SELECT oi.*, p.name as product_name, p.image_url 
             FROM order_items oi 
             LEFT JOIN products p ON oi.product_id = p.id 
             WHERE oi.order_id = ?`,
            [orderId]
        );

        // 3. On combine le tout
        const fullOrder = {
            ...orderResult[0],
            items: itemsResult
        };

        res.json(fullOrder);

    } catch (error) {
        console.error("Erreur détails commande:", error);
        res.status(500).json({ message: "Erreur serveur" });
    }
};


export const validateOrderDesign = async (req, res) => {
    const { id } = req.params;
    const { decision, message } = req.body; // decision: 'approved' ou 'rejected'

    try {
        // Si approuvé, on passe à 'pending' (attente paiement) ou 'paid' selon le cas
        // Si refusé, on passe à 'rejected'
        const newStatus = (decision === 'approved') ? 'pending' : 'rejected';

        const sql = `
            UPDATE orders 
            SET status = ?, designer_message = ? 
            WHERE id = ?
        `;
        
        await pool.query(sql, [newStatus, message || null, id]);

        res.json({ 
            success: true, 
            message: `Design ${decision === 'approved' ? 'validé' : 'refusé'}.`,
            newStatus 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};