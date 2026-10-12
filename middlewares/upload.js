// middlewares/upload.js
import multer from 'multer';

// Stockage sécurisé en mémoire RAM pour traitement et envoi direct vers le Cloud
const storage = multer.memoryStorage();

// Types MIME strictement autorisés (SVG exclu car risque de XSS stocké)
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
]);

const fileFilter = (req, file, cb) => {
    // 🛡️ SÉCURITÉ : Vérification du type MIME déclaré
    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
        return cb(new Error("Format de fichier non autorisé. Seules les images JPEG, PNG, WebP et GIF sont acceptées."), false);
    }

    // 🛡️ SÉCURITÉ : Vérification de l'extension de fichier contre les extensions suspectes
    const safeExtensionRegex = /\.(jpe?g|png|webp|gif)$/i;
    if (!safeExtensionRegex.test(file.originalname)) {
        return cb(new Error("Extension de fichier invalide."), false);
    }

    cb(null, true);
};

// 🛡️ OWASP : Limite stricte de 5 Mo (5 * 1024 * 1024 octets)
export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1 // 1 seul fichier à la fois
    }
});

/**
 * 🛡️ OWASP : Middleware de vérification des Magic Bytes (Signature binaire réelle)
 * Empêche le renommage malveillant d'un script exécutable (.php, .html) en .jpg/.png
 */
export const validateImageBuffer = (req, res, next) => {
    if (!req.file) return next();

    const buffer = req.file.buffer;
    if (!buffer || buffer.length < 12) {
        return res.status(400).json({ message: "Fichier corrompu ou illisible." });
    }

    // Signatures binaires standard (Magic Numbers)
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46; // GIF87a / GIF89a
    const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isJpeg && !isPng && !isGif && !isWebp) {
        return res.status(400).json({ 
            message: "Contenu de fichier suspect rejeté : la signature binaire ne correspond pas à une image valide (JPEG, PNG, WEBP, GIF)." 
        });
    }

    next();
};