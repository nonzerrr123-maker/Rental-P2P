BEGIN;

UPDATE rental_items
SET urgent_reservation_fee_rate = 0.0500,
    updated_at = now()
WHERE urgent_reservation_fee_rate <> 0.0500;

ALTER TABLE rental_items
  DROP CONSTRAINT IF EXISTS rental_items_urgent_reservation_fee_rate_fixed;

ALTER TABLE rental_items
  ADD CONSTRAINT rental_items_urgent_reservation_fee_rate_fixed
  CHECK (urgent_reservation_fee_rate = 0.0500);

COMMIT;
