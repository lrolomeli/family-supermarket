-- Add available column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT TRUE;
