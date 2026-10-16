import db from "../../db/db.js";

// 🛡️ Regex de validation stricte (Audit OWASP A03 Injection & Insecure Input Validation)
const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'-]{2,50}$/;
const PHONE_REGEX = /^(\+225)?(01|05|07)[0-9]{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const UpdateUser = async (req, res) => {
    try {
        const { id } = req.params;
        let { nom, prenom, email, phone, city, address } = req.body;

        // 1. Normalisation et nettoyage préventif
        nom = String(nom || '').trim();
        prenom = String(prenom || '').trim();
        email = String(email || '').trim().toLowerCase();
        phone = String(phone || '').trim().replace(/\s+/g, '');
        city = city !== undefined ? String(city).trim() : null;
        address = address !== undefined ? String(address).trim() : null;

        // 🛡️ Détection et rejet immédiat des balises HTML (<script>, <b>, etc.) pour bloquer le Stored XSS
        const containsHtml = (str) => /<[a-z/][\s\S]*>/i.test(str);
        if (containsHtml(nom) || containsHtml(prenom) || (city && containsHtml(city)) || (address && containsHtml(address))) {
            return res.status(400).json({ 
                success: false, 
                message: "Les balises HTML et scripts ne sont pas autorisés dans le profil." 
            });
        }

        // 2. Validation Nom & Prénom
        if (!nom || !NAME_REGEX.test(nom)) {
            return res.status(400).json({ 
                success: false, 
                message: "Le nom doit comporter entre 2 et 50 caractères alphabétiques valides (lettres, accents, tirets)." 
            });
        }

        if (!prenom || !NAME_REGEX.test(prenom)) {
            return res.status(400).json({ 
                success: false, 
                message: "Le prénom doit comporter entre 2 et 50 caractères alphabétiques valides (lettres, accents, tirets)." 
            });
        }

        // 3. Validation Email
        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: "Veuillez fournir une adresse email valide." 
            });
        }

        // 4. Validation Téléphone (Format mobile ivoirien strict à 10 chiffres)
        if (phone && !PHONE_REGEX.test(phone)) {
            return res.status(400).json({ 
                success: false, 
                message: "Le numéro de téléphone doit être un numéro mobile ivoirien valide à 10 chiffres (Orange, MTN, Moov débutant par 01, 05 ou 07)." 
            });
        }

        // 5. Requête SQL préparée (avec city et address si existants)
        const sql = `
            UPDATE users 
            SET nom = ?, prenom = ?, email = ?, phone = ?, 
                city = COALESCE(?, city), 
                address = COALESCE(?, address) 
            WHERE id = ?
        `;

        const values = [nom, prenom, email, phone || null, city, address, id];

        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        return res.json({ 
            success: true, 
            message: "Vos informations ont été mises à jour avec succès !",
            user: { id, nom, prenom, email, phone, city, address }
        });
    } catch (error) {
        console.error("❌ Erreur UpdateUser:", error);
        res.status(500).json({ success: false, message: "Une erreur est survenue lors de la mise à jour de l'utilisateur." });
    }
};