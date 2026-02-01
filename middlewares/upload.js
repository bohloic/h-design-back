// middlewares/upload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuration du stockage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'images/'; // <--- MODIFICATION ICI (C'était 'uploads/')
        
        // On vérifie si le dossier existe, sinon on le crée pour éviter les plantages
        if (!fs.existsSync(uploadPath)){
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath); 
    },
    filename: (req, file, cb) => {
        // On renomme le fichier pour éviter les doublons et les caractères spéciaux
        // ex: design-17382456.png
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtre pour n'accepter que les images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Seules les images sont autorisées !'));
    }
};

export const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // J'ai augmenté à 10MB pour les photos HD
    fileFilter: fileFilter
});