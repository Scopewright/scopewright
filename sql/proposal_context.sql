-- Proposal context: stores guided-form answers from estimators when proposing new articles
-- This JSONB field captures structured context (custom/standard, installation, approx price, constraints, notes)
-- that the approver and AI can use to suggest rules and pricing.

ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS proposal_context JSONB;
