import dotenv from 'dotenv';
dotenv.config();
import express from 'express'
import routes from './routes/routes.js'
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db/db.js'; // Import de la connexion DB pour la réparation

// Nécessaire si tu utilises "type": "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// on initialise express
const app = express();

// ============================================================
// 🛠️ SCRIPT DE RÉPARATION AUTOMATIQUE DES STATUTS (Exécuté au démarrage)
// ============================================================
(async () => {
    try {
        console.log("🛠️ [REPAIR] Démarrage du nettoyage des statuts...");
        const connection = await pool.getConnection();
        
        // 1. Harmonisation des statuts de design (Items)
        await connection.execute(`UPDATE order_items SET design_status = 'approved' WHERE design_status IN ('Validé', 'validé')`);
        await connection.execute(`UPDATE order_items SET design_status = 'rejected' WHERE design_status IN ('Refusé', 'refusé')`);
        
        // 2. Harmonisation des statuts de commande (Orders)
        // On remplace les statuts avec emojis par des statuts standards que le code comprend
        await connection.execute(`UPDATE orders SET status = 'Payé - Validation Design' WHERE status LIKE 'Payé - À Valider%'`);
        await connection.execute(`UPDATE orders SET status = 'Validation Design' WHERE status LIKE 'À Valider%'`);
        await connection.execute(`UPDATE orders SET status = 'Payé - Action Requise' WHERE status LIKE 'Payé - Action Requise%'`);
        // 3. Ajout de la colonne is_seen si elle n'existe pas
        const [columns] = await connection.execute("SHOW COLUMNS FROM orders LIKE 'is_seen'");
        if (columns.length === 0) {
            await connection.execute("ALTER TABLE orders ADD COLUMN is_seen TINYINT(1) DEFAULT 0");
            console.log("🆕 [REPAIR] Colonne 'is_seen' ajoutée à la table orders.");
        }
        
        connection.release();
        console.log("✅ [REPAIR] Nettoyage terminé avec succès.");
    } catch (err) {
        console.error("❌ [REPAIR] Erreur lors du nettoyage :", err.message);
    }
})();

// ⚡ PERFORMANCE : Compression Gzip
app.use(compression());

// 🛡️ SÉCURITÉ : Confiance envers le proxy (Ngrok/Vercel/Heroku)
// Nécessaire pour que express-rate-limit identifie correctement les IPs via X-Forwarded-For
app.set('trust proxy', 1);


// 🛡️ SÉCURITÉ : Headers HTTP (helmet)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// 🛡️ SÉCURITÉ : CORS restrictif
const allowedOrigins = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  process.env.FRONTEND_URL, // ex: https://votre-domaine.com
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autorise les requêtes sans origin (Postman, mobile, etc.) en dev
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqué pour l'origine : ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true
}));

// 🛡️ SÉCURITÉ : Rate Limiting sur les routes sensibles
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 tentatives max
  message: { message: "Trop de tentatives. Réessayez dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/login', authLimiter);
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

// Taille limite raisonnable pour les requêtes JSON (10 Mo max pour les images)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


// Adapte 'uploads' si ton dossier s'appelle autrement !
const dossierImages = path.join(__dirname, 'images');
console.log("📂 Le serveur sert les images depuis ce dossier :", dossierImages); // Ce log t'aidera à vérifier
// 2. IMPORTANT : Rend le dossier images public pour que le frontend puisse afficher les photos
// Assure-toi que le dossier 'images' existe à la racine de ton projet
app.use('/images', express.static(dossierImages, {
  setHeaders: function (res, path, stat) {
    // Cette ligne est la clé magique
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// ✅ Fix : On sert aussi le dossier uploads sous le même préfixe /images 
// pour que toutes les photos (produits + designs perso) soient accessibles.
app.use('/images', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: function (res, path, stat) {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

//les middleware




//on cree un route
// app.get('/', (req, res) => {
//     res.send("Bienvenue sur notre api")
// })

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
  console.error("🔥 ERREUR CRITIQUE SERVEUR :", err.stack); // Affiche l'erreur détaillée (côté logs serveur)

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

// ✅ MODE PRODUCTION MONOLITHIQUE
// Le backend sert le frontend depuis le dossier 'dist'
// (Ces lignes sont inoffensives en dev si le dossier 'dist' n'existe pas)

// 1. Servir les fichiers statiques du site React build (AVEC PRIORITÉ)
const oneYear = 31536000000;
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: oneYear,
  immutable: true,
  setHeaders: (res, filePath) => {
    // Autoriser le CORS pour les assets du build (indispensable pour Ngrok)
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

// Servir les images et uploads
app.use('/images', express.static(path.join(__dirname, 'uploads'), { 
    maxAge: oneYear,
    setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*')
}));

app.use('/images', express.static(path.join(__dirname, 'images'), { 
    maxAge: oneYear,
    setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*')
}));

// 2. Route "Catch-All" pour React Router (SPA)
// On utilise une Regex littérale pour contourner les erreurs 'path-to-regexp' de Node 22
app.get(/^(?!\/(api|images|assets)).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


const PORT = process.env.PORT || 205;
// on demarre le serveur
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Serveur démarré sur : http://localhost:${PORT}`));