# Cómo Verificar Migraciones y Actualizar Frontend

## 1. Verificar Migraciones en la Base de Datos

### Conectarse a la base de datos PostgreSQL

```bash
# Si la DB está en el mismo servidor
psql -h localhost -U tu_usuario -d viborita

# Si la DB está en EC2 (ajusta los valores según tu configuración)
psql -h tu-host-ec2 -U tu_usuario -d viborita
```

### Verificar qué migraciones se ejecutaron

```sql
-- Ver todas las migraciones ejecutadas
SELECT * FROM migrations ORDER BY id;

-- Deberías ver algo como:
-- id | name                    | executed_at
-- ---+-------------------------+----------------------------
--  1 | 001_initial_schema     | 2024-12-21 10:00:00
--  2 | 002_shop_upgrades       | 2024-12-21 10:01:00
--  3 | 003_add_magnet_speed    | 2024-12-21 10:02:00
```

### Verificar que las tablas/columnas existen

```sql
-- Verificar que existe la tabla shop_upgrades (de la migración 002)
SELECT * FROM shop_upgrades LIMIT 5;

-- Verificar que existen las columnas nuevas en user_progress (migración 003)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_progress' 
AND column_name IN ('magnet_level', 'speed_level');

-- Verificar que existe total_stars en users
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'total_stars';
```

### Si las migraciones NO se ejecutaron

```bash
# Ejecutar migraciones manualmente
cd ~/www/antonio/neonsnake/api
npm run migrate
```

## 2. Actualizar el Frontend

### Opción A: Usando el script de deploy (recomendado)

```bash
cd ~/www/antonio/neonsnake
./deploy-manual.sh
```

### Opción B: Manual

```bash
# 1. Actualizar código
cd ~/www/antonio/neonsnake
git pull

# 2. Rebuild del frontend
cd front
npm install
npm run build

# Esto crea/actualiza la carpeta front/dist/
# Nginx ya está configurado para servir desde ahí
```

### Verificar que el build se hizo correctamente

```bash
# Verificar que existe la carpeta dist
ls -la ~/www/antonio/neonsnake/front/dist/

# Deberías ver archivos como:
# - index.html
# - assets/ (con archivos JS y CSS)
```

### Si Nginx no está sirviendo el nuevo build

```bash
# Verificar configuración de Nginx
sudo nginx -t

# Reiniciar Nginx (si es necesario)
sudo systemctl restart nginx

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

## 3. Verificar que Todo Funciona

### Verificar API

```bash
# Health check
curl http://localhost:3003/health

# Ver logs de PM2
pm2 logs viborita-api --lines 20
```

### Verificar Frontend

1. Abre el navegador en `https://neon.snake.sally.ar`
2. Abre las DevTools (F12)
3. Ve a la pestaña "Network"
4. Recarga la página (Ctrl+F5 o Cmd+Shift+R para forzar recarga)
5. Verifica que los archivos JS/CSS se están cargando desde `/assets/`

### Limpiar caché del navegador

Si el frontend sigue mostrando la versión vieja:
- Chrome/Edge: Ctrl+Shift+Delete → Limpiar caché
- Firefox: Ctrl+Shift+Delete → Limpiar caché
- O usar modo incógnito para probar

## 4. Checklist Completo

- [ ] Migraciones ejecutadas (verificar en DB)
- [ ] Frontend rebuild hecho (`npm run build`)
- [ ] Carpeta `front/dist/` existe y tiene archivos nuevos
- [ ] Nginx está sirviendo desde `front/dist/`
- [ ] API está corriendo (PM2)
- [ ] Logs de API muestran migraciones ejecutadas
- [ ] Navegador muestra versión nueva (limpiar caché si es necesario)

