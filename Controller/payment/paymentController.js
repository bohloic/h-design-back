import axios from 'axios';
import pool from "../../db/db.js"; // Votre connexion DB
import { sendOrderConfirmationEmail } from '../../services/emailService.js';
import { generateInvoiceBuffer } from '../../utils/pdfGenerator.js';

// 1. INITIALISER LE PAIEMENT (AVEC VÉRIFICATION DES STOCKS)
export const initializePayment = async (req, res) => {
    try {
        const { email, amount, orderId, callbackUrl } = req.body;

        // 🛑 SÉCURITÉ 1 : VÉRIFICATION DES STOCKS AVANT DE PAYER
        const [items] = await pool.execute(
            `SELECT oi.quantity, p.stock_quantity, p.name 
             FROM order_items oi 
             JOIN products p ON oi.product_id = p.id 
             WHERE oi.order_id = ?`,
            [orderId]
        );

        const outOfStockItems = [];

        // On vérifie chaque article de la commande
        for (const item of items) {
            if (item.quantity > item.stock_quantity) {
                outOfStockItems.push({
                    name: item.name,
                    requested: item.quantity,
                    available: item.stock_quantity
                });
            }
        }

        // S'il y a des articles en rupture, on BLOQUE le paiement immédiatement
        if (outOfStockItems.length > 0) {
            return res.status(400).json({ 
                success: false, 
                errorType: 'STOCK_ERROR',
                message: "Certains articles de votre panier ne sont plus disponibles.",
                details: outOfStockItems
            });
        }

        // ✅ TOUT EST EN STOCK : On passe à Paystack
        // URL dynamique : on priorise celle envoyée par le frontend (production ou local), sinon le .env
        const frontendUrl = callbackUrl || process.env.FRONTEND_URL || 'http://localhost:3001';

        const params = {
            email: email,
            amount: amount * 100, 
            currency: 'XOF', 
            channels: ['mobile_money', 'card'],           
            callback_url: `${frontendUrl}/payment/callback`, 
            metadata: {
                order_id: orderId 
            }
        };

        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            params,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ 
            success: true,
            authorization_url: response.data.data.authorization_url,
            access_code: response.data.data.access_code,
            reference: response.data.data.reference
        });

    } catch (error) {
        console.error("❌ Erreur Paystack Init:", error.response?.data || error.message);
        res.status(500).json({ success: false, message: "Erreur lors de l'initialisation du paiement" });
    }
};

// 2. VÉRIFIER LE PAIEMENT (Après le retour du client)
export const verifyPayment = async (req, res) => {
    try {
        const { reference } = req.body;

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
        );

        const data = response.data.data;

        if (data.status === 'success') {
            const orderId = data.metadata.order_id;

            // 🛑 LECTURE DU STATUT INITIAL
            // On vérifie si la commande a été créée avec un design à valider
            const [orderRows] = await pool.execute('SELECT status FROM orders WHERE id = ?', [orderId]);
            const currentStatus = orderRows.length > 0 ? orderRows[0].status : 'pending';

            // 🎯 DÉTERMINATION DU STATUT FINAL
            // Si la commande nécessitait une validation, elle devient 'paid_waiting_validation'
            // Sinon, elle devient 'paid' (commande standard)
            const finalStatus = (currentStatus === 'waiting_validation') ? 'paid_waiting_validation' : 'paid';

            // 🛑 LE REMÈDE ANTI-DOUBLON ABSOLU (Mise à jour Atomique)
            // On bloque si c'est DÉJÀ payé (peu importe si c'est avec ou sans design)
            const updateSql = `UPDATE orders SET status = ?, payment_method = 'paystack' WHERE id = ? AND status NOT IN ('paid', 'paid_waiting_validation')`;
            const [updateResult] = await pool.execute(updateSql, [finalStatus, orderId]);

            // Si affectedRows est 0, c'est que la commande était DÉJÀ payée (la 2ème requête React est bloquée ici)
            if (updateResult.affectedRows === 0) {
                console.log(`⚠️ Commande #${orderId} déjà traitée, on bloque le double email.`);
                return res.status(200).json({ success: true, message: "Commande déjà traitée", orderId });
            }

            // 📉 GESTION DES STOCKS (NOUVEAU)
            try {
                // Étape A : On récupère tous les articles de cette commande
                const [items] = await pool.execute(
                    `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
                    [orderId]
                );

                // Étape B : On boucle sur chaque article pour baisser son stock
                for (const item of items) {
                    // Astuce Pro : GREATEST(0, ...) empêche le stock de devenir négatif (ex: -1)
                    await pool.execute(
                        `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?`,
                        [item.quantity, item.product_id]
                    );
                }
                console.log(`📦 Stocks mis à jour avec succès pour la commande #${orderId}`);
            } catch (stockErr) {
                // Si le stock plante, on log l'erreur mais on ne bloque pas l'email ! Le client a payé.
                console.error("❌ Erreur lors de la mise à jour des stocks :", stockErr);
            }

            // 📦 GÉNÉRER LE PDF ET ENVOYER L'EMAIL (Ceci ne s'exécutera qu'une seule fois !)
            try {
                const { pdfBuffer, orderData, itemsData } = await generateInvoiceBuffer(orderId);
                
                if (orderData.customer_email) {
                    sendOrderConfirmationEmail(
                        orderData.customer_email, 
                        orderId, 
                        orderData, 
                        itemsData, 
                        pdfBuffer
                    );
                }
            } catch (err) {
                console.error("Erreur génération PDF ou Email:", err);
            }

            res.status(200).json({ success: true, message: "Paiement réussi", orderId });
        } else {
            res.status(400).json({ success: false, message: "Le paiement a échoué" });
        }

    } catch (error) {
        console.error("❌ Erreur Paystack Verify:", error.message);
        res.status(500).json({ message: "Erreur de vérification" });
    }
};