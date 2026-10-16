/**
 * apmMiddleware.js — Métriques de Performance Applicative (APM) & Suivi de Latence
 * ─────────────────────────────────────────────────────────────────────────────
 * Mesure les temps de réponse de chaque endpoint, injecte l'en-tête standard X-Response-Time
 * et alerte en console en cas de latence anormale (> 1500ms).
 */

export const apmMiddleware = (req, res, next) => {
  const start = process.hrtime();

  // Écoute de l'événement finish sur la réponse HTTP
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInMs = Math.round((diff[0] * 1e3 + diff[1] * 1e-6) * 100) / 100;

    // Injection de l'en-tête de temps de réponse si les headers ne sont pas encore envoyés
    try {
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${durationInMs}ms`);
      }
    } catch (_) {}

    // Alerte APM en cas de requête lente (> 1500ms) hors streaming / génération IA lourde
    if (durationInMs > 1500 && !req.originalUrl.includes('/ai/generate-design')) {
      console.warn(`⏱️ [APM SLOW REQUEST] ${req.method} ${req.originalUrl} — ${durationInMs}ms (Statut: ${res.statusCode})`);
    }
  });

  next();
};

export default apmMiddleware;
