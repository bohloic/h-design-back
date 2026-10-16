/**
 * 💾 Script de sauvegarde automatique de la base de données (TiDB / MySQL)
 * Exporte le schéma et les données dans un fichier .sql horodaté
 * et nettoie les sauvegardes datant de plus de 7 jours.
 *
 * Utilisation :
 *   node scripts/backup-db.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = 7;

async function runBackup() {
  console.log('🚀 [Backup] Démarrage de la sauvegarde de la base de données...');

  try {
    // 1. S'assurer que le dossier backups existe
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${process.env.DB_NAME || 'database'}-${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    const writeStream = fs.createWriteStream(filepath, { encoding: 'utf8' });

    writeStream.write(`-- --------------------------------------------------------\n`);
    writeStream.write(`-- Sauvegarde automatique de la base : ${process.env.DB_NAME || 'database'}\n`);
    writeStream.write(`-- Date : ${new Date().toISOString()}\n`);
    writeStream.write(`-- --------------------------------------------------------\n\n`);
    writeStream.write(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);

    // 2. Récupérer toutes les tables
    const [tablesResult] = await db.query('SHOW TABLES');
    const tableKey = Object.keys(tablesResult[0] || {})[0];

    if (!tableKey) {
      console.warn('⚠️ [Backup] Aucune table trouvée dans la base de données.');
      writeStream.end();
      process.exit(0);
    }

    const tables = tablesResult.map((row) => row[tableKey]);
    console.log(`📋 [Backup] ${tables.length} tables détectées : ${tables.join(', ')}`);

    for (const table of tables) {
      // Structure de la table
      const [createTableResult] = await db.query(`SHOW CREATE TABLE \`${table}\``);
      const createStatement = createTableResult[0]['Create Table'] || createTableResult[0]['Create View'];

      writeStream.write(`-- Structure de la table \`${table}\`\n`);
      writeStream.write(`DROP TABLE IF EXISTS \`${table}\`;\n`);
      writeStream.write(`${createStatement};\n\n`);

      // Données de la table
      const [rows] = await db.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        writeStream.write(`-- Données de la table \`${table}\` (${rows.length} enregistrements)\n`);
        const columns = Object.keys(rows[0]).map((col) => `\`${col}\``).join(', ');

        for (const row of rows) {
          const values = Object.values(row).map((val) => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "\\'")}'`;
            return `'${String(val).replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
          }).join(', ');

          writeStream.write(`INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`);
        }
        writeStream.write('\n');
      }
    }

    writeStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
    writeStream.end();

    console.log(`✅ [Backup] Sauvegarde réussie : ${filepath}`);

    // 3. Rotation des sauvegardes (purge des fichiers > RETENTION_DAYS)
    cleanOldBackups();

  } catch (error) {
    console.error('❌ [Backup] Échec critique de la sauvegarde :', error);
    process.exit(1);
  } finally {
    await db.end().catch(() => {});
  }
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    let removedCount = 0;
    for (const file of files) {
      if (!file.endsWith('.sql')) continue;
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 [Backup] ${removedCount} ancienne(s) sauvegarde(s) purgée(s) (rétention: ${RETENTION_DAYS}j).`);
    }
  } catch (err) {
    console.warn('⚠️ [Backup] Erreur lors du nettoyage des anciennes sauvegardes :', err.message);
  }
}

runBackup();
