#!/bin/bash

# Script para iniciar PostgreSQL

echo "🔍 Verificando si PostgreSQL está corriendo..."
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✅ PostgreSQL ya está corriendo"
    exit 0
fi

echo "🚀 Intentando iniciar PostgreSQL..."
echo ""

# Intentar con brew services (sin sudo primero)
if command -v brew &> /dev/null; then
    echo "📦 Intentando con brew services (sin sudo)..."
    brew services start postgresql@15 2>&1 | grep -v "Warning" || true
    sleep 3
    
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "✅ PostgreSQL iniciado con brew services"
        exit 0
    fi
fi

# Intentar con pg_ctl directamente (sin sudo primero)
if [ -d "/opt/homebrew/var/postgresql@15" ]; then
    echo "🔧 Intentando con pg_ctl (sin sudo)..."
    /opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /opt/homebrew/var/postgresql@15 start 2>&1 | grep -v "Permission denied" || true
    sleep 2
    
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "✅ PostgreSQL iniciado con pg_ctl"
        exit 0
    fi
fi

# Intentar iniciar como proceso en background
echo "🚀 Intentando iniciar como proceso en background..."
if [ -d "/opt/homebrew/var/postgresql@15" ]; then
    /opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15 > /tmp/postgres.log 2>&1 &
    POSTGRES_PID=$!
    sleep 3
    
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "✅ PostgreSQL iniciado como proceso (PID: $POSTGRES_PID)"
        echo "   Logs en: /tmp/postgres.log"
        exit 0
    else
        echo "⚠️  Proceso iniciado pero no responde aún. Revisa /tmp/postgres.log"
    fi
fi

echo ""
echo "❌ No se pudo iniciar PostgreSQL automáticamente"
echo ""
echo "📋 Por favor, ejecuta manualmente uno de estos comandos:"
echo ""
echo "1. brew services start postgresql@15"
echo "   (Si tienes problemas de permisos, usa sudo)"
echo ""
echo "2. sudo /opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /opt/homebrew/var/postgresql@15 start"
echo ""
echo "3. Iniciar como proceso en background:"
echo "   /opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15 > /tmp/postgres.log 2>&1 &"
echo ""
echo "4. Ver documentación completa: cat INICIAR_POSTGRES.md"
echo ""
echo "Luego verifica con: pg_isready -h localhost -p 5432"
