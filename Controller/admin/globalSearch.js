import db from '../../db/db.js';

/**
 * GET /api/admin/search?q=<term>
 * Recherche globale dans : commandes, produits, clients
 */
export const globalSearch = async (req, res) => {
    const { q } = req.query;

    console.log(`🔍 [Admin Search] Recherche pour: "${q}"`);

    if (!q || q.trim().length < 2) {
        return res.json({ orders: [], products: [], customers: [] });
    }

    const rawQuery = q.trim();
    const term = `%${rawQuery}%`;
    
    // Tenter d'extraire un ID numérique (ex: "HD-00023" -> 23)
    const numericMatch = rawQuery.match(/\d+/);
    const numericId = numericMatch ? parseInt(numericMatch[0]) : null;

    try {
        const [ordersRows, productsRows, customersRows] = await Promise.all([
            // 1. Recherche dans les commandes (par slug, statut ou ID exact)
            db.query(
                `SELECT id, status, total_amount, created_at,
                        CONCAT('HD-', LPAD(id, 5, '0')) AS slug
                 FROM orders
                 WHERE CONCAT('HD-', LPAD(id, 5, '0')) LIKE ?
                    OR status LIKE ?
                    ${numericId ? 'OR id = ?' : ''}
                 ORDER BY created_at DESC
                 LIMIT 5`,
                numericId ? [term, term, numericId] : [term, term]
            ),
            // 2. Recherche dans les produits
            db.query(
                `SELECT id, name, price, image_url, stock_quantity
                 FROM products
                 WHERE name LIKE ?
                    OR description LIKE ?
                    ${numericId ? 'OR id = ?' : ''}
                 ORDER BY id DESC
                 LIMIT 5`,
                numericId ? [term, term, numericId] : [term, term]
            ),
            // 3. Recherche dans les clients
            db.query(
                `SELECT id, prenom, nom, email, loyalty_points
                 FROM users
                 WHERE prenom LIKE ?
                    OR nom LIKE ?
                    OR email LIKE ?
                    ${numericId ? 'OR id = ?' : ''}
                 ORDER BY id DESC
                 LIMIT 5`,
                numericId ? [term, term, term, numericId] : [term, term, term]
            ),
        ]);

        const results = {
            orders: ordersRows[0],
            products: productsRows[0],
            customers: customersRows[0],
        };

        console.log(`✅ [Admin Search] Trouvé: ${results.orders.length} commandes, ${results.products.length} produits, ${results.customers.length} clients.`);
        res.json(results);
    } catch (error) {
        console.error('❌ Erreur globalSearch:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la recherche.', error: error.message });
    }
};
