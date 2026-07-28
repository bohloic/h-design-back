import pool from '../db/db.js';

(async () => {
    console.log("🛠️ DÉBUT DE LA RÉPARATION COMPLÈTE TOUTES TABLES SUR TIDB CLOUD...");

    const targetTables = ['users', 'orders', 'order_items', 'products', 'categories', 'product_variants'];

    for (const tableName of targetTables) {
        try {
            console.log(`\n--------------------------------------------------`);
            console.log(`🔍 Vérification de la table '${tableName}'...`);

            // 1. Inspecter les colonnes actuelles
            const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
            const idCol = cols.find(c => c.Field === 'id');

            if (!idCol) {
                console.log(`⚠️ Pas de colonne 'id' dans '${tableName}', ignorée.`);
                continue;
            }

            if (idCol.Extra.includes('auto_increment')) {
                console.log(`✅ La table '${tableName}' a DÉJÀ id en AUTO_INCREMENT !`);
                continue;
            }

            console.log(`⚡ Conversion de '${tableName}' vers AUTO_INCREMENT...`);

            // 2. Obtenir la requête CREATE TABLE de la table originale
            const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
            let createSql = createRows[0]['Create Table'];

            // 3. Modifier le SQL pour ajouter AUTO_INCREMENT et la PRIMARY KEY si absente
            let newCreateSql = createSql.replace(
                new RegExp(`CREATE TABLE \`${tableName}\``, 'g'),
                `CREATE TABLE \`${tableName}_new\``
            );

            // Remplacer `id` int NOT NULL par `id` int NOT NULL AUTO_INCREMENT
            if (newCreateSql.includes("`id` int NOT NULL")) {
                newCreateSql = newCreateSql.replace("`id` int NOT NULL", "`id` int NOT NULL AUTO_INCREMENT");
            } else if (newCreateSql.includes("`id` int DEFAULT NULL")) {
                newCreateSql = newCreateSql.replace("`id` int DEFAULT NULL", "`id` int NOT NULL AUTO_INCREMENT");
            } else if (newCreateSql.includes("`id` int")) {
                newCreateSql = newCreateSql.replace("`id` int", "`id` int NOT NULL AUTO_INCREMENT");
            }

            // Si la table n'a pas de PRIMARY KEY, on l'ajoute avant la parenthèse fermante
            if (!newCreateSql.includes("PRIMARY KEY")) {
                // Trouver le dernier ')'
                const lastParenIndex = newCreateSql.lastIndexOf(')');
                newCreateSql = newCreateSql.substring(0, lastParenIndex) + `, PRIMARY KEY (\`id\`)\n` + newCreateSql.substring(lastParenIndex);
            }

            console.log(`📝 Nouveau CREATE TABLE pour ${tableName}_new:\n`, newCreateSql);

            // 4. Création de la table _new
            await pool.query(`DROP TABLE IF EXISTS \`${tableName}_new\``);
            await pool.query(newCreateSql);

            // 5. Copier les données existantes
            // Obtenir les colonnes communes
            const colList = cols.map(c => `\`${c.Field}\``).join(', ');
            await pool.query(`INSERT INTO \`${tableName}_new\` (${colList}) SELECT ${colList} FROM \`${tableName}\``);
            console.log(`📦 Données transférées vers \`${tableName}_new\`.`);

            // 6. Basculer les tables
            await pool.query(`DROP TABLE IF EXISTS \`${tableName}_old\``);
            await pool.query(`RENAME TABLE \`${tableName}\` TO \`${tableName}_old\`, \`${tableName}_new\` TO \`${tableName}\``);
            await pool.query(`DROP TABLE IF EXISTS \`${tableName}_old\``);

            // 7. Ajuster la valeur initiale de AUTO_INCREMENT si la table contient des données
            const [maxRows] = await pool.query(`SELECT MAX(id) as maxId FROM \`${tableName}\``);
            const maxId = maxRows[0]?.maxId || 0;
            if (maxId > 0) {
                try {
                    await pool.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = ${maxId + 1}`);
                } catch (e) {
                    console.log(`  (Note AUTO_INCREMENT set: ${e.message})`);
                }
            }

            console.log(`🎉 Table '${tableName}' réparée avec succès !`);

        } catch (tableErr) {
            console.error(`❌ ÉCHEC sur la table '${tableName}':`, tableErr.message);
        }
    }

    console.log(`\n==================================================`);
    console.log("✅ TOUTES LES TABLES ONT ÉTÉ TRAITÉES ET RÉPARÉES !");
    process.exit(0);
})();
