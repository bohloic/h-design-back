import cloudinary from '../services/cloudinaryService.js';

export const saveBase64Image = async (base64String) => {
    // 1. Validation
    if (!base64String || typeof base64String !== 'string') return null;
    // Si c'est déjà une URL (ex: une image déjà sur Cloudinary), on la retourne telle quelle
    if (base64String.startsWith('http')) return base64String;

    try {
        // 2. Upload Cloudinary (accepte directement le format data:image/...;base64)
        const result = await cloudinary.uploader.upload(base64String, {
            folder: 'h-designer/products'
        });
        
        // 3. Retourne l'URL sécurisée
        return result.secure_url;
    } catch (err) {
        console.error("Erreur sauvegarde image Cloudinary:", err);
        return null;
    }
};

export const uploadBufferToCloudinary = async (buffer, folder = 'h-designer/uploads') => {
    try {
        // Conversion du buffer en base64 URI
        const base64Data = buffer.toString('base64');
        const fileUri = `data:image/png;base64,${base64Data}`;
        
        const result = await cloudinary.uploader.upload(fileUri, {
            folder: folder
        });
        
        return result.secure_url;
    } catch (error) {
        console.error("Erreur upload buffer Cloudinary:", error);
        throw error;
    }
};