-- room price_override: delta (ajustement) appliqué au sous-total calculé
-- Stocke la différence entre le prix vendeur et le calculé: effective = calculated + delta
-- Ex: calculé=5000, vendeur veut 4000 → delta=-1000, si items changent à 6000 → effective=5000
ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS price_override NUMERIC;
