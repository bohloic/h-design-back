import db from '../db/db.js';

let tableInitialized = false;

// Initialisation sécurisée et idempotente de la table audit_logs
const initAuditLogsTable = async () => {
    if (tableInitialized) return;
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NULL,
                admin_email VARCHAR(255) NULL,
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(100) NOT NULL,
                resource_id VARCHAR(100) NOT NULL,
                old_value LONGTEXT NULL,
                new_value LONGTEXT NULL,
                ip_address VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_resource (resource_type, resource_id),
                INDEX idx_action (action),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        tableInitialized = true;
    } catch (err) {
        console.warn("⚠️ [AUDIT] Table audit_logs check/init warning:", err.message);
    }
};

/**
 * Enregistre une entrée dans la table d'audit traçabilité
 * @param {Object} params
 * @param {import('express').Request} params.req
 * @param {string} params.action - ex: 'UPDATE_PRODUCT_PRICE', 'DELETE_PRODUCT', 'UPDATE_ORDER_STATUS', etc.
 * @param {string} params.resourceType - 'product' | 'order' | 'user' | 'category' | 'collection'
 * @param {string|number} params.resourceId - ID de la ressource
 * @param {any} [params.oldValue] - Ancienne valeur ou état avant mutation
 * @param {any} [params.newValue] - Nouvelle valeur ou état après mutation
 */
export const logAuditTrail = async ({ req, action, resourceType, resourceId, oldValue = null, newValue = null }) => {
    try {
        await initAuditLogsTable();
        const adminId = req?.user?.userId || null;
        const adminEmail = req?.user?.email || null;
        const rawIp = req?.headers?.['x-forwarded-for'] || req?.ip || req?.socket?.remoteAddress || '127.0.0.1';
        const ipAddress = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '127.0.0.1';

        const serializedOld = oldValue !== null && oldValue !== undefined
            ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue))
            : null;

        const serializedNew = newValue !== null && newValue !== undefined
            ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue))
            : null;

        await db.execute(
            `INSERT INTO audit_logs (admin_id, admin_email, action, resource_type, resource_id, old_value, new_value, ip_address, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [adminId, adminEmail, action, resourceType, String(resourceId), serializedOld, serializedNew, ipAddress]
        );

        console.log(`📜 [AUDIT TRAIL] ${action} (${resourceType} #${resourceId}) par admin #${adminId} [${adminEmail}]`);
    } catch (err) {
        console.error("❌ [AUDIT TRAIL] Erreur lors de l'insertion du log :", err.message);
    }
};

/**
 * Contrôleur de consultation des logs d'audit pour les administrateurs
 */
export const getAuditLogs = async (req, res) => {
    try {
        await initAuditLogsTable();
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        const resourceType = req.query.resource_type;
        const action = req.query.action;

        let query = `SELECT * FROM audit_logs WHERE 1=1`;
        const params = [];

        if (resourceType) {
            query += ` AND resource_type = ?`;
            params.push(resourceType);
        }

        if (action) {
            query += ` AND action = ?`;
            params.push(action);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [logs] = await db.query(query, params);
        const [totalCount] = await db.query(`SELECT COUNT(*) as total FROM audit_logs`);

        res.json({
            success: true,
            total: totalCount[0]?.total || 0,
            limit,
            offset,
            logs
        });
    } catch (err) {
        console.error("❌ [AUDIT] Erreur récupération logs :", err);
        res.status(500).json({ success: false, message: "Erreur lors de la récupération des logs d'audit." });
    }
};

export default {
    logAuditTrail,
    getAuditLogs
};
