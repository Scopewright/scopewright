-- Colonne annotations sur room_media pour les labels de tags visuels
ALTER TABLE room_media ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT '[]';

-- Structure: [{ "id": "C1", "prefix": "C", "number": 1, "x": 0.45, "y": 0.32, "hasArrow": false, "arrowX": null, "arrowY": null }]
-- x, y = coordonnées relatives (0-1) du label sur l'image
-- arrowX, arrowY = point cible de la flèche (relatif aussi)
