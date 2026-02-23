-- Global submission discount
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS discount_type TEXT;   -- 'percentage' | 'fixed'
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS discount_value NUMERIC;
