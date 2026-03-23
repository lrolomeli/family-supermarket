# Configuración SMTP (Email)

La app usa email para:
- Notificar al admin cuando se crea una orden o se solicita un cambio
- Enviar enlaces de restablecimiento de contraseña a usuarios locales

Si no configuras SMTP, la app funciona normal pero sin enviar correos.

---

## 1. Crear una cuenta de Gmail dedicada (recomendado)

No uses tu cuenta personal. Crea una cuenta exclusiva para el proyecto, por ejemplo:
- `noreply.lomelisuper@gmail.com`
- `sistema.lomeli@gmail.com`

Esto mantiene separados los correos del sistema de tu bandeja personal.

## 2. Habilitar verificación en 2 pasos

La cuenta de Gmail necesita tener 2FA activado para poder generar App Passwords.

1. Entra a la cuenta de Gmail dedicada
2. Ve a https://myaccount.google.com/security
3. En "Cómo inicias sesión en Google", activa **Verificación en 2 pasos**
4. Sigue los pasos (necesitas un número de teléfono)

## 3. Generar App Password

1. Ve a https://myaccount.google.com/apppasswords
2. En "Nombre de la app", escribe algo como `Lomeli Super`
3. Haz clic en **Crear**
4. Google te dará una contraseña de 16 caracteres (ejemplo: `abcd efgh ijkl mnop`)
5. Copia esa contraseña **sin espacios**: `abcdefghijklmnop`

> Esta contraseña solo se muestra una vez. Si la pierdes, borra la anterior y genera una nueva.

## 4. Agregar variables al servidor

Edita `.env.production` en el servidor y agrega:

```env
SMTP_USER=tu-cuenta-dedicada@gmail.com
SMTP_PASS=abcdefghijklmnop
```

Reemplaza con tu cuenta y el App Password real.

## 5. Reconstruir el backend

```bash
docker compose --env-file .env.production up -d --build backend
```

Esto reemplaza el contenedor del backend con uno nuevo que lee las variables SMTP. La base de datos no se toca.

## 6. Verificar

Puedes probar de dos formas:

**Probar restablecimiento de contraseña:**
1. Ve a la pantalla de login → "Entrar con email y contraseña" → "¿Olvidaste tu contraseña?"
2. Ingresa un email de un usuario local registrado
3. Revisa la bandeja de entrada (y spam) del usuario

**Probar notificación de orden:**
1. Crea una orden desde una cuenta de usuario
2. Revisa la bandeja del email configurado en `ADMIN_EMAIL` / `VITE_ADMIN_EMAIL`

Si no llega el correo, revisa los logs del backend:
```bash
docker compose --env-file .env.production logs -f backend
```

Busca errores como `Error sending email:` en la salida.

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Invalid login` en logs | Verifica que el App Password sea correcto y sin espacios |
| No llegan correos | Revisa la carpeta de spam del destinatario |
| `Username and Password not accepted` | Asegúrate de usar un App Password, no la contraseña normal de Gmail |
| `Missing credentials` | Verifica que `SMTP_USER` y `SMTP_PASS` estén en `.env.production` y que reconstruiste el backend |

---

## Cambiar de cuenta SMTP después

Si necesitas cambiar la cuenta de envío:

1. Edita `SMTP_USER` y `SMTP_PASS` en `.env.production`
2. Reconstruye: `docker compose --env-file .env.production up -d --build backend`

No necesitas cambiar código. El backend lee las variables al arrancar.
