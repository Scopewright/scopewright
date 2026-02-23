-- room price_override: montant vendeur qui remplace le sous-total calculé
ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS price_override NUMERIC;
