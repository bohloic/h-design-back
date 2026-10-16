
import 'dotenv/config';
import express from 'express'
import { upload, validateImageBuffer } from '../middlewares/upload.js';
import { logout } from '../Controller/auth/logout.js';
import { getCurrentUser } from '../Controller/auth/me.js';
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
import { cancelOrder, commandeSelect, createOrder, getOrder, getOrderByEmail, getOrderByUser, getOrderItems, trackOrderPublic, updateItemDesign, updateOrderStatus, validateOrderDesign } from '../Controller/order/orderController.js'
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
import { getAuditLogs } from '../utils/auditLogger.js';
import { checkHealth } from '../Controller/health/healthController.js';
import { handleMailjetWebhook, getMailjetWebhookInfo } from '../Controller/webhooks/mailjetWebhookController.js';
import { validate, loginSchema, registerSchema, orderCreationSchema } from '../middlewares/validate.js';
import { cacheMiddleware } from '../middlewares/cacheMiddleware.js';

//la gestion de route
const routes = express.Router()

// 🩺 SURVEILLANCE & UPTIME MONITORING (Better Uptime / UptimeRobot / Pingdom)
routes.get('/health', checkHealth);

// 📧 WEBHOOKS MAILJET (Event API : Sent, Bounce, Blocked, Spam, Open, Click)
// Documentation : https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview
routes.post('/webhooks/mailjet', handleMailjetWebhook);
routes.get('/webhooks/mailjet', getMailjetWebhookInfo);


// ðŸŽ¯ PRIORITÃ‰ : Route des commandes
routes.get('/orders', verifyToken, verifyAdmin, getOrder);


// se connecter
routes.post('/login', validate(loginSchema), login)
routes.post('/logout', logout)
routes.post('/auth/logout', logout)
routes.get('/auth/me', verifyToken, getCurrentUser)
//s'inscrire
routes.post('/register', validate(registerSchema), register)
// verifier email
routes.post('/verify-email', verifyEmailCode);
// mot de passe oubliÃ©
routes.post('/forgot-password', forgotPassword);
routes.post('/reset-password', resetPassword);
routes.post('/resend-verification', resendVerification);

// pour l'utilisateur
// nouvelle utilisateur (Admin seul ou Inscription publique via /register)
routes.post("/users/create-user", verifyToken, verifyAdmin, createUser)
//liste d'utilisateur (Admin seul)
routes.get("/users/get-users", verifyToken, verifyAdmin, GetUser)
//selectionner un seul utilisateur (Admin ou PropriÃ©taire)
routes.get("/users/get-user/:id", verifyToken, verifyOwnerOrAdmin, GetOneUser)
// Route de mise Ã  jour utilisateur (Admin ou PropriÃ©taire)
routes.put("/users/update-user/:id", verifyToken, verifyOwnerOrAdmin, UpdateUser);
// La route de suppression utilisateur (Admin seul)
routes.delete("/users/delete-user/:id", verifyToken, verifyAdmin, deleteUser);

//ou


// nouvelle utilisateur (Admin seul)
routes.post("/users", verifyToken, verifyAdmin, createUser)
//liste d'utilisateur (Admin seul)
routes.get("/users", verifyToken, verifyAdmin, GetUser)
//selectionner un seul utilisateur (Admin ou PropriÃ©taire)
// âœ… FIX #5 : /users/profile/:id DOIT Ãªtre AVANT /users/:id
// info utilisateur connectÃ©
routes.get('/users/profile/:id', verifyToken, verifyAdmin, profil)
//selectionner un seul utilisateur (Admin ou PropriÃ©taire)
routes.get("/users/:id", verifyToken, verifyOwnerOrAdmin, GetOneUser)
// Route de mise Ã  jour utilisateur (Admin ou PropriÃ©taire)
routes.put("/users/:id", verifyToken, verifyOwnerOrAdmin, UpdateUser);
// La route de suppression utilisateur (Admin seul)
routes.delete("/users/:id", verifyToken, verifyAdmin, deleteUser);
// Route pour la carte de fidÃ©litÃ© VIP
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
routes.get("/products/get-product", cacheMiddleware(60), GetProduct)
//selectionner un seul produit
routes.get("/products/get-product/:id", getOneProduct)
// Route de mise Ã  jour produit
routes.put("/products/update-product/:id", verifyToken, verifyAdmin, updateProduct);
// La route de suppression
routes.delete("/products/delete-product/:id", verifyToken, verifyAdmin, deleteProduct);
// Route pour filtrer : /api/products/filter?categoryId=1&gender=homme
routes.get('/products/filter', getProductsByCategoryAndGender);
//  Route pour les PRODUITS (avec le nom de la collection)
routes.get('/products/shop', cacheMiddleware(60), shopController)
// afficher les produits les plus vue
routes.get('/products/trending', cacheMiddleware(60), getMostViewedProducts);
// âœ… FIX #1 : /products/collection/:id DOIT Ãªtre AVANT /products/:slug
// pour selectionner tous les produits par collection Route : /api/products/collection/5
routes.get('/products/collection/:id', getProductByCollection);
// selectionner produit par slug (route gÃ©nÃ©rique en DERNIER)
routes.get('/products/:slug', getProductBySlug);



// pour les collections
//  Route pour les CATÃ‰GORIES (Collections actives uniquement)
// IMPORTANT: Doit Ãªtre AVANT /collections/:id
routes.get('/collections/active', cacheMiddleware(60), getActiveCollection)

// tous les collection
routes.get('/collections', cacheMiddleware(60), getCollections);
// creer une nouvelle collection
routes.post('/collections/', verifyToken, verifyAdmin, createCollection);
// mettre Ã  jour une collection
routes.put('/collections/:id', verifyToken, verifyAdmin, updateCollection);
// supprimer une collection
routes.delete('/collections/:id', verifyToken, verifyAdmin, deleteCollection);





// pour les categories
// afficher categories
routes.get('/categories', cacheMiddleware(60), getCategory)
// creer categories
routes.post('/categories', verifyToken, verifyAdmin, createCategory)
// mise Ã  jour categories
routes.put('/categories/:id', verifyToken, verifyAdmin, updateCategory)
// supprimer categories
routes.delete('/categories/:id', verifyToken, verifyAdmin, deleteCategory)


// pour les commandes ou order
//afficher les commandes
// routes.get('/orders', verifyToken, getOrder)
//creer une commande (Authentification obligatoire + Validation Zod stricte)
routes.post('/orders', verifyToken, validate(orderCreationSchema), createOrder)
// 🔎 Suivi public sécurisé de commande sans authentification (Audit SAV)
routes.get('/orders/track/:reference', trackOrderPublic)
//mettre Ã  jour le statut
routes.put('/orders/:id/status', verifyToken, verifyAdmin, updateOrderStatus)
// RÃ©cupÃ©rer la liste des commandes pour le select
routes.get('/orders-select', verifyToken, verifyAdmin, commandeSelect)
// âœ… FIX #2 : /orders/my-orders DOIT Ãªtre AVANT /orders/:id
// afficher les commandes d'un utilisateur x
routes.get('/orders/my-orders/:id', verifyToken, getOrderByUser)
routes.get('/users/:id/orders', verifyToken, getOrderByUser)
routes.get('/orders/my-orders/email/:email', verifyToken, getOrderByEmail)
// afficher les details de commande (route gÃ©nÃ©rique en DERNIER)
routes.get('/orders/:id', verifyToken, getOrderItems)
// Validation du design par la designer depuis orderDetailsView.tsx
routes.put('/orders/:id/validate-design', verifyToken, verifyAdmin, validateOrderDesign);
// Validation du design par la designer depuis autre
routes.get('/admin/orders', verifyToken, verifyAdmin, getAllOrdersWithItems);
routes.put('/admin/orders/:id/validate-design', verifyToken, verifyAdmin, validateDesign);
routes.put('/admin/orders/:id/validate-items', verifyToken, verifyAdmin, validateItemsDesign);
routes.get('/admin/badges', verifyToken, verifyAdmin, getAdminBadges);
routes.put('/admin/orders/:id/seen', verifyToken, verifyAdmin, markOrderAsSeen);

// Mise Ã  jour du design par le client (Correction)
routes.put('/orders/items/:id/design', verifyToken, updateItemDesign);

// Annulation de commande par le client
routes.put('/orders/:id/cancel', verifyToken, cancelOrder);

// Route pour tÃ©lÃ©charger la facture
routes.get('/orders/:id/invoice', verifyToken, facture)

// ROUTES DE PAIEMENT (PAYSTACK)
routes.post('/payment/initialize', verifyTokenOptional, initializePayment); // ProtÃ©gÃ© par token optionnel pour les invitÃ©s
routes.post('/payment/verify', verifyToken, verifyPayment);


//livraison
// LIRE TOUTES LES LIVRAISONS (READ)
routes.get('/deliveries', getDelivery)
// CRÃ‰ER UNE LIVRAISON (CREATE)
routes.post('/deliveries', verifyToken, verifyAdmin, createDelivery)
// METTRE Ã€ JOUR UNE LIVRAISON (UPDATE)
routes.put('/deliveries/:id', verifyToken, verifyAdmin, updateDelivery)
// SUPPRIMER UNE LIVRAISON (DELETE)
routes.delete('/deliveries/:id', verifyToken, verifyAdmin, deleteDelivery)


// Route pour uploader le design personnalisÃ© (Accessible Ã  tous pour personnalisation libre)
routes.post('/products/upload-design', upload.single('design'), validateImageBuffer, uploadCustomDesign);

//pour l'ia (Routes publiques avec rate-limiting dÃ©fini dans index.js)
routes.post('/chat', chatWithGemini);
routes.post('/ai/gift-advice', getGiftAdvice);
routes.post('/ai/generate-slogans', generateSlogans); // Nouveau âœï¸
routes.get('/ai/list-models', verifyToken, verifyAdmin, listAiModels); // Diagnostic rÃ©servÃ© Admin
// ðŸ‘‡ ROUTE POUR L'IMAGE : Publique pour permettre la personnalisation invitÃ©e
// (ProtÃ©gÃ©e par le rateLimit global dÃ©fini dans index.js)
routes.post('/ai/generate-design', generateTshirtDesign); 


// Route GET pour gÃ©nÃ©rer le rapport
routes.get('/reports/export', verifyToken, verifyAdmin, exportReport)

// Notifications
routes.get('/notifications', verifyToken, getUserNotifications);
routes.put('/notifications/:id/read', verifyToken, markAsRead);
routes.delete('/notifications/:id', verifyToken, deleteNotification);

// Recherche globale Admin
routes.get('/admin/search', verifyToken, verifyAdmin, globalSearch);

// 🛡️ Traçabilité et Audit Trail (Admin uniquement - OWASP Logging & Monitoring)
routes.get('/admin/audit-logs', verifyToken, verifyAdmin, getAuditLogs);

export default routes;
