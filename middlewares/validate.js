import { z } from 'zod';

/**
 * validate.js — Middleware de Validation Stricte des Données avec Zod (OWASP A03 / A04)
 * ────────────────────────────────────────────────────────────────────────────────
 * Bloque les requêtes malformées avant qu'elles n'atteignent les contrôleurs ou la DB.
 * Empêche les crashs de type "Cannot read properties of undefined" et les injections de charge utile.
 */

export const validate = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Remplace req.body par les données assainies et typées par Zod
    if (validated.body !== undefined) req.body = validated.body;
    if (validated.query !== undefined) req.query = validated.query;
    if (validated.params !== undefined) req.params = validated.params;

    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => ({
        champ: i.path.join('.').replace(/^body\./, ''),
        message: i.message,
      }));

      return res.status(400).json({
        success: false,
        message: issues[0]?.message || "Données d'entrée invalides.",
        errors: issues,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Erreur de validation des données.",
    });
  }
};

// ==============================================================================
// 📋 SCHÉMAS DE VALIDATION ZOD
// ==============================================================================

export const registerSchema = z.object({
  body: z.object({
    nom: z.string().min(2, "Le nom doit comporter au moins 2 caractères.").max(50, "Le nom est trop long."),
    prenom: z.string().min(2, "Le prénom doit comporter au moins 2 caractères.").max(50, "Le prénom est trop long."),
    email: z.string().email("Adresse email invalide.").max(120),
    password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères."),
    phone: z.string().optional().refine((val) => {
      if (!val) return true;
      const clean = val.replace(/\s+/g, '');
      return /^(\+225)?(01|05|07)\d{8}$/.test(clean);
    }, "Le numéro doit être un numéro mobile ivoirien valide à 10 chiffres (01, 05 ou 07).")
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Adresse email invalide."),
    password: z.string().min(1, "Le mot de passe est obligatoire.")
  })
});

export const orderCreationSchema = z.object({
  body: z.object({
    userId: z.union([z.number(), z.string()]).optional(),
    cartItems: z.array(z.object({
      id: z.union([z.number(), z.string()]),
      name: z.string().min(1),
      price: z.number().nonnegative(),
      quantity: z.number().int().positive(),
      options: z.record(z.any()).optional(),
      customization: z.any().optional(),
    })).min(1, "Le panier doit contenir au moins un article."),
    shippingDetails: z.object({
      nom: z.string().min(1, "Le nom est obligatoire."),
      prenom: z.string().min(1, "Le prénom est obligatoire."),
      email: z.string().email("Adresse email de livraison invalide."),
      address: z.string().min(5, "L'adresse de livraison doit comporter au moins 5 caractères."),
      city: z.string().min(2, "La commune ou ville est obligatoire."),
      phone: z.string().refine((val) => {
        const clean = val.replace(/\s+/g, '');
        return /^(\+225)?(01|05|07)\d{8}$/.test(clean);
      }, "Le numéro de téléphone de livraison doit comporter 10 chiffres (01, 05 ou 07).")
    }),
    paymentMethod: z.string().min(1),
    totalAmount: z.number().nonnegative().optional(),
    useLoyaltyPoints: z.boolean().optional(),
  })
});
