import fs from 'fs';
import path from 'path';

export const saveBase64Image = (base64String) => {
    // 1. Validation
    if (!base64String || typeof base64String !== 'string') return null;
    if (base64String.startsWith('http')) return base64String;

    // 2. Extraction
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        console.warn("Format Base64 invalide");
        return null;
    }

    // 3. Création Buffer
    const imageBuffer = Buffer.from(matches[2], 'base64');
    const fileName = `product_${Date.now()}_${Math.round(Math.random() * 1E9)}.png`;

    // 4. Chemin (Correction pour ES Modules)
    // process.cwd() renvoie la racine de ton projet (là où est package.json)
    const uploadDir = path.join(process.cwd(), 'images');
    const uploadPath = path.join(uploadDir, fileName);

    // 5. Création dossier si inexistant
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 6. Écriture
    try {
        fs.writeFileSync(uploadPath, imageBuffer);
        return fileName;
    } catch (err) {
        console.error("Erreur sauvegarde image:", err);
        return null;
    }
};