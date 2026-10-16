import pool from '../../db/db.js';
import { getEmailConfig } from '../../services/emailService.js';

/**
 * healthController.js — Endpoint de Surveillance de Disponibilité (Uptime Monitoring)
 * ────────────────────────────────────────────────────────────────────────────────
 * Permet à des outils externes (UptimeRobot, Better Uptime, Datadog) de surveiller :
 * 1. La disponibilité du serveur web
 * 2. La connectivité réelle et la latence avec la base de données TiDB
 * 3. L'empreinte mémoire et le temps d'activité (uptime)
 * 4. L'état de configuration du service Email (Mailjet)
 */
export const checkHealth = async (req, res) => {
  const startDb = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;
  let dbError = null;

  try {
    // Vérification de la connexion active à la base de données
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - startDb;
  } catch (err) {
    dbStatus = 'unhealthy';
    dbError = err.message;
    console.error("❌ [HEALTH CHECK FAILED] Déconnexion Base de Données :", err.message);
  }

  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Math.round(process.uptime());

  // Vérification de la configuration Mailjet
  const emailConfig = getEmailConfig();
  const emailConfigured = Boolean(emailConfig.apiKey && emailConfig.secretKey);
  const missingEmailKeys = [
    !emailConfig.apiKey ? 'MAILJET_API_KEY' : null,
    !emailConfig.secretKey ? 'MAILJET_SECRET_KEY' : null
  ].filter(Boolean);

  const healthData = {
    status: (dbStatus === 'healthy' && emailConfigured) ? 'ok' : 'degraded',
    service: 'backend-h-designer',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    database: {
      status: dbStatus,
      latency: `${dbLatencyMs}ms`,
      ...(dbError ? { error: dbError } : {})
    },
    email: {
      configured: emailConfigured,
      provider: 'mailjet_rest',
      sender: emailConfig.senderEmail,
      ...(missingEmailKeys.length > 0 ? { missingKeys: missingEmailKeys } : {})
    },
    system: {
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    }
  };

  // Renvoie 200 si la DB est joignable, sinon 503 Service Unavailable pour déclencher les alertes SMS/Slack d'uptime monitoring
  const httpStatus = dbStatus === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(healthData);
};
