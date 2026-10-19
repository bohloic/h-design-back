import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * 📧 Configuration Email Hybride (Mailjet REST API v3.1 HTTPS + Repli SMTP Nodemailer)
 *
 * ⚠️ POURQUOI L'API REST HTTPS EST CRUCIALE SUR VERCEL :
 * Les environnements Serverless (Vercel / AWS Lambda) bloquent ou coupent fréquemment
 * les sockets TCP bruts vers les ports SMTP 25, 465 et 587, provoquant des erreurs 502
 * dues à des timeouts de 10 secondes.
 * L'API REST HTTPS v3.1 de Mailjet (https://api.mailjet.com/v3.1/send sur le port 443)
 * traverse nativement tous les pare-feux et livre l'email en moins de 300 millisecondes.
 */

export const getEmailConfig = () => {
    const apiKey = (
        process.env.MAILJET_API_KEY || 
        process.env.MJ_APIKEY_PUBLIC || 
        process.env.MAILJET_PUBLIC_KEY || 
        process.env.SMTP_USER || 
        process.env.EMAIL_USER || 
        ''
    ).trim();

    const secretKey = (
        process.env.MAILJET_SECRET_KEY || 
        process.env.MJ_APIKEY_PRIVATE || 
        process.env.MAILJET_PRIVATE_KEY || 
        process.env.SMTP_PASS || 
        process.env.EMAIL_PASS || 
        ''
    ).trim();

    const senderEmail = (
        process.env.MAILJET_SENDER_EMAIL || 
        process.env.MJ_SENDER_EMAIL || 
        process.env.EMAIL_FROM || 
        process.env.EMAIL_USER || 
        'konanboh99@gmail.com'
    ).trim().replace(/^["']|["']$/g, '');

    const senderName = (
        process.env.MAILJET_SENDER_NAME || 
        process.env.MJ_SENDER_NAME || 
        'H-Designer'
    ).trim().replace(/^["']|["']$/g, '');

    const isGmail = (
        process.env.EMAIL_PROVIDER === 'gmail' || 
        (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('gmail')) ||
        Boolean(process.env.EMAIL_PASS && !process.env.MAILJET_API_KEY)
    );

    const host = (process.env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'in-v3.mailjet.com')).trim();
    const port = parseInt(process.env.SMTP_PORT || (host.includes('mailjet') || host.includes('gmail') ? '465' : '587'), 10);
    const isMailjet = Boolean((apiKey || host.includes('mailjet')) && !isGmail);

    const user = isGmail ? (process.env.EMAIL_USER || senderEmail) : apiKey;
    const pass = isGmail ? (process.env.EMAIL_PASS || secretKey) : secretKey;

    return {
        isMailjet,
        isGmail,
        apiKey,
        secretKey,
        senderEmail,
        senderName,
        fromHeader: `"${senderName}" <${senderEmail}>`,
        host,
        port,
        secure: port === 465,
        user,
        pass
    };
};

export const createTransporter = () => {
    const config = getEmailConfig();

    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        pool: false,
        auth: {
            user: config.user,
            pass: config.pass
        },
        connectionTimeout: 3000,
        greetingTimeout: 3000,
        socketTimeout: 3000,
        tls: {
            rejectUnauthorized: false
        }
    });
};

const transporter = createTransporter();

/**
 * 🚀 Envoi d'email via l'API REST HTTPS v3.1 de Mailjet (Port 443)
 */
export const sendViaMailjetRestApi = async ({ to, toName, subject, html, text, attachments = [] }) => {
    const config = getEmailConfig();
    const apiKey = config.apiKey;
    const secretKey = config.secretKey;

    if (!apiKey || !secretKey) {
        throw new Error("Clés API Mailjet manquantes (MAILJET_API_KEY ou MAILJET_SECRET_KEY non configurés)");
    }

    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

    const formattedAttachments = attachments.map(att => {
        let base64Content = '';
        if (Buffer.isBuffer(att.content)) {
            base64Content = att.content.toString('base64');
        } else if (typeof att.content === 'string') {
            base64Content = Buffer.from(att.content).toString('base64');
        }

        return {
            ContentType: att.contentType || 'application/pdf',
            Filename: att.filename || 'piece-jointe',
            Base64Content: base64Content
        };
    });

    const payload = {
        Messages: [
            {
                From: {
                    Email: config.senderEmail,
                    Name: config.senderName
                },
                To: [
                    {
                        Email: to.trim().toLowerCase(),
                        Name: toName || to
                    }
                ],
                Subject: subject,
                HTMLPart: html,
                ...(text ? { TextPart: text } : {}),
                ...(formattedAttachments.length > 0 ? { Attachments: formattedAttachments } : {})
            }
        ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s max pour ne jamais atteindre la limite Vercel

    try {
        const response = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errMsg = data?.ErrorMessage || data?.message || `Erreur HTTP ${response.status} de l'API Mailjet`;
            console.error("❌ [Mailjet REST API Error]:", response.status, errMsg, data);
            throw new Error(errMsg);
        }

        const firstMsg = data?.Messages?.[0];
        if (firstMsg?.Status !== 'success') {
            const errorDetail = firstMsg?.Errors?.map(e => e.ErrorMessage).join(', ') || `Statut Mailjet: ${firstMsg?.Status}`;
            console.error("❌ [Mailjet Delivery Error]:", errorDetail, firstMsg);
            throw new Error(errorDetail);
        }

        const messageId = firstMsg?.To?.[0]?.MessageID || firstMsg?.To?.[0]?.MessageUUID || 'N/A';
        console.log(`📧 ✅ [Mailjet REST API] Email envoyé avec succès à ${to} (MessageID: ${messageId})`);
        return {
            success: true,
            messageId,
            provider: 'mailjet_rest',
            raw: data
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error("Délai d'attente dépassé (4.5s) lors de l'appel à l'API Mailjet.");
        }
        throw err;
    }
};

/**
 * 📨 Repli automatique Nodemailer SMTP (Hors serverless uniquement)
 */
export const sendViaNodemailerSmtp = async ({ to, toName, subject, html, text, attachments = [] }) => {
    const config = getEmailConfig();

    const mailOptions = {
        from: config.fromHeader,
        to: to.trim().toLowerCase(),
        subject,
        html,
        ...(text ? { text } : {}),
        attachments: attachments.map(att => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType
        }))
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 ✅ [SMTP Nodemailer] Email envoyé avec succès à ${to} (ID: ${info.messageId})`);
    return {
        success: true,
        messageId: info.messageId,
        provider: 'nodemailer_smtp',
        raw: info
    };
};

/**
 * 🛡️ Envoi universel : Resend REST API -> Gmail SMTP -> Mailjet REST API -> Repli SMTP
 */
export const sendEmail = async ({ to, toName, subject, html, text, attachments = [] }) => {
    const config = getEmailConfig();

    // 1. Si Resend est configuré (API REST HTTPS Port 443 - 3 000 emails/mois)
    if (process.env.RESEND_API_KEY) {
        try {
            return await sendViaResendRestApi({ to, toName, subject, html, text, attachments });
        } catch (resendErr) {
            console.error("❌ [EmailService] Échec Resend API :", resendErr.message || resendErr);
        }
    }

    // 2. Si Gmail SMTP est sélectionné ou configuré (500 emails/jour gratuits sans rejet DMARC)
    if (config.isGmail && config.pass) {
        try {
            return await sendViaNodemailerSmtp({ to, toName, subject, html, text, attachments });
        } catch (gmailErr) {
            console.error("❌ [EmailService] Échec Gmail SMTP :", gmailErr.message || gmailErr);
            throw new Error(`Échec de l'envoi via Gmail : ${gmailErr.message}`);
        }
    }

    // 3. Tenter l'API REST HTTPS Mailjet si les clés API sont configurées
    if (config.apiKey && config.secretKey && config.isMailjet) {
        try {
            return await sendViaMailjetRestApi({ to, toName, subject, html, text, attachments });
        } catch (restErr) {
            console.error(`❌ [EmailService] Échec API REST Mailjet :`, restErr.message || restErr);
            throw new Error(`Échec de l'envoi de l'email via l'API Mailjet : ${restErr.message}`);
        }
    }

    // 4. Repli vers SMTP Nodemailer générique si configuré
    if (config.user && config.pass) {
        return await sendViaNodemailerSmtp({ to, toName, subject, html, text, attachments });
    }

    throw new Error("Service d'envoi d'email indisponible : Aucune méthode d'envoi valide configurée (Gmail SMTP, Resend ou Mailjet).");
};

/**
 * 🚀 Envoi d'email via l'API REST HTTPS de Resend (https://resend.com - Port 443)
 */
export const sendViaResendRestApi = async ({ to, toName, subject, html, text, attachments = [] }) => {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) throw new Error("Clé RESEND_API_KEY manquante");
    const config = getEmailConfig();

    const formattedAttachments = attachments.map(att => ({
        filename: att.filename || 'piece-jointe',
        content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : (typeof att.content === 'string' ? Buffer.from(att.content).toString('base64') : att.content)
    }));

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            from: config.fromHeader,
            to: [to.trim().toLowerCase()],
            subject,
            html,
            ...(text ? { text } : {}),
            ...(formattedAttachments.length > 0 ? { attachments: formattedAttachments } : {})
        }),
        signal: AbortSignal.timeout(5000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.message || `Erreur HTTP ${response.status} de l'API Resend`);
    }

    console.log(`📧 ✅ [Resend API] Email envoyé avec succès à ${to} (ID: ${data.id})`);
    return {
        success: true,
        messageId: data.id,
        provider: 'resend',
        raw: data
    };
};

/**
 * 🔍 Diagnostic de connexion Mailjet / SMTP
 */
export const verifyEmailConfiguration = async () => {
    const config = getEmailConfig();

    if (!config.apiKey || !config.secretKey) {
        console.warn("\n========================================================");
        console.warn("⚠️ [MAILJET / EMAIL SERVICE] Clés API d'envoi manquantes !");
        console.warn("👉 Ajoutez dans vos variables d'environnement Vercel :");
        console.warn("   MAILJET_API_KEY=votre_cle_api_mailjet");
        console.warn("   MAILJET_SECRET_KEY=votre_cle_secrete_mailjet");
        console.warn("   MAILJET_SENDER_EMAIL=konanboh99@gmail.com");
        console.warn("========================================================\n");
        return false;
    }

    // 1. Test via l'API REST HTTPS Mailjet
    try {
        const auth = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');
        const res = await fetch('https://api.mailjet.com/v3/REST/user', {
            headers: { 'Authorization': `Basic ${auth}` },
            signal: AbortSignal.timeout(4000)
        });

        if (res.ok) {
            const data = await res.json();
            const user = data?.Data?.[0];
            console.log(`✅ [EMAIL SERVICE] Connecté à l'API REST HTTPS Mailjet avec succès ! (Utilisateur: ${user?.Username || user?.Email || 'OK'})`);
            console.log(`📨 Expéditeur configuré : ${config.fromHeader}`);
            return true;
        }
    } catch (e) {
        console.warn("⚠️ [EMAIL SERVICE] Erreur lors du test HTTPS REST Mailjet :", e.message || e);
    }

    // 2. Test via SMTP (hors serverless)
    if (!process.env.VERCEL) {
        try {
            await transporter.verify();
            console.log(`✅ [EMAIL SERVICE] Connecté à Mailjet via SMTP (${config.host}:${config.port})`);
            return true;
        } catch (err) {
            console.error("❌ [EMAIL SERVICE] Échec de vérification Mailjet SMTP :", err.message || err);
            return false;
        }
    }

    return false;
};

// --- 1. L'EMAIL DE FACTURE (PAIEMENT CONFIRMÉ) ---
export const sendOrderConfirmationEmail = async (userEmail, orderId, orderData, itemsData, pdfBuffer) => {
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

        const html = `
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
        `;

        const attachments = pdfBuffer ? [{
            filename: `Facture_H-Designer_${orderId}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }] : [];

        return await sendEmail({
            to: userEmail,
            toName: orderData.customer_name || 'Client',
            subject: `🎉 Confirmation de votre commande #HD-${String(orderId).padStart(5, '0')} - H-Designer`,
            html,
            attachments
        });
    } catch (error) {
        console.error("❌ [EmailService] Erreur lors de l'envoi de la facture :", error.message || error);
        throw error;
    }
};

// --- 2. L'EMAIL DE VÉRIFICATION OTP (INSCRIPTION / RENVOI CODE) ---
export const sendVerificationEmail = async (userEmail, userName, code) => {
    const config = getEmailConfig();

    try {
        const html = `
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
        `;

        if (process.env.NODE_ENV !== 'production' || !config.apiKey) {
            console.log(`🔐 [OTP SECURE LOG] Code de vérification pour ${userEmail} (${userName}) : [ ${code} ]`);
        }

        return await sendEmail({
            to: userEmail,
            toName: userName || 'Client',
            subject: `🔐 ${code} est votre code de sécurité H-Designer`,
            html,
            text: `Votre code de sécurité H-Designer est : ${code}. Il expire dans 15 minutes.`
        });
    } catch (error) {
        console.error("❌ [EmailService] Erreur email vérification OTP :", error.message || error);
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
    const resetLink = `${process.env.FRONTEND_URL || 'https://h-design-v1.vercel.app'}/reset-password?token=${resetToken}`;

    try {
        const html = `
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
        `;

        return await sendEmail({
            to: userEmail,
            toName: 'Client',
            subject: `🔑 Réinitialisation de votre mot de passe H-Designer`,
            html,
            text: `Réinitialisez votre mot de passe en cliquant sur ce lien : ${resetLink}`
        });
    } catch (error) {
        console.error("❌ [EmailService] Erreur email reset :", error.message || error);
        console.log(`\n======================================================`);
        console.log(`🔑 [LIEN DE RÉINITIALISATION DE SECOURS]`);
        console.log(`Destinataire : ${userEmail}`);
        console.log(`Lien         : ${resetLink}`);
        console.log(`======================================================\n`);
        throw error;
    }
};