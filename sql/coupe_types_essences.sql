-- Migration: Add per-essence factors to coupe_types (#219)
-- Run in Supabase SQL Editor

-- UPSERT the enriched coupe_types with facteur_defaut + facteurs per essence
INSERT INTO app_config (key, value)
VALUES ('coupe_types', '[
  {
    "code": "FC",
    "label": "Fil courant",
    "facteur": 1.00,
    "facteur_defaut": 1.00,
    "facteurs": {
      "chene_blanc": 1.00, "chene_rouge": 1.00, "noyer": 1.00,
      "erable": 1.00, "merisier": 1.00, "frene": 1.00,
      "cerisier": 1.00, "pin_noueux": 1.00, "acajou": 1.00
    },
    "notes": ""
  },
  {
    "code": "EP",
    "label": "Faux quartier / Rift cut",
    "facteur": 1.10,
    "facteur_defaut": 1.10,
    "facteurs": {
      "chene_blanc": 1.10, "chene_rouge": 1.10, "noyer": 1.15,
      "erable": 1.12, "merisier": 1.08, "frene": 1.03,
      "cerisier": 1.10, "pin_noueux": 1.05, "acajou": 1.10
    },
    "notes": ""
  },
  {
    "code": "QC",
    "label": "Sur quartier / Quarter cut",
    "facteur": 1.25,
    "facteur_defaut": 1.25,
    "facteurs": {
      "chene_blanc": 1.25, "chene_rouge": 1.25, "noyer": 1.20,
      "erable": 1.22, "merisier": 1.18, "frene": 1.15,
      "cerisier": 1.20, "pin_noueux": 1.10, "acajou": 1.20
    },
    "notes": ""
  },
  {
    "code": "DR",
    "label": "Déroulé / Rotary cut",
    "facteur": 0.85,
    "facteur_defaut": 0.85,
    "facteurs": {
      "chene_blanc": 0.85, "chene_rouge": 0.85, "noyer": 0.88,
      "erable": 0.85, "merisier": 0.85, "frene": 0.85,
      "cerisier": 0.88, "pin_noueux": 0.85, "acajou": 0.88
    },
    "notes": ""
  },
  {
    "code": "LO",
    "label": "Loupe / Burl",
    "facteur": 2.00,
    "facteur_defaut": 2.00,
    "facteurs": {
      "chene_blanc": 2.00, "noyer": 2.20, "erable": 2.50,
      "cerisier": 2.10, "acajou": 2.30
    },
    "notes": ""
  },
  {
    "code": "HR",
    "label": "Demi-rond / Half round",
    "facteur": 1.15,
    "facteur_defaut": 1.15,
    "facteurs": {
      "chene_blanc": 1.15, "chene_rouge": 1.15, "noyer": 1.18,
      "erable": 1.15, "merisier": 1.12, "frene": 1.10,
      "cerisier": 1.15, "acajou": 1.18
    },
    "notes": ""
  }
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
