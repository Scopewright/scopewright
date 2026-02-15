-- Colonne tag sur les lignes d'articles
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT NULL;

-- Nomenclature des tags par défaut dans app_config
INSERT INTO app_config (key, value) VALUES ('tag_prefixes', '[
  {"prefix": "C", "label_fr": "Caisson", "label_en": "Cabinet", "sort_order": 1},
  {"prefix": "F", "label_fr": "Filler", "label_en": "Filler", "sort_order": 2},
  {"prefix": "P", "label_fr": "Panneau", "label_en": "Panel", "sort_order": 3},
  {"prefix": "T", "label_fr": "Tiroir", "label_en": "Drawer", "sort_order": 4},
  {"prefix": "M", "label_fr": "Moulure", "label_en": "Moulding", "sort_order": 5},
  {"prefix": "A", "label_fr": "Accessoire", "label_en": "Accessory", "sort_order": 6}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
