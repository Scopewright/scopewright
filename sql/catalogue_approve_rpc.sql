-- RPC function to approve/reject catalogue items with server-side permission check
-- Execute in Supabase SQL Editor

CREATE OR REPLACE FUNCTION approve_catalogue_item(
    p_item_id TEXT,
    p_new_status TEXT
) RETURNS JSON AS $$
DECLARE
    v_email TEXT;
    v_role TEXT;
    v_perms JSONB;
    v_allowed BOOLEAN := false;
BEGIN
    -- Get caller email
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    IF v_email IS NULL THEN
        RETURN json_build_object('error', 'Non authentifié');
    END IF;

    -- Get role from user_roles
    SELECT value->>v_email INTO v_role FROM app_config WHERE key = 'user_roles';
    IF v_role IS NULL THEN v_role := 'Client'; END IF;

    -- Check approbation permission
    SELECT value->v_role->'approbation' INTO v_perms FROM app_config WHERE key = 'permissions';
    IF v_perms IS NOT NULL AND v_perms::TEXT = 'true' THEN
        v_allowed := true;
    END IF;

    -- Fallback: Admin always has approbation
    IF NOT v_allowed AND v_role = 'Admin' THEN
        v_allowed := true;
    END IF;

    IF NOT v_allowed THEN
        RETURN json_build_object('error', 'Permission refusée');
    END IF;

    -- Validate status
    IF p_new_status NOT IN ('approved', 'rejected') THEN
        RETURN json_build_object('error', 'Statut invalide');
    END IF;

    -- Update item status
    UPDATE catalogue_items SET status = p_new_status WHERE id = p_item_id;

    RETURN json_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
