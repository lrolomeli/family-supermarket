-- Add order favorites table
CREATE TABLE IF NOT EXISTS order_favorites (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  products JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_favorites_uid ON order_favorites(uid);

-- Add order history view (orders are already stored, but we can add a flag for completed orders)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Add index for order history queries
CREATE INDEX IF NOT EXISTS idx_orders_uid_status ON orders(uid, status);
