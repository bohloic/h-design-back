import db from '../../db/db.js'; // Ta connexion base de données



// 👇 AJOUTE CETTE ROUTE "ME" (Profil)
export const profil =  async (req, res) => {
    try {
          const { id } = req.params;// Récupéré depuis le token

        // 1. On sélectionne UNIQUEMENT les colonnes qui existent dans ta table
        // (On ne demande pas phone ou address car ça ferait planter le code)
        const sql = 'SELECT nom, prenom, email FROM users WHERE id = ?';
        
        const [users] = await db.execute(sql, [id]);

        if (users.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        const user = users[0];

        // 2. On transforme les données pour le Frontend
        // Le frontend attend "name", "email", "phone", etc.
        const responseData = {
            // On combine Prénom + Nom pour faire le "Nom complet"
            // name: `${user.prenom} ${user.nom}`, 
            nom: user.nom,
            prenom :user.prenom,
            email: user.email,
            // Comme ces infos n'existent pas dans ta table users, on renvoie du vide
            // L'utilisateur devra les remplir manuellement la première fois
            phone: "", 
            address: "", 
            city: ""
        };

        res.json(responseData);

    } catch (error) {
        console.error("Erreur profil:", error);
        res.status(500).json({ message: "Erreur serveur" });
    }
};

