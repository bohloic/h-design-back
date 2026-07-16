import db from "../../db/db.js";
import { saveBase64Image } from '../../utils/imageService.js';

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, description, category, price, stock_quantity,
            collection_id, category_id, attributes,
            image_base64, existing_image_url, variants, color
        } = req.body;

        // 1. Image principale
        let finalImageName = existing_image_url; // Par défaut, l'ancien nom

        // Si le frontend envoie une URL complète (ex: http://localhost...), on la nettoie pour garder juste le nom
        if (finalImageName && finalImageName.includes('/images/')) {
            finalImageName = finalImageName.split('/images/')[1];
        }

        if (image_base64) {
            const fileName = await saveBase64Image(image_base64);
            if (fileName) {
                finalImageName = fileName; // Nouvelle URL Cloudinary
            }
        }

        // 2. IDs
        const colId = (collection_id && collection_id !== '') ? parseInt(collection_id) : null;
        const catId = (category_id && category_id !== '') ? parseInt(category_id) : null;

        // 3. Update SQL
        await db.query(
            `UPDATE products SET name=?, description=?, price=?, stock_quantity=?, collection_id=?, category_id=?, gender=?, attributes=?, image_url=?, color=? WHERE id=?`,
            [name, description, price, stock_quantity, colId, catId, category, attributes, finalImageName, color || 'Blanc', id]
        );

        // 4. Update Variantes
        if (variants && Array.isArray(variants)) {
            await db.query("DELETE FROM product_variants WHERE product_id = ?", [id]);

            for (const variant of variants) {
                let variantImageNames = [];

                if (variant.images_base64 && Array.isArray(variant.images_base64)) {
                    for (const b64 of variant.images_base64) {
                        const fName = await saveBase64Image(b64);
                        if (fName) {
                            variantImageNames.push(fName);
                        }
                    }
                }
                // Si tu gères les anciennes images, assure-toi de ne garder que le nom de fichier ici aussi.

                await db.query(
                    "INSERT INTO product_variants (product_id, color_name, color_code, stock_quantity, images) VALUES (?, ?, ?, ?, ?)",
                    [id, variant.colorName, variant.colorCode, variant.stockQuantity, JSON.stringify(variantImageNames)]
                );
            }
        }

        res.status(200).json({ message: "Produit mis à jour !" });

    } catch (error) {
        console.error("Erreur Update:", error);
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
};