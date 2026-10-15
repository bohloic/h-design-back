
import db from "../../db/db.js"

// ✅ BONNE SYNTAXE
// 1. Ajoutez 'async' devant la fonction
export const GetUser = async (req, res) => {
    try {
        // 2. Utilisez 'await' et déstructurez le résultat pour avoir les lignes (rows)
        // pool.query ne prend PAS de fonction callback ici
        // 🛡️ OWASP: Ne jamais exposer les hashes de mots de passe ou tokens de réinitialisation
        const [rows] = await db.query(`
            SELECT id, nom, prenom, email, phone, city, address, role, loyalty_points, is_verified, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        // 3. Renvoyez la réponse
        res.json(rows);
        
    } catch (error) {
        // 4. Gérez les erreurs avec try/catch
        console.error(error);
        res.status(500).json({ message: "Erreur serveur" });
    }
};
