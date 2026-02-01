

// Controller/products/uploadController.js
export const uploadCustomDesign = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Aucun fichier reçu" });
        }

        // On construit l'URL complète de l'image
        // Assurez-vous que votre serveur sert bien le dossier '/images' ou '/uploads'
        const imageUrl = `/images/${req.file.filename}`; // ou '/uploads/' selon votre config index.js

        res.status(200).json({ 
            message: "Design sauvegardé !", 
            url: imageUrl 
        });

    } catch (error) {
        console.error("Erreur upload:", error);
        res.status(500).json({ message: "Erreur lors de la sauvegarde du design" });
    }
};