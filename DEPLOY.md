# Guía de Despliegue a Producción

## URL de Producción
- **Frontend**: https://neon.snake.sally.ar
- **API**: https://neon.snake.sally.ar/api

## Requisitos Previos

1. **Servidor con Docker y Docker Compose instalado**
2. **Dominio configurado**: `neon.snake.sally.ar` apuntando al servidor
3. **Nginx o similar** configurado como reverse proxy (opcional pero recomendado)

## Configuración

### 1. Variables de Entorno

**El `.env` va en la carpeta `api/`** (solo la API necesita variables de entorno).

Crea un archivo `api/.env` basado en `api/.env.example`:

```bash
cp api/.env.example api/.env
```

Edita `api/.env` y configura:
- `JWT_SECRET`: Genera un secreto fuerte y aleatorio
- `DB_PASSWORD`: Contraseña segura para PostgreSQL
- `CORS_ORIGIN`: `https://neon.snake.sally.ar`

**Nota**: El frontend es estático y no necesita `.env`.

### 2. Generar JWT Secret

```bash
# En Mac/Linux
openssl rand -base64 32

# O usar Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Configuración de Nginx (Recomendado)

Si usas Nginx como reverse proxy, configura algo como esto:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name neon.snake.sally.ar;

    # Redirigir HTTP a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name neon.snake.sally.ar;

    # Certificados SSL (usar Let's Encrypt)
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend (archivos estáticos)
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
    }
}
```

### 4. Build y Despliegue

**Opción A: Script automático (recomendado)**

```bash
./deploy.sh
```

**Opción B: Manual**

```bash
# 1. Construir las imágenes Docker
docker-compose build

# 2. Ejecutar migraciones de base de datos
docker-compose run --rm api npm run migrate

# 3. Iniciar los servicios
docker-compose up -d

# 4. Ver logs
docker-compose logs -f
```

**Opción C: Con override para producción**

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 5. Verificar el Despliegue

- Frontend: https://neon.snake.sally.ar
- API Health: https://neon.snake.sally.ar/health
- API: https://neon.snake.sally.ar/api

## Comandos Útiles

```bash
# Ver estado de los contenedores
docker-compose ps

# Ver logs
docker-compose logs -f api
docker-compose logs -f front

# Reiniciar servicios
docker-compose restart

# Detener servicios
docker-compose down

# Detener y eliminar volúmenes (¡CUIDADO! Esto borra la base de datos)
docker-compose down -v

# Reconstruir después de cambios
docker-compose up -d --build
```

## Actualizaciones

Para actualizar el código en producción:

```bash
# 1. Hacer pull del código actualizado
git pull

# 2. Reconstruir y reiniciar
docker-compose up -d --build

# 3. Si hay cambios en la base de datos, ejecutar migraciones
docker-compose run api npm run migrate
```

## Seguridad

- ✅ Usa HTTPS (certificados SSL/TLS)
- ✅ Cambia `JWT_SECRET` por un valor seguro y aleatorio
- ✅ Usa contraseñas fuertes para la base de datos
- ✅ Configura firewall para limitar acceso a puertos necesarios
- ✅ Mantén Docker y las imágenes actualizadas
- ✅ Revisa logs regularmente

## Troubleshooting

### La API no responde
- Verifica que el contenedor esté corriendo: `docker-compose ps`
- Revisa logs: `docker-compose logs api`
- Verifica que el puerto 3000 esté accesible

### CORS errors
- Verifica que `CORS_ORIGIN` en `api/.env` coincida con la URL del frontend
- Reinicia el contenedor de la API después de cambiar `api/.env`

### Base de datos no conecta
- Verifica que el contenedor de DB esté corriendo: `docker-compose ps db`
- Revisa las variables de entorno de conexión
- Verifica logs: `docker-compose logs db`

