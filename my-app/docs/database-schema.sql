-- Rental-P2P / Borow Borow relational model (PostgreSQL 16+)
-- TASK 2: canonical MVP persistence model.
--
-- Security/privacy rule:
-- Raw national-ID images and raw biometric/face images must not be stored in this
-- application database. Store provider references and minimum audit metadata only.

BEGIN;

-- Required for GiST exclusion constraints that combine UUID equality with time ranges.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- -----------------------------------------------------------------------------
-- Canonical enums
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');
CREATE TYPE verification_status AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE listing_status AS ENUM ('ACTIVE', 'PAUSED', 'UNAVAILABLE', 'ARCHIVED');
CREATE TYPE item_condition AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED');
CREATE TYPE rental_pricing_mode AS ENUM ('HOUR', 'DAY');
CREATE TYPE rental_status AS ENUM (
  'REQUESTED',
  'ACCEPTED',
  'REJECTED',
  'WAITING_PAYMENT',
  'PAID',
  'WAITING_PICKUP',
  'RENTING',
  'RETURNING',
  'RETURNED',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
  'EXPIRED'
);
CREATE TYPE payment_type AS ENUM ('RENTAL', 'DEPOSIT', 'URGENT_RESERVATION_FEE', 'PLATFORM_FEE', 'REFUND');
CREATE TYPE payment_status AS ENUM ('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE deposit_status AS ENUM ('PENDING', 'HELD', 'RELEASED', 'PARTIALLY_RELEASED', 'FORFEITED', 'REFUNDED');
CREATE TYPE handover_event_type AS ENUM ('PICKUP', 'RETURN');
CREATE TYPE dispute_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE community_request_status AS ENUM ('OPEN', 'MATCHED', 'CLOSED', 'CANCELLED', 'EXPIRED');
CREATE TYPE community_offer_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- -----------------------------------------------------------------------------
-- Users, sessions, identity verification
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'USER',
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  rating_average NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating_average BETWEEN 0 AND 5),
  rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email = lower(email)),
  CHECK (length(trim(display_name)) > 0)
);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL UNIQUE,
  status verification_status NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (status <> 'UNVERIFIED')
);

-- -----------------------------------------------------------------------------
-- Rental listings and availability
-- -----------------------------------------------------------------------------
CREATE TABLE rental_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  condition item_condition NOT NULL,
  status listing_status NOT NULL DEFAULT 'ACTIVE',
  hourly_rate NUMERIC(12,2) CHECK (hourly_rate IS NULL OR hourly_rate > 0),
  daily_rate NUMERIC(12,2) CHECK (daily_rate IS NULL OR daily_rate > 0),
  minimum_hours INTEGER NOT NULL DEFAULT 1 CHECK (minimum_hours > 0),
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  urgent_enabled BOOLEAN NOT NULL DEFAULT false,
  urgent_reservation_fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0500 CHECK (urgent_reservation_fee_rate BETWEEN 0 AND 1),
  province TEXT NOT NULL,
  district TEXT,
  subdistrict TEXT,
  location_label TEXT,
  latitude NUMERIC(9,6) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(title)) > 0),
  CHECK (length(trim(category)) > 0),
  CHECK (hourly_rate IS NOT NULL OR daily_rate IS NOT NULL),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);

CREATE TABLE rental_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES rental_items(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, storage_key)
);

CREATE TABLE item_availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES rental_items(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CONSTRAINT item_availability_blocks_no_overlap
    EXCLUDE USING gist (
      item_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    )
);

-- -----------------------------------------------------------------------------
-- Rental requests, pricing snapshot, contracts, handover
-- -----------------------------------------------------------------------------
CREATE TABLE rental_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES rental_items(id) ON DELETE RESTRICT,
  lender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  borrower_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pricing_mode rental_pricing_mode NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  unit_rate NUMERIC(12,2) NOT NULL CHECK (unit_rate >= 0),
  duration_units NUMERIC(12,2) NOT NULL CHECK (duration_units > 0),
  rental_amount NUMERIC(12,2) NOT NULL CHECK (rental_amount >= 0),
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  platform_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (platform_fee_amount >= 0),
  urgent_reservation_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (urgent_reservation_fee_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  reservation_expires_at TIMESTAMPTZ,
  status rental_status NOT NULL DEFAULT 'REQUESTED',
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (lender_id <> borrower_id),
  CHECK (currency = upper(currency)),
  CHECK (NOT is_urgent OR urgent_reservation_fee_amount >= 0),
  CONSTRAINT rental_requests_no_active_overlap
    EXCLUDE USING gist (
      item_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    )
    WHERE (status IN ('ACCEPTED', 'WAITING_PAYMENT', 'PAID', 'WAITING_PICKUP', 'RENTING', 'RETURNING', 'DISPUTED'))
);

CREATE TABLE rental_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id UUID NOT NULL UNIQUE REFERENCES rental_requests(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  terms_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  lender_confirmed_at TIMESTAMPTZ,
  borrower_confirmed_at TIMESTAMPTZ,
  agreed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rental_handover_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id UUID NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
  event_type handover_event_type NOT NULL,
  confirmed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  condition_notes TEXT,
  evidence_storage_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rental_request_id, event_type, confirmed_by)
);

-- -----------------------------------------------------------------------------
-- Payments and deposits
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id UUID NOT NULL REFERENCES rental_requests(id) ON DELETE RESTRICT,
  original_payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
  payer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type payment_type NOT NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT UNIQUE,
  idempotency_key TEXT UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  status payment_status NOT NULL DEFAULT 'PENDING',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (currency = upper(currency)),
  CHECK ((type = 'REFUND' AND original_payment_id IS NOT NULL) OR type <> 'REFUND')
);

CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id UUID NOT NULL UNIQUE REFERENCES rental_requests(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status deposit_status NOT NULL DEFAULT 'PENDING',
  held_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Chat
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id UUID NOT NULL UNIQUE REFERENCES rental_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message_reads (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Reviews, disputes, notifications
-- -----------------------------------------------------------------------------
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id UUID NOT NULL REFERENCES rental_requests(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reviewer_id <> reviewee_id),
  UNIQUE (rental_request_id, reviewer_id)
);

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id UUID NOT NULL REFERENCES rental_requests(id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  details TEXT,
  status dispute_status NOT NULL DEFAULT 'OPEN',
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CHECK (length(trim(reason)) > 0)
);

CREATE TABLE dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_key TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(type)) > 0),
  CHECK (length(trim(title)) > 0)
);

-- -----------------------------------------------------------------------------
-- Community requests / คอมมูหาของ
-- -----------------------------------------------------------------------------
CREATE TABLE community_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  province TEXT NOT NULL,
  district TEXT,
  subdistrict TEXT,
  latitude NUMERIC(9,6) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  needed_starts_at TIMESTAMPTZ NOT NULL,
  needed_ends_at TIMESTAMPTZ NOT NULL,
  target_price NUMERIC(12,2) CHECK (target_price IS NULL OR target_price >= 0),
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  status community_request_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(title)) > 0),
  CHECK (length(trim(category)) > 0),
  CHECK (needed_ends_at > needed_starts_at),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);

CREATE TABLE community_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_request_id UUID NOT NULL REFERENCES community_requests(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rental_item_id UUID REFERENCES rental_items(id) ON DELETE SET NULL,
  pricing_mode rental_pricing_mode,
  offered_rate NUMERIC(12,2) CHECK (offered_rate IS NULL OR offered_rate >= 0),
  message TEXT,
  status community_offer_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_request_id, lender_id)
);

-- -----------------------------------------------------------------------------
-- Admin audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(action)) > 0)
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX user_sessions_user_idx ON user_sessions(user_id);
CREATE INDEX user_sessions_expires_idx ON user_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX identity_verifications_user_created_idx ON identity_verifications(user_id, submitted_at DESC);

CREATE INDEX rental_items_owner_idx ON rental_items(owner_id);
CREATE INDEX rental_items_status_category_idx ON rental_items(status, category);
CREATE INDEX rental_items_location_idx ON rental_items(province, district, subdistrict);
CREATE INDEX rental_items_urgent_idx ON rental_items(urgent_enabled, status) WHERE urgent_enabled = true;

CREATE INDEX item_availability_blocks_item_time_idx ON item_availability_blocks(item_id, starts_at, ends_at);

CREATE INDEX rental_requests_borrower_created_idx ON rental_requests(borrower_id, created_at DESC);
CREATE INDEX rental_requests_lender_created_idx ON rental_requests(lender_id, created_at DESC);
CREATE INDEX rental_requests_item_time_idx ON rental_requests(item_id, starts_at, ends_at);
CREATE INDEX rental_requests_status_idx ON rental_requests(status);
CREATE INDEX rental_requests_reservation_expiry_idx ON rental_requests(reservation_expires_at)
  WHERE reservation_expires_at IS NOT NULL AND status = 'WAITING_PAYMENT';

CREATE INDEX payments_rental_created_idx ON payments(rental_request_id, created_at DESC);
CREATE INDEX payments_status_idx ON payments(status);
CREATE INDEX payment_events_unprocessed_idx ON payment_events(received_at) WHERE processed_at IS NULL;
CREATE INDEX deposits_status_idx ON deposits(status);

CREATE INDEX conversation_participants_user_idx ON conversation_participants(user_id, conversation_id);
CREATE INDEX messages_conversation_created_idx ON messages(conversation_id, created_at DESC);
CREATE INDEX message_reads_user_idx ON message_reads(user_id, read_at DESC);

CREATE INDEX reviews_reviewee_created_idx ON reviews(reviewee_id, created_at DESC);
CREATE INDEX disputes_status_created_idx ON disputes(status, created_at DESC);
CREATE INDEX notifications_user_created_idx ON notifications(user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE INDEX community_requests_status_location_idx ON community_requests(status, province, district, subdistrict);
CREATE INDEX community_requests_needed_time_idx ON community_requests(needed_starts_at, needed_ends_at);
CREATE INDEX community_offers_request_status_idx ON community_offers(community_request_id, status);
CREATE INDEX admin_audit_logs_actor_created_idx ON admin_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX admin_audit_logs_target_idx ON admin_audit_logs(target_type, target_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER rental_items_set_updated_at
BEFORE UPDATE ON rental_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER rental_requests_set_updated_at
BEFORE UPDATE ON rental_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER deposits_set_updated_at
BEFORE UPDATE ON deposits
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER conversations_set_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER disputes_set_updated_at
BEFORE UPDATE ON disputes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER community_requests_set_updated_at
BEFORE UPDATE ON community_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER community_offers_set_updated_at
BEFORE UPDATE ON community_offers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
