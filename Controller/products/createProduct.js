// 1. On importe la connexion (Assure-toi que le chemin vers config/db.js est bon)
import db from "../../db/db.js";
import { saveBase64Image } from '../../utils/imageService.js';
import { generateUniqueSlug } from "./productController.js";

export const createProduct = async (req, res) => {
    try {
        const { 
            name, description, category, price, stock_quantity, 
            collection_id, category_id, attributes, 
            image_base64, variants ,color 
        } = req.body;

        const slug = await generateUniqueSlug(name);

        // 1. Gestion de l'image principale
        let mainImageName = null; 
        if (image_base64) {
            const fileName = await saveBase64Image(image_base64);
            if (fileName) {
                mainImageName = fileName; // URL Cloudinary
            }
        }

        // 2. Gestion des IDs (Collection & Catégorie)
        const colId = (collection_id && collection_id !== '') ? parseInt(collection_id) : null;
        const catId = (category_id && category_id !== '') ? parseInt(category_id) : null;

        // 3. Sécurisation des attributs (Tailles) en JSON
        const attributesJson = typeof attributes === 'object' ? JSON.stringify(attributes) : attributes;

        // 4. Insertion SQL PRODUIT
        // CORRECTION ICI : Ajout du 10ème point d'interrogation pour image_url
        const sqlProduct = `INSERT INTO products (name, slug, description, price, stock_quantity, collection_id, category_id, gender, attributes, image_url, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const [result] = await db.query(sqlProduct, [
            name, 
            slug,
            description, 
            price, 
            stock_quantity, 
            colId,        
            catId,        
            category,     // Correspond à la colonne 'gender' dans votre BDD
            attributesJson, 
            mainImageName, // Correspond à la colonne 'image_url' (le 10ème)
            color || 'Blanc'
        ]);
        
        const newProductId = result.insertId;

        // 5. Gestion des Variantes
        if (variants && Array.isArray(variants)) {
            for (const variant of variants) {
                let variantImageNames = [];
                
                // Sauvegarde des images de la variante
                if (variant.images_base64 && Array.isArray(variant.images_base64)) {
                    for (const b64 of variant.images_base64) {
                        const fName = await saveBase64Image(b64);
                        if (fName) {
                            variantImageNames.push(fName);
                        }
                    }
                }

                // SÉCURITÉ : Si la variante n'a pas d'image, on utilise l'image principale du produit
                // Cela évite d'avoir des variantes invisibles sur le site
                if (variantImageNames.length === 0 && mainImageName) {
                    variantImageNames.push(mainImageName);
                }

                // Insertion de la variante
                await db.query(
                    "INSERT INTO product_variants (product_id, color_name, color_code, stock_quantity, images) VALUES (?, ?, ?, ?, ?)",
                    [
                        newProductId, 
                        variant.colorName || 'Standard',      // Valeur par défaut
                        variant.colorCode || '#FFFFFF',       // Valeur par défaut
                        variant.stockQuantity || 0, 
                        JSON.stringify(variantImageNames)     // Conversion tableau -> string JSON pour la BDD
                    ]
                );
            }
        }

        res.status(201).json({ message: "Produit créé avec succès !", id: newProductId });

    } catch (error) {
        console.error("Erreur Controller:", error);
        // On renvoie le message SQL exact pour faciliter le debug
        res.status(500).json({ message: "Erreur serveur", error: error.message, sqlMessage: error.sqlMessage });
    }
};