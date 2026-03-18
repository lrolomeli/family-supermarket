-- Add proposed_changes column to order_requests table
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS proposed_changes JSONB;

-- Add index for better performance on proposed_changes queries
CREATE INDEX IF NOT EXISTS idx_order_requests_proposed_changes ON order_requests USING GIN (proposed_changes);
