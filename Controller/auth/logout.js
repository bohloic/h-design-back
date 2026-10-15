// Controller/auth/logout.js

export const logout = (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    
    // Suppression sécurisée du cookie HttpOnly
    res.clearCookie('token', {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'Strict' : 'Lax',
        path: '/'
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    res.status(200).json({ 
        success: true, 
        message: "Déconnexion réussie. Session révoquée." 
    });
};
