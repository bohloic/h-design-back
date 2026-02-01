
import db from "../../db/db.js"

// ✅ BONNE SYNTAXE
// 1. Ajoutez 'async' devant la fonction
export const GetProduct = async (req, res) => {
    try {
        // 2. Utilisez 'await' et déstructurez le résultat pour avoir les lignes (rows)
        // pool.query ne prend PAS de fonction callback ici
        const [rows] = await db.query("SELECT * FROM `products` ");
        
        // 3. Renvoyez la réponse
        res.json(rows);
        
    } catch (error) {
        // 4. Gérez les erreurs avec try/catch
        console.error(error);
        res.status(500).json({ message: "Erreur serveur" });
    }
};


