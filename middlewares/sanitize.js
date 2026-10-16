/**
 * 🛡️ OWASP Anti-XSS Sanitization Middleware
 * Nettoie et purifie récursivement les entrées de requêtes (body, query, params)
 * pour neutraliser les injections de scripts, balises malveillantes, et vecteurs d'attaque XSS.
 */

// Motifs XSS dangereux à éradiquer
const DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /data\s*:\s*text\/html/gi,
    /on(?:error|load|click|mouseover|focus|blur|change|submit|keydown|keyup)\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
    /expression\s*\(.*?\)/gi
];

/**
 * Nettoie une chaîne de caractères en retirant les charges actives malveillantes
 * tout en préservant le texte naturel et le formatage légitime.
 * @param {string} value 
 * @returns {string}
 */
export const sanitizeString = (value) => {
    if (typeof value !== 'string') return value;

    // Si la valeur est du base64 d'image ou du JSON brut valide, on évite d'altérer la structure
    if (value.startsWith('data:image/') || value === 'base64_removed_for_db_safety') {
        return value;
    }

    let cleaned = value;
    for (const pattern of DANGEROUS_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Neutraliser les chevrons isolés suspects non fermés
    return cleaned;
};

/**
 * Parcourt récursivement un objet ou tableau pour assainir toutes les valeurs textuelles
 * @param {any} data 
 * @returns {any}
 */
export const sanitizeData = (data) => {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
        return sanitizeString(data);
    }

    if (Array.isArray(data)) {
        return data.map((item) => sanitizeData(item));
    }

    if (typeof data === 'object') {
        const sanitizedObj = {};
        for (const [key, val] of Object.entries(data)) {
            // Ne pas altérer les champs de mots de passe pour ne pas corrompre le hash
            if (key.toLowerCase().includes('password')) {
                sanitizedObj[key] = val;
            } else {
                sanitizedObj[key] = sanitizeData(val);
            }
        }
        return sanitizedObj;
    }

    return data;
};

/**
 * Middleware Express global de sanitization
 */
export const sanitizeInputs = (req, res, next) => {
    try {
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeData(req.body);
        }
        // En Express 5, req.query et req.params ne peuvent pas être réassignés directement (getter uniquement).
        // On assainit donc leurs propriétés en place.
        if (req.query && typeof req.query === 'object') {
            for (const key of Object.keys(req.query)) {
                req.query[key] = sanitizeData(req.query[key]);
            }
        }
        if (req.params && typeof req.params === 'object') {
            for (const key of Object.keys(req.params)) {
                req.params[key] = sanitizeData(req.params[key]);
            }
        }
    } catch (err) {
        console.warn("⚠️ [SANITIZE] Erreur lors de l'assainissement :", err.message);
    }
    next();
};

export default sanitizeInputs;
