/**
 * cacheMiddleware.js — Mise en cache HTTP & Mémoire pour la Protection de la BDD
 * ─────────────────────────────────────────────────────────────────────────────
 * Évite que chaque visiteur ne surcharge la base de données TiDB lors de la consultation
 * du catalogue produit. Met en cache les requêtes GET pendant 60 secondes avec
 * support de l'en-tête Cache-Control pour CDN / Cloudflare.
 */

const memoryCache = new Map();

export const cacheMiddleware = (durationSeconds = 60) => (req, res, next) => {
  // Ne mettre en cache que les requêtes GET publiques
  if (req.method !== 'GET') {
    return next();
  }

  // Ne pas mettre en cache les requêtes authentifiées avec token client
  if (req.headers.authorization || req.cookies?.token) {
    return next();
  }

  const cacheKey = req.originalUrl || req.url;
  const cached = memoryCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < durationSeconds * 1000)) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', `public, max-age=${durationSeconds}, stale-while-revalidate=${durationSeconds * 2}`);
    return res.status(200).json(cached.data);
  }

  // Interception de res.json pour stocker la réponse dans le cache mémoire
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && body) {
      memoryCache.set(cacheKey, {
        timestamp: Date.now(),
        data: body
      });
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `public, max-age=${durationSeconds}, stale-while-revalidate=${durationSeconds * 2}`);
    }
    return originalJson(body);
  };

  next();
};

/**
 * Invalide le cache mémoire lorsqu'un produit, une catégorie ou un stock est modifié
 */
export const invalidateCache = (prefix = '/api/products') => {
  for (const key of memoryCache.keys()) {
    if (key.includes(prefix)) {
      memoryCache.delete(key);
    }
  }
};
