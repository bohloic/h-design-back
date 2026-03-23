import dotenv from 'dotenv';
dotenv.config();

export const generateTshirtDesign = async (req, res) => {
    try {
        console.log("🎨 --- DÉMARRAGE GÉNÉRATION (HUGGING FACE ROUTER) ---");
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "La description du design est requise." });
        }

        const hfKey = process.env.HUGGINGFACE_API_KEY;
        if (!hfKey) {
            console.error("❌ Clé Hugging Face introuvable dans le .env !");
            return res.status(500).json({ success: false, text: "Erreur de configuration du serveur." });
        }

        const fullPrompt = `A high-quality professional t-shirt graphic design showing: ${prompt}. Minimalist vector art style, clean white background, no text, highly detailed.`;
        console.log(`🖌️ Requête envoyée à Stable Diffusion : "${prompt}"`);

        // NOUVELLE ADRESSE OFFICIELLE DE HUGGING FACE
        const apiUrl = "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0";

        let response = await fetch(apiUrl, {
            headers: {
                "Authorization": `Bearer ${hfKey}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ inputs: fullPrompt }),
        });

        // Si le modèle est en train de se réveiller (Erreur 503), on patiente 15 secondes et on retente
        if (response.status === 503) {
            console.log("⏳ L'IA se réveille... On patiente 15 secondes...");
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            response = await fetch(apiUrl, {
                headers: {
                    "Authorization": `Bearer ${hfKey}`,
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({ inputs: fullPrompt }),
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Refus de l'IA (Statut: ${response.status}) - ${errorText}`);
        }

        // Conversion de l'image pour le Frontend
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        console.log("✅ Design généré avec succès (Gratuit & Sans Filigrane) !");

        return res.json({ 
            success: true, 
            imageUrl: `data:image/jpeg;base64,${base64Image}` 
        });

    } catch (error) {
        console.error("❌ Erreur Serveur:", error.message);
        res.status(500).json({ 
            success: false, 
            text: "Désolé, l'artiste IA est très sollicité. Réessayez dans un instant !" 
        });
    }
};