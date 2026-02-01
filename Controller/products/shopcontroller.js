import pool from "../../db/db.js";

export const shopController = async (req, res) => {
    try {
        // 1. Récupérer les produits (Ta requête existante)
        const sqlProducts = `
            SELECT 
                p.*,
                c.name as collection_name, 
                cat.name as category_name
            FROM products p
            LEFT JOIN collections c ON p.collection_id = c.id
            LEFT JOIN categories cat ON p.category_id = cat.id 
            WHERE p.stock_quantity > 0
            ORDER BY p.created_at DESC;
        `;
        const [products] = await pool.query(sqlProducts);

        // 2. Récupérer toutes les variantes (C'est ce qui manquait !)
        const sqlVariants = `SELECT * FROM product_variants`;
        const [allVariants] = await pool.query(sqlVariants);

        // 3. Fusionner les données pour le Frontend
        const productsWithData = products.map(product => {
            
            // A. On associe les variantes au bon produit
            const productVariants = allVariants.filter(v => v.product_id === product.id);

            // B. On nettoie les images des variantes (souvent stockées en JSON string)
            const cleanVariants = productVariants.map(v => {
                let vImages = [];
                try {
                    vImages = typeof v.images === 'string' ? JSON.parse(v.images) : v.images;
                } catch (e) { vImages = []; }
                
                return { ...v, images: Array.isArray(vImages) ? vImages : [] };
            });

            // C. On parse les tailles (attributes) du produit (ex: "['S', 'M']")
            let parsedSizes = [];
            try {
                parsedSizes = typeof product.attributes === 'string' 
                    ? JSON.parse(product.attributes) 
                    : product.attributes;
            } catch (e) { parsedSizes = []; }

            // D. On retourne l'objet complet prêt pour Shop.tsx
            return {
                ...product,
                price: parseFloat(product.price), // On s'assure que c'est un nombre
                sizes: Array.isArray(parsedSizes) ? parsedSizes : [],
                variants: cleanVariants
            };
        });

        res.json(productsWithData);

    } catch (err) {
        console.error("Erreur Shop Controller:", err);
        res.status(500).json({ error: err.message });
    }
};