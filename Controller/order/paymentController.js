import axios from 'axios';

export const verifyPayment = async (req, res) => {
    const { transactionId } = req.body;

    console.log(`🔍 Backend : Vérification de la transaction : ${transactionId}`);

    if (!transactionId) {
        return res.status(400).json({ success: false, message: "Transaction ID manquant" });
    }

    try {
        // ✅ ON UTILISE LA MÉTHODE GET (Plus fiable)
        // On interroge directement le statut de la transaction
        const url = `https://api.kkiapay.me/api/v1/transactions/status/${transactionId}`;
        
        console.log(`📡 Appel Kkiapay vers : ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'x-api-key': process.env.KKIAPAY_PUBLIC_KEY,
                'x-private-key': process.env.KKIAPAY_PRIVATE_KEY,
                'Content-Type': 'application/json'
            }
        });

        const data = response.data;
        console.log("📦 Réponse Kkiapay :", data.status);

        // Kkiapay peut renvoyer le statut directement ou dans un objet
        const status = data.status || (data.transaction && data.transaction.status);

        if (status === 'SUCCESS') {
            console.log("✅ Paiement validé avec succès !");
            return res.status(200).json({ 
                success: true, 
                message: "Paiement validé",
                transactionId: transactionId 
            });
        } else {
            console.log(`❌ Paiement échoué ou invalide. Statut : ${status}`);
            return res.status(400).json({ 
                success: false, 
                message: `Statut invalide : ${status}` 
            });
        }

    } catch (error) {
        // GESTION DES ERREURS PRÉCISE
        console.error("🚨 ERREUR KKIAPAY :");
        
        if (error.response) {
            // Le serveur Kkiapay a répondu avec une erreur (ex: 404, 401)
            console.error(`Status Code : ${error.response.status}`);
            console.error(`Données :`, error.response.data);
            
            if (error.response.status === 404) {
                return res.status(404).json({ message: "Transaction introuvable (Vérifiez si vous êtes bien en mode TEST/SANDBOX sur le Dashboard Kkiapay)" });
            }
            if (error.response.status === 401) {
                return res.status(401).json({ message: "Clés API invalides (Vérifiez votre fichier .env)" });
            }
        } else {
            // Erreur réseau ou autre
            console.error(error.message);
        }

        return res.status(500).json({ message: "Erreur serveur lors de la vérification Kkiapay" });
    }
};

export const callServer = async (req, res) => {
    const event = req.body;
    console.log("Webhook reçu de KKiaPay:", event);
    // Traiter l'événement ici...
    res.sendStatus(200);
};