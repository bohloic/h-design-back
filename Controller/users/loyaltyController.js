import QRCode from 'qrcode';
import pool from '../../db/db.js'; // Assure-toi que le chemin vers ta DB est correct

export const getUserLoyaltyCard = async (req, res) => {
    try {
        // 1. Récupération de l'ID via le token sécurisé
        // (Vérifie si ton middleware auth met l'ID dans req.user.userId ou req.user.id)
        const userId = req.user?.userId || req.user?.id; 

        if (!userId) {
            return res.status(401).json({ message: "Non autorisé" });
        }

        // 2. On cherche le client et ses points
        const [rows] = await pool.query(
            'SELECT id, nom, prenom, email, loyalty_points FROM users WHERE id = ?', 
            [userId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        const user = rows[0];

        // 3. Les données "secrètes" cachées dans le QR Code
        // C'est ce que la caméra d'Ashley lira lors du scan
        const qrData = JSON.stringify({ 
            userId: user.id, 
            type: 'GLAMS_VIP_CARD',
            email: user.email
        });

        // 4. Dessin du QR Code
        const qrImageBase64 = await QRCode.toDataURL(qrData, {
            color: {
                dark: '#b91c1c',  // Un joli rouge pour coller à ton thème (text-red-600)
                light: '#ffffff'  // Fond blanc
            },
            width: 300,
            margin: 2
        });

        // 5. Envoi au Dashboard du client
        res.json({
            success: true,
            user: {
                nom: user.nom,
                prenom: user.prenom,
                points: user.loyalty_points || 0
            },
            qrCode: qrImageBase64
        });

    } catch (error) {
        console.error("Erreur Génération QR Code:", error);
        res.status(500).json({ error: error.message });
    }
};





// --- FONCTION 1 : Rechercher un client (Scanner VIP) ---
export const scanVipCard = async (req, res) => {
    // On récupère l'id ou l'email depuis l'URL (ex: ?id=42 ou ?email=test@test.com)
    const { id, email } = req.query;

    try {
        let query = '';
        let param = '';

        if (id) {
            query = 'SELECT id, nom, prenom, email, loyalty_points FROM users WHERE id = ?';
            param = id;
        } else if (email) {
            query = 'SELECT id, nom, prenom, email, loyalty_points FROM users WHERE email = ?';
            param = email;
        } else {
            return res.status(400).json({ message: "Veuillez fournir un ID ou un Email valide." });
        }

        const [rows] = await pool.query(query, [param]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Client introuvable dans la base de données." });
        }

        // On renvoie les infos du client
        res.json(rows[0]);

    } catch (error) {
        console.error("Erreur Scan VIP :", error);
        res.status(500).json({ message: "Erreur serveur lors de la recherche." });
    }
};


// --- FONCTION 2 : Valider la gratuité et déduire les points ---
export const redeemPoints = async (req, res) => {
    const { userId, pointsToDeduct } = req.body;

    try {
        // 1. On vérifie le solde actuel du client (sécurité)
        const [rows] = await pool.query('SELECT loyalty_points FROM users WHERE id = ?', [userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: "Client introuvable." });
        }

        const currentPoints = rows[0].loyalty_points;

        // 2. On vérifie s'il a assez de points pour éviter les triches
        if (currentPoints < pointsToDeduct) {
            return res.status(400).json({ message: `Points insuffisants. Solde actuel: ${currentPoints}` });
        }

        // 3. On déduit les points
        await pool.query(
            'UPDATE users SET loyalty_points = loyalty_points - ? WHERE id = ?', 
            [pointsToDeduct, userId]
        );

        res.json({ 
            success: true, 
            message: `${pointsToDeduct} points ont été déduits avec succès !` 
        });

    } catch (error) {
        console.error("Erreur Déduction Points :", error);
        res.status(500).json({ message: "Erreur serveur lors de la déduction des points." });
    }
};