#!/usr/bin/env node
/**
 * optimize-images.js
 * Redimensiona y convierte todas las imágenes PNG de public/assets a WebP 200x200px
 * Uso: node scripts/optimize-images.js
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.resolve(__dirname, "../lomeli-super/public/assets");
const SIZE = 200;

const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".png"));

(async () => {
  console.log(`Optimizando ${files.length} imágenes...\n`);

  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(INPUT_DIR, file.replace(".png", ".webp"));

    const before = (fs.statSync(inputPath).size / 1024).toFixed(1);

    await sharp(inputPath)
      .resize(SIZE, SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .webp({ quality: 85 })
      .toFile(outputPath);

    const after = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(`✅ ${file}: ${before}KB → ${after}KB`);
  }

  console.log("\n✔ Listo. Ahora actualiza products.jsx para usar .webp en lugar de .png");
})();
