
import 'dotenv/config';
import express from 'express'
import { upload } from '../middlewares/upload.js';
import { UpdateUser } from '../Controller/users/updateUser.js'
import { GetUser } from '../Controller/users/getUser.js'
import { GetOneUser } from '../Controller/users/getOneUser.js'
import { createUser } from '../Controller/users/createUser.js'
import { deleteUser } from '../Controller/users/deleteUser.js'
import { login } from '../Controller/auth/login.js'
import { register } from '../Controller/auth/register.js'
import { createProduct } from '../Controller/products/createProduct.js'
import { getOneProduct } from '../Controller/products/getOneProduct.js'
import { updateProduct } from '../Controller/products/updateProduct.js'
import { deleteProduct } from '../Controller/products/deleteProduct.js'
import { GetProduct } from '../Controller/products/getProduct.js'
import { createCollection, deleteCollection, getActiveCollection, getCollections, updateCollection } from '../Controller/collections/collectionsController.js'
import { commandeSelect, createOrder, getOrder, getOrderByEmail, getOrderByUser, getOrderItems, updateItemDesign, updateOrderStatus, validateOrderDesign } from '../Controller/order/orderController.js'
import { shopController } from '../Controller/products/shopcontroller.js'
import { createDelivery, deleteDelivery, getDelivery, updateDelivery } from '../Controller/deliveries/deliveriesController.js'
import { chatWithGemini, generateSlogans, getGiftAdvice, listAiModels } from '../Controller/ia/aiController.js'
import { verifyAdmin, verifyToken, verifyOwnerOrAdmin, verifyTokenOptional } from '../middlewares/auth.js'
import { profil } from '../Controller/users/profile.js'
import { createCategory, deleteCategory, getCategory, updateCategory } from '../Controller/categories/categoriesController.js';
import { getMostViewedProducts, getProductByCollection, getProductBySlug, getProductsByCategoryAndGender } from '../Controller/products/productController.js';
import { getAdminBadges, markOrderAsSeen } from '../Controller/admin/adminStatsController.js';
import { uploadCustomDesign } from '../Controller/products/uploadController.js';
import { initializePayment, verifyPayment } from '../Controller/payment/paymentController.js';
import { getUserLoyaltyCard, redeemPoints, scanVipCard } from '../Controller/users/loyaltyController.js';
import { generateTshirtDesign } from '../Controller/ia/designController.js';
import { verifyEmailCode } from '../Controller/auth/verifyEmail.js';
import { forgotPassword } from '../Controller/auth/forgotPassword.js';
import { resetPassword } from '../Controller/auth/resetPassword.js';
import { resendVerification } from '../Controller/auth/resendVerification.js';
import { updateUserRole } from '../Controller/auth/updateUserRole.js';
import { exportReport } from '../Controller/order/rapport.js';
import { facture } from '../Controller/order/facture.js';
import { getAllOrdersWithItems, validateDesign, validateItemsDesign } from '../Controller/order/adminOrderController.js';
import { globalSearch } from '../Controller/admin/globalSearch.js';
import { deleteNotification, getUserNotifications, markAsRead } from '../Controller/notifications/notificationController.js';

//la gestion de route
const routes = express.Router()


// 🎯 PRIORITÉ : Route des commandes
routes.get('/orders', verifyToken, getOrder);


// se connecter
routes.post('/login', login)
//s'inscrire
routes.post('/register', register)
// verifier email
routes.post('/verify-email', verifyEmailCode);
// mot de passe oublié
routes.post('/forgot-password', forgotPassword);
routes.post('/reset-password', resetPassword);
routes.post('/resend-verification', resendVerification);

// pour l'utilisateur
// nouvelle utilisateur (Admin seul ou Inscription publique via /register)
routes.post("/users/create-user", verifyToken, verifyAdmin, createUser)
//liste d'utilisateur (Admin seul)
routes.get("/users/get-users", verifyToken, verifyAdmin, GetUser)
//selectionner un seul utilisateur (Admin ou Propriétaire)
routes.get("/users/get-user/:id", verifyToken, verifyOwnerOrAdmin, GetOneUser)
// Route de mise à jour utilisateur (Admin ou Propriétaire)
routes.put("/users/update-user/:id", verifyToken, verifyOwnerOrAdmin, UpdateUser);
// La route de suppression utilisateur (Admin seul)
routes.delete("/users/delete-user/:id", verifyToken, verifyAdmin, deleteUser);

//ou


// nouvelle utilisateur (Admin seul)
routes.post("/users", verifyToken, verifyAdmin, createUser)
//liste d'utilisateur (Admin seul)
routes.get("/users", verifyToken, verifyAdmin, GetUser)
//selectionner un seul utilisateur (Admin ou Propriétaire)
// ✅ FIX #5 : /users/profile/:id DOIT être AVANT /users/:id
// info utilisateur connecté
routes.get('/users/profile/:id', verifyToken, verifyAdmin, profil)
//selectionner un seul utilisateur (Admin ou Propriétaire)
routes.get("/users/:id", verifyToken, verifyOwnerOrAdmin, GetOneUser)
// Route de mise à jour utilisateur (Admin ou Propriétaire)
routes.put("/users/:id", verifyToken, verifyOwnerOrAdmin, UpdateUser);
// La route de suppression utilisateur (Admin seul)
routes.delete("/users/:id", verifyToken, verifyAdmin, deleteUser);
// Route pour la carte de fidélité VIP
routes.get('/loyalty/my-card', verifyToken, getUserLoyaltyCard);
// --- ROUTES ADMIN POUR LE CLUB VIP ---
routes.get('/admin/loyalty/scan', verifyToken, verifyAdmin, scanVipCard);
routes.post('/admin/loyalty/redeem', verifyToken, verifyAdmin, redeemPoints);
// route pour changer le role 
routes.put('/users/:id/role', verifyToken, verifyAdmin, updateUserRole);



// pour le produit
//creer produit
routes.post("/products/create-product", verifyToken, verifyAdmin, createProduct)
//tous les produits
routes.get("/products/get-product", GetProduct)
//selectionner un seul produit
routes.get("/products/get-product/:id", getOneProduct)
// Route de mise à jour produit
routes.put("/products/update-product/:id", verifyToken, verifyAdmin, updateProduct);
// La route de suppression
routes.delete("/products/delete-product/:id", verifyToken, verifyAdmin, deleteProduct);
// Route pour filtrer : /api/products/filter?categoryId=1&gender=homme
routes.get('/products/filter', getProductsByCategoryAndGender);
//  Route pour les PRODUITS (avec le nom de la collection)
routes.get('/products/shop', shopController)
// afficher les produits les plus vue
routes.get('/products/trending', getMostViewedProducts);
// ✅ FIX #1 : /products/collection/:id DOIT être AVANT /products/:slug
// pour selectionner tous les produits par collection Route : /api/products/collection/5
routes.get('/products/collection/:id', getProductByCollection);
// selectionner produit par slug (route générique en DERNIER)
routes.get('/products/:slug', getProductBySlug);



// pour les collections
//  Route pour les CATÉGORIES (Collections actives uniquement)
// IMPORTANT: Doit être AVANT /collections/:id
routes.get('/collections/active', getActiveCollection)

// tous les collection
routes.get('/collections', getCollections);
// creer une nouvelle collection
routes.post('/collections/', verifyToken, verifyAdmin, createCollection);
// mettre à jour une collection
routes.put('/collections/:id', verifyToken, verifyAdmin, updateCollection);
// supprimer une collection
routes.delete('/collections/:id', verifyToken, verifyAdmin, deleteCollection);





// pour les categories
// afficher categories
routes.get('/categories', getCategory)
// creer categories
routes.post('/categories', verifyToken, verifyAdmin, createCategory)
// mise à jour categories
routes.put('/categories/:id', verifyToken, verifyAdmin, updateCategory)
// supprimer categories
routes.delete('/categories/:id', verifyToken, verifyAdmin, deleteCategory)


// pour les commandes ou order
//afficher les commandes
// routes.get('/orders', verifyToken, getOrder)
//creer une commandes (Mode invité supporté via verifyTokenOptional)
routes.post('/orders', verifyTokenOptional, createOrder)
//mettre à jour le statut
routes.put('/orders/:id/status', verifyToken, verifyAdmin, updateOrderStatus)
// Récupérer la liste des commandes pour le select
routes.get('/orders-select', verifyToken, verifyAdmin, commandeSelect)
// ✅ FIX #2 : /orders/my-orders DOIT être AVANT /orders/:id
// afficher les commandes d'un utilisateur x
routes.get('/orders/my-orders/:id', verifyToken, getOrderByUser)
routes.get('/orders/my-orders/email/:email', verifyToken, getOrderByEmail)
// afficher les details de commande (route générique en DERNIER)
routes.get('/orders/:id', verifyToken, getOrderItems)
// Validation du design par la designer depuis orderDetailsView.tsx
routes.put('/orders/:id/validate-design', verifyToken, verifyAdmin, validateOrderDesign);
// Validation du design par la designer depuis autre
routes.get('/admin/orders', verifyToken, verifyAdmin, getAllOrdersWithItems);
routes.put('/admin/orders/:id/validate-design', verifyToken, verifyAdmin, validateDesign);
routes.put('/admin/orders/:id/validate-items', verifyToken, verifyAdmin, validateItemsDesign);
routes.get('/admin/badges', verifyToken, verifyAdmin, getAdminBadges);
routes.put('/admin/orders/:id/seen', verifyToken, verifyAdmin, markOrderAsSeen);

// Mise à jour du design par le client (Correction)
routes.put('/orders/items/:id/design', verifyToken, updateItemDesign);

// Route pour télécharger la facture
routes.get('/orders/:id/invoice', verifyToken, facture)

// ROUTES DE PAIEMENT (PAYSTACK)
routes.post('/payment/initialize', verifyTokenOptional, initializePayment); // Protégé par token optionnel pour les invités
routes.post('/payment/verify', verifyToken, verifyPayment);


//livraison
// LIRE TOUTES LES LIVRAISONS (READ)
routes.get('/deliveries', getDelivery)
// CRÉER UNE LIVRAISON (CREATE)
routes.post('/deliveries', verifyToken, verifyAdmin, createDelivery)
// METTRE À JOUR UNE LIVRAISON (UPDATE)
routes.put('/deliveries/:id', verifyToken, verifyAdmin, updateDelivery)
// SUPPRIMER UNE LIVRAISON (DELETE)
routes.delete('/deliveries/:id', verifyToken, verifyAdmin, deleteDelivery)


// Route pour uploader le design personnalisé (Accessible à tous pour personnalisation libre)
routes.post('/products/upload-design', upload.single('design'), uploadCustomDesign);

//pour l'ia (Routes publiques avec rate-limiting défini dans index.js)
routes.post('/chat', chatWithGemini);
routes.post('/ai/gift-advice', getGiftAdvice);
routes.post('/ai/generate-slogans', generateSlogans); // Nouveau ✍️
routes.get('/ai/list-models', verifyToken, verifyAdmin, listAiModels); // Diagnostic réservé Admin
// 👇 ROUTE POUR L'IMAGE : Publique pour permettre la personnalisation invitée
// (Protégée par le rateLimit global défini dans index.js)
routes.post('/ai/generate-design', generateTshirtDesign); 


// Route GET pour générer le rapport
routes.get('/reports/export', verifyToken, verifyAdmin, exportReport)

// Notifications
routes.get('/notifications', verifyToken, getUserNotifications);
routes.put('/notifications/:id/read', verifyToken, markAsRead);
routes.delete('/notifications/:id', verifyToken, deleteNotification);

// Recherche globale Admin
routes.get('/admin/search', verifyToken, verifyAdmin, globalSearch);

export default routes