#!/bin/bash

# Script de despliegue a producción
# Uso: ./deploy.sh

set -e

echo "🚀 Iniciando despliegue a producción..."

# Verificar que existe .env
if [ ! -f .env ]; then
    echo "❌ Error: Archivo .env no encontrado"
    echo "📝 Crea un archivo .env basado en .env.example"
    exit 1
fi

# Verificar que JWT_SECRET no sea el valor por defecto
if grep -q "your_jwt_secret_here_change_this" .env || grep -q "cambiar_en_produccion" .env; then
    echo "⚠️  ADVERTENCIA: JWT_SECRET parece ser el valor por defecto"
    echo "   Por favor, cambia JWT_SECRET en .env a un valor seguro"
    read -p "¿Continuar de todas formas? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Construir imágenes
echo "🔨 Construyendo imágenes Docker..."
docker-compose build

# Ejecutar migraciones
echo "📊 Ejecutando migraciones de base de datos..."
docker-compose run --rm api npm run migrate

# Iniciar servicios
echo "▶️  Iniciando servicios..."
docker-compose up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 5

# Verificar salud
echo "🏥 Verificando salud de los servicios..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API está respondiendo correctamente"
else
    echo "⚠️  API no está respondiendo, revisa los logs: docker-compose logs api"
fi

echo ""
echo "✅ Despliegue completado!"
echo ""
echo "📋 Servicios:"
docker-compose ps
echo ""
echo "📝 Para ver logs: docker-compose logs -f"
echo "🛑 Para detener: docker-compose down"

