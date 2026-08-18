BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS avatar_content_type TEXT,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_avatar_content_type_check;

ALTER TABLE users
  ADD CONSTRAINT users_avatar_content_type_check
  CHECK (avatar_content_type IS NULL OR avatar_content_type IN ('image/jpeg','image/png','image/webp'));

COMMIT;
