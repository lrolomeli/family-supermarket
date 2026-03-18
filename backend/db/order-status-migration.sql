-- Add order status management fields
-- Migration for order workflow improvements

-- Add additional fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create favorites table for quick reordering
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  products JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update existing orders to have proper status values
UPDATE orders SET status = 'pending' WHERE status IS NULL OR status = '';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_uid_status ON orders(uid, status);
CREATE INDEX IF NOT EXISTS idx_favorites_uid ON favorites(uid);
