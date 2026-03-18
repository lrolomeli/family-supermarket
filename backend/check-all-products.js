const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkAllProducts() {
  try {
    const res = await pool.query('SELECT id, name, image FROM products ORDER BY id LIMIT 10');
    console.log('All products:');
    res.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Image: ${p.image || 'NULL'}`);
    });
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAllProducts();
