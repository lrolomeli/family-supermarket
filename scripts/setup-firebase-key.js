#!/usr/bin/env node
/**
 * Reads a Firebase service account JSON key and updates backend/.env
 * with the Firebase credentials.
 *
 * Usage:
 *   node scripts/setup-firebase-key.js path/to/key.json
 */

const fs = require("fs");
const path = require("path");

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Uso: node scripts/setup-firebase-key.js <ruta-a-key.json>");
  process.exit(1);
}

if (!fs.existsSync(keyPath)) {
  console.error(`❌ No se encontró: ${keyPath}`);
  process.exit(1);
}

const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));

if (!key.project_id || !key.client_email || !key.private_key) {
  console.error("❌ El archivo no parece ser una llave de servicio de Firebase válida");
  process.exit(1);
}

const BACKEND_ENV = path.join(__dirname, "..", "backend", ".env");

// Read existing backend/.env or create a template
let envContent = "";
if (fs.existsSync(BACKEND_ENV)) {
  envContent = fs.readFileSync(BACKEND_ENV, "utf8");
} else {
  envContent = `FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=""

DB_HOST=localhost
DB_PORT=5432
DB_NAME=lomeli_super
DB_USER=postgres
DB_PASSWORD=

JWT_SECRET=
ADMIN_EMAIL=
`;
}

// Helper: replace or add a key in env content
const setEnvValue = (content, envKey, value) => {
  // For multiline private key, handle specially
  if (envKey === "FIREBASE_PRIVATE_KEY") {
    // Remove existing FIREBASE_PRIVATE_KEY (could be multiline)
    content = content.replace(
      /FIREBASE_PRIVATE_KEY=["']?[\s\S]*?-----END PRIVATE KEY-----[\s\S]*?["']?\n?/,
      ""
    );
    // Add it back
    const escaped = value.replace(/\n/g, "\\n");
    return content.trimEnd() + `\nFIREBASE_PRIVATE_KEY="${escaped}"\n`;
  }

  const regex = new RegExp(`^${envKey}=.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `${envKey}=${value}`);
  }
  return content.trimEnd() + `\n${envKey}=${value}\n`;
};

envContent = setEnvValue(envContent, "FIREBASE_PROJECT_ID", key.project_id);
envContent = setEnvValue(envContent, "FIREBASE_CLIENT_EMAIL", key.client_email);
envContent = setEnvValue(envContent, "FIREBASE_PRIVATE_KEY", key.private_key);

fs.writeFileSync(BACKEND_ENV, envContent, "utf8");

console.log(`✅ backend/.env actualizado con:`);
console.log(`   FIREBASE_PROJECT_ID:    ${key.project_id}`);
console.log(`   FIREBASE_CLIENT_EMAIL:  ${key.client_email}`);
console.log(`   FIREBASE_PRIVATE_KEY:   ${key.private_key.substring(0, 40)}...`);
console.log("");
console.log("📋 Próximos pasos:");
console.log("   1. Regenera .env.production:");
console.log("      node scripts/generate-env-production.js --api-url https://super.luisrlp.com/api");
console.log("   2. Copia .env.production al servidor");
console.log("   3. Reconstruye: docker compose --env-file .env.production up -d --build");
