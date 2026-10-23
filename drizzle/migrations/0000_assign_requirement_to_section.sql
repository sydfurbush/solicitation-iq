CREATE OR REPLACE FUNCTION public.assign_requirement_to_section(p_requirement_id uuid, p_outline_node_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  v_outline uuid; v_node_sol uuid; v_req_sol uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_org_staff(auth.uid()) OR public.is_client_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only owners, admins and analysts can link requirements to sections';
  END IF;
  SELECT n.outline_id, o.solicitation_id INTO v_outline, v_node_sol
    FROM outline_nodes n JOIN proposal_outlines o ON o.id = n.outline_id WHERE n.id = p_outline_node_id;
  IF v_outline IS NULL THEN RAISE EXCEPTION 'Outline section not found'; END IF;
  SELECT solicitation_id INTO v_req_sol FROM requirement_items WHERE id = p_requirement_id;
  IF v_req_sol IS NULL THEN RAISE EXCEPTION 'Requirement not found'; END IF;
  IF v_req_sol <> v_node_sol THEN
    RAISE EXCEPTION 'Requirement and section belong to different solicitations';
  END IF;
  UPDATE outline_nodes SET linked_requirement_ids = array_remove(linked_requirement_ids, p_requirement_id)
   WHERE outline_id = v_outline AND id <> p_outline_node_id AND p_requirement_id = ANY(linked_requirement_ids);
  UPDATE outline_nodes SET linked_requirement_ids = array_append(array_remove(COALESCE(linked_requirement_ids, '{}'::uuid[]), p_requirement_id), p_requirement_id)
   WHERE id = p_outline_node_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not allowed to edit this outline'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.unassign_requirement(p_requirement_id uuid, p_outline_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_org_staff(auth.uid()) OR public.is_client_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only owners, admins and analysts can unlink requirements';
  END IF;
  UPDATE outline_nodes SET linked_requirement_ids = array_remove(linked_requirement_ids, p_requirement_id)
   WHERE outline_id = p_outline_id AND p_requirement_id = ANY(linked_requirement_ids);
END; $$;

REVOKE ALL ON FUNCTION public.assign_requirement_to_section(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unassign_requirement(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_requirement_to_section(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_requirement(uuid, uuid) TO authenticated;