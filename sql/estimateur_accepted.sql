-- Track when an estimateur accepts their assignment on a submission
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS estimateur_accepted_at TIMESTAMPTZ;
