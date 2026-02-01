
import db from "../../db/db.js"

// controller/productController.js
 export const getProductById = async (req, res) => {
    try {
        const productId = req.params.id;
        
        // 1. Récupérer le produit principal
        const [products] = await db.execute('SELECT * FROM products WHERE id = ?', [productId]);
        if (products.length === 0) return res.status(404).json({ message: 'Produit introuvable' });
        
        const product = products[0];

        // 2. Récupérer les variantes liées
        const [variants] = await db.execute('SELECT * FROM product_variants WHERE product_id = ?', [productId]);

        // 3. Renvoyer tout ensemble
        res.json({
            ...product,
            variants: variants // Le frontend s'attend à recevoir ce tableau
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
};