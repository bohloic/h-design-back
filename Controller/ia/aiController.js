import 'dotenv/config';
import pool from "../../db/db.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- VERIFICATION API KEY ---
if (!process.env.GEMINI_API_KEY) {
    console.error("🔴 ERREUR FATALE : La clé GEMINI_API_KEY est introuvable dans le fichier .env !");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- 🛠️ DEBUG : LISTER LES MODÈLES DISPONIBLES ---
// Ce bloc va s'exécuter au démarrage pour nous dire quels modèles fonctionnent
(async function listAvailableModels() {
    try {
        // Cette fonction n'existe que dans les versions récentes de la librairie
        // Si elle plante, c'est que la mise à jour a échoué.
        const modelList = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).countTokens("test"); 
        // Note: Il n'y a pas de fonction simple "listModels" publique dans le client SDK Node simple,
        // donc on teste directement si le modèle flash répond.
        console.log("✅ TEST MODÈLE : gemini-1.5-flash est accessible !");
    } catch (error) {
        console.error("⚠️ ATTENTION : gemini-1.5-flash ne répond pas. Code erreur :", error.message);
        console.log("ℹ️ Essayez de relancer 'npm install @google/generative-ai@latest'");
    }
})();

// On utilise le modèle Flash. Si ça plante encore après la mise à jour,
// essayez "gemini-1.0-pro" à la place.
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", 
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ]
});

// --- INFORMATIONS BOUTIQUE ---
const SHOP_KNOWLEDGE = `
NOM: H-Design
LIVRAISON: 
- Abidjan : 1500 FCFA (24h).
- Intérieur : 3000 FCFA (48h-72h).
PAIEMENT: Cash à la livraison (Abidjan) ou Mobile Money (Intérieur).
CONTACT: 07 00 00 00 00.
HORAIRES: 9h-18h.
`;

// --- ETAPE 1 : SQL ---
async function searchProducts(filters) {
    let sql = `
        SELECT p.id, p.name, p.slug, p.price, p.image_url, p.gender, p.attributes, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
    `;
    const params = [];

    if (filters.keyword) {
        sql += " AND (p.name LIKE ? OR c.name LIKE ?)";
        params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
    }
    if (filters.color) {
        sql += " AND (p.attributes LIKE ? OR p.name LIKE ?)";
        params.push(`%${filters.color}%`, `%${filters.color}%`);
    }
    if (filters.size) {
        sql += " AND p.attributes LIKE ?";
        params.push(`%${filters.size}%`);
    }
    if (filters.gender) {
        sql += " AND (p.gender = ? OR p.gender = 'unisexe')";
        params.push(filters.gender);
    }

    sql += " LIMIT 5";

    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (e) { 
        console.error("❌ Erreur SQL:", e); 
        return []; 
    }
}

async function getTrendingProducts() {
    try {
        const [rows] = await pool.execute(`
            SELECT p.id, p.name, p.slug, p.price, p.image_url 
            FROM products p ORDER BY created_at DESC LIMIT 4
        `);
        return rows;
    } catch (e) { return []; }
}

// --- ETAPE 2 : ANALYSE INTENTION ---
async function analyzeIntent(userMessage) {
    const prompt = `
    Tu es le cerveau d'un site e-commerce. Analyse la phrase : "${userMessage}".
    
    Réponds UNIQUEMENT avec un JSON suivant ce format strict :
    {
      "type": "search" | "faq" | "chat", 
      "filters": {
         "keyword": string | null,
         "color": string | null,
         "size": string | null,
         "gender": "homme" | "femme" | "enfant" | null
      }
    }

    Règles :
    - Si produit demandé -> type: "search".
    - Si question livraison/paiement/contact -> type: "faq".
    - Si salutation -> type: "chat".
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("🔴 ERREUR GEMINI (Analyse):", error.message);
        return { type: "chat", filters: {} };
    }
}

// --- ETAPE 3 : RÉPONSE FINALE ---
async function generateResponse(userMessage, products, context) {
    const productsList = products.map(p => `- ${p.name} (${p.price}F)`).join("\n");
    
    const prompt = `
    Tu es l'IA de H-Design.
    INFO BOUTIQUE : ${SHOP_KNOWLEDGE}
    CONTEXTE : Client: "${userMessage}" | Intention: ${context.type}
    Produits Trouvés: ${productsList || "Aucun"}
    
    CONSIGNES :
    - FAQ : Réponds avec les infos boutique.
    - Chat : Sois poli.
    - Search : Présente les produits ou propose les nouveautés si fallback.
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("🔴 ERREUR GEMINI (Réponse):", error.message);
        return "Je suis là pour vous aider !";
    }
}

// --- CONTROLEUR PRINCIPAL ---
export const chatWithAI = async (req, res) => {
    try {
        const { message, isAdmin } = req.body;
        if (!message) return res.status(400).json({ reply: "..." });

        if (isAdmin && message.includes("admin")) return res.json({ reply: "Admin connecté.", products: [] });

        // 1. ANALYSE
        const intent = await analyzeIntent(message);
        console.log("🧠 Intention :", intent);

        let products = [];
        let searchMode = 'none';

        // 2. LOGIQUE
        if (intent.type === 'search') {
            products = await searchProducts(intent.filters);
            if (products.length > 0) {
                searchMode = 'exact';
            } else {
                products = await getTrendingProducts();
                searchMode = 'fallback';
            }
        } 

        // 3. RÉPONSE
        const aiReply = await generateResponse(message, products, { 
            type: intent.type, 
            mode: searchMode,
            filters: intent.filters
        });

        res.json({ reply: aiReply, products: products });

    } catch (error) {
        console.error("🔴 CRASH CONTROLEUR:", error);
        res.status(200).json({ 
            reply: "Désolé, une erreur technique m'empêche de répondre.", 
            products: [] 
        });
    }
};

export const generateDesignAI = async (req, res) => {
    res.status(200).json({ message: "Image generation placeholder" }); 
};