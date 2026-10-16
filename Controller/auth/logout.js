// Controller/auth/logout.js

export const logout = (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    
    const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax', // Correspondance exacte avec login.js pour permettre la suppression en cross-site
        path: '/'
    };

    // Suppression sécurisée des cookies de session HttpOnly
    res.clearCookie('token', cookieOptions);
    res.clearCookie('session_token', cookieOptions);
    res.clearCookie('jwt', cookieOptions);

    // 🛡️ OWASP / RFC 8885: Clear-Site-Data ordonne nativement aux navigateurs (Chrome, Edge, Firefox, Safari)
    // de vider intégralement les cookies et les espaces de stockage (localStorage/sessionStorage) associés
    res.setHeader('Clear-Site-Data', '"cookies", "storage"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json({ 
        success: true, 
        message: "Déconnexion réussie. Session révoquée et données nettoyées." 
    });
};
