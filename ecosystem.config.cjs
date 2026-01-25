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
      // Estos comandos se ejecutan desde el directorio del release (ej: /home/ubuntu/www/antonio/neonsnake/releases/YYYYMMDDHHmmss)
      'post-deploy': [
        // Create shared directories if they don't exist
        'echo "📁 Setting up shared directories..."',
        'mkdir -p ../shared',
        'mkdir -p api/logs',
        
        // Symlink .env from shared folder to api/
        'echo "🔗 Linking .env file..."',
        'ln -sf ../../shared/.env api/.env',
        
        // Frontend: install dependencies and build
        'echo "📦 Building frontend..."',
        'cd front && rm -rf dist && npm install --production=false && npm run build',
        
        // API: install dependencies
        'echo "📦 Installing API dependencies..."',
        'cd ../api && npm install --production=false',
        
        // API: run migrations (with error handling)
        'echo "🔄 Running migrations..."',
        'npm run migrate || (echo "❌ Migration failed!" && exit 1)',
        
        // Restart PM2 app specifically (desde cualquier directorio funciona)
        'echo "🔄 Restarting PM2..."',
        'pm2 restart viborita-api',
        
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
        'mkdir -p ../shared && mkdir -p api/logs',
        'ln -sf ../../shared/.env api/.env',
        'cd front && npm install --production=false && npm run build',
        'cd ../api && npm install --production=false && npm run migrate',
        'cd .. && pm2 reload ecosystem.config.cjs --env production',
        'pm2 save'
      ].join(' && '),
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};

