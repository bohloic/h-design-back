
import db from "../../db/db.js"

// controller/productController.js
 export const getProductByCategory = async (req, res) => {
   // ✅ FAIS ÇA : La route s'arrête net, sans le "?"
   
    
    // C'est ICI qu'on récupère ce qu'il y a après le "?"
    // Si l'URL est /products?collection=T-shirt
    // alors req.query.collection vaudra "T-shirt"
    const collectionDemandee = req.params.category_id;

    try {
        let sql = "SELECT * FROM products";
        let params = [];

        // Si on a un paramètre collection, on filtre
        if (collectionDemandee) {
            sql += " WHERE products.category_id = ?";
            params.push(collectionDemandee);
        }

        // ... exécution de ta requête SQL ...
        const [result] = await db.execute(sql, params);
        res.json(result);

    } catch (error) {
        console.error("❌ Erreur productByCategory:", error);
        res.status(500).json({ message: "Une erreur est survenue lors de la récupération des produits par catégorie." });
    }
};
