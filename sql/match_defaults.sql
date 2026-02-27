-- match_defaults: cache $match: cascade resolutions per submission
-- Key format: "EXPENSE_CATEGORY:keyword1+keyword2", value: catalogue_item_id
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS match_defaults JSONB DEFAULT '{}';
