import pool from "../../db/db.js"
import slugify from "slugify";

// Route pour récupérer un seul produit par son slug
// Route pour récupérer un seul produit par son slug (AVEC SES VARIANTES)
export const getProductBySlug = async (req, res) => {
    const { slug } = req.params; 
    const cleanSlug = slug.trim();
    try {
        // 1. Mise à jour des vues
        await pool.query("UPDATE products SET view_count = view_count + 1 WHERE slug = ?", [cleanSlug]);
        
        // 2. Récupération du Produit Principal
        const sqlProduct = `
            SELECT p.*, p.color, c.name as collection_name, cat.name as category_name
            FROM products p
            LEFT JOIN collections c ON p.collection_id = c.id
            LEFT JOIN categories cat ON p.category_id = cat.id 
            WHERE p.slug = ?
        `;
        
        const [productRows] = await pool.query(sqlProduct, [cleanSlug]);

        if (productRows.length === 0) {
            return res.status(404).json({ message: "Produit introuvable" });
        }

        const product = productRows[0];

        // Parsing des tailles (attributs)
        try {
            if (typeof product.attributes === 'string') {
                product.attributes = JSON.parse(product.attributes);
            }
        } catch (e) {
            product.attributes = [];
        }

        // 3. Récupération des Variantes liées (C'est l'étape qui manquait !)
        const sqlVariants = `
            SELECT id, color_name as colorName, color_code as colorCode, images, stock_quantity 
            FROM product_variants 
            WHERE product_id = ?
        `;
        
        const [variantRows] = await pool.query(sqlVariants, [product.id]);

        // Nettoyage des images des variantes (si stockées en JSON string)
        const formattedVariants = variantRows.map(v => {
            let vImages = [];
            try {
                vImages = typeof v.images === 'string' ? JSON.parse(v.images) : v.images;
            } catch (e) { vImages = []; }
            
            return {
                ...v,
                images: Array.isArray(vImages) ? vImages : []
            };
        });

        // 4. On attache les variantes au produit
        product.variants = formattedVariants;

        res.json(product); 

    } catch (err) {
        console.error("❌ Erreur getProductBySlug:", err);
        res.status(500).json({ message: "Une erreur est survenue lors de la récupération du produit." });
    }
};

// Fonction récursive pour trouver un slug unique
export const generateUniqueSlug = async (name) => {
    let slug = slugify(name, { lower: true, strict: true, locale: 'fr' });
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
        const [existing] = await pool.query("SELECT id FROM products WHERE slug = ?", [uniqueSlug]);
        if (existing.length === 0) return uniqueSlug;
        uniqueSlug = `${slug}-${counter}`;
        counter++;
    }
};

export const getProductByCollection = async (req, res) => {
    const collectionId = req.params.id; 

    // ✅ AJOUT : p.color
    const sql = `
        SELECT 
            p.id AS product_id, p.name, p.price, p.image_url, p.description, p.slug, p.attributes, p.color,
            c.name AS collection_name,
            v.id AS variant_id, v.color_name, v.color_code, v.images AS variant_image
        FROM products p
        JOIN collections c ON p.collection_id = c.id
        LEFT JOIN product_variants v ON p.id = v.product_id
        WHERE p.collection_id = ? 
    `;

    try {
        const [rows] = await pool.execute(sql, [collectionId]);

        const productsMap = {};

        rows.forEach(row => {
            if (!productsMap[row.product_id]) {
                let sizes = [];
                try { sizes = typeof row.attributes === 'string' ? JSON.parse(row.attributes) : row.attributes; } catch (e) { sizes = []; }

                productsMap[row.product_id] = {
                    id: row.product_id,
                    name: row.name,
                    slug: row.slug, 
                    price: row.price,
                    image: row.image_url,
                    description: row.description,
                    collection: row.collection_name,
                    color: row.color, // ✅ On renvoie la couleur principale
                    sizes: Array.isArray(sizes) ? sizes : [],
                    variants: [] 
                };
            }

            if (row.variant_id) {
                let vImages = [];
                try { vImages = typeof row.variant_image === 'string' ? JSON.parse(row.variant_image) : row.variant_image; } catch (e) { vImages = []; }

                productsMap[row.product_id].variants.push({
                    id: row.variant_id,
                    colorName: row.color_name,
                    hex: row.color_code,
                    images: Array.isArray(vImages) ? vImages : [] 
                });
            }
        });

        res.json(Object.values(productsMap));

    } catch (error) {
        console.error("❌ Erreur SQL Collection:", error);
        res.status(500).json({ message: "Une erreur est survenue lors de la récupération de la collection." });
    }
};

export const getProductsByCategoryAndGender = async (req, res) => {
    const { categoryId, gender } = req.query;

    if (!categoryId || !gender) {
        return res.status(400).json({ error: "Catégorie et Genre sont requis." });
    }

    // ✅ AJOUT : p.color
    const sql = `
        SELECT 
            p.id AS product_id, p.name, p.price, p.image_url, p.description, p.slug, p.attributes, p.color,
            c.name AS collection_name,
            v.id AS variant_id, v.color_name, v.color_code, v.images AS variant_image
        FROM products p
        LEFT JOIN collections c ON p.collection_id = c.id
        LEFT JOIN product_variants v ON p.id = v.product_id
        WHERE p.category_id = ? AND p.gender = ?
    `;

    try {
        const [rows] = await pool.execute(sql, [categoryId, gender]);

        const productsMap = {};

        rows.forEach(row => {
            if (!productsMap[row.product_id]) {
                let sizes = [];
                try { sizes = JSON.parse(row.attributes); } catch (e) {}

                productsMap[row.product_id] = {
                    id: row.product_id,
                    name: row.name,
                    slug: row.slug,
                    price: row.price,
                    image: row.image_url, 
                    collection: row.collection_name,
                    color: row.color, // ✅
                    sizes: Array.isArray(sizes) ? sizes : [],
                    variants: []
                };
            }

            if (row.variant_id) {
                let vImages = [];
                try { vImages = JSON.parse(row.variant_image); } catch (e) {}

                productsMap[row.product_id].variants.push({
                    id: row.variant_id,
                    colorName: row.color_name,
                    hex: row.color_code,
                    images: Array.isArray(vImages) ? vImages : [] 
                });
            }
        });

        res.json(Object.values(productsMap));

    } catch (error) {
        console.error("❌ Erreur SQL Filter:", error);
        res.status(500).json({ message: "Une erreur est survenue lors du filtrage des produits." });
    }
};

export const getMostViewedProducts = async (req, res) => {
    try {
        // ✅ AJOUT : p.color
        const sql = `
            SELECT 
                p.id AS product_id, p.name, p.price, p.image_url, p.slug, p.collection_id, p.view_count, p.attributes, p.color,
                c.name AS collection_name,
                v.id AS variant_id, v.color_name, v.color_code, v.images AS variant_image
            FROM products p
            LEFT JOIN collections c ON p.collection_id = c.id
            LEFT JOIN product_variants v ON p.id = v.product_id
            ORDER BY p.view_count DESC 
            LIMIT 50
        `;

        const [rows] = await pool.query(sql);

        const productsMap = {};

        rows.forEach(row => {
            if (!productsMap[row.product_id]) {
                let sizes = [];
                try { sizes = JSON.parse(row.attributes); } catch (e) {}

                productsMap[row.product_id] = {
                    id: row.product_id,
                    name: row.name,
                    slug: row.slug,
                    price: row.price,
                    image: row.image_url,
                    collection: row.collection_name,
                    color: row.color, // ✅
                    sizes: Array.isArray(sizes) ? sizes : [],
                    variants: []
                };
            }
            if (row.variant_id) {
                let vImages = [];
                try { vImages = typeof row.variant_image === 'string' ? JSON.parse(row.variant_image) : row.variant_image; } catch (e) { vImages = []; }

                productsMap[row.product_id].variants.push({
                    id: row.variant_id,
                    colorName: row.color_name,
                    hex: row.color_code,
                    images: Array.isArray(vImages) ? vImages : [] 
                });
            }
        });

        res.json(Object.values(productsMap));

    } catch (err) {
        console.error("❌ Erreur Top Views:", err);
        res.status(500).json({ message: "Une erreur est survenue lors de la récupération des produits populaires." });
    }
};