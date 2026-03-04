-- Add language column to submissions
-- Stores the display language for the submission ('fr' or 'en')
-- Used to persist the FR/EN toggle state and pass it to quote.html presentation
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';
