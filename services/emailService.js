import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * 📧 Configuration Nodemailer optimisée pour Mailjet (et Vercel Serverless)
 *
 * Variables d'environnement prioritaires pour Mailjet :
 * - MAILJET_API_KEY : Clé API Publique Mailjet (32 caractères)
 * - MAILJET_SECRET_KEY : Clé Secrète Mailjet (32 caractères)
 * - MAILJET_SENDER_EMAIL : Adresse email d'expéditeur validée dans Mailjet (ex: contact@votre-domaine.com)
 * - MAILJET_SENDER_NAME : Nom affiché (ex: "H-Designer")
 *
 * Variables de repli génériques :
 * - SMTP_HOST : 'in-v3.mailjet.com' par défaut
 * - SMTP_PORT : 465 (SSL) ou 587 (TLS)
 * - SMTP_USER / EMAIL_USER
 * - SMTP_PASS / EMAIL_PASS
 */

export const getEmailConfig = () => {
    const isMailjet = Boolean(process.env.MAILJET_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('mailjet')));
    const host = process.env.SMTP_HOST?.trim() || 'in-v3.mailjet.com';
    const port = parseInt(process.env.SMTP_PORT || (host.includes('mailjet') ? '465' : '587'), 10);
    const user = (process.env.MAILJET_API_KEY || process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const pass = (process.env.MAILJET_SECRET_KEY || process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();
    const senderEmail = (process.env.MAILJET_SENDER_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || user).trim();
    const senderName = process.env.MAILJET_SENDER_NAME || 'H-Designer';

    return {
        isMailjet,
        host,
        port,
        secure: port === 465,
        user,
        pass,
        senderEmail,
        senderName,
        fromHeader: `"${senderName}" <${senderEmail}>`
    };
};

export const createTransporter = () => {
    const config = getEmailConfig();

    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure, // true pour le port 465 SSL (recommandé Vercel)
        pool: false, // ⚠️ Crucial sur Serverless Vercel : chaque invocation est éphémère
        auth: {
            user: config.user,
            pass: config.pass
        },
        connectionTimeout: 10000, // 10 secondes max
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
            rejectUnauthorized: false
        }
    });
};

const transporter = createTransporter();

// 🔍 Diagnostic de connexion Mailjet / SMTP
export const verifyEmailConfiguration = async () => {
    const config = getEmailConfig();

    if (!config.user || !config.pass) {
        console.warn("\n========================================================");
        console.warn("⚠️ [MAILJET / EMAIL SERVICE] Clés API d'envoi manquantes !");
        console.warn("👉 Ajoutez dans votre fichier .env :");
        console.warn("   MAILJET_API_KEY=votre_cle_api_mailjet");
        console.warn("   MAILJET_SECRET_KEY=votre_cle_secrete_mailjet");
        console.warn("   MAILJET_SENDER_EMAIL=votre_email_valide_dans_mailjet");
        console.warn("========================================================\n");
        return false;
    }

    try {
        await transporter.verify();
        console.log(`✅ [EMAIL SERVICE] Connecté à Mailjet (${config.host}:${config.port}) avec succès !`);
        console.log(`📨 Expéditeur configuré : ${config.fromHeader}`);
        return true;
    } catch (err) {
        console.error("\n========================================================");
        console.error("⚠️ [EMAIL SERVICE] Échec de vérification Mailjet :");
        console.error(err.message || err);
        console.error("👉 Vérifiez :");
        console.error("   1. Que MAILJET_API_KEY et MAILJET_SECRET_KEY sont bien renseignés sans espaces.");
        console.error("   2. Que MAILJET_SENDER_EMAIL est bien validé dans votre compte Mailjet (Menu > Expéditeurs & Domaines).");
        console.error("   3. Que le port 465 ou 587 n'est pas bloqué par votre pare-feu local.");
        console.error("========================================================\n");
        return false;
    }
};

// --- 1. L'EMAIL DE FACTURE (PAIEMENT CONFIRMÉ) ---
export const sendOrderConfirmationEmail = async (userEmail, orderId, orderData, itemsData, pdfBuffer) => {
    const config = getEmailConfig();

    try {
        const formatMoney = (amount) => Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        
        const itemsHtml = itemsData.map(item => `
            <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px;">${item.name || 'Article personnalisé'}</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: center; font-size: 14px;">${item.quantity}</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right; font-weight: bold; font-size: 14px;">${formatMoney(item.price * item.quantity)} FCFA</td>
            </tr>
        `).join('');

        const subtotal = itemsData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingFee = orderData.shipping_fee || 0;

        const mailOptions = {
            from: config.fromHeader,
            to: userEmail,
            subject: `🎉 Confirmation de votre commande #HD-${String(orderId).padStart(5, '0')} - H-Designer`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="background-color: #0f172a; padding: 35px 20px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 30px; letter-spacing: 2px;">H-Designer</h1>
                        <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Vos créations uniques prennent vie</p>
                    </div>
                    
                    <div style="padding: 30px 25px; background-color: #ffffff;">
                        <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Bonjour ${orderData.customer_name || 'Client'},</h2>
                        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                            Un grand merci pour votre confiance ! Nous avons bien reçu votre paiement. Voici le récapitulatif de votre commande :
                        </p>

                        <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #0F4C3A; margin: 25px 0;">
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
                                <p style="margin: 10px 0 0 0; color: #0F4C3A; font-size: 18px; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 10px;">Total Payé : <span style="display: inline-block; width: 100px;">${formatMoney(orderData.total_amount)} FCFA</span></p>
                            </div>
                        </div>

                        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                            Votre facture officielle est jointe à cet email au format PDF.
                        </p>

                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 35px 0 25px 0;">
                        
                        <div style="text-align: center;">
                            <p style="color: #1e293b; font-weight: bold; font-size: 16px; margin: 0 0 10px 0;">L'équipe H-Designer</p>
                            <p style="color: #64748b; font-size: 13px; margin: 0;">WhatsApp : +225 01 72 32 27 27</p>
                        </div>
                    </div>
                </div>
            `,
            attachments: pdfBuffer ? [{ filename: `Facture_H-Designer_${orderId}.pdf`, content: pdfBuffer }] : []
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`📧 ✅ [Mailjet] Facture envoyée à ${userEmail} (MessageId: ${result.messageId})`);
        return result;
    } catch (error) {
        console.error("❌ [Mailjet] Erreur lors de l'envoi de la facture :", error.message || error);
        throw error;
    }
};

// --- 2. L'EMAIL DE VÉRIFICATION OTP (INSCRIPTION) ---
export const sendVerificationEmail = async (userEmail, userName, code) => {
    const config = getEmailConfig();

    try {
        const mailOptions = {
            from: config.fromHeader,
            to: userEmail.trim().toLowerCase(),
            subject: `🔐 ${code} est votre code de sécurité H-Designer`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h2 style="color: #0F4C3A; margin: 0; font-size: 24px;">Bienvenue chez H-Designer, ${userName || 'Cher Client'} !</h2>
                        <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Activez votre compte pour finaliser vos commandes en toute sécurité.</p>
                    </div>

                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 24px; text-align: center; border-radius: 12px; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0F4C3A; font-family: monospace;">${code}</span>
                    </div>

                    <p style="color: #475569; font-size: 14px; line-height: 1.5; text-align: center;">
                        Ce code est valable pendant <strong>15 minutes</strong>. Ne le partagez avec personne.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                    
                    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
                    </p>
                </div>
            `
        };

        if (process.env.NODE_ENV !== 'production' || !config.user) {
            console.log(`🔐 [OTP SECURE LOG] Code de vérification pour ${userEmail} (${userName}) : [ ${code} ]`);
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 ✅ [Mailjet] Code OTP envoyé avec succès à ${userEmail} (ID: ${info.messageId})`);
        return info;
    } catch (error) {
        console.error("❌ [Mailjet] Erreur email vérification OTP :", error.message || error);
        console.log(`\n======================================================`);
        console.log(`🔐 [CODE OTP DE SECOURS AFFICHÉ EN CONSOLE]`);
        console.log(`Destinataire : ${userEmail} (${userName})`);
        console.log(`CODE OTP     : [ ${code} ]`);
        console.log(`Valable 15 minutes.`);
        console.log(`======================================================\n`);
        throw error;
    }
};

// --- 3. L'EMAIL DE MOT DE PASSE OUBLIÉ ---
export const sendPasswordResetEmail = async (userEmail, resetToken) => {
    const config = getEmailConfig();
    const resetLink = `${process.env.FRONTEND_URL || 'https://h-design-v1.vercel.app'}/reset-password?token=${resetToken}`;

    try {
        const mailOptions = {
            from: config.fromHeader,
            to: userEmail.trim().toLowerCase(),
            subject: `🔑 Réinitialisation de votre mot de passe H-Designer`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h2 style="color: #0f172a; margin: 0; font-size: 24px;">Mot de passe oublié ?</h2>
                        <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Pas d'inquiétude, cliquez ci-dessous pour choisir un nouveau mot de passe :</p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #0F4C3A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; font-size: 15px;">
                            Réinitialiser mon mot de passe
                        </a>
                    </div>

                    <p style="color: #64748b; font-size: 13px; text-align: center;">
                        Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 ✅ [Mailjet] Lien de réinitialisation envoyé à ${userEmail} (ID: ${info.messageId})`);
        return info;
    } catch (error) {
        console.error("❌ [Mailjet] Erreur email reset :", error.message || error);
        console.log(`\n======================================================`);
        console.log(`🔑 [LIEN DE RÉINITIALISATION DE SECOURS]`);
        console.log(`Destinataire : ${userEmail}`);
        console.log(`Lien         : ${resetLink}`);
        console.log(`======================================================\n`);
        throw error;
    }
};