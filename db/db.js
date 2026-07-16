// Gardez cette ligne une seule fois, tout en haut du fichier
import mysql from 'mysql2/promise';
import dotenv from 'dotenv'; // Si vous utilisez un fichier .env

// Charge les variables d'environnement (si nécessaire)
dotenv.config();

// Création de la connexion (Pool)
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'h-design',
    port: parseInt(process.env.DB_PORT) || 4000, // TiDB utilise souvent le port 4000
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    },
    waitForConnections: true,
    connectionLimit: 5, // Réduit pour le mode serverless (Vercel)
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

console.log("Tentative de connexion à la BDD...");

// Test de connexion (Optionnel mais recommandé pour le debug)
db.getConnection()
    .then(connection => {
        console.log("✅ Connecté à la base de données avec succès !");
        connection.release();
    })
    .catch(error => {
        console.error("❌ Erreur de connexion à la base de données :", error.message);
    });

export default db; 