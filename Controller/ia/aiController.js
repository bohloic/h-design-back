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
        const result = await chat.sendMessage(message);

        res.json({ success: true, text: result.response.text() });

    } catch (error) {
        console.error("❌ Erreur Chat AI:", error);
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

        const result = await model.generateContent(prompt);
        res.json({ success: true, text: result.response.text() });
    } catch (error) {
        console.error("❌ Erreur Gift AI:", error);
        res.status(500).json({ success: false, text: "Conseiller indisponible." });
    }
};

/**
 * 🔍 LISTE DES MODÈLES (Admin)
 */
export const listAiModels = async (req, res) => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
