import dotenv from 'dotenv';
dotenv.config(); // <--- INDISPENSABLE pour lire le fichier .env
import express from 'express'
import routes from './routes/routes.js'
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Nécessaire si tu utilises "type": "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// on initialise express
const app = express();


//  demande à express de reconnaitre le json
// Middleware pour autoriser les requêtes externes (CORS) et lire le JSON
app.use(cors({
  origin: true, // Autorise toutes les requêtes (pratique pour ngrok et localhost)
  credentials: true // Indispensable pour les sessions/cookies
}));
// 1. Augmente la taille limite pour accepter les grosses images en Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


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
  console.error("🔥 ERREUR CRITIQUE SERVEUR :", err.stack); // Affiche l'erreur détaillée

  // Gestion spécifique des erreurs Multer (Upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: "L'image est trop lourde (Max 5Mo) !" });
  }

  // Erreur générique pour ne pas faire planter le front
  res.status(500).json({ message: "Une erreur interne est survenue", error: err.message });
});


// ---------------------------------------------------------
// AJOUTE CETTE LIGNE ICI (Change 'uploads' par le vrai nom de ton dossier images)
// Le premier '/uploads' est l'adresse dans l'URL, le second est le dossier réel.
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// ---------------------------------------------------------

//activer les deux derniers ligne en mode prod

// 1. Servir les fichiers statiques du site (le dossier dist)
app.use(express.static(path.join(__dirname, 'dist')));

// 2. La route "Catch-All" (celle qu'on a corrigée tout à l'heure)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


const PORT = process.env.PORT || 205;
// on demarre le serveur
app.listen(PORT, () => console.log('votre serveur a bien demarrer'))