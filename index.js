import dotenv from 'dotenv';
dotenv.config();
import express from 'express'
import routes from './routes/routes.js'
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Nécessaire si tu utilises "type": "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// on initialise express
const app = express();


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



//




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

//activer les deux derniers ligne en mode prod

// // 1. Servir les fichiers statiques du site (le dossier dist)
// app.use(express.static(path.join(__dirname, 'dist')));

// // 2. La route "Catch-All" (celle qu'on a corrigée tout à l'heure)
// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });


const PORT = process.env.PORT || 205;
// on demarre le serveur
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Serveur démarré sur : http://localhost:${PORT}`));