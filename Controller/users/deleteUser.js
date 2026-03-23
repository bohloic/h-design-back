import pool from "../../db/db.js"; // 👈 L'import qui manquait !

export const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        
        res.status(200).json({ message: "Utilisateur supprimé avec succès." });

    } catch (error) {
        console.error("❌ Erreur suppression:", error);
        
        // 🛡️ GESTION DE LA SÉCURITÉ MYSQL (Commandes existantes)
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                message: "Impossible de supprimer ce client car il a déjà passé des commandes. Supprimez d'abord ses commandes." 
            });
        }
        
        res.status(500).json({ message: "Erreur lors de la suppression." });
    }
};