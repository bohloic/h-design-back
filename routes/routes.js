
import 'dotenv/config';
import express from 'express'
import { upload } from '../middlewares/upload.js';
import { UpdateUser } from '../Controller/users/updateUser.js'
import { GetUser } from '../Controller/users/getUser.js'
import { GetOneUser } from '../Controller/users/getOneUser.js'
import { createUser } from '../Controller/users/createUser.js'
import { deleteUser } from '../Controller/users/deleteUser.js'
import { Login } from '../Controller/auth/login.js'
import { register } from '../Controller/auth/register.js'
import { createProduct } from '../Controller/products/createProduct.js'
import { getOneProduct } from '../Controller/products/getOneProduct.js'
import { updateProduct } from '../Controller/products/updateProduct.js'
import { deleteProduct } from '../Controller/products/deleteProduct.js'
import { GetProduct } from '../Controller/products/getProduct.js'
import { collectionActive, createCollection, deleteCollection, getAllCollections, updateCollection } from '../Controller/collections/collectionsController.js'
import {  commandeSelect, createOrder, getOrder, getOrderByEmail, getOrderByUser, getOrderItems, udpdateOrder } from '../Controller/order/orderController.js'
import { shopController } from '../Controller/products/shopcontroller.js'
import { createDelivery, deleteDelivery, getDelivery, updateDelivery } from '../Controller/deliveries/deliveriesController.js'
import { chatWithAI, generateDesignAI } from '../Controller/ia/aiController.js'
import { verifyAdmin, verifyToken } from '../middlewares/auth.js'
import { profil } from '../Controller/users/profile.js'
import { createCategory, deleteCategory, getCategory, updateCategory } from '../Controller/categories/categoriesController.js';
import { getMostViewedProducts, getProductByCollection, getProductBySlug, getProductsByCategoryAndGender } from '../Controller/products/productController.js';
import { uploadCustomDesign } from '../Controller/products/uploadController.js';
import { initializePayment, verifyPayment } from '../Controller/payment/paymentController.js';

//la gestion de route
const routes = express.Router()


// se connecter
routes.post('/login', Login)
//s'inscrire
routes.post('/register', register)

// pour l'utilisateur
// nouvelle utilisateur
routes.post("/users/create-user", createUser) 
//liste d'utilisateur
routes.get("/users/get-users", GetUser) 
//selectionner un seul utilisateur
routes.get("/users/get-user/:id", GetOneUser)
// Route de mise à jour utilisateur
routes.put("/users/update-user/:id", UpdateUser);
// La route de suppression utilisateur
routes.delete("/users/delete-user/:id", deleteUser);

//ou


// nouvelle utilisateur
routes.post("/users", createUser) 
//liste d'utilisateur
routes.get("/users", GetUser) 
//selectionner un seul utilisateur
routes.get("/users/:id", GetOneUser)
// Route de mise à jour utilisateur
routes.put("/users/:id", UpdateUser);
// La route de suppression utilisateur
routes.delete("/users/:id", deleteUser);
//selectionner un seul utilisateur
routes.get("/users/:id", GetOneUser)
// info utilisateur connecté
routes.get('/users/profile/:id', verifyToken, verifyAdmin, profil)



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
// selectionner produit par slug
routes.get('/products/:slug', getProductBySlug);
// pour selectionner tous les produits par  collection Route : /api/products/collection/5
routes.get('/products/collection/:id', getProductByCollection);



// pour les collections
// tous les collection
routes.get('/collections', getAllCollections);
// creer une nouvelle collection
routes.post('/collections/', createCollection);
// mettre à jour une collection
routes.put('/collections/:id', updateCollection);
// supprimer une collection
routes.delete('/collections/:id', deleteCollection);
//  Route pour les CATÉGORIES (Collections actives uniquement)
routes.get('/collections/active', collectionActive)





// pour les categories
// afficher categories
routes.get('/categories', getCategory)
// creer categories
routes.post('/categories', createCategory)
// mise à jour categories
routes.put('/categories/:id', updateCategory)
// supprimer categories
routes.delete('/categories/:id', deleteCategory)


// pour les commandes ou order
//afficher les commandes
routes.get('/orders', getOrder)
//creer une commandes
routes.post('/orders', verifyToken, createOrder)
//mettre à jour le statut
routes.put('/orders/:id/status', udpdateOrder)
// Récupérer la liste des commandes pour le select
routes.get('/orders', commandeSelect)
// afficher les details de commande
routes.get('/orders/:id', getOrderItems)
// afficher les commandes d'un utilisateur x
routes.get('/orders/my-orders/:id', verifyToken, getOrderByUser)
routes.get('/orders/my-orders/email/:email', verifyToken, getOrderByEmail)

// ROUTES DE PAIEMENT (PAYSTACK)
routes.post('/payment/initialize', verifyToken, initializePayment); // Protégé par token
routes.post('/payment/verify', verifyToken, verifyPayment);


//livraison
// LIRE TOUTES LES LIVRAISONS (READ)
routes.get('/deliveries', getDelivery)
// CRÉER UNE LIVRAISON (CREATE)
routes.post('/deliveries', createDelivery)
// METTRE À JOUR UNE LIVRAISON (UPDATE)
routes.put('/deliveries/:id', updateDelivery)
// SUPPRIMER UNE LIVRAISON (DELETE)
routes.delete('/deliveries/:id', deleteDelivery)


// Route pour uploader le design personnalisé (Accessible aux clients connectés)
routes.post('/products/upload-design', verifyToken, upload.single('design'), uploadCustomDesign);

//pour l'ia
// Quand le React envoie une requête POST sur /api/chat...
// ... on déclenche la fonction chatWithAI du contrôleur
routes.post('/chat', chatWithAI);
// 👇 NOUVELLE ROUTE POUR L'IMAGE
routes.post('/ia/generate-design', verifyToken, generateDesignAI); // verifyToken pour protéger (coût $)

export default routes