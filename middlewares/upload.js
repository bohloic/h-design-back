// middlewares/upload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

console.log("🛠️ Chargement du middleware Upload...");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Chemin absolu vers le dossier images
        const uploadPath = path.join(process.cwd(), 'images');
        
        console.log("📂 Tentative d'upload dans :", uploadPath);

        // Création du dossier si inexistant
        if (!fs.existsSync(uploadPath)){
            console.log("✨ Création du dossier 'images'...");
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const name = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
        console.log("📝 Nom du fichier généré :", name);
        cb(null, name);
    }
});

const fileFilter = (req, file, cb) => {
    console.log("🔍 Vérification du fichier :", file.originalname, file.mimetype);
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        console.error("❌ Type de fichier refusé !");
        cb(new Error('Seules les images sont autorisées !'));
    }
};

export const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // J'ai augmenté à 10MB pour être sûr
});