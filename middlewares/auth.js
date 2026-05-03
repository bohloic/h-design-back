import jwt from 'jsonwebtoken';

// 1. Vérifier si connecté (Strict)
export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Enlève le mot "Bearer"
    
    if (!token) return res.status(403).json({ message: "Aucun token fourni" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // On stocke les infos (id, role) pour la suite
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token invalide" });
    }
};

// 1b. Vérifier si connecté (Optionnel - pour mode invité)
export const verifyTokenOptional = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        // En mode optionnel, si le token est invalide, on traite comme un invité
        req.user = null;
        next();
    }
};

// 2. Vérifier si Admin
export const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Accès refusé : Réservé aux administrateurs." });
    }
    next();
};

// 3. Vérifier si Propriétaire OU Admin (pour voir son propre profil)
export const verifyOwnerOrAdmin = (req, res, next) => {
    const { id } = req.params;
    
    // Si c'est un admin, il passe
    if (req.user.role === 'admin') return next();
    
    // Si c'est l'utilisateur lui-même, il passe
    // On compare l'ID du token (req.user.userId) avec l'ID demandé (id)
    if (String(req.user.userId) === String(id)) return next();

    return res.status(403).json({ message: "Accès refusé : Vous ne pouvez accéder qu'à votre propre compte." });
};
