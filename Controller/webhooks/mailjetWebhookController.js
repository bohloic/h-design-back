import { getEmailConfig } from '../../services/emailService.js';

/**
 * 📧 Mailjet Webhook Controller (Event API)
 * Documentation officielle : https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview
 *
 * Mailjet envoie des notifications HTTP POST en temps réel à chaque événement de cycle de vie :
 * - 'sent'    : Le message a été transmis au serveur de messagerie destinataire.
 * - 'open'    : Le destinataire a ouvert l'email.
 * - 'click'   : Le destinataire a cliqué sur un lien dans l'email.
 * - 'bounce'  : Rebond dur ou mou (adresse introuvable, boîte pleine, etc.).
 * - 'blocked' : Message bloqué par Mailjet (expéditeur non vérifié, politique anti-spam, etc.).
 * - 'spam'    : Le destinataire a classé l'email en courrier indésirable / spam.
 * - 'unsub'   : Le destinataire a cliqué sur le lien de désinscription.
 */

export const handleMailjetWebhook = async (req, res) => {
    try {
        const rawPayload = req.body;
        const events = Array.isArray(rawPayload) ? rawPayload : (rawPayload ? [rawPayload] : []);

        if (events.length === 0) {
            console.log("ℹ️ [Mailjet Webhook] Requête reçue avec payload vide.");
            return res.status(200).json({ success: true, message: "Payload vide reçu" });
        }

        console.log(`\n🔔 [MAILJET WEBHOOK] Réception d'un lot de ${events.length} événement(s) :`);

        for (const ev of events) {
            const eventType = String(ev.event || 'unknown').toLowerCase();
            const email = ev.email || ev.recipient || 'N/A';
            const messageId = ev.MessageID || ev.Message_GUID || 'N/A';
            const time = ev.time ? new Date(ev.time * 1000).toISOString() : new Date().toISOString();

            switch (eventType) {
                case 'sent':
                    console.log(`📧 ✅ [Mailjet: SENT] Message #${messageId} délivré avec succès à [${email}] le ${time}`);
                    break;

                case 'blocked':
                    console.error(`🚨 ⛔ [Mailjet: BLOCKED] Message #${messageId} BLOQUÉ pour [${email}] !`);
                    console.error(`   👉 Raison : ${ev.error || 'Non spécifiée'}`);
                    console.error(`   👉 Lié à   : ${ev.error_related_to || 'Expéditeur ou Politique'}`);
                    if (ev.comment) console.error(`   👉 Détail : ${ev.comment}`);
                    break;

                case 'bounce':
                    const isHard = Boolean(ev.hard_bounce);
                    console.error(`⚠️ 💥 [Mailjet: BOUNCE] Rebond (${isHard ? 'HARD' : 'SOFT'}) pour [${email}] !`);
                    console.error(`   👉 Code erreur : ${ev.error || 'Inconnu'}`);
                    console.error(`   👉 Raison      : ${ev.comment || ev.error_related_to || 'N/A'}`);
                    break;

                case 'spam':
                    console.warn(`⚠️ 🚨 [Mailjet: SPAM] Plainte de spam signalée par [${email}] (Message #${messageId})`);
                    break;

                case 'open':
                    console.log(`📬 👀 [Mailjet: OPEN] Email ouvert par [${email}] (Message #${messageId})`);
                    break;

                case 'click':
                    console.log(`👆 🔗 [Mailjet: CLICK] Clic sur lien par [${email}] -> URL: ${ev.url || 'N/A'}`);
                    break;

                case 'unsub':
                    console.log(`🚪 ⛔ [Mailjet: UNSUB] Désinscription demandée par [${email}]`);
                    break;

                default:
                    console.log(`ℹ️ [Mailjet: ${eventType.toUpperCase()}] Événement pour [${email}] (Message #${messageId})`, ev);
            }
        }

        // ⚠️ RÈGLE MAILJET STRICTE : L'endpoint DOIT retourner un statut HTTP 200 OK.
        // Tout autre code statut déclenche des tentatives de renvoi toutes les 30s pendant 24h.
        return res.status(200).json({
            success: true,
            received: events.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("❌ [Mailjet Webhook] Erreur lors du traitement :", error.message || error);
        // On retourne tout de même 200 pour éviter de bloquer la queue Mailjet
        return res.status(200).json({ success: false, error: error.message });
    }
};

/**
 * 🔍 Endpoint GET de diagnostic pour vérifier que le Webhook est en ligne
 * et afficher l'état de l'expéditeur Mailjet
 */
export const getMailjetWebhookInfo = async (req, res) => {
    const config = getEmailConfig();

    let senderStatus = 'Inconnu';
    let sendersList = [];

    if (config.apiKey && config.secretKey) {
        try {
            const auth = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');
            const response = await fetch('https://api.mailjet.com/v3/REST/sender', {
                headers: { 'Authorization': `Basic ${auth}` },
                signal: AbortSignal.timeout(4000)
            });

            if (response.ok) {
                const data = await response.json();
                sendersList = data?.Data || [];
                const currentSender = sendersList.find(s => s.Email?.toLowerCase() === config.senderEmail.toLowerCase());
                if (currentSender) {
                    senderStatus = currentSender.Status; // 'Active' ou 'Inactive'
                }
            }
        } catch (err) {
            senderStatus = `Erreur vérification: ${err.message}`;
        }
    }

    return res.status(200).json({
        status: "ok",
        service: "Mailjet Webhook Receiver",
        documentation: "https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview",
        webhookUrl: `${process.env.BACKEND_URL || 'https://h-design-back-off.vercel.app'}/api/webhooks/mailjet`,
        sender: {
            configuredEmail: config.senderEmail,
            mailjetStatus: senderStatus,
            isActive: senderStatus === 'Active',
            instruction: senderStatus !== 'Active' 
                ? "⚠️ Votre adresse expéditeur est INACTIVE dans Mailjet. Veuillez vous connecter sur https://app.mailjet.com/account/senders et cliquer sur le lien de confirmation envoyé par email."
                : "✅ L'adresse expéditeur est active et validée chez Mailjet."
        },
        supportedEvents: ["sent", "open", "click", "bounce", "blocked", "spam", "unsub"]
    });
};
