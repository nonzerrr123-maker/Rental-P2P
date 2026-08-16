-- Rental-P2P / Borow Borow PostgreSQL smoke test
-- Run only after docs/database-schema.sql has been applied.
-- The transaction is rolled back at the end so no test rows remain.

BEGIN;

INSERT INTO users (
  id, email, password_hash, display_name, role, verification_status
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'lender.smoke@example.com', 'smoke-hash', 'Smoke Lender', 'USER', 'VERIFIED'),
  ('00000000-0000-0000-0000-000000000002', 'borrower.smoke@example.com', 'smoke-hash', 'Smoke Borrower', 'USER', 'VERIFIED'),
  ('00000000-0000-0000-0000-000000000003', 'admin.smoke@example.com', 'smoke-hash', 'Smoke Admin', 'ADMIN', 'VERIFIED');

INSERT INTO user_sessions (
  id, user_id, token_hash, expires_at
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'smoke-session-token-hash',
  now() + interval '1 day'
);

INSERT INTO identity_verifications (
  id, user_id, provider, provider_reference, status, reviewed_at, reviewed_by
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'smoke-provider',
  'smoke-verification-reference',
  'VERIFIED',
  now(),
  '00000000-0000-0000-0000-000000000003'
);

INSERT INTO rental_items (
  id, owner_id, title, category, description, condition,
  hourly_rate, daily_rate, minimum_hours, deposit_amount,
  urgent_enabled, province, district, subdistrict, latitude, longitude
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Smoke Test Camera',
  'camera',
  'Temporary listing used by the database smoke test.',
  'GOOD',
  100.00,
  500.00,
  2,
  1000.00,
  true,
  'Chonburi',
  'Mueang Chonburi',
  'Saen Suk',
  13.284600,
  100.925600
);

INSERT INTO rental_images (
  id, item_id, storage_key, sort_order
) VALUES (
  '31000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'smoke/items/camera-1.jpg',
  0
);

INSERT INTO item_availability_blocks (
  id, item_id, starts_at, ends_at, reason, created_by
) VALUES (
  '32000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '2026-09-03 10:00:00+07',
  '2026-09-03 12:00:00+07',
  'Owner unavailable',
  '00000000-0000-0000-0000-000000000001'
);

INSERT INTO rental_requests (
  id, item_id, lender_id, borrower_id, pricing_mode,
  starts_at, ends_at, unit_rate, duration_units, rental_amount,
  deposit_amount, platform_fee_amount, urgent_reservation_fee_amount,
  is_urgent, status
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'HOUR',
  '2026-09-01 10:00:00+07',
  '2026-09-01 14:00:00+07',
  100.00,
  4.00,
  400.00,
  1000.00,
  20.00,
  20.00,
  true,
  'ACCEPTED'
);

-- PostgreSQL must reject a second active rental whose time window overlaps the
-- accepted rental above. Catch the expected exclusion violation so the smoke
-- test can continue; fail explicitly if no violation is raised.
DO $$
DECLARE
  overlap_blocked BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO rental_requests (
      id, item_id, lender_id, borrower_id, pricing_mode,
      starts_at, ends_at, unit_rate, duration_units, rental_amount,
      deposit_amount, status
    ) VALUES (
      '40000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000003',
      'HOUR',
      '2026-09-01 12:00:00+07',
      '2026-09-01 15:00:00+07',
      100.00,
      3.00,
      300.00,
      1000.00,
      'WAITING_PAYMENT'
    );
  EXCEPTION
    WHEN exclusion_violation THEN
      overlap_blocked := true;
  END;

  IF NOT overlap_blocked THEN
    RAISE EXCEPTION 'Smoke test failed: overlapping active rental was not blocked';
  END IF;
END;
$$;

INSERT INTO rental_contracts (
  id, rental_request_id, terms_version, terms_snapshot,
  lender_confirmed_at, borrower_confirmed_at, agreed_at
) VALUES (
  '41000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'smoke-v1',
  '{"source":"database-smoke-test"}'::jsonb,
  now(),
  now(),
  now()
);

INSERT INTO payments (
  id, rental_request_id, payer_id, type, provider,
  provider_reference, idempotency_key, amount, status
) VALUES (
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'DEPOSIT',
  'smoke-provider',
  'smoke-payment-reference',
  'smoke-payment-idempotency-key',
  1000.00,
  'SUCCEEDED'
);

INSERT INTO payment_events (
  id, payment_id, provider, provider_event_id, event_type, payload, processed_at
) VALUES (
  '51000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'smoke-provider',
  'smoke-event-reference',
  'payment.succeeded',
  '{"smoke":true}'::jsonb,
  now()
);

INSERT INTO deposits (
  id, rental_request_id, payment_id, amount, status, held_at
) VALUES (
  '52000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  1000.00,
  'HELD',
  now()
);

INSERT INTO conversations (
  id, rental_request_id
) VALUES (
  '60000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001'
);

INSERT INTO conversation_participants (conversation_id, user_id) VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

INSERT INTO messages (
  id, conversation_id, sender_id, body
) VALUES (
  '61000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Smoke test message'
);

INSERT INTO message_reads (message_id, user_id) VALUES (
  '61000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

INSERT INTO rental_handover_events (
  id, rental_request_id, event_type, confirmed_by, condition_notes
) VALUES (
  '62000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'PICKUP',
  '00000000-0000-0000-0000-000000000002',
  'Smoke pickup confirmation'
);

INSERT INTO notifications (
  id, user_id, type, title, body, related_entity_type, related_entity_id
) VALUES (
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'RENTAL_ACCEPTED',
  'Smoke rental accepted',
  'Database smoke test notification',
  'rental_request',
  '40000000-0000-0000-0000-000000000001'
);

INSERT INTO community_requests (
  id, requester_id, title, description, category, province,
  needed_starts_at, needed_ends_at, target_price, is_urgent
) VALUES (
  '80000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Need a smoke-test drill',
  'Temporary community request',
  'tools',
  'Chonburi',
  '2026-09-05 09:00:00+07',
  '2026-09-05 12:00:00+07',
  300.00,
  true
);

INSERT INTO community_offers (
  id, community_request_id, lender_id, rental_item_id,
  pricing_mode, offered_rate, message
) VALUES (
  '81000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'HOUR',
  100.00,
  'Smoke test offer'
);

INSERT INTO admin_audit_logs (
  id, actor_user_id, action, target_type, target_id, details
) VALUES (
  '90000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'SMOKE_TEST',
  'rental_request',
  '40000000-0000-0000-0000-000000000001',
  '{"smoke":true}'::jsonb
);

-- Representative UPDATE and DELETE operations.
UPDATE rental_items
SET daily_rate = 550.00
WHERE id = '30000000-0000-0000-0000-000000000001';

DELETE FROM message_reads
WHERE message_id = '61000000-0000-0000-0000-000000000001'
  AND user_id = '00000000-0000-0000-0000-000000000001';

-- Representative reads. With psql these rows also make the smoke-test output easy
-- to inspect manually.
SELECT id, email, role, verification_status
FROM users
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
)
ORDER BY email;

SELECT id, status, starts_at, ends_at
FROM rental_requests
WHERE id = '40000000-0000-0000-0000-000000000001';

SELECT COUNT(*) AS conversation_participant_count
FROM conversation_participants
WHERE conversation_id = '60000000-0000-0000-0000-000000000001';

SELECT id, status
FROM community_requests
WHERE id = '80000000-0000-0000-0000-000000000001';

ROLLBACK;
