import pool from '../db/db.js';

(async () => {
    try {
        console.log("🛠️ Démarrage de la migration de la base de données...");

        // ==========================================
        // 1. MIGRATION DES TABLES
        // ==========================================
        console.log("1️⃣ Vérification de la structure des tables...");
        const [columns] = await pool.execute("SHOW COLUMNS FROM order_items");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('design_status')) {
            await pool.execute("ALTER TABLE order_items ADD COLUMN design_status VARCHAR(20) DEFAULT 'En attente'");
            console.log("➕ Colonne 'design_status' ajoutée à 'order_items'");
        }
        if (!columnNames.includes('rejection_reason')) {
            await pool.execute("ALTER TABLE order_items ADD COLUMN rejection_reason TEXT");
            console.log("➕ Colonne 'rejection_reason' ajoutée à 'order_items'");
        }

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                link VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("🔔 Table 'notifications' vérifiée/créée.");

        // ==========================================
        // 2. NETTOYAGE DES STATUTS (Orders & Items)
        // ==========================================
        console.log("2️⃣ Nettoyage des statuts existants...");
        await pool.execute(`UPDATE order_items SET design_status = 'approved' WHERE design_status IN ('Validé', 'validé')`);
        await pool.execute(`UPDATE order_items SET design_status = 'rejected' WHERE design_status IN ('Refusé', 'refusé')`);
        
        await pool.execute(`UPDATE orders SET status = 'Payé - Validation Design' WHERE status LIKE 'Payé - À Valider%'`);
        await pool.execute(`UPDATE orders SET status = 'Validation Design' WHERE status LIKE 'À Valider%'`);
        await pool.execute(`UPDATE orders SET status = 'Payé - Action Requise' WHERE status LIKE 'Payé - Action Requise%'`);
        
        const [ordersColumns] = await pool.execute("SHOW COLUMNS FROM orders LIKE 'is_seen'");
        if (ordersColumns.length === 0) {
            await pool.execute("ALTER TABLE orders ADD COLUMN is_seen TINYINT(1) DEFAULT 0");
            console.log("🆕 Colonne 'is_seen' ajoutée à la table orders.");
        }

        const [orders] = await pool.execute("SELECT id, status FROM orders WHERE status LIKE '%🎨%' OR status LIKE '%📦%' OR status LIKE '%⚠️%'");
        for (const order of orders) {
            let cleanStatus = order.status
                .replace(/🎨/g, '')
                .replace(/📦/g, '')
                .replace(/⚠️/g, '')
                .replace(/À Valider/g, 'Validation Design')
                .replace(/À Préparer/g, 'En préparation')
                .trim();
            await pool.execute("UPDATE orders SET status = ? WHERE id = ?", [cleanStatus, order.id]);
            console.log(`✅ Commande #${order.id} réparée.`);
        }

        console.log("✅ TOUTES LES MIGRATIONS SONT TERMINÉES AVEC SUCCÈS !");
    } catch (err) {
        console.error("❌ Erreur critique lors de la migration :", err);
    } finally {
        process.exit();
    }
})();
