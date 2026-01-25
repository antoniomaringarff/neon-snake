#!/bin/bash

# Script simple para iniciar PostgreSQL después de reiniciar la Mac

echo "🔄 Deteniendo procesos de PostgreSQL existentes..."
pkill -f "postgres.*postgresql@15" 2>/dev/null
sleep 2

echo "🚀 Iniciando PostgreSQL..."
# Iniciar PostgreSQL directamente sin servicios del sistema
nohup /opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15 > /tmp/postgres-startup.log 2>&1 &

POSTGRES_PID=$!
echo "   PID: $POSTGRES_PID"

echo "⏳ Esperando a que PostgreSQL inicie (esto puede tomar unos segundos)..."
for i in {1..10}; do
    sleep 1
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "✅ PostgreSQL está corriendo y aceptando conexiones!"
        echo ""
        echo "📋 Información útil:"
        echo "   - Logs: tail -f /tmp/postgres-startup.log"
        echo "   - Detener: kill $POSTGRES_PID"
        echo "   - Verificar: pg_isready -h localhost -p 5432"
        exit 0
    fi
    echo -n "."
done

echo ""
echo "⚠️  PostgreSQL no responde aún. Revisa los logs:"
echo "   tail -20 /tmp/postgres-startup.log"
echo ""
echo "Si hay errores de permisos, puede que necesites:"
echo "   sudo chown -R $(whoami) /opt/homebrew/var/postgresql@15"
