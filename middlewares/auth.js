import jwt from 'jsonwebtoken';

// 1. Vérifier si connecté (Strict - lit le cookie HttpOnly en priorité)
export const verifyToken = (req, res, next) => {
    // 🛡️ OWASP: Lecture prioritaire du cookie HttpOnly
    let token = req.cookies?.token;
    
    // Fallback sur le header Authorization pour les requêtes API / backward compatibility
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
        return res.status(401).json({ message: "Authentification requise : aucun token fourni (Cookie ou Bearer)." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId, email, role }
        next();
    } catch (err) {
        return res.status(401).json({ message: "Session expirée ou token invalide." });
    }
};

// 1b. Vérifier si connecté (Optionnel - pour mode invité)
export const verifyTokenOptional = (req, res, next) => {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        req.user = null;
        next();
    }
};

// 2. Vérifier si Admin (BFLA / RBAC - Role-Based Access Control)
export const verifyAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Accès refusé (403 Forbidden) : Privilèges Administrateur requis." });
    }
    next();
};

// 3. Vérifier si Propriétaire OU Admin (BOLA / IDOR)
export const verifyOwnerOrAdmin = (req, res, next) => {
    const { id } = req.params;
    
    if (!req.user) {
        return res.status(401).json({ message: "Authentification requise." });
    }

    // Si c'est un admin, il passe
    if (req.user.role === 'admin') return next();
    
    // Si c'est l'utilisateur lui-même, il passe
    if (String(req.user.userId) === String(id)) return next();

    return res.status(403).json({ message: "Accès refusé (BOLA/IDOR) : Vous ne pouvez accéder qu'à vos propres données." });
};
