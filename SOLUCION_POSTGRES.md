# Solución para PostgreSQL después de reiniciar

## Problema identificado
El directorio de datos de PostgreSQL pertenece a otro usuario (`gabimarin`) y tu usuario actual (`antoniomaringarff`) no tiene permisos.

## Soluciones

### Opción 1: Cambiar el propietario del directorio (Recomendado)
```bash
sudo chown -R $(whoami) /opt/homebrew/var/postgresql@15
```

Luego inicia PostgreSQL:
```bash
./iniciar-postgres-simple.sh
```

### Opción 2: Iniciar como el usuario correcto
Si `gabimarin` es otro usuario de la Mac, puedes iniciar sesión como ese usuario o usar `su`:
```bash
su - gabimarin
brew services start postgresql@15
exit
```

### Opción 3: Usar un directorio de datos diferente
Si prefieres mantener los datos separados, puedes crear un nuevo cluster:
```bash
/opt/homebrew/opt/postgresql@15/bin/initdb -D ~/postgres-data
/opt/homebrew/opt/postgresql@15/bin/postgres -D ~/postgres-data
```

Y actualizar tu `.env` para apuntar a ese directorio.

## Después de iniciar PostgreSQL

Verifica que esté corriendo:
```bash
pg_isready -h localhost -p 5432
```

Verifica o crea la base de datos:
```bash
psql -h localhost -p 5432 -U antonio -d postgres -c "CREATE DATABASE viborita;"
```

O usa el script:
```bash
./check-db.sh
```
