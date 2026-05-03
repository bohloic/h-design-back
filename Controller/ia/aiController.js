// Controller/ia/aiController.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

/**
 * 🤖 CHATBOT PRINCIPAL H-DESIGNER
 * Utilise la version 2.5 Flash (Early Access)
 */
export const chatWithGemini = async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: "Message vide." });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `Tu es l'assistant virtuel officiel de la marque 'H-designer' à Abidjan. 
            Ton catalogue comporte UNIQUEMENT des t-shirts personnalisables. 
            Sois chic, poli et aide les clients à choisir tailles et designs.`
        });

        let cleanHistory = [];
        if (history && Array.isArray(history)) {
            cleanHistory = history
                .filter(msg => msg.role && msg.parts && msg.parts[0].text)
                .map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.parts[0].text }]
                }));

            if (cleanHistory.length > 0 && cleanHistory[0].role === 'model') {
                cleanHistory.shift();
            }
        }

        const chat = model.startChat({ history: cleanHistory });
        // 🔄 MÉCANISME DE RETRY POUR GEMINI (Gère les erreurs 503 temporaires)
        const maxRetries = 3;
        let lastError;
        let responseText = "";

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await chat.sendMessage(message);
                responseText = result.response.text();
                lastError = null;
                break; // Succès !
            } catch (err) {
                lastError = err;
                console.warn(`⚠️ Tentative IA #${attempt} échouée...`);
                if (attempt < maxRetries) {
                    // Attente exponentielle (500ms, 1000ms)
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                }
            }
        }

        if (lastError) throw lastError;

        res.json({ success: true, text: responseText });

    } catch (error) {
        console.error("❌ Erreur Chat AI:", error);

        // Message spécifique pour la surcharge
        if (error.status === 503) {
            return res.status(503).json({
                success: false,
                text: "L'IA est actuellement surchargée. Veuillez retenter dans quelques secondes."
            });
        }

        res.status(500).json({ success: false, text: "Désolé, une erreur est survenue." });
    }
};

/**
 * 🎁 CONSEILLER CADEAUX (Home Page)
 */
export const getGiftAdvice = async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt vide." });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: "Tu es l'Expert Style & Cadeaux de H-designer à Abidjan. Conseille des t-shirts personnalisés."
        });

        // 🔄 MÉCANISME DE RETRY POUR GEMINI
        const maxRetries = 3;
        let lastError;
        let responseText = "";

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await model.generateContent(prompt);
                responseText = result.response.text();
                lastError = null;
                break;
            } catch (err) {
                lastError = err;
                console.warn(`⚠️ Tentative Gift IA #${attempt} échouée...`);
                if (attempt < maxRetries) await new Promise(r => setTimeout(r, 500 * attempt));
            }
        }

        if (lastError) throw lastError;
        res.json({ success: true, text: responseText });
    } catch (error) {
        console.error("❌ Erreur Gift AI:", error);
        if (error.status === 503) {
            return res.status(503).json({ success: false, text: "Service temporairement surchargé. Réessayez." });
        }
        res.status(500).json({ success: false, text: "Conseiller indisponible." });
    }
};

/**
 * 🔍 LISTE DES MODÈLES (Admin)
 */
export const listAiModels = async (req, res) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const models = await genAI.listModels();
        console.log("📜 Liste des modèles disponibles :", JSON.stringify(models, null, 2));
        res.json(models);
    } catch (error) {
        console.error("❌ Impossible de lister les modèles :", error);
        res.status(500).json({ message: "Une erreur est survenue lors de la récupération de la liste des modèles." });
    }
};

/**
 * ✍️ GÉNÉRATEUR DE SLOGANS (Customizer)
 */
export const generateSlogans = async (req, res) => {
    try {
        const { keyword } = req.body;
        if (!keyword) return res.status(400).json({ error: "Thème manquant." });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // 🔄 MÉCANISME DE RETRY & FALLBACK
        const maxRetries = 2;
        let lastError;
        let responseText = "";

        const modelsToTry = ["gemini-2.5-flash", "gemini-pro"];

        for (const modelName of modelsToTry) {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: "Tu es un concepteur-rédacteur publicitaire expert. Génère 5 slogans pour un t-shirt. Réponds UNIQUEMENT avec un tableau JSON de chaînes : [\"slogan1\", \"slogan2\", ...]"
            });

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const prompt = `Génère 5 slogans courts pour le thème : "${keyword}"`;
                    const result = await model.generateContent(prompt);
                    responseText = result.response.text();
                    lastError = null;
                    break;
                } catch (err) {
                    lastError = err;
                    console.warn(`⚠️ Tentative Slogans (${modelName}) #${attempt} échouée : ${err.message}`);
                    if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
                }
            }
            if (!lastError) break; // Sortir si un modèle a fonctionné
        }

        if (lastError) throw lastError;

        // Nettoyage au cas où l'IA met des balises markdown ```json
        const jsonMatch = responseText.match(/\[.*\]/s);
        const slogans = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        res.json({ success: true, slogans });
    } catch (error) {
        console.error("❌ Erreur Critique Slogans IA:", error);

        // Fallback ultime : Slogans statiques si l'IA est vraiment HS
        const fallbacks = [
            `Passion ${keyword}`,
            `Mode ${keyword}`,
            `Style ${keyword} Unique`,
            `H-Designer x ${keyword}`,
            `${keyword} Vibration`
        ];
        res.json({ success: true, slogans: fallbacks, note: "IA surchargée, slogans de secours générés." });
    }
};
