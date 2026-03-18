const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkImages() {
  try {
    const res = await pool.query('SELECT id, name, image FROM products WHERE image IS NOT NULL LIMIT 5');
    console.log('Product images in database:');
    res.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Image: ${p.image}`);
    });
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkImages();
