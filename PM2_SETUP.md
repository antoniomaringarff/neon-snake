# Configuración PM2 para la API

## Instalación de PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# O con yarn
yarn global add pm2
```

## Uso Básico

### Opción 1: Usando el archivo de configuración (Recomendado)

```bash
# Desde la raíz del proyecto
cd /Users/antoniomaringarff/www/viborita
pm2 start api/ecosystem.config.cjs

# O desde el directorio api
cd api
pm2 start ../ecosystem.config.cjs
```

### Opción 2: Comando directo

```bash
cd /Users/antoniomaringarff/www/viborita/api
pm2 start server.js --name viborita-api --env production
```

### Opción 3: Usando npm start

```bash
cd /Users/antoniomaringarff/www/viborita/api
pm2 start npm --name viborita-api -- start
```

## Comandos Útiles de PM2

```bash
# Ver todos los procesos
pm2 list

# Ver logs en tiempo real
pm2 logs viborita-api

# Ver logs de los últimos 100 líneas
pm2 logs viborita-api --lines 100

# Reiniciar la aplicación
pm2 restart viborita-api

# Detener la aplicación
pm2 stop viborita-api

# Eliminar la aplicación de PM2
pm2 delete viborita-api

# Ver información detallada
pm2 show viborita-api

# Monitoreo en tiempo real
pm2 monit

# Guardar la configuración actual para que se reinicie al reiniciar el servidor
pm2 save

# Configurar PM2 para iniciar al arrancar el sistema (solo Linux)
pm2 startup
# Seguir las instrucciones que aparecen
pm2 save
```

## Variables de Entorno

Asegúrate de tener un archivo `.env` en el directorio `api/` con:

```env
NODE_ENV=production
PORT=3003
DB_HOST=localhost
DB_PORT=5432
DB_NAME=viborita
DB_USER=tu_usuario
DB_PASSWORD=tu_password
JWT_SECRET=tu_jwt_secret_seguro
CORS_ORIGIN=https://neon.snake.sally.ar
```

## Verificar que está funcionando

```bash
# Verificar que el proceso está corriendo
pm2 list

# Verificar que responde
curl http://localhost:3003/health

# Ver logs
pm2 logs viborita-api
```

## Reinicio Automático

PM2 reiniciará automáticamente la aplicación si:
- Se cae por un error
- El servidor se reinicia (si configuraste `pm2 startup`)
- Reinicio manual con `pm2 restart`

## Logs

Los logs se guardan en:
- `api/logs/pm2-error.log` - Errores
- `api/logs/pm2-out.log` - Salida estándar

Asegúrate de crear el directorio `logs` si no existe:

```bash
mkdir -p api/logs
```

