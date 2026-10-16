/**
 * 🛰️ Service de Journalisation et Surveillance des Erreurs (Backend Node.js)
 * Intégration Sentry / APM / Journalisation structurée.
 */
import dotenv from 'dotenv';
dotenv.config();

class LoggerService {
  constructor() {
    this.sentryDsn = process.env.SENTRY_DSN || null;
    this.environment = process.env.NODE_ENV || 'development';
    
    if (this.sentryDsn) {
      console.log(`🛰️ [LoggerService] Surveillance Sentry active pour l'environnement : ${this.environment}`);
    }
  }

  /**
   * Capture une erreur critique avec trace et contexte
   */
  async captureException(error, context = {}) {
    const errorLog = {
      level: 'error',
      message: error?.message || 'Erreur inconnue',
      name: error?.name || 'Error',
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      environment: this.environment,
      context,
    };

    console.error(`🚨 [CRITICAL_ERROR] ${errorLog.name}: ${errorLog.message}`);
    if (error?.stack && this.environment !== 'production') {
      console.error(error.stack);
    }

    // Envoi direct vers Sentry via l'API Store HTTP si un DSN est configuré
    if (this.sentryDsn) {
      try {
        await this.sendToSentry(errorLog);
      } catch (sentryErr) {
        console.warn('⚠️ [LoggerService] Échec de transmission vers Sentry :', sentryErr.message);
      }
    }
  }

  /**
   * Envoi vers l'ingestion Sentry HTTP Store
   */
  async sendToSentry(payload) {
    if (!this.sentryDsn) return;
    try {
      const urlObj = new URL(this.sentryDsn);
      const projectId = urlObj.pathname.replace('/', '');
      const key = urlObj.username;
      const sentryHost = `${urlObj.protocol}//${urlObj.host}`;
      const apiUrl = `${sentryHost}/api/${projectId}/store/`;

      const sentryPayload = {
        event_id: Math.random().toString(36).substring(2) + Date.now().toString(36),
        timestamp: new Date().toISOString().slice(0, 19),
        platform: 'node',
        environment: this.environment,
        message: payload.message,
        exception: {
          values: [
            {
              type: payload.name,
              value: payload.message,
              stacktrace: payload.stack ? { frames: [] } : undefined,
            },
          ],
        },
        extra: payload.context,
      };

      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=boutique-noel-backend/1.0.0`,
        },
        body: JSON.stringify(sentryPayload),
      });
    } catch (_) {
      // Ignorer pour ne pas bloquer le serveur
    }
  }

  info(message, data = {}) {
    console.log(`ℹ️ [INFO] ${new Date().toISOString()} - ${message}`, Object.keys(data).length ? data : '');
  }

  warn(message, data = {}) {
    console.warn(`⚠️ [WARN] ${new Date().toISOString()} - ${message}`, Object.keys(data).length ? data : '');
  }
}

export const logger = new LoggerService();
export default logger;
