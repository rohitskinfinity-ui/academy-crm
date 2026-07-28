-- Add password_hash for admin JWT auth (idempotent for existing DBs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
