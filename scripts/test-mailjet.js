/**
 * 🧪 Script de Diagnostic et Test Mailjet
 *
 * Utilisation :
 *   node scripts/test-mailjet.js [votre-email@destinataire.com]
 *
 * Exemples :
 *   node scripts/test-mailjet.js
 *   node scripts/test-mailjet.js mon-email@gmail.com
 */

import dotenv from 'dotenv';
dotenv.config();
import { verifyEmailConfiguration, sendVerificationEmail, getEmailConfig } from '../services/emailService.js';

async function main() {
    console.log("==================================================================");
    console.log("🚀 [DIAGNOSTIC MAILJET] Test de la configuration email");
    console.log("==================================================================");

    const config = getEmailConfig();

    console.log(`📌 Host SMTP        : ${config.host}`);
    console.log(`📌 Port             : ${config.port} (${config.secure ? 'SSL' : 'STARTTLS'})`);
    console.log(`📌 Clé API (User)   : ${config.user ? `${config.user.slice(0, 6)}... (longueur: ${config.user.length})` : '❌ NON DÉFINIE'}`);
    console.log(`📌 Clé Secrète      : ${config.pass ? `******** (longueur: ${config.pass.length})` : '❌ NON DÉFINIE'}`);
    console.log(`📌 Expéditeur (From): ${config.fromHeader}`);
    console.log("------------------------------------------------------------------");

    if (!config.user || !config.pass) {
        console.error("❌ ERREUR : Les identifiants Mailjet ne sont pas configurés dans votre fichier .env !");
        console.log("\n👉 Ajoutez les lignes suivantes dans votre fichier backend .env :");
        console.log("   MAILJET_API_KEY=votre_cle_api_publique");
        console.log("   MAILJET_SECRET_KEY=votre_cle_api_secrete");
        console.log("   MAILJET_SENDER_EMAIL=votre_email_valide@domaine.com");
        console.log("   MAILJET_SENDER_NAME=H-Designer\n");
        process.exit(1);
    }

    console.log("⏳ Étape 1 : Vérification de la liaison SMTP avec in-v3.mailjet.com...");
    const isReady = await verifyEmailConfiguration();

    if (!isReady) {
        console.error("❌ Échec de la poignée de main SMTP. Consultez les logs ci-dessus pour la cause exacte.");
        process.exit(1);
    }

    // Étape 2 : Envoi d'un email de test si une adresse est fournie
    const targetEmail = process.argv[2];

    if (targetEmail) {
        console.log(`\n⏳ Étape 2 : Envoi d'un email de test en direct vers ${targetEmail}...`);
        const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

        try {
            const info = await sendVerificationEmail(targetEmail, "Testeur Mailjet", testOtp);
            console.log("------------------------------------------------------------------");
            console.log(`🎉 SUCCÈS TOTAL ! Email de test envoyé avec succès.`);
            console.log(`📧 Message ID : ${info.messageId}`);
            console.log(`📬 Vérifiez la boîte de réception (et dossiers Spams/Indésirables) de : ${targetEmail}`);
            console.log(`🔐 Code envoyé : ${testOtp}`);
            console.log("------------------------------------------------------------------");
        } catch (sendErr) {
            console.error("❌ Échec lors de l'envoi de l'email de test :", sendErr.message || sendErr);
            if (sendErr.message && sendErr.message.includes('Sender address not allowed')) {
                console.error("\n⚠️ CAUSE FRÉQUENTE : L'adresse expéditeur n'a pas été validée dans votre compte Mailjet.");
                console.error("👉 Solution : Rendez-vous sur https://app.mailjet.com/account/senders et ajoutez l'adresse : " + config.senderEmail);
            }
            process.exit(1);
        }
    } else {
        console.log("\n💡 Astuce : Vous pouvez tester l'envoi d'un vrai email en tapant :");
        console.log("   node scripts/test-mailjet.js votre-email@gmail.com");
    }

    console.log("\n==================================================================");
    console.log("✅ Diagnostic terminé avec succès !");
    console.log("==================================================================");
    process.exit(0);
}

main();
