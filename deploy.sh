#!/bin/bash

# Script de despliegue a producción
# Uso: ./deploy.sh

set -e

# Detectar si usar docker-compose (antiguo) o docker compose (nuevo)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Error: docker-compose o 'docker compose' no encontrado"
    echo "   Instala Docker Compose o actualiza Docker a la versión más reciente"
    exit 1
fi

echo "🚀 Iniciando despliegue a producción..."
echo "📦 Usando: $DOCKER_COMPOSE"

# Verificar que existe .env en api/
if [ ! -f api/.env ]; then
    echo "❌ Error: Archivo api/.env no encontrado"
    echo "📝 Crea un archivo api/.env basado en api/.env.example"
    exit 1
fi

# Verificar que JWT_SECRET no sea el valor por defecto
if grep -q "your_jwt_secret_here_change_this" api/.env || grep -q "cambiar_en_produccion" api/.env; then
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
$DOCKER_COMPOSE build

# Iniciar servicios (solo DB primero para que esté lista)
echo "▶️  Iniciando base de datos..."
$DOCKER_COMPOSE up -d db

# Esperar a que la base de datos esté lista
echo "⏳ Esperando a que la base de datos esté lista..."
sleep 10

# Ejecutar migraciones
echo "📊 Ejecutando migraciones de base de datos..."
$DOCKER_COMPOSE run --rm api npm run migrate

# Iniciar todos los servicios
echo "▶️  Iniciando todos los servicios..."
$DOCKER_COMPOSE up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 5

# Verificar salud
echo "🏥 Verificando salud de los servicios..."
if curl -f http://localhost:3003/health > /dev/null 2>&1; then
    echo "✅ API está respondiendo correctamente"
else
    echo "⚠️  API no está respondiendo, revisa los logs: $DOCKER_COMPOSE logs api"
fi

echo ""
echo "✅ Despliegue completado!"
echo ""
echo "📋 Servicios:"
$DOCKER_COMPOSE ps
echo ""
echo "📝 Para ver logs: $DOCKER_COMPOSE logs -f"
echo "🛑 Para detener: $DOCKER_COMPOSE down"

