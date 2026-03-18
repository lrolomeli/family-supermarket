-- Create order requests table for user-admin communication
CREATE TABLE IF NOT EXISTS order_requests (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  uid VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL, -- 'modify', 'cancel', 'add_items', etc.
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  admin_response TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_order_requests_order_id ON order_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_order_requests_status ON order_requests(status);
