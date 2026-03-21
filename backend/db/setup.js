const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const runSetup = async (pool) => {
  try {
    const init = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
    await pool.query(init);
    console.log("✅ DB schema ready");

    // Run migrations to add columns that may be missing on existing tables
    const migrations = [
      "add-favorites-migration.sql",
      "add-proposed-changes-migration.sql",
      "add-invitations-migration.sql",
      "add-sell-by-migration.sql",
      "add-available-migration.sql",
    ];
    for (const file of migrations) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, "utf8");
        await pool.query(sql);
      }
    }
    console.log("✅ DB migrations ready");

    // Sync is_delivered flag for any orders marked delivered but not flagged
    await pool.query(
      "UPDATE orders SET is_delivered = true, delivered_at = COALESCE(delivered_at, updated_at, CURRENT_TIMESTAMP) WHERE status = 'delivered' AND is_delivered = false"
    );

    const seed = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8");
    await pool.query(seed);
    console.log("✅ DB seed ready");

    // Create default admin if no users exist (first deployment)
    const { rows: users } = await pool.query("SELECT COUNT(*) as count FROM users");
    if (parseInt(users[0].count) === 0) {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "admin@lomeli.com";
      const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || "admin123";
      const uid = `local_${crypto.randomBytes(16).toString("hex")}`;
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      await pool.query(
        "INSERT INTO users (uid, email, password_hash, display_name, auth_type, is_approved, is_admin) VALUES ($1, $2, $3, $4, 'local', true, true)",
        [uid, adminEmail, passwordHash, "Admin"]
      );
      console.log(`✅ Admin creado: ${adminEmail} / ${adminPassword}`);
      console.log("⚠️  Cambia la contraseña del admin después del primer login");
    }
  } catch (error) {
    console.error("❌ DB setup error:", error.message);
  }
};

module.exports = runSetup;
