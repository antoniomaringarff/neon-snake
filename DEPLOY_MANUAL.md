# Guía de Despliegue Manual (Sin Docker)

## URL de Producción
- **Frontend**: https://neon.snake.sally.ar
- **API**: https://neon.snake.sally.ar/api

## Requisitos Previos

1. **Node.js** (v18 o superior) instalado
2. **PostgreSQL** instalado y corriendo
3. **Nginx** instalado (para servir el frontend y hacer reverse proxy)
4. **PM2** (opcional pero recomendado para mantener procesos corriendo)

## Instalación de Dependencias

### 1. Instalar Node.js (si no está instalado)

```bash
# En Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version
npm --version
```

### 2. Instalar PostgreSQL

```bash
# En Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Iniciar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos
sudo -u postgres psql
CREATE DATABASE viborita;
CREATE USER viborita_user WITH PASSWORD 'tu_contraseña_segura';
GRANT ALL PRIVILEGES ON DATABASE viborita TO viborita_user;
\q
```

### 3. Instalar PM2 (para mantener procesos corriendo)

```bash
sudo npm install -g pm2
```

## Configuración del Backend (API)

### 1. Configurar variables de entorno

```bash
cd api
cp .env.example .env
nano .env  # o usa tu editor preferido
```

Edita `api/.env` con:

```env
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=viborita
DB_USER=viborita_user
DB_PASSWORD=tu_contraseña_segura

JWT_SECRET=tu_secreto_jwt_generado_aqui
CORS_ORIGIN=https://neon.snake.sally.ar
```

**Generar JWT Secret:**
```bash
openssl rand -base64 32
```

### 2. Instalar dependencias y ejecutar migraciones

```bash
cd api
npm install
npm run migrate
```

### 3. Probar que la API funciona

```bash
# En modo desarrollo (para probar)
npm run dev

# Debería estar corriendo en http://localhost:3000
# Verifica: curl http://localhost:3000/health
```

### 4. Ejecutar en producción con PM2

```bash
# Desde la carpeta api/
pm2 start server.js --name "viborita-api" --env production

# O si quieres usar npm run dev en producción:
pm2 start npm --name "viborita-api" -- run dev

# Guardar configuración de PM2
pm2 save

# Configurar PM2 para iniciar al arrancar el sistema
pm2 startup
# (sigue las instrucciones que aparecen)
```

**Comandos PM2 útiles:**
```bash
pm2 list              # Ver procesos
pm2 logs viborita-api # Ver logs
pm2 restart viborita-api # Reiniciar
pm2 stop viborita-api    # Detener
pm2 delete viborita-api  # Eliminar
```

## Configuración del Frontend

### 1. Instalar dependencias

```bash
cd front
npm install
```

### 2. Build para producción

```bash
cd front
npm run build
```

Esto creará una carpeta `front/dist/` con los archivos estáticos listos para servir.

### 3. Servir el frontend con Nginx

El frontend se servirá directamente con Nginx (ver sección de Nginx más abajo).

## Configuración de Nginx

### 1. Instalar Nginx

```bash
sudo apt-get update
sudo apt-get install nginx
```

### 2. Configurar sitio

Crea el archivo de configuración:

```bash
sudo nano /etc/nginx/sites-available/neon.snake.sally.ar
```

Contenido:

```nginx
# Redirigir HTTP a HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name neon.snake.sally.ar;

    # Para Let's Encrypt (certbot)
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirigir todo lo demás a HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Configuración HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name neon.snake.sally.ar;

    # Certificados SSL (usar Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/neon.snake.sally.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/neon.snake.sally.ar/privkey.pem;
    
    # Configuración SSL recomendada
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend (archivos estáticos)
    root /home/ubuntu/www/antonio/neonsnake/front/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        
        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # API Backend (reverse proxy)
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_set_header Host $host;
    }

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Habilitar el sitio

```bash
# Crear symlink
sudo ln -s /etc/nginx/sites-available/neon.snake.sally.ar /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 4. Configurar SSL con Let's Encrypt

```bash
# Instalar certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d neon.snake.sally.ar

# Renovación automática (ya viene configurado)
sudo certbot renew --dry-run
```

## Proceso de Despliegue Completo

### Primera vez (setup inicial)

```bash
# 1. Clonar/actualizar código
cd ~/www/antonio/neonsnake
git pull  # o clonar si es primera vez

# 2. Configurar API
cd api
cp .env.example .env
# Editar .env con tus valores
npm install
npm run migrate

# 3. Iniciar API con PM2
pm2 start server.js --name "viborita-api" --env production
pm2 save

# 4. Build del frontend
cd ../front
npm install
npm run build

# 5. Verificar que Nginx esté configurado y corriendo
sudo nginx -t
sudo systemctl status nginx
```

### Actualizaciones (cuando hay cambios)

```bash
# 1. Actualizar código
cd ~/www/antonio/neonsnake
git pull

# 2. Actualizar API
cd api
npm install
npm run migrate  # Solo si hay cambios en la BD
pm2 restart viborita-api

# 3. Rebuild del frontend
cd ../front
npm install
npm run build

# 4. Nginx ya está sirviendo desde front/dist, no necesita reinicio
# (a menos que cambies la configuración de Nginx)
```

## Verificación

```bash
# Verificar que la API está corriendo
curl http://localhost:3000/health

# Verificar PM2
pm2 list
pm2 logs viborita-api

# Verificar Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Verificar desde el navegador
# https://neon.snake.sally.ar
# https://neon.snake.sally.ar/health
```

## Estructura de Directorios Recomendada

```
/home/ubuntu/www/antonio/neonsnake/
├── api/
│   ├── .env                    # Variables de entorno (NO subir a git)
│   ├── server.js
│   ├── package.json
│   └── ...
├── front/
│   ├── dist/                   # Build de producción (generado por npm run build)
│   ├── src/
│   ├── package.json
│   └── ...
└── ...
```

## Troubleshooting

### La API no responde
```bash
# Verificar que PM2 está corriendo
pm2 list

# Ver logs
pm2 logs viborita-api

# Verificar puerto
sudo netstat -tlnp | grep 3000
```

### Frontend no carga
```bash
# Verificar que existe el build
ls -la front/dist/

# Verificar permisos
sudo chown -R www-data:www-data front/dist/

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

### Errores de CORS
- Verifica que `CORS_ORIGIN` en `api/.env` sea exactamente `https://neon.snake.sally.ar`
- Reinicia la API: `pm2 restart viborita-api`

### Base de datos no conecta
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Probar conexión
psql -h localhost -U viborita_user -d viborita

# Verificar variables en api/.env
cat api/.env | grep DB_
```

## Comandos Rápidos de Referencia

```bash
# API
cd api
npm run dev          # Desarrollo
pm2 start server.js --name "viborita-api"  # Producción
pm2 restart viborita-api
pm2 logs viborita-api

# Frontend
cd front
npm run dev          # Desarrollo (localhost:5173)
npm run build        # Build para producción

# Base de datos
npm run migrate      # Desde api/

# Nginx
sudo nginx -t        # Verificar configuración
sudo systemctl restart nginx
sudo tail -f /var/log/nginx/error.log
```

## Seguridad

- ✅ Usa HTTPS (Let's Encrypt)
- ✅ Cambia `JWT_SECRET` por un valor seguro
- ✅ Usa contraseñas fuertes para PostgreSQL
- ✅ Configura firewall (solo puertos 80, 443)
- ✅ Mantén Node.js y dependencias actualizadas
- ✅ Revisa logs regularmente
- ✅ No expongas el puerto 3000 públicamente (solo vía Nginx)

