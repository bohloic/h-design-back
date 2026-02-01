import axios from 'axios';
import pool from "../../db/db.js"; // Votre connexion DB

// 1. INITIALISER LE PAIEMENT
export const initializePayment = async (req, res) => {
    try {
        const { email, amount, orderId } = req.body;

        // Paystack attend le montant en centimes (Kobo), donc on multiplie par 100
        // Exemple : 1000 FCFA = 100000
        const params = {
            email: email,
            amount: amount * 100, 
            currency: 'XOF', // Franc CFA
            channels: ['mobile_money', 'card'], // On active Mobile Money et Carte
            callback_url: `http://localhost:3001/payment/callback`, // URL du Frontend après paiement
            metadata: {
                order_id: orderId // On garde l'ID de commande pour la suite
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

        // On renvoie l'URL de paiement au Frontend
        res.status(200).json({ 
            authorization_url: response.data.data.authorization_url,
            access_code: response.data.data.access_code,
            reference: response.data.data.reference
        });

    } catch (error) {
        console.error("❌ Erreur Paystack Init:", error.response?.data || error.message);
        res.status(500).json({ message: "Erreur lors de l'initialisation du paiement" });
    }
};

// 2. VÉRIFIER LE PAIEMENT (Après le retour du client)
export const verifyPayment = async (req, res) => {
    try {
        const { reference } = req.body;

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const data = response.data.data;

        if (data.status === 'success') {
            // ✅ Paiement validé !
            // On récupère l'ID de commande qu'on avait caché dans les métadonnées
            const orderId = data.metadata.order_id;

            // METTRE À JOUR LA COMMANDE EN BASE DE DONNÉES
            // (Adaptez cette requête à votre structure de table)
            const updateSql = `UPDATE orders SET status = 'paid', payment_method = 'paystack' WHERE id = ?`;
            await pool.execute(updateSql, [orderId]);

            res.status(200).json({ success: true, message: "Paiement réussi", orderId });
        } else {
            res.status(400).json({ success: false, message: "Le paiement a échoué" });
        }

    } catch (error) {
        console.error("❌ Erreur Paystack Verify:", error.message);
        res.status(500).json({ message: "Erreur de vérification" });
    }
};