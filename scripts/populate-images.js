/**
 * Populate product images from Pexels API.
 *
 * Usage:
 *   PEXELS_API_KEY=<your_key> node scripts/populate-images.js
 *
 * Requires: pg, sharp, dotenv (all already in backend deps).
 * Run from project root so that dotenv picks up backend/.env.
 */

const path = require("path");

// Resolve backend node_modules so we can reuse its deps
const backendDir = path.join(__dirname, "../backend");
require(path.join(backendDir, "node_modules/dotenv")).config({ path: path.join(backendDir, ".env") });

const { Pool } = require(path.join(backendDir, "node_modules/pg"));
const sharp = require(path.join(backendDir, "node_modules/sharp"));
const fs = require("fs");
const https = require("https");

// ── Config ──────────────────────────────────────────────────────────────────

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_API_KEY) {
  console.error("Set PEXELS_API_KEY env var before running this script.");
  process.exit(1);
}

const ASSETS_DIR = path.join(__dirname, "../lomeli-super/public/assets");
const DELAY_MS = 250; // polite delay between API calls

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ── Spanish → English dictionary ────────────────────────────────────────────

const translations = {
  aguacate: "avocado",
  ajo: "garlic",
  apio: "celery",
  arugula: "arugula",
  avena: "oats",
  betabel: "beetroot",
  berros: "watercress",
  blueberry: "blueberry",
  brocoli: "broccoli",
  calabaza: "squash",
  camote: "sweet potato",
  cebolla: "onion",
  "cebolla cambray": "spring onion",
  "cebolla morada": "red onion",
  "cebolla rabo": "green onion",
  cebollin: "chives",
  champinones: "mushrooms",
  champipack: "mushrooms",
  chayote: "chayote",
  "chile mirasol": "guajillo chili",
  "chile de arbol": "arbol chili",
  "chile jalapeno": "jalapeno pepper",
  "chile verde": "green chili",
  cilantro: "cilantro",
  col: "cabbage",
  coliflor: "cauliflower",
  curcuma: "turmeric",
  durazno: "peach",
  ejotes: "green beans",
  elotes: "corn on the cob",
  esparragos: "asparagus",
  espinaca: "spinach",
  espinacas: "spinach",
  frambuesa: "raspberry",
  fresas: "strawberry",
  garbanzo: "chickpea",
  granada: "pomegranate",
  guayaba: "guava",
  hierbabuena: "mint",
  jengibre: "ginger",
  jicama: "jicama",
  jitomate: "tomato",
  kiwi: "kiwi",
  lechuga: "lettuce",
  "lechuga romana": "romaine lettuce",
  lentejas: "lentils",
  limon: "lime",
  "limon con semilla": "lime",
  "limon sin semilla": "lime",
  mandarina: "tangerine",
  "manzana roja": "red apple",
  "manzana verde": "green apple",
  "manzana golden": "golden apple",
  melon: "melon",
  "melon chino": "cantaloupe",
  "melon valenciano": "honeydew melon",
  naranja: "orange",
  "naranja con semilla": "orange",
  "naranja sin semilla": "orange",
  nopales: "nopales cactus",
  nuez: "walnut",
  "oregano seco": "dried oregano",
  papa: "potato",
  "papa cambray": "baby potato",
  papaya: "papaya",
  pepino: "cucumber",
  pera: "pear",
  perejil: "parsley",
  "pimiento rojo": "red bell pepper",
  "pimiento verde": "green bell pepper",
  "pimiento naranja": "orange bell pepper",
  "pimiento amarillo": "yellow bell pepper",
  pina: "pineapple",
  platano: "banana",
  "platano macho": "plantain",
  "penca de platano": "banana bunch",
  "penca de platano dominico": "baby banana bunch",
  "penca de platano macho": "plantain bunch",
  poro: "leek",
  rabanos: "radish",
  sandia: "watermelon",
  "sandia bola": "watermelon",
  "sandia grande": "watermelon",
  tamarindo: "tamarind",
  tejocote: "tejocote fruit",
  tomate: "tomato",
  "tomate cherry": "cherry tomato",
  tomatillo: "tomatillo",
  toronja: "grapefruit",
  tuna: "prickly pear fruit",
  "uvas moradas": "purple grapes",
  "uvas verdes": "green grapes",
  verdolagas: "purslane",
  yuca: "cassava",
  zanahoria: "carrot",
  "baby zanahoria": "baby carrot",
  zarzamora: "blackberry",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Remove parenthetical qualifiers like (caja), (manojo), (bolsa), (bote 1lt) */
function cleanName(name) {
  return name
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Translate cleaned Spanish name to English search term */
function translate(cleaned) {
  // Try exact match first
  if (translations[cleaned]) return translations[cleaned];

  // Try longest prefix match
  const sorted = Object.keys(translations).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (cleaned.startsWith(key)) return translations[key];
  }

  // Fallback: return as-is (some names like "kiwi" work in English)
  return cleaned;
}

/** Fetch JSON from Pexels API */
function pexelsFetch(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=square`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers: { Authorization: PEXELS_API_KEY } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/** Download image buffer from URL */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Process and save image, return relative path */
async function saveImage(buffer, productId) {
  const filename = `product-${productId}.webp`;
  const outputPath = path.join(ASSETS_DIR, filename);
  await sharp(buffer)
    .resize(400, 400, { fit: "cover" })
    .webp({ quality: 80 })
    .toFile(outputPath);
  return `/assets/${filename}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Ensure assets dir exists
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const { rows: products } = await pool.query(
    "SELECT id, name, image FROM products ORDER BY id"
  );

  console.log(`Found ${products.length} products.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  // Cache: search term → saved image path (allows reuse across similar products)
  const imageCache = {};

  for (const product of products) {
    const cleaned = cleanName(product.name);
    const searchTerm = translate(cleaned);

    // Reuse cached image for same search term
    if (imageCache[searchTerm]) {
      await pool.query("UPDATE products SET image = $1 WHERE id = $2", [imageCache[searchTerm], product.id]);
      console.log(`  [cache] ${product.name} → ${searchTerm} → ${imageCache[searchTerm]}`);
      updated++;
      continue;
    }

    try {
      console.log(`  [fetch] ${product.name} → "${searchTerm}" ...`);
      const result = await pexelsFetch(searchTerm);

      if (!result.photos || result.photos.length === 0) {
        console.log(`    ⚠ No image found, keeping default.`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      const photoUrl = result.photos[0].src.medium;
      const buffer = await downloadImage(photoUrl);
      const savedPath = await saveImage(buffer, product.id);

      await pool.query("UPDATE products SET image = $1 WHERE id = $2", [savedPath, product.id]);
      imageCache[searchTerm] = savedPath;
      console.log(`    ✓ Saved ${savedPath}`);
      updated++;
    } catch (err) {
      console.error(`    ✗ Error for "${product.name}": ${err.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
