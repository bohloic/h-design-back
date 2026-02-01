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

// 2. ROUTE POUR METTRE À JOUR LE STATUT
export const udpdateOrder = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: "Statut mis à jour", newStatus: status });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        console.log("📥 Commande reçue (Solution 2 - Structure DB Native)");
        await connection.beginTransaction();

        const { userId, cartItems, totalAmount, shippingDetails, paymentMethod } = req.body;

        // 1. Vérification ID Utilisateur
        let finalUserId = userId;
        if (!finalUserId || finalUserId === '') {
            finalUserId = req.user?.userId;
        }
        finalUserId = parseInt(finalUserId, 10);

        if (!finalUserId || isNaN(finalUserId)) {
            throw new Error(`ID Utilisateur invalide (Reçu: ${userId})`);
        }

        // 2. Création de la commande (Table 'orders')
        const addressString = `${shippingDetails.address}, ${shippingDetails.city} - ${shippingDetails.phone} (${shippingDetails.nom} ${shippingDetails.prenom})`;
        const cleanTotal = parseFloat(totalAmount);

        const sqlOrder = `
            INSERT INTO orders 
            (user_id, total_amount, status, shipping_address, payment_method, created_at) 
            VALUES (?, ?, ?, ?, ?, NOW())
        `;

        const [result] = await connection.execute(sqlOrder, [
            finalUserId, 
            cleanTotal, 
            'pending', 
            addressString, 
            paymentMethod || 'Espèces'
        ]);

        const newOrderId = result.insertId;
        console.log("✅ Commande créée ID:", newOrderId);

        // 3. Insertion des articles (Table 'order_items')
        // ADAPTATION À VOTRE STRUCTURE EXACTE :
        // unit_price au lieu de price
        // size et color séparés au lieu de options (JSON)
        if (cartItems && cartItems.length > 0) {
            
            const itemSql = `
                INSERT INTO order_items 
                (order_id, product_id, quantity, unit_price, customization, size, color) 
                VALUES ?
            `;
            
            const itemValues = cartItems.map(item => {
                const prodId = item.product_id || item.productId || item.id;
                if (!prodId) throw new Error("ID produit manquant");

                // Récupération sécurisée de la taille et couleur
                // (Peut venir de item.options.size OU item.size selon comment le front l'envoie)
                const sizeVal = item.options?.size || item.size || null;
                const colorVal = item.options?.color || item.color || null;

                return [
                    newOrderId,
                    parseInt(prodId, 10),
                    parseInt(item.quantity, 10),
                    parseFloat(item.price), // Va dans 'unit_price'
                    
                    // Customization (JSON)
                    item.design && item.design.length > 0 ? JSON.stringify(item.design) : null,

                    // Colonnes séparées
                    sizeVal,  // Va dans 'size'
                    colorVal  // Va dans 'color'
                ];
            });
            
            await connection.query(itemSql, [itemValues]);
        }

        await connection.commit();
        console.log("🎉 Succès !");

        res.status(201).json({ 
            success: true, 
            message: "Commande créée avec succès", 
            orderId: newOrderId 
        });

    } catch (error) {
        await connection.rollback();
        console.error("❌ Erreur SQL:", error);
        res.status(500).json({ 
            message: "Erreur serveur lors de la création de la commande", 
            error: error.message,
            sqlMessage: error.sqlMessage 
        });
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