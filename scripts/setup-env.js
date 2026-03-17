#!/usr/bin/env node
/**
 * setup-env.js
 * Uso: node scripts/setup-env.js <ruta-al-archivo-llave.json>
 * Ejemplo: node scripts/setup-env.js C:/Users/tu_usuario/Downloads/mi-llave.json
 *
 * Lee la llave de servicio de Firebase y llena backend/.env con los campos necesarios.
 */

const fs = require("fs");
const path = require("path");

const keyFilePath = process.argv[2];

if (!keyFilePath) {
  console.error("❌ Debes proporcionar la ruta al archivo JSON de la llave.");
  console.error("   Uso: node scripts/setup-env.js <ruta-al-archivo-llave.json>");
  process.exit(1);
}

// Leer y parsear el JSON
let key;
try {
  const raw = fs.readFileSync(path.resolve(keyFilePath), "utf8");
  key = JSON.parse(raw);
} catch (e) {
  console.error("❌ No se pudo leer el archivo:", e.message);
  process.exit(1);
}

const envPath = path.resolve(__dirname, "../backend/.env");

// Leer el .env actual
let envContent = fs.readFileSync(envPath, "utf8");

// Reemplazar los campos de Firebase
envContent = envContent
  .replace(/^FIREBASE_PROJECT_ID=.*$/m, `FIREBASE_PROJECT_ID=${key.project_id}`)
  .replace(/^FIREBASE_CLIENT_EMAIL=.*$/m, `FIREBASE_CLIENT_EMAIL=${key.client_email}`)
  .replace(/^FIREBASE_PRIVATE_KEY=.*$/m, `FIREBASE_PRIVATE_KEY="${key.private_key}"`);

fs.writeFileSync(envPath, envContent, "utf8");

console.log("✅ backend/.env actualizado con:");
console.log(`   FIREBASE_PROJECT_ID=${key.project_id}`);
console.log(`   FIREBASE_CLIENT_EMAIL=${key.client_email}`);
console.log(`   FIREBASE_PRIVATE_KEY=*** (cargado correctamente)`);
console.log("\n⚠️  Recuerda llenar manualmente:");
console.log("   - backend/.env → DB_PASSWORD");
console.log("   - lomeli-super/.env → todas las variables VITE_FIREBASE_*");
