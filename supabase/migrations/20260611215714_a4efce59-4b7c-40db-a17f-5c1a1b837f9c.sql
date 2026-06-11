CREATE POLICY "Solicitation members read audit rows"
ON public.assistant_audit_log
FOR SELECT
TO authenticated
USING (
  solicitation_id IS NOT NULL
  AND public.is_solicitation_member(auth.uid(), solicitation_id)
);