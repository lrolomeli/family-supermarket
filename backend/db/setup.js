const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const runSetup = async (pool) => {
  try {
    const init = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
    await pool.query(init);
    console.log("✅ DB schema ready");

    // Run migrations to add columns that may be missing on existing tables
    const migrations = [
      "add-favorites-migration.sql",
      "add-proposed-changes-migration.sql",
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
  } catch (error) {
    console.error("❌ DB setup error:", error.message);
  }
};

module.exports = runSetup;
