module.exports = {
  /**
   * Application configuration
   */
  apps: [{
    name: 'viborita-api',
    cwd: './api',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3003
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }],

  /**
   * Deployment configuration
   * 
   * Usage:
   *   Primera vez:     pm2 deploy production setup
   *   Deployar:        pm2 deploy production
   *   Actualizar:      pm2 deploy production update
   *   Revertir:        pm2 deploy production revert 1
   */
  deploy: {
    production: {
      // Usuario SSH del servidor
      user: 'ubuntu',
      
      // IP o hostname del servidor
      host: 'sally.ar',
      
      // Rama de git a deployar
      ref: 'origin/main',
      
      // URL del repositorio
      repo: 'git@github.com:antoniomaringarff/neon-snake.git',
      
      // Carpeta en el servidor donde se despliega
      path: '/home/ubuntu/www/antonio/neonsnake',
      
      // Comandos a ejecutar ANTES de hacer git pull
      'pre-deploy': 'echo "🚀 Starting deployment..."',
      
      // Comandos a ejecutar DESPUÉS de hacer git pull
      'post-deploy': [
        // Frontend: install dependencies and build
        'echo "📦 Building frontend..."',
        'cd front && npm install --production=false && npm run build',
        
        // API: install dependencies
        'echo "📦 Installing API dependencies..."',
        'cd ../api && npm install --production=false',
        
        // API: run migrations
        'echo "🔄 Running migrations..."',
        'cd ../api && npm run migrate',
        
        // Create logs directory if not exists
        'mkdir -p api/logs',
        
        // Restart PM2 using the root ecosystem file
        'echo "🔄 Restarting PM2..."',
        'pm2 reload ecosystem.config.cjs --env production',
        
        // Save PM2 state
        'pm2 save',
        
        'echo "✅ Deployment complete!"'
      ].join(' && '),
      
      // Variables de entorno para el deploy
      env: {
        NODE_ENV: 'production'
      }
    },
    
    // Configuración para staging (opcional)
    staging: {
      user: 'ubuntu',
      host: 'sally.ar',
      ref: 'origin/develop',
      repo: 'git@github.com:antoniomaringarff/neon-snake.git',
      path: '/home/ubuntu/www/antonio/neonsnake-staging',
      'post-deploy': [
        'cd front && npm install --production=false && npm run build',
        'cd ../api && npm install --production=false && npm run migrate',
        'mkdir -p api/logs',
        'pm2 reload ecosystem.config.cjs --env production',
        'pm2 save'
      ].join(' && '),
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};

