// Fichier : Controller/deleteUser.js
import db from '../../db/db.js';

export const deleteUser = async (req, res) => {
    try{
        const userId = req.params.id;
        
        // ⚠️ LA COMMANDE DANGEREUSE
        // N'oubliez JAMAIS le "WHERE", sinon ça supprime toute la table !
        const sql = "DELETE FROM users WHERE id = ?";

        const [result] = await db.query(sql, [id]);

        //  Vérification : Est-ce qu'une ligne a été touchée ?
        if (result.affectedRows === 0) {
            // Si 0, c'est que l'ID n'existait pas dans la base
            return res.status(404).json({ message: "Utilisateur introuvable (peut-être déjà supprimé)." });
        }

        //  Succès
        return res.json({ message: "Utilisateur supprimé avec succès !" })
    }catch(error){
        console.log(error)
    }
    
};