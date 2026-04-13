import pool from "../../db/db.js";

// 📡 RÉCUPÉRER LES NOTIFICATIONS D'UN UTILISATEUR
// GET /api/notifications
export const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId; // Supporte les deux formats de payload JWT

        const [rows] = await pool.execute(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );

        res.status(200).json(rows);
    } catch (error) {
        console.error("❌ Erreur récupération notifications :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des notifications." });
    }
};

// ✅ MARQUER UNE NOTIFICATION COMME LUE
// PUT /api/notifications/:id/read
export const markAsRead = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const notifId = req.params.id;

        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [notifId, userId]
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("❌ Erreur marquage notification :", error);
        res.status(500).json({ message: "Erreur serveur." });
    }
};

// 🗑️ SUPPRIMER UNE NOTIFICATION
// DELETE /api/notifications/:id
export const deleteNotification = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const notifId = req.params.id;

        await pool.execute(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [notifId, userId]
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("❌ Erreur suppression notification :", error);
        res.status(500).json({ message: "Erreur serveur." });
    }
};

// 🛠️ FONCTION INTERNE POUR CRÉER UNE NOTIFICATION (Utilisée par les autres contrôleurs)
export const createNotification = async ({ userId, title, message, type = 'info', link = null }) => {
    try {
        if (!userId) return null;
        
        const [result] = await pool.execute(
            'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
            [userId, title, message, type, link]
        );
        
        return result.insertId;
    } catch (error) {
        console.error("⚠️ Échec création notification en DB :", error);
        return null;
    }
};
