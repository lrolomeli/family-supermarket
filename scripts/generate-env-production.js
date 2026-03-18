#!/usr/bin/env node
/**
 * Generates .env.production from existing local .env files.
 * 
 * Usage:
 *   node scripts/generate-env-production.js
 *   node scripts/generate-env-production.js --api-url http://192.168.1.50:5000
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const BACKEND_ENV = path.join(ROOT, "backend", ".env");
const FRONTEND_ENV = path.join(ROOT, "lomeli-super", ".env");
const OUTPUT = path.join(ROOT, ".env.production");

// Parse --api-url flag
const args = process.argv.slice(2);
const apiUrlIdx = args.indexOf("--api-url");
const customApiUrl = apiUrlIdx !== -1 ? args[apiUrlIdx + 1] : null;

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró: ${filePath}`);
    process.exit(1);
  }
  const vars = {};
  const content = fs.readFileSync(filePath, "utf8");
  let currentKey = null;
  let currentValue = "";
  let inMultiline = false;

  for (const line of content.split("\n")) {
    if (inMultiline) {
      currentValue += "\n" + line;
      // Check if this line closes the multiline value
      const trimmed = line.trim();
      if (trimmed.endsWith('"') || trimmed.endsWith("'")) {
        vars[currentKey] = currentValue.replace(/^["']|["']$/g, "");
        inMultiline = false;
        currentKey = null;
        currentValue = "";
      }
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx).trim();
    let value = trimmed.substring(eqIdx + 1).trim();

    // Check if value starts a multiline (starts with quote but doesn't end with one)
    if ((value.startsWith('"') && !value.endsWith('"')) ||
        (value.startsWith("'") && !value.endsWith("'"))) {
      currentKey = key;
      currentValue = value;
      inMultiline = true;
      continue;
    }

    // Remove surrounding quotes
    value = value.replace(/^["']|["']$/g, "");
    vars[key] = value;
  }

  return vars;
}

console.log("📦 Leyendo archivos .env locales...\n");

const backend = parseEnv(BACKEND_ENV);
const frontend = parseEnv(FRONTEND_ENV);

// Generate a strong JWT secret if the current one looks like a placeholder
let jwtSecret = backend.JWT_SECRET || "";
if (!jwtSecret || jwtSecret.includes("change-in-production") || jwtSecret.length < 32) {
  jwtSecret = crypto.randomBytes(48).toString("base64url");
  console.log("🔑 JWT_SECRET generado automáticamente");
}

// Generate a strong DB password if the current one is weak
let dbPassword = backend.DB_PASSWORD || "changeme";

// Escape the private key for single-line env format
const privateKey = backend.FIREBASE_PRIVATE_KEY || "";
const escapedKey = privateKey.includes("\\n")
  ? privateKey
  : privateKey.replace(/\n/g, "\\n");

const apiUrl = customApiUrl || frontend.VITE_API_BASE_URL || "http://localhost:5000";

const output = `# ============================================
# .env.production - Generado el ${new Date().toISOString().split("T")[0]}
# ============================================

# === Base de Datos ===
DB_NAME=${backend.DB_NAME || "lomeli_super"}
DB_USER=${backend.DB_USER || "postgres"}
DB_PASSWORD=${dbPassword}

# === Backend ===
JWT_SECRET=${jwtSecret}

# === Firebase Admin (backend) ===
FIREBASE_PROJECT_ID=${backend.FIREBASE_PROJECT_ID || ""}
FIREBASE_CLIENT_EMAIL=${backend.FIREBASE_CLIENT_EMAIL || ""}
FIREBASE_PRIVATE_KEY="${escapedKey}"

# === Firebase Client (frontend - se compila en el build) ===
VITE_FIREBASE_API_KEY=${frontend.VITE_FIREBASE_API_KEY || ""}
VITE_FIREBASE_AUTH_DOMAIN=${frontend.VITE_FIREBASE_AUTH_DOMAIN || ""}
VITE_FIREBASE_PROJECT_ID=${frontend.VITE_FIREBASE_PROJECT_ID || ""}
VITE_FIREBASE_STORAGE_BUCKET=${frontend.VITE_FIREBASE_STORAGE_BUCKET || ""}
VITE_FIREBASE_MESSAGING_SENDER_ID=${frontend.VITE_FIREBASE_MESSAGING_SENDER_ID || ""}
VITE_FIREBASE_APP_ID=${frontend.VITE_FIREBASE_APP_ID || ""}

# === URLs y Admin ===
# ⚠️  Cambia esto a la IP o dominio de tu servidor
VITE_API_BASE_URL=${apiUrl}
VITE_ADMIN_EMAIL=${frontend.VITE_ADMIN_EMAIL || ""}

# === Puertos (opcional) ===
FRONTEND_PORT=80
BACKEND_PORT=5000
`;

fs.writeFileSync(OUTPUT, output, "utf8");

console.log(`✅ Archivo generado: ${OUTPUT}\n`);
console.log("Variables incluidas:");
console.log(`   DB_NAME:          ${backend.DB_NAME || "lomeli_super"}`);
console.log(`   DB_USER:          ${backend.DB_USER || "postgres"}`);
console.log(`   DB_PASSWORD:      ${"*".repeat(Math.min(dbPassword.length, 12))}`);
console.log(`   JWT_SECRET:       ${jwtSecret.substring(0, 8)}...`);
console.log(`   FIREBASE_PROJECT: ${backend.FIREBASE_PROJECT_ID || "?"}`);
console.log(`   API_BASE_URL:     ${apiUrl}`);
console.log(`   ADMIN_EMAIL:      ${frontend.VITE_ADMIN_EMAIL || "?"}`);
console.log("");

if (!customApiUrl || apiUrl.includes("localhost")) {
  console.log("⚠️  VITE_API_BASE_URL apunta a localhost.");
  console.log("   Para producción, ejecuta:");
  console.log("   node scripts/generate-env-production.js --api-url http://TU_IP:5000");
  console.log("");
}

console.log("📋 Próximos pasos:");
console.log("   1. Revisa el archivo .env.production");
console.log("   2. Copia el proyecto al servidor Rocky Linux");
console.log("   3. docker compose --env-file .env.production up -d --build");
