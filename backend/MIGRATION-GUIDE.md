# Guía de Migración de Servidor

Pasos para mover la aplicación a un servidor nuevo sin perder datos de producción.

## Resumen

```
Servidor Actual                    Servidor Nuevo
┌─────────────┐                   ┌─────────────┐
│  PostgreSQL  │ ── pg_dump ──►   │  backup.sql  │
│  (con datos) │                  │              │
└─────────────┘                   │  git clone   │
                                  │  restaurar   │
                                  │  deploy      │
                                  └─────────────┘
```

## Paso 1: Backup en el servidor actual

Conectarte al servidor actual y exportar la base de datos completa:

```bash
# En el servidor actual
cd /ruta/al/proyecto

# Exportar toda la DB (esquema + datos)
docker compose --env-file .env.production exec -T db pg_dump -U postgres lomeli_super > backup-$(date +%Y%m%d).sql

# Verificar que el archivo tiene contenido
ls -lh backup-*.sql
```

Esto genera un archivo `.sql` con todo: tablas, datos de usuarios, órdenes, favoritos, invitaciones, settings, etc.

## Paso 2: Copiar el backup al servidor nuevo

```bash
# Desde tu máquina local (o desde el servidor actual)
scp usuario@servidor-actual:/ruta/al/proyecto/backup-20260323.sql usuario@servidor-nuevo:/tmp/
```

O si prefieres, descárgalo a tu máquina local primero y luego súbelo:

```bash
# Descargar a tu máquina
scp usuario@servidor-actual:/ruta/al/proyecto/backup-20260323.sql ./

# Subir al servidor nuevo
scp backup-20260323.sql usuario@servidor-nuevo:/tmp/
```

## Paso 3: Preparar el servidor nuevo

```bash
# En el servidor nuevo
# 1. Instalar Docker y Docker Compose si no están instalados

# 2. Clonar el repositorio
git clone <tu-repo-url> family-supermarket
cd family-supermarket

# 3. Configurar el archivo de entorno
cp .env.production.example .env.production
# Editar .env.production con los valores correctos (DB password, Firebase keys, etc.)
nano .env.production

# 4. Levantar SOLO la base de datos primero
docker compose --env-file .env.production up -d db

# 5. Esperar unos segundos a que PostgreSQL inicie
sleep 5

# 6. Verificar que la DB está corriendo
docker compose --env-file .env.production exec db psql -U postgres -c "SELECT 1;"
```

## Paso 4: Restaurar el backup

```bash
# Restaurar el backup en la DB del servidor nuevo
cat /tmp/backup-20260323.sql | docker compose --env-file .env.production exec -T db psql -U postgres -d lomeli_super
```

Si la base de datos `lomeli_super` no existe aún:

```bash
# Crear la DB primero
docker compose --env-file .env.production exec db psql -U postgres -c "CREATE DATABASE lomeli_super;"

# Luego restaurar
cat /tmp/backup-20260323.sql | docker compose --env-file .env.production exec -T db psql -U postgres -d lomeli_super
```

## Paso 5: Levantar la aplicación completa

```bash
# Levantar todos los servicios
docker compose --env-file .env.production up -d --build
```

Al arrancar, el backend ejecutará `setup.js` que:
- Corre `init.sql` → no hace nada porque las tablas ya existen del backup
- Corre las migraciones → no hacen nada porque ya están aplicadas en el backup
- Corre `seed.sql` → actualiza el catálogo de productos sin duplicar
- Verifica admin → no crea uno nuevo porque ya existe en el backup

## Paso 6: Verificar

```bash
# Verificar que los datos están
docker compose --env-file .env.production exec db psql -U postgres -d lomeli_super -c "SELECT COUNT(*) FROM users;"
docker compose --env-file .env.production exec db psql -U postgres -d lomeli_super -c "SELECT COUNT(*) FROM orders;"
docker compose --env-file .env.production exec db psql -U postgres -d lomeli_super -c "SELECT COUNT(*) FROM products;"

# Verificar logs del backend
docker compose logs backend

# Probar la app en el navegador
curl http://localhost:50000
```

## Paso 7: Configurar nginx externo (si aplica)

Si usas nginx externo como proxy (como en el servidor actual):

```bash
# Instalar nginx
sudo dnf install nginx  # Rocky Linux
# o
sudo apt install nginx  # Ubuntu/Debian

# Crear configuración del sitio
sudo nano /etc/nginx/conf.d/super.conf
```

Contenido:

```nginx
server {
    listen 80;
    server_name super.luisrlp.com;

    location /api/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:50000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Verificar y reiniciar nginx
sudo nginx -t
sudo systemctl restart nginx
```

## Paso 8: Actualizar DNS (si cambias de IP)

Si el servidor nuevo tiene una IP diferente, actualiza el registro A en Cloudflare (o tu proveedor DNS) para que `super.luisrlp.com` apunte a la nueva IP.

---

## Checklist rápido

- [ ] Backup de la DB en servidor actual (`pg_dump`)
- [ ] Copiar backup al servidor nuevo (`scp`)
- [ ] Clonar repo en servidor nuevo
- [ ] Configurar `.env.production`
- [ ] Levantar DB y restaurar backup
- [ ] Levantar app completa (`docker compose up -d --build`)
- [ ] Verificar datos y funcionamiento
- [ ] Configurar nginx externo
- [ ] Actualizar DNS si cambió la IP
- [ ] Verificar que todo funciona desde el dominio

## Backups periódicos (recomendado)

Para no depender de hacer el backup manualmente antes de migrar, puedes programar backups automáticos con cron:

```bash
# Editar crontab
crontab -e

# Agregar backup diario a las 3am
0 3 * * * cd /ruta/al/proyecto && docker compose --env-file .env.production exec -T db pg_dump -U postgres lomeli_super > /ruta/backups/backup-$(date +\%Y\%m\%d).sql 2>/dev/null

# Opcional: borrar backups de más de 30 días
0 4 * * * find /ruta/backups/ -name "backup-*.sql" -mtime +30 -delete
```
