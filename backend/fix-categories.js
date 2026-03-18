const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkAndFixCategories() {
  try {
    console.log('Checking product categories...');
    
    // Check current categories
    const result = await pool.query('SELECT id, name, category FROM products ORDER BY id');
    console.log('Current products:');
    result.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Category: "${p.category}"`);
    });
    
    // Check categories table
    const categoriesResult = await pool.query('SELECT * FROM categories');
    console.log('\nAvailable categories:');
    categoriesResult.rows.forEach(c => {
      console.log(`ID: ${c.id}, Name: "${c.name}"`);
    });
    
    // Fix products with null/empty categories
    await pool.query("UPDATE products SET category = 'general' WHERE category IS NULL OR category = ''");
    console.log('\nFixed null/empty categories to "general"');
    
    // Show updated products
    const updatedResult = await pool.query('SELECT id, name, category FROM products ORDER BY id');
    console.log('\nUpdated products:');
    updatedResult.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Category: "${p.category}"`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndFixCategories();
