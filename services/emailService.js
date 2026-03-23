import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Configuration de la connexion à Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- 1. L'EMAIL DE FACTURE (PAIEMENT) ---
export const sendOrderConfirmationEmail = async (userEmail, orderId, orderData, itemsData, pdfBuffer) => {
    try {
        const formatMoney = (amount) => Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        
        const itemsHtml = itemsData.map(item => `
            <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px;">${item.name || 'T-shirt personnalisé'}</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: center; font-size: 14px;">${item.quantity}</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right; font-weight: bold; font-size: 14px;">${formatMoney(item.price * item.quantity)} FCFA</td>
            </tr>
        `).join('');

        const subtotal = itemsData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingFee = orderData.shipping_fee || 0;

        const mailOptions = {
            from: `"H-designer" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: `🎉 Confirmation de votre commande #HD-${String(orderId).padStart(5, '0')} - H-designer`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="background-color: #0f172a; padding: 35px 20px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 30px; letter-spacing: 2px;">H-designer</h1>
                        <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Vos créations uniques prennent vie</p>
                    </div>
                    
                    <div style="padding: 30px 25px; background-color: #ffffff;">
                        <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Bonjour ${orderData.customer_name},</h2>
                        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                            Un grand merci pour votre confiance ! Nous avons bien reçu votre paiement. Voici le récapitulatif de votre commande :
                        </p>

                        <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #dc2626; margin: 25px 0;">
                            <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #0f172a;">📍 Détails de Livraison</h3>
                            <p style="margin: 0 0 8px 0; font-size: 14px; color: #475569;">Téléphone : <strong style="color: #1e293b;">${orderData.phone || 'Non renseigné'}</strong></p>
                            <p style="margin: 0; font-size: 14px; color: #475569;">Adresse : <strong style="color: #1e293b;">${orderData.shipping_address || 'Non renseignée'}</strong></p>
                        </div>

                        <div style="margin: 30px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background-color: #f8fafc;">
                                        <th style="padding: 12px 15px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Article</th>
                                        <th style="padding: 12px 15px; text-align: center; color: #64748b; font-size: 12px; text-transform: uppercase;">Qté</th>
                                        <th style="padding: 12px 15px; text-align: right; color: #64748b; font-size: 12px; text-transform: uppercase;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>
                            
                            <div style="background-color: #f8fafc; padding: 15px; text-align: right;">
                                <p style="margin: 0 0 5px 0; color: #64748b; font-size: 14px;">Sous-total : <span style="color: #1e293b; display: inline-block; width: 100px;">${formatMoney(subtotal)} FCFA</span></p>
                                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Livraison : <span style="color: #1e293b; display: inline-block; width: 100px;">${formatMoney(shippingFee)} FCFA</span></p>
                                <p style="margin: 10px 0 0 0; color: #dc2626; font-size: 18px; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 10px;">Total Payé : <span style="display: inline-block; width: 100px;">${formatMoney(orderData.total_amount)} FCFA</span></p>
                            </div>
                        </div>

                        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                            Votre facture officielle est jointe à cet email au format PDF.
                        </p>

                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 35px 0 25px 0;">
                        
                        <div style="text-align: center;">
                            <p style="color: #1e293b; font-weight: bold; font-size: 16px; margin: 0 0 10px 0;">L'équipe H-designer</p>
                            <p style="color: #64748b; font-size: 13px; margin: 0;">WhatsApp : +225 01 72 32 27 27</p>
                        </div>
                    </div>
                </div>
            `,
            attachments: pdfBuffer ? [{ filename: `Facture_H-designer_${orderId}.pdf`, content: pdfBuffer }] : []
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 ✅ Email unique et détaillé envoyé à ${userEmail} !`);
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de l'email :", error);
    }
};

// --- 2. L'EMAIL DE VÉRIFICATION (INSCRIPTION) ---
export const sendVerificationEmail = async (userEmail, userName, code) => {
    try {
        const mailOptions = {
            from: `"H-designer" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: `🔐 Votre code de sécurité H-designer`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <h2 style="color: #0f172a;">Bienvenue chez H-designer, ${userName} !</h2>
                    <p style="color: #475569; font-size: 16px;">Pour valider la création de votre compte, veuillez utiliser le code de sécurité ci-dessous :</p>
                    
                    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #dc2626;">${code}</span>
                    </div>
                    
                    <p style="color: #64748b; font-size: 14px;">Ce code est valable pendant 15 minutes. S'il n'a pas été demandé par vous, ignorez simplement cet email.</p>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`📧 Code de vérification envoyé à ${userEmail}`);
    } catch (error) {
        console.error("❌ Erreur email vérification:", error);
    }
};

// --- 3. L'EMAIL DE MOT DE PASSE OUBLIÉ ---
export const sendPasswordResetEmail = async (userEmail, resetToken) => {
    try {
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        
        const mailOptions = {
            from: `"H-designer" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: `🔑 Réinitialisation de votre mot de passe H-designer`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <h2 style="color: #0f172a;">Mot de passe oublié ?</h2>
                    <p style="color: #475569; font-size: 16px;">Pas de panique ! Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe sécurisé :</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Réinitialiser mon mot de passe</a>
                    </div>
                    
                    <p style="color: #64748b; font-size: 14px;">Ce lien est valable pendant 1 heure. Si vous n'avez rien demandé, votre compte est toujours en sécurité.</p>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`📧 Lien de réinitialisation envoyé à ${userEmail}`);
    } catch (error) {
        console.error("❌ Erreur email reset:", error);
    }
};