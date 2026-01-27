# Resolver Divergencia de Ramas Git

## Situación Actual
- **Commit local**: `f7da866` - "Agregamos varias skins de los simpsons, stormtrooper y gandalf del señor de los anillos"
- **Commits remotos**: 14 commits que no tienes localmente
- Las ramas han divergido

## Solución

### Opción 1: Merge (Recomendado)
Ya está configurado para hacer merge. Cuando tengas conexión a internet, ejecuta:

```bash
git pull origin antonio/cosas/hinchas
```

Esto creará un commit de merge que combinará tus cambios locales con los cambios remotos.

### Opción 2: Rebase (Si prefieres mantener historial lineal)
Si prefieres reorganizar tus commits encima de los remotos:

```bash
git pull --rebase origin antonio/cosas/hinchas
```

Esto moverá tu commit local encima de los commits remotos.

### Opción 3: Ver cambios antes de hacer merge
Para ver qué cambios hay en el remoto antes de hacer merge:

```bash
git fetch origin
git log HEAD..origin/antonio/cosas/hinchas --oneline
git diff HEAD origin/antonio/cosas/hinchas
```

## Si hay conflictos después del pull

Si hay conflictos de merge, Git te indicará qué archivos tienen conflictos. Luego:

1. Resuelve los conflictos manualmente en los archivos indicados
2. Marca los archivos como resueltos: `git add <archivo>`
3. Completa el merge: `git commit`

## Configuración actual

```bash
git config pull.rebase false  # Configurado para hacer merge
```

Para cambiar a rebase por defecto:
```bash
git config pull.rebase true
```
