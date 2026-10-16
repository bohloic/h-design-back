/**
 * 🛠️ Système de Migration Automatisée & Versionnée
 * Versionne les modifications de schéma SQL et garantit que chaque migration
 * n'est exécutée qu'une seule fois via la table 'schema_migrations'.
 */
import pool from '../db/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations() {
    console.log("🚀 [Migrations] Démarrage du gestionnaire de migrations...");

    try {
        // 1. Table de suivi des versions (schema_migrations)
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Récupérer les migrations déjà exécutées
        const [appliedRows] = await pool.execute("SELECT name FROM schema_migrations");
        const appliedSet = new Set(appliedRows.map(r => r.name));

        const runMigration = async (name, migrationFn) => {
            if (appliedSet.has(name)) {
                console.log(`⏩ [Migrations] Migration déjà appliquée : ${name}`);
                return;
            }

            console.log(`⏳ [Migrations] Application de : ${name}...`);
            await migrationFn();
            await pool.execute("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
            console.log(`✅ [Migrations] Succès : ${name}`);
        };

        // ==========================================
        // Migration 001 : Structure order_items et notifications
        // ==========================================
        await runMigration('001_order_items_and_notifications', async () => {
            const [columns] = await pool.execute("SHOW COLUMNS FROM order_items");
            const columnNames = columns.map(c => c.Field);

            if (!columnNames.includes('design_status')) {
                await pool.execute("ALTER TABLE order_items ADD COLUMN design_status VARCHAR(20) DEFAULT 'En attente'");
            }
            if (!columnNames.includes('rejection_reason')) {
                await pool.execute("ALTER TABLE order_items ADD COLUMN rejection_reason TEXT");
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
        });

        // ==========================================
        // Migration 002 : Statuts commandes et colonne is_seen
        // ==========================================
        await runMigration('002_clean_order_statuses_and_is_seen', async () => {
            await pool.execute(`UPDATE order_items SET design_status = 'approved' WHERE design_status IN ('Validé', 'validé')`);
            await pool.execute(`UPDATE order_items SET design_status = 'rejected' WHERE design_status IN ('Refusé', 'refusé')`);

            await pool.execute(`UPDATE orders SET status = 'Payé - Validation Design' WHERE status LIKE 'Payé - À Valider%'`);
            await pool.execute(`UPDATE orders SET status = 'Validation Design' WHERE status LIKE 'À Valider%'`);
            await pool.execute(`UPDATE orders SET status = 'Payé - Action Requise' WHERE status LIKE 'Payé - Action Requise%'`);

            const [ordersColumns] = await pool.execute("SHOW COLUMNS FROM orders LIKE 'is_seen'");
            if (ordersColumns.length === 0) {
                await pool.execute("ALTER TABLE orders ADD COLUMN is_seen TINYINT(1) DEFAULT 0");
            }

            const [orders] = await pool.execute("SELECT id, status FROM orders WHERE status LIKE '%🎨%' OR status LIKE '%📦%' OR status LIKE '%⚠️%'");
            for (const order of orders) {
                const cleanStatus = order.status
                    .replace(/🎨/g, '')
                    .replace(/📦/g, '')
                    .replace(/⚠️/g, '')
                    .replace(/À Valider/g, 'Validation Design')
                    .replace(/À Préparer/g, 'En préparation')
                    .trim();
                await pool.execute("UPDATE orders SET status = ? WHERE id = ?", [cleanStatus, order.id]);
            }
        });

        // ==========================================
        // Migration 003 : Exécution dynamique des scripts SQL du dossier migrations/
        // ==========================================
        if (fs.existsSync(MIGRATIONS_DIR)) {
            const files = fs.readdirSync(MIGRATIONS_DIR).sort();
            for (const file of files) {
                if (!file.endsWith('.sql')) continue;
                await runMigration(`file_${file}`, async () => {
                    const filePath = path.join(MIGRATIONS_DIR, file);
                    const sqlContent = fs.readFileSync(filePath, 'utf8');
                    const statements = sqlContent
                        .split(';')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);

                    for (const statement of statements) {
                        await pool.query(statement);
                    }
                });
            }
        }

        console.log("✨ [Migrations] Base de données à jour et synchronisée !");
    } catch (err) {
        console.error("❌ [Migrations] Erreur fatale lors de la migration :", err);
        process.exit(1);
    } finally {
        await pool.end().catch(() => {});
        process.exit(0);
    }
}

runMigrations();
