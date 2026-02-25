# Cómo Iniciar PostgreSQL

**Importante:** Este proyecto usa **postgresql@15** (no @14).

## Problema
PostgreSQL no está corriendo y necesitas iniciarlo manualmente debido a permisos.

## Soluciones (en orden de preferencia)

### Opción 1: Script del proyecto (más fácil)
Desde la raíz del repo:
```bash
./start-postgres.sh
```
O el script simple:
```bash
./iniciar-postgres-simple.sh
```

### Opción 2: Usar brew services
```bash
brew services start postgresql@15
```

Si tienes problemas de permisos, puedes intentar:
```bash
sudo brew services start postgresql@15
```

### Opción 3: Iniciar directamente con pg_ctl
```bash
sudo /opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /opt/homebrew/var/postgresql@15 start
```

### Opción 4: Iniciar como proceso en background
```bash
/opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15 > /tmp/postgres.log 2>&1 &
```

### Opción 5: Usar launchd (macOS)
Si tienes un archivo de servicio de launchd, puedes iniciarlo con:
```bash
sudo launchctl load -w ~/Library/LaunchAgents/homebrew.mxcl.postgresql@15.plist
```

## Verificar que está corriendo

Después de iniciar, verifica con:
```bash
pg_isready -h localhost -p 5432
```

Deberías ver: `localhost:5432 - accepting connections`

## Verificar/Crear la base de datos

Una vez que PostgreSQL esté corriendo:
```bash
# Verificar conexión
psql -h localhost -p 5432 -U antonio -d postgres

# Si puedes conectarte, crear la base de datos:
CREATE DATABASE viborita;

# Salir
\q
```

O usar el script:
```bash
./check-db.sh
```

## Si nada funciona

1. Verifica que PostgreSQL esté instalado:
   ```bash
   brew list postgresql@15
   ```

2. Reinstala PostgreSQL si es necesario:
   ```bash
   brew reinstall postgresql@15
   ```

3. Inicializa el directorio de datos si no existe:
   ```bash
   /opt/homebrew/opt/postgresql@15/bin/initdb -D /opt/homebrew/var/postgresql@15
   ```
