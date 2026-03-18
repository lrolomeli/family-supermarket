const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixImages() {
  try {
    const productImages = {
      1: '/assets/strawberry.webp',
      2: '/assets/avocado.webp',
      3: '/assets/bananas.webp',
      4: '/assets/dominican.webp',
      5: '/assets/greengrape.webp',
      6: '/assets/mango.webp',
      7: '/assets/berries.webp',
      8: '/assets/carrot.webp',
      9: '/assets/guava.webp',
      10: '/assets/squash.webp',
      11: '/assets/lemonseed.webp',
      12: '/assets/lemon.webp',
      13: '/assets/broccoli.webp',
      14: '/assets/redapple.webp',
      15: '/assets/greenapple.webp',
      16: '/assets/pineapple.webp',
      17: '/assets/onion.webp',
      18: '/assets/tomato.webp',
      19: '/assets/tomatillo.webp',
      20: '/assets/zucchini.webp',
      21: '/assets/potato.webp',
      22: '/assets/papaya.webp'
    };

    console.log('Updating product images...');
    
    for (const [id, imagePath] of Object.entries(productImages)) {
      await pool.query(
        'UPDATE products SET image = $1 WHERE id = $2',
        [imagePath, parseInt(id)]
      );
      console.log(`Updated product ${id} with image: ${imagePath}`);
    }
    
    console.log('All product images updated successfully!');
    
    // Verify the updates
    const result = await pool.query('SELECT id, name, image FROM products ORDER BY id LIMIT 5');
    console.log('\nVerification - First 5 products:');
    result.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Image: ${p.image}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

fixImages();
