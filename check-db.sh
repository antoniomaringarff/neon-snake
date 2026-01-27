#!/bin/bash

# Script para verificar y crear la base de datos si no existe

echo "🔍 Verificando conexión a PostgreSQL..."

if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "❌ PostgreSQL no está corriendo"
    echo "Ejecuta primero: ./start-postgres.sh"
    exit 1
fi

echo "✅ PostgreSQL está corriendo"
echo ""
echo "🔍 Verificando si la base de datos 'viborita' existe..."

# Intentar conectarse a la base de datos
if psql -h localhost -p 5432 -U antonio -d viborita -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ La base de datos 'viborita' existe y es accesible"
    exit 0
fi

echo "⚠️  La base de datos 'viborita' no existe o no es accesible"
echo ""
echo "Creando la base de datos..."

# Crear la base de datos (conectarse a postgres primero)
if psql -h localhost -p 5432 -U antonio -d postgres -c "CREATE DATABASE viborita;" 2>&1; then
    echo "✅ Base de datos 'viborita' creada exitosamente"
else
    echo "❌ Error al crear la base de datos"
    echo ""
    echo "Intenta crear la base de datos manualmente:"
    echo "  psql -h localhost -p 5432 -U antonio -d postgres -c \"CREATE DATABASE viborita;\""
    exit 1
fi
