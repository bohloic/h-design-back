import db from '../../db/db.js'; // Ta connexion base de données



// 👇 AJOUTE CETTE ROUTE "ME" (Profil)
export const profil =  async (req, res) => {
    try {
          const { id } = req.params;// Récupéré depuis le token

        // 1. On sélectionne toutes les colonnes nécessaires pour le profil
        const sql = 'SELECT nom, prenom, email, phone, city, address, loyalty_points FROM users WHERE id = ?';
        
        const [users] = await db.execute(sql, [id]);

        if (users.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        const user = users[0];

        // 2. On transforme les données pour le Frontend
        const responseData = {
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            phone: user.phone || "", 
            address: user.address || "", 
            city: user.city || "",
            loyalty_points: user.loyalty_points || 0
        };

        res.json(responseData);

    } catch (error) {
        console.error("Erreur profil:", error);
        res.status(500).json({ message: "Erreur serveur" });
    }
};

