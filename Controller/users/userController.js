import jwt from 'jsonwebtoken';

// ... vérification du mot de passe ...

// Création du token
const token = jwt.sign(
    { 
        userId: user.id, 
        email: user.email // <--- C'est ICI qu'on injecte l'email
    },
    process.env.JWT_SECRET, // Votre clé secrète
    { expiresIn: '24h' }
);

// Envoi de la réponse au frontend
res.status(200).json({
    userId: user.id,
    token: token
});