-- Rental P2P relational model (PostgreSQL)
-- Identity documents and biometric images must NOT be stored here.

CREATE TYPE verification_status AS ENUM ('UNVERIFIED','PENDING','VERIFIED','REJECTED');
CREATE TYPE rental_status AS ENUM ('REQUESTED','ACCEPTED','REJECTED','PAID','PICKUP','RENTING','RETURNING','RETURNED','COMPLETED','DISPUTED','CANCELLED');
CREATE TYPE item_condition AS ENUM ('NEW','LIKE_NEW','GOOD','FAIR','USED');

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT,
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE identity_verifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  status verification_status NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE TABLE rental_items (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  daily_rate NUMERIC(12,2) NOT NULL CHECK (daily_rate >= 0),
  weekly_rate NUMERIC(12,2) CHECK (weekly_rate >= 0),
  deposit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  condition item_condition NOT NULL,
  location TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rental_images (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES rental_items(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rental_requests (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES rental_items(id),
  lender_id UUID NOT NULL REFERENCES users(id),
  borrower_id UUID NOT NULL REFERENCES users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rental_fee NUMERIC(12,2) NOT NULL CHECK (rental_fee >= 0),
  deposit NUMERIC(12,2) NOT NULL CHECK (deposit >= 0),
  status rental_status NOT NULL DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date),
  CHECK (lender_id <> borrower_id)
);

CREATE TABLE rental_contracts (
  id UUID PRIMARY KEY,
  rental_request_id UUID NOT NULL UNIQUE REFERENCES rental_requests(id) ON DELETE CASCADE,
  agreed_at TIMESTAMPTZ,
  terms_version TEXT NOT NULL,
  lender_confirmed_at TIMESTAMPTZ,
  borrower_confirmed_at TIMESTAMPTZ
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  rental_request_id UUID NOT NULL REFERENCES rental_requests(id),
  provider TEXT NOT NULL,
  provider_reference TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deposits (
  id UUID PRIMARY KEY,
  rental_request_id UUID NOT NULL UNIQUE REFERENCES rental_requests(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'HELD',
  released_at TIMESTAMPTZ
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  rental_request_id UUID NOT NULL UNIQUE REFERENCES rental_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  rental_request_id UUID NOT NULL REFERENCES rental_requests(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewee_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rental_request_id, reviewer_id)
);

CREATE TABLE disputes (
  id UUID PRIMARY KEY,
  rental_request_id UUID NOT NULL REFERENCES rental_requests(id),
  opened_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rental_items_owner_idx ON rental_items(owner_id);
CREATE INDEX rental_requests_borrower_idx ON rental_requests(borrower_id);
CREATE INDEX rental_requests_lender_idx ON rental_requests(lender_id);
CREATE INDEX messages_conversation_created_idx ON messages(conversation_id, created_at);
CREATE INDEX notifications_user_created_idx ON notifications(user_id, created_at DESC);
