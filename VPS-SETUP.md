# Configuración de VPS Ubuntu para Lomeli Super

Guía paso a paso para preparar un VPS Ubuntu nuevo y desplegar la aplicación.

## Requisitos

- VPS con Ubuntu 22.04+ 
- Acceso SSH como root o usuario con sudo
- Dominio apuntando a la IP del VPS (ej: super.luisrlp.com en Cloudflare)

---

## 1. Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

## 2. Instalar Docker

```bash
# Dependencias
sudo apt install -y ca-certificates curl gnupg

# Repo oficial de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Usar docker sin sudo
sudo usermod -aG docker $USER
```

Cierra la sesión SSH y vuelve a conectarte para que el grupo tome efecto.

Verifica:

```bash
docker --version
docker compose version
```

## 3. Instalar nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

## 4. Instalar Git y clonar el proyecto

```bash
sudo apt install -y git
cd ~
git clone <tu-repo-url> family-supermarket
cd family-supermarket
```

Si el repo es privado, necesitas configurar una SSH key o usar un token:

```bash
# Opción SSH key
ssh-keygen -t ed25519 -C "tu@email.com"
cat ~/.ssh/id_ed25519.pub
# Agregar la llave pública en GitHub → Settings → SSH Keys
```

## 5. Configurar variables de entorno

Opción A — Copiar desde el servidor anterior (recomendado):

```bash
# Desde tu máquina local o el servidor viejo
scp usuario@servidor-viejo:/ruta/family-supermarket/.env.production \
    usuario@servidor-nuevo:/home/usuario/family-supermarket/.env.production
```

Opción B — Crear desde cero:

```bash
cp .env.production.example .env.production
nano .env.production
# Llenar: DB password, Firebase keys, admin email, etc.
```

## 6. Restaurar backup de DB (si migras desde otro servidor)

Si vienes de otro servidor y tienes un backup:

```bash
# Copiar el backup al VPS nuevo (desde tu máquina o servidor viejo)
scp usuario@servidor-viejo:/ruta/backup.sql /tmp/backup.sql

# Levantar solo la DB
docker compose --env-file .env.production up -d db
sleep 5

# Crear la DB si no existe
docker compose --env-file .env.production exec db psql -U postgres -c "CREATE DATABASE lomeli_super;"

# Restaurar
cat /tmp/backup.sql | docker compose --env-file .env.production exec -T db psql -U postgres -d lomeli_super

# Verificar
docker compose --env-file .env.production exec db psql -U postgres -d lomeli_super -c "SELECT COUNT(*) FROM users;"
```

Si es un despliegue nuevo (sin datos previos), salta este paso — `setup.js` creará todo al arrancar.

## 7. Levantar la aplicación

```bash
docker compose --env-file .env.production up -d --build
```

Verificar:

```bash
docker compose ps                          # Todos los servicios corriendo
docker compose logs backend --tail 30      # Logs del backend
curl http://localhost:50000                 # Frontend responde
curl http://localhost:5000/products         # API responde
```

## 8. Configurar nginx como proxy

```bash
sudo nano /etc/nginx/sites-available/super
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

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/super /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 9. Actualizar DNS

En Cloudflare (o tu proveedor DNS), actualiza el registro A de `super.luisrlp.com` para que apunte a la IP del VPS nuevo.

Para obtener la IP pública del VPS:

```bash
curl ifconfig.me
```

## 10. Autorizar dominio/IP en Firebase

En la consola de Firebase → Authentication → Settings → Authorized domains, agrega el dominio o la IP pública del VPS nuevo para que los logins funcionen.

## 11. Verificar desde el navegador

Abre `https://super.luisrlp.com` y verifica que todo funcione.

---

## Comandos útiles post-setup

```bash
# Ver estado de los contenedores
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Reiniciar todo
docker compose --env-file .env.production restart

# Rebuild y deploy después de git pull
git pull
docker compose --env-file .env.production up -d --build

# Rebuild solo frontend
docker compose --env-file .env.production up -d --build frontend

# Acceder a la DB
docker compose --env-file .env.production exec db psql -U postgres -d lomeli_super

# Backup manual de la DB
docker compose --env-file .env.production exec -T db pg_dump -U postgres lomeli_super > backup-$(date +%Y%m%d).sql
```

## Backups automáticos (recomendado)

```bash
# Crear carpeta de backups
mkdir -p ~/backups

# Agregar cron job
crontab -e

# Backup diario a las 3am + limpiar backups de más de 30 días
0 3 * * * cd ~/family-supermarket && docker compose --env-file .env.production exec -T db pg_dump -U postgres lomeli_super > ~/backups/backup-$(date +\%Y\%m\%d).sql 2>/dev/null
0 4 * * * find ~/backups/ -name "backup-*.sql" -mtime +30 -delete
```

## Checklist

- [ ] Sistema actualizado
- [ ] Docker instalado y funcionando sin sudo
- [ ] nginx instalado
- [ ] Repo clonado
- [ ] `.env.production` configurado
- [ ] Backup restaurado (si aplica)
- [ ] `docker compose up -d --build` exitoso
- [ ] nginx configurado como proxy
- [ ] DNS actualizado
- [ ] Dominio/IP autorizado en Firebase
- [ ] App accesible desde el dominio
- [ ] Backups automáticos configurados
