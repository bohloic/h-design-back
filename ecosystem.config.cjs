/**
 * 🚀 Configuration PM2 (Process Manager)
 * Garantit le redémarrage automatique en cas de crash, la montée en charge (Cluster)
 * et le recyclage des processus en cas de dépassement mémoire.
 *
 * Commandes utiles :
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 restart boutique-noel-backend
 *   pm2 logs boutique-noel-backend
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'boutique-noel-backend',
      script: './index.js',
      instances: 'max', // Multi-cœurs pour haute disponibilité
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M', // Redémarre automatiquement si la mémoire dépasse 500MB (anti-fuite)
      restart_delay: 2000, // Attente de 2s entre les redémarrages en cas de crash
      max_restarts: 10,
      min_uptime: '10s',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'development',
        PORT: 205,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 205,
      },
    },
  ],
};
