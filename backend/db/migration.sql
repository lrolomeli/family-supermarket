-- Migration to add image and category columns to products table
-- and create categories table

-- Add image column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS image VARCHAR(255);

-- Add category column to products table  
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'general';

-- Create categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

-- Insert default categories if they don't exist
INSERT INTO categories (name) VALUES
  ('Frutas'),
  ('Verduras'),
  ('General')
ON CONFLICT (name) DO NOTHING;

-- Update existing products to have default category
UPDATE products SET category = 'general' WHERE category IS NULL;
