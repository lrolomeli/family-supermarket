# Family Supermarket

Web app para que familia y amigos hagan pedidos de despensa. El administrador recibe las órdenes, gestiona precios y marca el estado de cada pedido.

## Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Autenticación:** Firebase Auth (Google Sign-In)

## Estructura

```
family-supermarket/
├── backend/          # API REST en Express
│   ├── db/
│   │   ├── init.sql  # Schema de la DB
│   │   ├── seed.sql  # Precios iniciales
│   │   └── setup.js  # Auto-init al arrancar
│   └── index.js
├── lomeli-super/     # Frontend React
│   └── src/
│       ├── components/   # Navbar, Login
│       ├── pages/        # Order, MyOrders, Admin
│       ├── data/         # Catálogo de productos
│       └── utils/        # Helpers de precios
└── scripts/
    ├── setup-env.js       # Llena backend/.env desde la llave de Firebase
    └── optimize-images.js # Convierte imágenes PNG a WebP
```

## Setup

### 1. Variables de entorno

Corre el script con tu llave de servicio de Firebase:
```bash
node scripts/setup-env.js ruta/a/tu-llave.json
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

Llena `backend/.env`:
```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lomeli_super
DB_USER=postgres
DB_PASSWORD=
```

### 2. Base de datos

Crea la DB en PostgreSQL:
```bash
psql -U postgres -c "CREATE DATABASE lomeli_super;"
```

El schema y seed se aplican automáticamente al arrancar el backend.

Para marcar un usuario como admin (después de su primer login):
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'tu-correo@gmail.com';
```

### 3. Correr el proyecto

Backend:
```bash
cd backend
npm install
npm run dev
```

Frontend:
```bash
cd lomeli-super
npm install
npm run dev
```

## Funcionalidades

**Usuario**
- Login con Google
- Crear órdenes seleccionando productos, cantidad y unidad (piezas o kg)
- Ver y editar sus órdenes con total estimado a pagar

**Administrador**
- Dashboard con estadísticas y gráficas
- Gestión de órdenes por usuario con cambio de status
- Editor de precios con búsqueda, guardado individual o masivo
- Importar/exportar precios en CSV
