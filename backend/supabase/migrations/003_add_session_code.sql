-- Add a short shareable code to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS code VARCHAR(6) UNIQUE;

-- Backfill existing sessions with random codes
UPDATE sessions SET code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6)) WHERE code IS NULL;

-- Make code NOT NULL after backfill
ALTER TABLE sessions ALTER COLUMN code SET NOT NULL;

-- Set default for new rows
ALTER TABLE sessions ALTER COLUMN code SET DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
