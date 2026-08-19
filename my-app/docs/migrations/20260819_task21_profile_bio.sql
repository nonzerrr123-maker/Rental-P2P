BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_bio_length_check;

ALTER TABLE users
  ADD CONSTRAINT users_bio_length_check
  CHECK (bio IS NULL OR length(bio) <= 500);

COMMIT;
