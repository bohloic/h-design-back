import dotenv from 'dotenv';
dotenv.config();

export const generateTshirtDesign = async (req, res) => {
    try {
        console.log("🎨 --- DÉMARRAGE GÉNÉRATION (POLLINATIONS ROUTER) ---");
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "La description du design est requise." });
        }

        // Pollinations.ai est gratuit et sans clé, c'est le "Pantheon" sans filigrame (nologo=true)
        const encodedPrompt = encodeURIComponent(`A high-quality professional t-shirt graphic design showing: ${prompt}. Minimalist vector art style, clean white background, no text, highly detailed.`);
        const seed = Math.floor(Math.random() * 1000000); // Pour avoir une image unique
        const apiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&model=flux&seed=${seed}`;

        console.log(`🖌️ Requête envoyée à Pollinations : "${prompt}"`);

        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`Refus de l'IA (Statut: ${response.status})`);
        }

        // Conversion de l'image pour le Frontend
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        console.log("✅ Design généré avec succès (Pollinations - Sans Filigrane) !");

        return res.json({ 
            success: true, 
            imageUrl: `data:image/jpeg;base64,${base64Image}` 
            // Note: On renvoie du Base64 car c'est plus stable pour l'affichage immédiat
        });

    } catch (error) {
        console.error("❌ Erreur Serveur Pollinations:", error.message);
        res.status(500).json({ 
            success: false, 
            text: "Désolé, l'artiste IA est temporairement indisponible. Réessayez !" 
        });
    }
};