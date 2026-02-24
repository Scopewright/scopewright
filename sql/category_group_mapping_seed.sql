-- Seed: material_groups + category_group_mapping defaults
-- Run once in Supabase SQL Editor.
-- Uses ON CONFLICT DO NOTHING so existing config is never overwritten.

INSERT INTO app_config (key, value)
VALUES (
    'material_groups',
    '["Caisson","Façades et panneaux apparents","Tiroirs","Poignées","Éclairage","Autre"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES (
    'category_group_mapping',
    '{
        "Budgétaire": ["Caisson","Façades et panneaux apparents","Tiroirs","Poignées","Éclairage","Autre"],
        "Panneaux":   ["Caisson","Façades et panneaux apparents"],
        "Poignées":   ["Poignées"],
        "Tiroirs":    ["Tiroirs"],
        "Éclairage":  ["Éclairage"],
        "Portes intérieures": ["Façades et panneaux apparents"]
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
