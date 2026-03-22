-- Add multi-use and active flag to invitations
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS multi_use BOOLEAN DEFAULT FALSE;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
