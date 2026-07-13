import { uploadBufferToCloudinary } from '../../utils/imageService.js';

export const uploadCustomDesign = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Aucun fichier reçu" });
        }

        // Upload sur Cloudinary depuis le buffer en mémoire
        const imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'h-designer/designs');

        res.status(200).json({ 
            message: "Design sauvegardé !", 
            url: imageUrl 
        });

    } catch (error) {
        console.error("Erreur upload:", error);
        res.status(500).json({ message: "Erreur lors de la sauvegarde du design" });
    }
};