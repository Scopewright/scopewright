-- Price modifiers: room-level and submission-level percentage adjustments
-- These are invisible to the client — they adjust prices multiplicatively.
-- Formula: effective_price = base_price × (1 + global_mod/100) × (1 + room_mod/100)

-- Room-level modifier (per piece)
ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS price_modifier_pct NUMERIC;

-- Submission-level global modifier
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS global_price_modifier_pct NUMERIC;
