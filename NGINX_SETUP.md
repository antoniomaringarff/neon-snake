# Configuración de Nginx para Producción

## Problemas Detectados y Soluciones

### Frontend (neon.snake.snake.sally.ar)

**Problemas:**
1. ❌ `root` apunta a `/front` en lugar de `/front/dist` (los archivos compilados están en `dist/`)
2. ❌ `try_files` usa `=404` en lugar de `/index.html` (necesario para SPA)

**Solución:**
```nginx
root /home/ubuntu/www/antonio/neonsnake/front/dist;  # ← Agregar /dist
location / {
    try_files $uri $uri/ /index.html;  # ← Cambiar =404 por /index.html
}
```

### API (api.neon.snake.sally.ar)

**Problemas:**
1. ❌ Tiene `root` y `index` cuando no debería (es solo un proxy)
2. ❌ `location /api` está mal - el dominio ya es `api.neon.snake.sally.ar`, entonces debería ser `location /`

**Solución:**
```nginx
# ELIMINAR estas líneas:
# root /home/ubuntu/www/antonio/neonsnake/api;
# index index.html;

# Cambiar location /api por location /
location / {
    proxy_pass http://localhost:3003;
    # ... resto de configuración
}
```

## Archivos de Configuración

He creado dos archivos de ejemplo:
- `nginx-front.conf` - Configuración corregida para el frontend
- `nginx-api.conf` - Configuración corregida para la API

## Pasos para Aplicar

### 1. Backup de configuraciones actuales

```bash
sudo cp /etc/nginx/sites-available/neon.snake.sally.ar /etc/nginx/sites-available/neon.snake.sally.ar.backup
sudo cp /etc/nginx/sites-available/api.neon.snake.sally.ar /etc/nginx/sites-available/api.neon.snake.sally.ar.backup
```

### 2. Editar configuración del Frontend

```bash
sudo nano /etc/nginx/sites-available/neon.snake.sally.ar
```

**Cambiar:**
```nginx
root /home/ubuntu/www/antonio/neonsnake/front;
```
**Por:**
```nginx
root /home/ubuntu/www/antonio/neonsnake/front/dist;
```

**Y cambiar:**
```nginx
location / {
    try_files $uri $uri/ =404;
}
```
**Por:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}

# Agregar proxy para API
location /api {
    proxy_pass http://localhost:3003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### 3. Editar configuración de la API

```bash
sudo nano /etc/nginx/sites-available/api.neon.snake.sally.ar
```

**ELIMINAR estas líneas:**
```nginx
root /home/ubuntu/www/antonio/neonsnake/api;
index index.html;
```

**Y cambiar:**
```nginx
location /api {
    proxy_pass http://localhost:3003;
    ...
}
```
**Por:**
```nginx
location / {
    proxy_pass http://localhost:3003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### 4. Verificar y reiniciar

```bash
# Verificar configuración
sudo nginx -t

# Si todo está bien, reiniciar
sudo systemctl reload nginx
# O
sudo systemctl restart nginx
```

### 5. Verificar permisos

```bash
# Asegurar que Nginx puede leer los archivos
sudo chown -R www-data:www-data /home/ubuntu/www/antonio/neonsnake/front/dist
sudo chmod -R 755 /home/ubuntu/www/antonio/neonsnake/front/dist
```

## Verificación

```bash
# Ver logs de errores
sudo tail -f /var/log/nginx/sally_error.log
sudo tail -f /var/log/nginx/api_neon_error.log

# Ver logs de acceso
sudo tail -f /var/log/nginx/sally_access.log
sudo tail -f /var/log/nginx/api_neon_access.log

# Probar endpoints
curl https://neon.snake.sally.ar
curl https://api.neon.snake.sally.ar/health
```

## Resumen de Cambios

### Frontend
- ✅ `root` → `/front/dist` (archivos compilados)
- ✅ `try_files` → `/index.html` (para SPA)
- ✅ Agregar `location /api` para proxy

### API
- ✅ Eliminar `root` y `index`
- ✅ Cambiar `location /api` → `location /`
- ✅ Proxy a `http://localhost:3003`

