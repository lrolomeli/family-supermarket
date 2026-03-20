# Family Supermarket

Web app para que familia y amigos hagan pedidos de despensa. El administrador recibe las órdenes, gestiona precios y marca el estado de cada pedido.

## Stack

- **Frontend:** React + Vite + nginx
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Autenticación:** Firebase Auth (Google Sign-In) + login local con email/password
- **Deploy:** Docker Compose

## Estructura

```
family-supermarket/
├── backend/          # API REST en Express
│   ├── db/
│   │   ├── init.sql  # Schema de la DB
│   │   ├── seed.sql  # Productos iniciales
│   │   └── setup.js  # Auto-init, migraciones y seed al arrancar
│   ├── Dockerfile
│   └── index.js
├── lomeli-super/     # Frontend React
│   ├── src/
│   │   ├── components/   # Navbar, Login
│   │   ├── pages/        # Order, MyOrders, Admin, Register, etc.
│   │   └── utils/        # Helpers de precios
│   ├── Dockerfile
│   └── nginx.conf
├── scripts/
│   └── generate-env-production.js  # Genera .env.production desde .env locales
├── docker-compose.yml
└── .env.production.example
```

---

## Desarrollo local

### 1. Variables de entorno

Llena `backend/.env`:
```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lomeli_super
DB_USER=postgres
DB_PASSWORD=
JWT_SECRET=cualquier-string-para-dev
```

Llena `lomeli-super/.env`:
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=http://localhost:5000
VITE_ADMIN_EMAIL=tu-correo@gmail.com
```

### 2. Base de datos

Crea la DB en PostgreSQL:
```bash
psql -U postgres -c "CREATE DATABASE lomeli_super;"
```

El schema, migraciones y seed se aplican automáticamente al arrancar el backend.

### 3. Correr el proyecto

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (otra terminal)
cd lomeli-super
npm install
npm run dev
```

---

## Deploy con Docker

### 1. Generar .env.production

```bash
node scripts/generate-env-production.js --api-url http://TU_IP:5000
```

Esto lee los `.env` locales y genera `.env.production` en la raíz. Revísalo y ajusta lo necesario.

### 2. Copiar al servidor

```bash
# Clonar el repo en el servidor
git clone <tu-repo-url>

# Copiar .env.production manualmente (tiene secretos)
scp .env.production usuario@TU_IP:/ruta/al/proyecto/.env.production
```

### 3. Construir y levantar

```bash
docker compose --env-file .env.production up -d --build
```

### 4. Comandos útiles

```bash
# Ver logs
docker compose --env-file .env.production logs -f

# Ver logs de un servicio específico
docker compose --env-file .env.production logs -f backend

# Reiniciar todo
docker compose --env-file .env.production restart

# Parar todo
docker compose --env-file .env.production down

# Borrar TODO y empezar de cero (containers, volumes, images)
docker compose --env-file .env.production down -v --rmi all

# Reconstruir después de cambios
docker compose --env-file .env.production up -d --build
```

### 5. Firebase Console

Agrega la IP/dominio de tu servidor en:
- Firebase Console → Authentication → Settings → Authorized domains

### 6. Primer admin

Al desplegar con la DB vacía, el backend automáticamente:
- Crea un usuario admin con el email de `VITE_ADMIN_EMAIL`
- Password por defecto: `admin123` (o el valor de `ADMIN_DEFAULT_PASSWORD` en `.env.production`)
- Entra con email/password desde la pantalla de login

Si usas Google Sign-In, el email que coincida con `VITE_ADMIN_EMAIL` se promueve a admin automáticamente.

### 7. Notificaciones por email (opcional)

El admin recibe un email cuando un usuario crea una orden o solicita un cambio. Para activarlo, agrega en `.env.production`:

```env
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=tu-app-password
```

Necesitas generar un "App Password" en Google (no uses tu contraseña normal):
1. Ve a https://myaccount.google.com/apppasswords
2. Genera una contraseña para "Mail"
3. Usa esa contraseña en `SMTP_PASS`

Si no configuras estas variables, la app funciona normal sin enviar emails.

---

## Funcionalidades

**Usuario**
- Login con Google o con email/password (por invitación)
- Crear órdenes seleccionando productos, cantidad y unidad (piezas o kg)
- Ver y editar órdenes pendientes
- Historial de órdenes y favoritos
- Solicitar cambios en órdenes en progreso

**Administrador**
- Dashboard con estadísticas y gráficas (auto-refresh cada 3 min)
- Notificaciones por email de nuevas órdenes y solicitudes de cambio
- Gestión de órdenes por usuario con cambio de status
- Editor de precios con búsqueda, guardado individual o masivo
- Importar/exportar precios en CSV
- Gestión de usuarios (aprobar/rechazar)
- Crear enlaces de invitación para nuevos usuarios
- Crear y editar productos con imágenes
