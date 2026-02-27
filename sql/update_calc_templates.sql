-- update_calc_templates.sql
-- Migrate calc_template from $default: to $match: syntax.
-- Updates templates by category name, preserving all other fields.
-- Safe to re-run: only touches calc_template, skips unknown categories.

DO $$
DECLARE
    cats JSONB;
    i INT;
    cat_name TEXT;
    templates JSONB;
BEGIN
    templates := '{
  "PANNEAU BOIS": "Quantité en pieds carrés (surface). Formule: L * H / 144 (pouces → pi²).\nUn panneau peut être un côté de caisson, une tablette, un dos, une façade.\nSi l''article est un caisson complet, considérer toutes les surfaces: (L*H*2 + L*P*2 + P*H*2) / 144.\nAdapter la formule selon la géométrie décrite dans la description de l''article.\nVariables: L (longueur po), H (hauteur po), P (profondeur po), QTY (quantité parent).\nSi cet article nécessite un matériau complémentaire en cascade, utiliser \"$match:NOM_CATÉGORIE_DE_DÉPENSE\" comme target. Le matching se fait par client_text du parent. Utiliser \"condition\" (ex: \"H > 24\") pour des cascades conditionnelles.",

  "PANNEAU MDF": "Quantité en pieds carrés (surface). Formule: L * H / 144 (pouces → pi²).\nUtilisé pour panneaux peints, moulures, composantes usinées.\nSi plusieurs pièces, multiplier par le nombre de faces/pièces concernées.\nVariables: L, H, P (pouces), QTY.\nSi cet article nécessite un matériau complémentaire en cascade, utiliser \"$match:NOM_CATÉGORIE_DE_DÉPENSE\" comme target. Le matching se fait par client_text du parent. Utiliser \"condition\" (ex: \"H > 24\") pour des cascades conditionnelles.",

  "PANNEAU MÉLAMINE": "Quantité en pieds carrés (surface). Formule: L * H / 144 (pouces → pi²).\nUtilisé pour intérieurs de caissons, tablettes, composantes non visibles.\nAdapter la formule selon le nombre de pièces dans l''article.\nVariables: L, H, P (pouces), QTY.\nSi cet article nécessite un matériau complémentaire en cascade, utiliser \"$match:NOM_CATÉGORIE_DE_DÉPENSE\" comme target. Le matching se fait par client_text du parent. Utiliser \"condition\" (ex: \"H > 24\") pour des cascades conditionnelles.",

  "BANDE DE CHANT": "Quantité en pieds linéaires (longueur de chant). Formule de base: (L * 2 + H * 2) / 12 (pouces → pi.lin.).\nAppliquée sur les chants visibles d''un panneau. Le nombre de chants dépend de l''article.\nUn panneau simple peut avoir 1-4 chants. Un caisson complet a plus de chants (tablettes, partitions).\nAdapter la formule selon le nombre de chants visibles décrits.\nVariables: L, H, P (pouces), QTY.\nArticle terminal. La bande de chant est une cible de cascade, pas une source. Le matching par client_text assure que l''essence correspond au panneau parent.",

  "PLACAGE": "Quantité en pieds carrés (surface plaquée). Formule: L * H / 144 (pouces → pi²).\nAppliqué sur les surfaces visibles à plaquer. Peut être une ou deux faces.\nAdapter selon la description: une face = L*H/144, deux faces = L*H*2/144.\nVariables: L, H, P (pouces), QTY.\nSi cet article nécessite un matériau complémentaire en cascade, utiliser \"$match:NOM_CATÉGORIE_DE_DÉPENSE\" comme target. Le matching se fait par client_text du parent. Utiliser \"condition\" (ex: \"H > 24\") pour des cascades conditionnelles.",

  "STRATIFIÉ": "Quantité en pieds carrés (surface). Formule: L * H / 144 (pouces → pi²).\nUtilisé pour comptoirs, surfaces de travail, revêtements.\nVariables: L, H, P (pouces), QTY.\nSi cet article nécessite un matériau complémentaire en cascade, utiliser \"$match:NOM_CATÉGORIE_DE_DÉPENSE\" comme target. Le matching se fait par client_text du parent. Utiliser \"condition\" (ex: \"H > 24\") pour des cascades conditionnelles.",

  "BOIS BRUT": "Quantité en pieds carrés (surface) ou en pieds-mesure de planche (PMP, unité standard industrie).\nFormule surface: L * H / 144 (pi²). Adapter selon l''épaisseur et le type de bois.\nVariables: L, H, P (pouces), QTY.\nSi cet article nécessite un matériau complémentaire en cascade, utiliser \"$match:NOM_CATÉGORIE_DE_DÉPENSE\" comme target. Le matching se fait par client_text du parent. Utiliser \"condition\" (ex: \"H > 24\") pour des cascades conditionnelles.",

  "COLLAGE DE BOIS": "Bois massif collé acheté comme matériau. Quantité au pied carré ou à l''unité.\nFormule surface si applicable: L * H / 144 (pi²).\nVariables: L, H, P (pouces), QTY.\nArticle typiquement terminal — rarement source de cascade.",

  "FINITION BOIS": "Quantité en pieds carrés (surface à finir). Formule: L * H / 144 (pouces → pi²).\nInclut toutes les surfaces nécessitant une finition bois naturel (vernis, huile, laque claire).\nLa surface à finir peut être multi-faces. Un panneau fini 2 faces = surface × 2. Adapter selon la description de l''article.\nVariables: L, H, P (pouces), QTY.\nArticle terminal — cible de cascade, pas source.",

  "FINITION OPAQUE": "Quantité en pieds carrés (surface à peindre/laquer). Formule: L * H / 144 (pouces → pi²).\nInclut toutes les surfaces nécessitant une finition opaque (peinture, laque colorée).\nLa surface à finir peut être multi-faces. Un panneau fini 2 faces = surface × 2. Adapter selon la description de l''article.\nVariables: L, H, P (pouces), QTY.\nArticle terminal — cible de cascade, pas source.",

  "FINITION TEINTURE": "Quantité en pieds carrés (surface à teindre). Formule: L * H / 144 (pouces → pi²).\nLa surface à finir peut être multi-faces. Un panneau fini 2 faces = surface × 2. Adapter selon la description de l''article.\nVariables: L, H, P (pouces), QTY.\nArticle terminal — cible de cascade, pas source.",

  "TIROIRS": "Quantité à l''unité (par tiroir ou par ensemble). Formule: QTY ou un nombre fixe.\nLe contenu (coulisses, boîte, façade) dépend de l''article spécifique.\nVariables: L, H, P (pouces), QTY.\nSi cet article nécessite un matériau complémentaire en cascade, utiliser \"$match:NOM_CATÉGORIE_DE_DÉPENSE\" comme target. Le matching se fait par client_text du parent. Utiliser \"condition\" (ex: \"H > 24\") pour des cascades conditionnelles.",

  "POIGNÉES": "Quantité à l''unité. Formule: QTY ou un nombre fixe par porte/tiroir.\nVariables: L, H, P (pouces), QTY.\nArticle typiquement terminal.",

  "QUINCAILLERIE": "Quantité à l''unité ou au lot. Formule: QTY ou un nombre fixe.\nInclut charnières, coulisses, supports, mécanismes.\nVariables: L, H, P (pouces), QTY.\nArticle typiquement terminal.",

  "ÉCLAIRAGE": "Quantité à l''unité ou en pieds linéaires selon le type.\nBande LED: L / 12 (pouces → pi.lin.). Spots: QTY.\nVariables: L, H, P (pouces), QTY.\nArticle typiquement terminal.",

  "MÉTAL": "Quantité en pieds linéaires ou à l''unité selon le type de pièce métallique.\nFormule linéaire: L / 12 (pouces → pi.lin.). Pièce unique: QTY.\nVariables: L, H, P (pouces), QTY.\nSi cet article nécessite un matériau complémentaire en cascade, utiliser \"$match:NOM_CATÉGORIE_DE_DÉPENSE\" comme target. Le matching se fait par client_text du parent. Utiliser \"condition\" (ex: \"H > 24\") pour des cascades conditionnelles.",

  "VITRIER": "Quantité en pieds carrés (surface vitrée). Formule: L * H / 144 (pouces → pi²).\nVariables: L, H, P (pouces), QTY.\nArticle typiquement terminal.",

  "DÉCOUPE NUMÉRIQUE": "Quantité à l''unité (par pièce ou par programme). Formule: QTY.\nVariables: L, H, P (pouces), QTY.\nArticle terminal — service, pas de cascade."
}'::jsonb;

    SELECT value INTO cats FROM app_config WHERE key = 'expense_categories';
    IF cats IS NULL THEN
        RAISE NOTICE 'expense_categories not found in app_config';
        RETURN;
    END IF;

    FOR i IN 0..jsonb_array_length(cats)-1 LOOP
        cat_name := cats->i->>'name';
        IF templates ? cat_name THEN
            cats := jsonb_set(cats, ARRAY[i::text, 'calc_template'], templates->cat_name);
        END IF;
    END LOOP;

    UPDATE app_config SET value = cats WHERE key = 'expense_categories';
    RAISE NOTICE 'calc_templates updated for % categories', jsonb_array_length(cats);
END $$;
