BEGIN;

DO $$
BEGIN
  CREATE TYPE auth_action_purpose AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_email_verifications (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preserve current accounts: email verification enforcement only applies to accounts
-- created after this migration unless an existing verification row is removed deliberately.
INSERT INTO user_email_verifications (user_id, verified_at)
SELECT id, created_at
FROM users
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS auth_action_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose auth_action_purpose NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (length(token_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_auth_action_tokens_user_purpose_created
  ON auth_action_tokens (user_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_action_tokens_unconsumed_expiry
  ON auth_action_tokens (purpose, expires_at)
  WHERE consumed_at IS NULL;

COMMIT;
