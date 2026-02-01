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
    port: 3307, // <-- Port ajouté ici (3306 est le défaut pour MySQL/MariaDB)
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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