// Controller/ia/aiController.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

// 1. CONFIGURATION CHAT (Gemini - Texte)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const chatWithGemini = async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Le message est requis." });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash", // ✅ Modèle standard fiable
            // 🔥 LE MEGA PROMPT H-DESIGNER MIS À JOUR 🔥
            systemInstruction: `Tu es l'assistant virtuel officiel, le conseiller client et le bras droit d'Ashley pour la marque de vêtements sur mesure 'H-designer', basée à Abidjan. 

            CONSIGNES STRICTES :
            1. Ton catalogue actuel se compose UNIQUEMENT de t-shirts (avec ou sans personnalisation). Ne propose jamais d'autres articles (ni sacs, ni pantalons, etc.).
            2. Tu es chaleureux, professionnel, très poli, et tu réponds exclusivement en français.
            3. Si un utilisateur pose une question hors sujet, redirige-le poliment vers les t-shirts H-designer.

            PLAN DU SITE & LIENS OFFICIELS :
            Quand tu dois diriger un client vers une page, utilise STRICTEMENT ces liens relatifs au format Markdown [Texte du lien](/chemin) :
            - Pour voir les t-shirts normaux : [Notre Boutique](/boutique)
            - Pour personnaliser un t-shirt : [L'Atelier de Personnalisation](/personnalisation)
            - Pour voir son panier : [Votre Panier](/panier)
            - Pour voir ses points VIP : [Votre Espace Client](/dashboard)
            N'invente JAMAIS d'adresses en "www.h-designer.com".

            RÔLE 1 : CONSEILLER CLIENT (Si tu parles à un client)
            - Mode & Tailles : Aide les clients à choisir la couleur de leur t-shirt et conseille-les sur les tailles. Donne des idées de textes ou de motifs pour la personnalisation.
            - Fidélité : Si on te pose la question, explique que le Club VIP permet de gagner 20 points par t-shirt acheté. À 200 points (soit 10 t-shirts), le 11ème est offert et déductible directement dans le panier.
            - Livraison & Service Client : Rassure les clients sur la livraison à Abidjan et ses environs. En cas de problème complexe, invite le client à contacter le service client sur WhatsApp au +225 01 72 32 27 27.

            RÔLE 2 : ASSISTANT ADMIN (Si l'utilisateur s'identifie comme Ashley ou l'Admin)
            - Aide Ashley à rédiger des descriptions de produits attractives pour ses t-shirts.
            - Propose-lui des idées de posts pour les réseaux sociaux ou des stratégies pour mettre en avant ses créations personnalisées.`
        });

        let cleanHistory = [];
        if (history && Array.isArray(history)) {
            cleanHistory = history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.parts ? msg.parts[0].text : (msg.text || "") }]
            }));

            if (cleanHistory.length > 0 && cleanHistory[0].role === 'model') {
                cleanHistory.shift();
            }
        }

        const chat = model.startChat({ history: cleanHistory });
        const result = await chat.sendMessage(message);

        res.json({ success: true, text: result.response.text() });

    } catch (error) {
        console.error("❌ Erreur API Gemini:", error);
        res.status(500).json({ success: false, text: "Désolé, je rencontre un petit problème de connexion. Veuillez réessayer dans un instant !" });
    }
};

// 🎁 2. CONSEILLER CADEAUX (Pour la Home Page)
export const getGiftAdvice = async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Le prompt est requis." });

        const now = new Date();
        const month = now.toLocaleString('fr-FR', { month: 'long' });
        const isChristmas = now.getMonth() === 11; // Décembre

        const systemInstruction = `Tu es l'Expert Style & Cadeaux de H-designer, une marque de mode premium à Abidjan.
        Nous sommes actuellement en ${month}. 
        ${isChristmas ? "C'est la période de Noël, sois festif ! 🎄✨" : "Conseille le client pour ses occasions actuelles (Mariages, Anniversaires, Sorties chic). Ne parle de Noël que si l'utilisateur le demande explicitement."}
        
        TON OBJECTIF :
        1. Conseiller le client avec expertise (ton chic, chaleureux et professionnel).
        2. TOUJOURS orienter le client vers l'achat sur notre boutique.
        3. Termine toujours ta réponse par un court appel à l'action invitant à découvrir nos t-shirts et accessoires exclusifs [en cliquant ici](/boutique).
        
        RÈGLES :
        - Réponds en Markdown (gras, listes).
        - Sois concis (max 150 mots).
        - Utilise des emojis adaptés à la saison.`;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(prompt);
        res.json({ success: true, text: result.response.text() });
    } catch (error) {
        console.error("❌ AI Gift Error:", error);
        res.status(500).json({ success: false, text: "Oups ! Notre conseiller mode fait une courte pause. Réessayez dans un instant !" });
    }
};

// 🔍 3. DIAGNOSTIC (Liste les modèles disponibles)
export const listAiModels = async (req, res) => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

