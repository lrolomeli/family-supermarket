const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixCategories() {
  try {
    console.log('Fixing category inconsistencies...');
    
    // Update categories table to use lowercase
    await pool.query("UPDATE categories SET name = LOWER(name) WHERE name != LOWER(name)");
    console.log('Updated categories to lowercase');
    
    // Update product categories to match proper categories
    const updates = [
      // Fruits
      { name: 'Fresa', category: 'frutas' },
      { name: 'Aguacate', category: 'frutas' },
      { name: 'Platano', category: 'frutas' },
      { name: 'Dominico', category: 'frutas' },
      { name: 'Uva Verde', category: 'frutas' },
      { name: 'Mango', category: 'frutas' },
      { name: 'Frutos Rojos (Berries)', category: 'frutas' },
      { name: 'Guayaba', category: 'frutas' },
      { name: 'Limon Con Semilla', category: 'frutas' },
      { name: 'Limon Sin Semilla', category: 'frutas' },
      { name: 'Manzana Roja', category: 'frutas' },
      { name: 'Manzana Verde', category: 'frutas' },
      { name: 'Piña', category: 'frutas' },
      { name: 'Papaya', category: 'frutas' },
      
      // Vegetables
      { name: 'Zanahoria', category: 'verduras' },
      { name: 'Chayote', category: 'verduras' },
      { name: 'Brocoli', category: 'verduras' },
      { name: 'Cebolla', category: 'verduras' },
      { name: 'Jitomate Rojo', category: 'verduras' },
      { name: 'Tomate Verde', category: 'verduras' },
      { name: 'Calabaza', category: 'verduras' },
      { name: 'Papa', category: 'verduras' },
    ];
    
    for (const update of updates) {
      await pool.query(
        'UPDATE products SET category = $1 WHERE name = $2',
        [update.category, update.name]
      );
      console.log(`Updated ${update.name} to category: ${update.category}`);
    }
    
    // Show final result
    const result = await pool.query('SELECT id, name, category FROM products ORDER BY id');
    console.log('\nFinal product categories:');
    result.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Category: "${p.category}"`);
    });
    
    const categoriesResult = await pool.query('SELECT * FROM categories ORDER BY name');
    console.log('\nAvailable categories:');
    categoriesResult.rows.forEach(c => {
      console.log(`ID: ${c.id}, Name: "${c.name}"`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixCategories();
