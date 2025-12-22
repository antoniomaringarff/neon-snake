#!/bin/bash

# Script de despliegue manual (sin Docker)
# Para usar con PM2 y build manual del frontend
# Uso: ./deploy-manual.sh

set -e

echo "🚀 Iniciando despliegue manual..."

# Verificar que estamos en el directorio correcto
if [ ! -d "api" ] || [ ! -d "front" ]; then
    echo "❌ Error: Este script debe ejecutarse desde la raíz del proyecto"
    exit 1
fi

# 1. Actualizar código desde git
echo "📥 Actualizando código desde git..."
git pull

# 2. Actualizar API
echo "📦 Actualizando API..."
cd api

# Instalar dependencias
echo "   Instalando dependencias..."
npm install

# Ejecutar migraciones
echo "📊 Ejecutando migraciones de base de datos..."
npm run migrate

# Reiniciar PM2
echo "🔄 Reiniciando API con PM2..."
pm2 restart viborita-api || pm2 start ecosystem.config.js || pm2 start server.js --name "viborita-api" --env production

# Guardar configuración PM2
pm2 save

cd ..

# 3. Rebuild del frontend
echo "🎨 Reconstruyendo frontend..."
cd front

# Instalar dependencias
echo "   Instalando dependencias..."
npm install

# Build
echo "   Construyendo para producción..."
npm run build

cd ..

echo ""
echo "✅ Despliegue completado!"
echo ""
echo "📋 Verificar estado:"
echo "   pm2 list"
echo "   pm2 logs viborita-api"
echo ""

