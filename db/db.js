// Gardez cette ligne une seule fois, tout en haut du fichier
import mysql from 'mysql2/promise';
import dotenv from 'dotenv'; // Si vous utilisez un fichier .env

// Charge les variables d'environnement (si nécessaire)
dotenv.config();

// Création de la connexion (Pool)
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', // Vide par défaut sous XAMPP
    database: process.env.DB_NAME || 'h-design',
    port: parseInt(process.env.DB_PORT) || 3306, // ✅ FIX #15 : Port lu depuis .env (DB_PORT=3307)
    waitForConnections: true,
    connectionLimit: 15, // Augmenté pour gérer l'affluence
    queueLimit: 0,
    enableKeepAlive: true, // Empêche les ECONNRESET lors des payloads lourds
    keepAliveInitialDelay: 10000 
});

console.log("Tentative de connexion à la BDD...");

// Test de connexion (Optionnel mais recommandé pour le debug)
db.getConnection()
    .then(async connection => {
        console.log("✅ Connecté à la base de données avec succès !");
        
        // 🪄 AUTO-MIGRATION : Ajout des colonnes pour la validation granulaire
        try {
            console.log("🛠️ Vérification de la structure de la base de données...");
            
            // On vérifie si les colonnes existent déjà
            const [columns] = await connection.execute("SHOW COLUMNS FROM order_items");
            const columnNames = columns.map(c => c.Field);

            if (!columnNames.includes('design_status')) {
                await connection.execute("ALTER TABLE order_items ADD COLUMN design_status VARCHAR(20) DEFAULT 'En attente'");
                console.log("➕ Colonne 'design_status' ajoutée à 'order_items'");
            }
            if (!columnNames.includes('rejection_reason')) {
                await connection.execute("ALTER TABLE order_items ADD COLUMN rejection_reason TEXT");
                console.log("➕ Colonne 'rejection_reason' ajoutée à 'order_items'");
            }

            // 🔔 AUTO-MIGRATION : Table notifications
            await connection.execute(`
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

            console.log("✅ Structure DB à jour.");
        } catch (migErr) {
            console.error("⚠️ Erreur lors de l'auto-migration :", migErr.message);
        }

        connection.release();
    })
    .catch(error => {
        console.error("❌ Erreur de connexion à la base de données :", error.message);
    });

export default db;