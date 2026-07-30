import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * 🤖 SCRIPT DE SEGMENTATION IA (ÉTAPE 1 : Génération automatique du masque de vêtement)
 * - Prend une image produit avec fond complexe.
 * - Utilise l'API de Segmentation Photoroom (ou Remove.bg / Pixelbin).
 * - Isole uniquement le vêtement pour créer un masque PNG transparent (clothing-mask.png).
 */

export async function generateClothingMask({ inputImagePath, outputMaskPath, apiKey }) {
    try {
        console.log(`🤖 [IA RECOLORING] Segmentation du vêtement en cours pour : ${inputImagePath}`);

        if (!fs.existsSync(inputImagePath)) {
            throw new Error(`Fichier image introuvable : ${inputImagePath}`);
        }

        const formData = new FormData();
        const imageBuffer = fs.readFileSync(inputImagePath);
        const blob = new Blob([imageBuffer], { type: 'image/png' });
        
        formData.append('image_file', blob, path.basename(inputImagePath));
        // Paramètres spécifiques Photoroom / Remove.bg pour segmenter l'objet/vêtement
        formData.append('segmentation_target', 'clothing'); 
        formData.append('channels', 'alpha_only'); // Renvoie le masque alpha pur transparent

        const response = await axios.post('https://sdk.photoroom.com/v1/segment', formData, {
            headers: {
                'x-api-key': apiKey || process.env.PHOTOROOM_API_KEY || 'PR_DEMO_API_KEY_123',
                'Content-Type': 'multipart/form-data'
            },
            responseType: 'arraybuffer'
        });

        // Sauvegarde du masque PNG transparent
        fs.writeFileSync(outputMaskPath, response.data);
        console.log(`✅ [IA RECOLORING] Masque transparent généré avec succès : ${outputMaskPath}`);

        return {
            success: true,
            maskPath: outputMaskPath
        };

    } catch (error) {
        console.error("❌ Erreur génération masque IA :", error.response?.data || error.message);
        return {
            success: false,
            error: error.message
        };
    }
}
