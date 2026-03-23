# Backend — Lomeli Super

## Base de Datos y Migraciones

### Cómo funciona

La base de datos es PostgreSQL, corriendo en Docker con un volumen persistente. Los datos de usuarios, órdenes, favoritos, etc. sobreviven entre deploys porque el volumen no se borra al recrear contenedores.

### Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `db/init.sql` | Esquema inicial. Crea tablas con `CREATE TABLE IF NOT EXISTS`. Solo tiene efecto real en una DB nueva. |
| `db/seed.sql` | Datos iniciales (catálogo de productos). Usa `ON CONFLICT ... DO UPDATE` para no duplicar. |
| `db/setup.js` | Orquestador. Corre `init.sql` → migraciones → `seed.sql` → crea admin si no existe. |
| `db/add-*-migration.sql` | Migraciones incrementales. Cada una agrega tablas o columnas nuevas. |

### Flujo de ejecución al hacer deploy

```
docker compose up -d --build
        │
        ▼
  Backend arranca
        │
        ▼
  setup.js se ejecuta
        │
        ├── 1. Corre init.sql (CREATE TABLE IF NOT EXISTS — no borra nada)
        │
        ├── 2. Corre cada migración en orden:
        │       add-favorites-migration.sql
        │       add-proposed-changes-migration.sql
        │       add-invitations-migration.sql
        │       add-sell-by-migration.sql
        │       add-available-migration.sql
        │       add-multiuse-invitations-migration.sql
        │       add-settings-migration.sql
        │
        ├── 3. Corre seed.sql (INSERT ... ON CONFLICT DO UPDATE)
        │
        └── 4. Crea admin por defecto si no hay usuarios
```

### Cómo agregar un cambio al esquema

1. Crea un archivo de migración en `db/`:
   ```
   db/add-mi-cambio-migration.sql
   ```

2. Usa sentencias idempotentes (seguras de correr múltiples veces):
   ```sql
   -- Agregar tabla nueva
   CREATE TABLE IF NOT EXISTS mi_tabla (...);

   -- Agregar columna a tabla existente
   ALTER TABLE productos ADD COLUMN IF NOT EXISTS mi_columna TEXT DEFAULT '';

   -- Insertar dato por defecto
   INSERT INTO settings (key, value) VALUES ('mi_setting', 'true')
   ON CONFLICT (key) DO NOTHING;
   ```

3. Registra la migración en `setup.js` dentro del array `migrations`:
   ```js
   const migrations = [
     // ... migraciones existentes
     "add-mi-cambio-migration.sql",
   ];
   ```

4. Haz deploy normalmente. `setup.js` ejecutará la nueva migración sin afectar datos existentes.

### Reglas importantes

- **NUNCA** uses `docker compose down -v` en producción — el flag `-v` borra el volumen de la DB y pierdes todos los datos
- **NUNCA** uses `DROP TABLE` o `DROP COLUMN` en migraciones sin respaldo
- **SIEMPRE** usa `IF NOT EXISTS` / `IF EXISTS` en migraciones
- **SIEMPRE** usa `ON CONFLICT` en seeds para no duplicar datos
- Las migraciones deben ser idempotentes: correr 1 o 100 veces debe dar el mismo resultado

### Comandos útiles

```bash
# Deploy completo
docker compose --env-file .env.production up -d --build

# Solo frontend
docker compose --env-file .env.production up -d --build frontend

# Ver logs del backend
docker compose logs -f backend

# Acceder a la DB en producción
docker compose exec db psql -U postgres -d lomeli_super

# Backup de la DB
docker compose exec db pg_dump -U postgres lomeli_super > backup.sql

# Restaurar backup
cat backup.sql | docker compose exec -T db psql -U postgres -d lomeli_super
```
