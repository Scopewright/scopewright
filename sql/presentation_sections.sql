-- Migration: Add presentation section keys to app_config
-- Keys for "Pourquoi [Atelier]" page + "Étapes du projet"
-- Note: app_config.value is JSONB — use to_jsonb(text) for strings, ::jsonb for JSON

-- Pourquoi page
INSERT INTO app_config (key, value)
VALUES ('why_title', to_jsonb('Pourquoi stele?'::text))
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES ('why_text', to_jsonb('<p>Parce que, comme vous, nous estimons et admirons le travail de votre architecte, et souhaitons rendre hommage à leur vision avec la même exigence.</p><p>Parce que nos années d''expérience dans la réalisation de projets d''ébénisterie d''envergure nous ont appris à maîtriser la complexité, et que notre équipe se distingue par son habileté là où la technologie atteint ses limites.</p><p>Parce que stele, c''est avant tout une équipe de gens passionnés, animés par le désir de créer des pièces uniques. Si chaque projet apporte son lot de défis, nous sommes prêts à les relever pour que chaque étape se fasse en toute simplicité.</p>'::text))
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES ('why_image_url', to_jsonb(''::text))
ON CONFLICT (key) DO NOTHING;

-- Étapes du projet (8 étapes, JSON array)
INSERT INTO app_config (key, value)
VALUES ('project_steps', '[{"title":"Conception","description":"Rassembler les informations nécessaires : choix des poignées, approbation des matériaux, fiches techniques des électroménagers."},{"title":"Prise de mesure initiale","description":"Mesures sur les colombages et le plancher non fini. Nous tiendrons compte de l''épaisseur des revêtements prévus."},{"title":"Approbation des dessins d''atelier","description":"Les dessins d''atelier vous seront remis pour approbation. Une fois approuvés, aucune modification ne pourra y être apportée."},{"title":"Commande de matériaux","description":"Commande des matériaux (placages, quincaillerie spéciale) pour éviter tout délai lors de la mise en production."},{"title":"Prise de mesure finale","description":"Mesure finale une fois le plancher fini et les joints posés. Délai de 6 semaines avant le début de l''installation."},{"title":"Dessins d''atelier pour production","description":"Ajustements mineurs par rapport aux mesures initiales. Sauf changement majeur, pas de nouvelle approbation requise."},{"title":"Installation","description":"La durée varie selon l''ampleur du projet. Votre vision prend forme."},{"title":"Contrôle de qualité","description":"Visite avec un représentant pour établir une liste d''ajustements si nécessaire."}]'::jsonb)
ON CONFLICT (key) DO NOTHING;
