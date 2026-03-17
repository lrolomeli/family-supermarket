const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const runSetup = async (pool) => {
  try {
    const init = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
    await pool.query(init);
    console.log("✅ DB schema ready");

    const seed = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8");
    await pool.query(seed);
    console.log("✅ DB seed ready");
  } catch (error) {
    console.error("❌ DB setup error:", error.message);
  }
};

module.exports = runSetup;
