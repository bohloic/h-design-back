// middlewares/upload.js
import multer from 'multer';
import path from 'path';

console.log("🛠️ Chargement du middleware Upload (Memory Storage pour Vercel)...");

// On stocke le fichier en mémoire RAM (buffer) au lieu du disque
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    console.log("🔍 Vérification du fichier :", file.originalname, file.mimetype);
    const allowedTypes = /jpeg|jpg|png|gif|webp/;

    // Simplification de la vérification
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype) {
        return cb(null, true);
    } else {
        console.error("❌ Type de fichier refusé !");
        cb(new Error('Seules les images sont autorisées !'));
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // Max 10MB
});