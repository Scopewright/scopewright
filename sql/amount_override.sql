-- amount_override: montant estimé manuellement, priorité d'affichage sur le montant calculé
ALTER TABLE projects ADD COLUMN IF NOT EXISTS amount_override NUMERIC;
