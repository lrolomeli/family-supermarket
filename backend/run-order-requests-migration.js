const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runOrderRequestsMigration() {
  try {
    console.log('Running order requests migration...');
    
    // Create order requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_requests (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        uid VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        request_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        admin_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created order_requests table');
    
    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_requests_order_id ON order_requests(order_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_requests_status ON order_requests(status)`);
    console.log('✓ Created indexes');
    
    console.log('Order requests migration completed successfully!');
    
    await pool.end();
  } catch (error) {
    console.error('Migration error:', error);
    await pool.end();
  }
}

runOrderRequestsMigration();
