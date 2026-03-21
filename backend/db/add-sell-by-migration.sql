-- Add sell_by column to products: 'both', 'kg', 'pieces'
ALTER TABLE products ADD COLUMN IF NOT EXISTS sell_by VARCHAR(20) DEFAULT 'both';
