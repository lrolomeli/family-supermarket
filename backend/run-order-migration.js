const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runMigration() {
  try {
    console.log('Running order status migration...');
    
    // Add additional fields to orders table
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS notes TEXT
    `);
    console.log('✓ Added order fields');
    
    // Create favorites table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        products JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created favorites table');
    
    // Update existing orders
    await pool.query(`
      UPDATE orders SET status = 'pending' WHERE status IS NULL OR status = ''
    `);
    console.log('✓ Updated existing orders');
    
    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_uid_status ON orders(uid, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_favorites_uid ON favorites(uid)`);
    console.log('✓ Created indexes');
    
    console.log('Migration completed successfully!');
    
    await pool.end();
  } catch (error) {
    console.error('Migration error:', error);
    await pool.end();
  }
}

runMigration();
