-- Per-deal commission percentage used to calculate expected commission.
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE deals
  DROP CONSTRAINT IF EXISTS deals_commission_percentage_check;

ALTER TABLE deals
  ADD CONSTRAINT deals_commission_percentage_check
  CHECK (commission_percentage >= 0 AND commission_percentage <= 100);
