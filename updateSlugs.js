// updateSlugs.js
import pool from "./db/db.js"; // Adapte le chemin vers ton fichier de connexion DB
import slugify from "slugify";

const updateAllSlugs = async () => {
    console.log("🚀 Démarrage de la mise à jour des slugs...");

    try {
        // 1. Récupérer tous les produits
        const [products] = await pool.query("SELECT id, name FROM products");
        
        console.log(`📦 ${products.length} produits trouvés.`);

        // 2. Boucler sur chaque produit
        for (const product of products) {
            // Création du slug : "T-shirt Été" deviendra "t-shirt-ete"
            let slug = slugify(product.name, {
                lower: true,      // Tout en minuscule
                strict: true,     // Enlève les caractères spéciaux (: , / etc)
                locale: 'fr'      // Gère bien les accents français
            });

            // Pour garantir l'unicité immédiate sans prise de tête, on ajoute l'ID
            // Ex: t-shirt-ete-15
            // Si tu préfères sans ID, retire la partie "-${product.id}" 
            // mais tu risques une erreur SQL si deux noms sont identiques.
            const uniqueSlug = `${slug}-${product.id}`;

            // 3. Mise à jour en base de données
            await pool.query("UPDATE products SET slug = ? WHERE id = ?", [uniqueSlug, product.id]);
            
            console.log(`✅ Produit ${product.id} : ${uniqueSlug}`);
        }

        console.log("🎉 Terminé ! Tous les slugs sont à jour.");
        process.exit();

    } catch (error) {
        console.error("❌ Erreur :", error);
        process.exit(1);
    }
};

updateAllSlugs();