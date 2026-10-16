import dotenv from 'dotenv';
dotenv.config();
import express from 'express'
import cookieParser from 'cookie-parser';
import routes from './routes/routes.js'
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db/db.js'; // Import de la connexion DB pour la réparation
import sanitizeInputs from './middlewares/sanitize.js';
import { verifyEmailConfiguration } from './services/emailService.js';
import apmMiddleware from './middlewares/apmMiddleware.js';
import logger from './services/loggerService.js';

// Nécessaire si tu utilises "type": "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// on initialise express
const app = express();

// ⚡ PERFORMANCE : Compression Gzip
app.use(compression());

// 📊 APM & PERFORMANCE : Suivi des temps de réponse et détection des requêtes lentes
app.use(apmMiddleware);

// ⏳ RÉSILIENCE : Timeout global sur les requêtes (15 secondes max)
app.use((req, res, next) => {
  res.setTimeout(15000, () => {
    if (!res.headersSent) {
      console.warn(`⏳ Timeout (15s) dépassé pour la requête : ${req.method} ${req.originalUrl}`);
      res.status(504).json({ message: "Délai d'attente de la requête dépassé (Timeout 15s)." });
    }
  });
  next();
});

// 🛡️ SÉCURITÉ : Confiance envers le proxy (Ngrok/Vercel/Heroku)
// Nécessaire pour que express-rate-limit identifie correctement les IPs via X-Forwarded-For
app.set('trust proxy', 1);

// 🛡️ SÉCURITÉ : Protection contre le Directory Traversal
app.use((req, res, next) => {
  try {
    const decodedPath = decodeURIComponent(req.path);
    if (decodedPath.includes('\0') || decodedPath.includes('..') || decodedPath.includes('\\..') || decodedPath.includes('/..')) {
      console.warn(`🚨 Tentative de Directory Traversal bloquée : ${req.ip} -> ${req.originalUrl}`);
      return res.status(400).json({ message: "Requête invalide : tentative de Directory Traversal détectée." });
    }
  } catch (err) {
    return res.status(400).json({ message: "URI malformée." });
  }
  next();
});

// 🛡️ SÉCURITÉ : Headers HTTP (helmet)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "*.kaspersky-labs.com", "https://*.ngrok-free.dev"],
      "img-src": ["'self'", "data:", "blob:", "*"],
      "connect-src": ["'self'", "*"]
    }
  }
}));

// 🛡️ SÉCURITÉ & CONFIDENTIALITÉ : Bloquer l'indexation par les robots pour l'ensemble du back-office et de l'API
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  next();
});

// 🛡️ SÉCURITÉ : CORS restrictif (avec credentials activés pour les cookies HttpOnly)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  process.env.FRONTEND_URL, // ex: https://votre-domaine.com
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autorise les requêtes sans origin (Postman, mobile, curl)
    if (!origin) return callback(null, true);
    
    // Origines explicitement autorisées
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // 🛡️ SÉCURITÉ : N'autoriser que les déploiements Vercel légitimes du projet H-Designer (anti-phishing)
    const isProjectVercelDomain = /^https:\/\/(h-design|boutique-de-noel)[a-z0-9-]*\.vercel\.app$/i.test(origin);
    if (isProjectVercelDomain) {
      return callback(null, true);
    }

    console.warn(`⚠️ CORS bloqué pour l'origine : ${origin}`);
    callback(new Error('Non autorisé par CORS'));
  },
  credentials: true
}));

// 🛡️ OWASP : Parser de Cookies pour les sessions JWT HttpOnly
app.use(cookieParser());

// 🛡️ SÉCURITÉ : Limiteur global sur l'ensemble de l'API (Anti-DDoS / Bots)
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requêtes max par IP
  message: { message: "Trop de requêtes effectuées depuis votre adresse IP. Veuillez patienter un instant." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalApiLimiter);

// 🛡️ SÉCURITÉ : Rate Limiting STRICT sur la connexion (Blocage après 5 tentatives échouées / 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  message: { message: "Trop de tentatives de connexion échouées. Par mesure de sécurité, votre accès est bloqué pendant 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/login', loginLimiter);

// Rate limiter pour les autres flux d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 tentatives max
  message: { message: "Trop de tentatives. Réessayez dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/register', authLimiter);
app.use('/api/forgot-password', authLimiter);
app.use('/api/resend-verification', authLimiter);

// 🛡️ SÉCURITÉ : Chatbot IA Public mais limité
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // 5 messages par minute max par IP
  message: { message: "Vous avez atteint la limite de messages IA. Veuillez patienter une minute." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/chat', aiLimiter);
app.use('/api/ai/gift-advice', aiLimiter);
app.use('/api/ai/generate-slogans', aiLimiter);

// 🛡️ SÉCURITÉ : Génération d'images IA (Ressources serveur intensives - 3 requêtes max par minute)
const imageAiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3,
  message: { message: "Limite de génération d'images IA atteinte. Veuillez patienter une minute avant de réessayer." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/ai/generate-design', imageAiLimiter);

// Taille limite raisonnable pour les requêtes JSON (10 Mo max pour les images)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 🛡️ OWASP : Sanitization stricte récursive contre les injections XSS
app.use(sanitizeInputs);


// Adapte 'uploads' si ton dossier s'appelle autrement !
const dossierImages = path.join(__dirname, 'images');
console.log("📂 Le serveur sert les images depuis ce dossier :", dossierImages); // Ce log t'aidera à vérifier
// 2. IMPORTANT : Rend le dossier images public pour que le frontend puisse afficher les photos
// Assure-toi que le dossier 'images' existe à la racine de ton projet
// 🛡️ SÉCURITÉ : Fichiers statiques avec blocage dotfiles et header nosniff
const safeStaticOptions = {
  dotfiles: 'ignore',
  maxAge: '7d',
  setHeaders: function (res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('X-Content-Type-Options', 'nosniff');
  }
};

app.use('/images', express.static(dossierImages, safeStaticOptions));
app.use('/images', express.static(path.join(__dirname, 'uploads'), safeStaticOptions));

//les middleware




//on cree un route
app.get('/', (req, res) => {
  res.send('Le serveur h-design-back fonctionne parfaitement !');
});

//appel au routes
app.use('/api', routes)

// 🔍 DEBUG : Log toutes les routes 404 pour comprendre pourquoi l'API échoue
app.use('/api', (req, res) => {
  console.warn(`⚠️ 404 sur l'API : ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: `Route ${req.originalUrl} non trouvée sur le serveur.` });
});

// ---------------------------------------------------------
// AJOUTE CECI À LA FIN DE TON FICHIER INDEX.JS
// Middleware global de gestion d'erreurs (Le filet de sécurité)
// ---------------------------------------------------------
app.use((err, req, res, next) => {
  // 🛰️ Centralisation des erreurs via LoggerService (Sentry / APM)
  logger.captureException(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Gestion spécifique des erreurs CORS
  if (err.message === 'Non autorisé par CORS') {
    return res.status(403).json({ message: "Origine non autorisée." });
  }

  // Gestion spécifique des erreurs Multer (Upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: "L'image est trop lourde (Max 5Mo) !" });
  }

  // 🛡️ SÉCURITÉ : Ne PAS exposer les détails d'erreur au client en production
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    message: "Une erreur interne est survenue.",
    ...(isProduction ? {} : { error: err.message })
  });
});


// ---------------------------------------------------------
// AJOUTE CETTE LIGNE ICI (Change 'uploads' par le vrai nom de ton dossier images)
// Le premier '/uploads' est l'adresse dans l'URL, le second est le dossier réel.
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// ---------------------------------------------------------

// Les routes pour servir le dossier 'dist' (React) ont été supprimées
// car le frontend est déployé de manière indépendante sur Vercel.



const PORT = process.env.PORT || 205;

let server;
// Démarrage du serveur HTTP (Local / VPS / Docker / PM2)
if (process.env.NODE_ENV !== 'production' || process.env.STANDALONE === 'true') {
  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Serveur démarré sur : http://localhost:${PORT}`);
    verifyEmailConfiguration().catch(() => {});
  });
}

// 🛑 ARRÊT PROPRE (Graceful Shutdown) : Fermeture ordonnée du serveur et du pool MySQL
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Signal ${signal} reçu. Arrêt gracieux du serveur et du pool de données...`);
  
  if (server) {
    server.close(async () => {
      console.log('🔌 Serveur HTTP fermé aux nouvelles connexions.');
      try {
        await pool.end();
        console.log('💾 Connexions MySQL/TiDB fermées avec succès.');
        process.exit(0);
      } catch (err) {
        console.error('❌ Erreur lors de la fermeture du pool MySQL :', err);
        process.exit(1);
      }
    });

    // Timeout de sécurité : forcer la fermeture après 10s si une requête reste bloquée
    setTimeout(() => {
      console.error('⚠️ Délai dépassé (10s), arrêt forcé du processus.');
      process.exit(1);
    }, 10000).unref();
  } else {
    try {
      await pool.end();
    } catch (_) {}
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 🛡️ SÉCURITÉ : Interception des promesses et exceptions non gérées (anti-crash silencieux)
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 [Process] Promesse non gérée (Unhandled Rejection) :', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 [Process] Exception fatale non interceptée (Uncaught Exception) :', error);
  gracefulShutdown('uncaughtException');
});

// 🚀 EXPORT POUR VERCEL SERVERLESS
export default app;
