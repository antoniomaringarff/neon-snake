#!/bin/sh
set -e

# Ejecutar migraciones antes de iniciar el servidor
echo "📊 Ejecutando migraciones de base de datos..."
node src/migrations/run.js

# Iniciar el servidor
echo "🚀 Iniciando servidor..."
exec node server.js

