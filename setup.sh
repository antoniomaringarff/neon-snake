#!/bin/bash

echo "🐍 Configurando proyecto Viborita..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "api" ] || [ ! -d "front" ]; then
    echo -e "${RED}❌ Error: Debe ejecutar este script desde /Users/antoniomaringarff/www/viborita/${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Instalando dependencias del API...${NC}"
cd api
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error instalando dependencias del API${NC}"
    exit 1
fi

echo -e "${BLUE}📝 Configurando variables de entorno...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ Archivo .env creado${NC}"
    echo -e "${BLUE}ℹ️  Editá el archivo api/.env si necesitás cambiar las credenciales de PostgreSQL${NC}"
else
    echo -e "${GREEN}✅ Archivo .env ya existe${NC}"
fi

echo -e "${BLUE}🗄️  Creando base de datos...${NC}"
createdb viborita 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Base de datos 'viborita' creada${NC}"
else
    echo -e "${BLUE}ℹ️  La base de datos 'viborita' ya existe${NC}"
fi

echo -e "${BLUE}🔄 Corriendo migraciones...${NC}"
npm run migrate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error corriendo migraciones${NC}"
    echo -e "${BLUE}ℹ️  Asegurate de que PostgreSQL esté corriendo: brew services start postgresql@15${NC}"
    exit 1
fi

cd ..

echo -e "${BLUE}📦 Instalando dependencias del Frontend...${NC}"
cd front
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error instalando dependencias del Frontend${NC}"
    exit 1
fi

cd ..

echo -e "${GREEN}✅ ¡Proyecto configurado exitosamente!${NC}"
echo ""
echo -e "${BLUE}🚀 Para iniciar el proyecto:${NC}"
echo ""
echo "Terminal 1 (API):"
echo "  cd api && npm run dev"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd front && npm run dev"
echo ""
echo -e "${BLUE}📝 Luego abrí tu navegador en: http://localhost:5173${NC}"
echo ""
