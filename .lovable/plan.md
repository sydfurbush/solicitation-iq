
## What's happening

Confirmed from Postgres logs:
- `jb4smith@gmail.com` (uid `744dcf74…`) is an `owner` in org `256b10…`, with 3 clients in that org.
- The insert is reaching Postgres and failing the **WITH CHECK** on `solicitations` INSERT, returning `42501`.

Today there are two permissive policies that allow INSERT:

```
"staff create solicitations"  (INSERT, authenticated)
  WITH CHECK: is_org_staff(auth.uid())
              AND client_id IN (SELECT c.id FROM clients c
                                WHERE c.organization_id = current_user_org())

"staff manage solicitations"  (ALL, public)
  WITH CHECK: client_id IN (SELECT id FROM clients
                            WHERE organization_id = current_user_org())
              AND (is_org_admin(auth.uid()) OR is_org_staff(auth.uid()))
```

Both rely on a **subquery against `public.clients`**, which is itself subject to RLS. For an owner this should resolve, but the subquery evaluation inside WITH CHECK is the most likely failure point (e.g. when `current_user_org()` returns `NULL` because the session falls back to `anon`, or when the inner `clients` policy fails to match for any reason — both produce exactly this `42501`).

Anon also currently has table-level `INSERT`/`SELECT` GRANTs on `solicitations` (separate hardening issue).

## Recommendation

Replace the fragile subquery with a `SECURITY DEFINER` helper that checks `clients.organization_id` directly, bypassing nested RLS. Collapse the two overlapping INSERT-applicable policies into one explicit policy per command, and tighten grants.

### Migration

```sql
-- 1. Helper: does this client belong to the caller's org? Bypasses clients RLS.
CREATE OR REPLACE FUNCTION public.client_in_current_org(_client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.users u ON u.id = auth.uid()
    WHERE c.id = _client_id
      AND c.organization_id = u.organization_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.client_in_current_org(uuid) TO authenticated;

-- 2. Rebuild solicitations policies cleanly.
DROP POLICY IF EXISTS "staff create solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "staff manage solicitations" ON public.solicitations;

-- INSERT: org staff creating for a client in their org
CREATE POLICY "staff insert solicitations"
ON public.solicitations FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_staff(auth.uid())
  AND public.client_in_current_org(client_id)
);

-- UPDATE / DELETE: solicitation member + still in org
CREATE POLICY "staff update solicitations"
ON public.solicitations FOR UPDATE TO authenticated
USING (public.is_solicitation_member(auth.uid(), id)
       AND public.client_in_current_org(client_id))
WITH CHECK (public.client_in_current_org(client_id)
            AND public.is_org_staff(auth.uid()));

CREATE POLICY "staff delete solicitations"
ON public.solicitations FOR DELETE TO authenticated
USING (public.is_org_admin(auth.uid())
       AND public.client_in_current_org(client_id));

-- 3. Tighten grants: anon should never touch solicitations.
REVOKE INSERT, UPDATE, DELETE, SELECT ON public.solicitations FROM anon;
```

The existing SELECT policies (`view accessible solicitations`, `client user view own solicitations`) stay as-is.

### Why this fixes it

- `client_in_current_org` runs as SECURITY DEFINER, so the `clients` lookup is no longer subject to a nested RLS pass that could silently return zero rows.
- A single, explicit INSERT policy removes ambiguity from overlapping permissive policies.
- Revoking `anon` grants ensures a misrouted (unauthenticated) request fails with a clear table-level permission error instead of a confusing RLS failure.

## After the migration

Ask jb4smith to:
1. Fully sign out and sign back in (force a fresh JWT).
2. Retry creating the solicitation.
3. If it still fails, capture the exact toast text and the network response body for the `POST .../solicitations` request — that response includes `code`, `message`, `details`, and `hint` which will pinpoint any remaining cause (e.g. a trigger).

## Options if you'd rather not change RLS

1. **Diagnostic-only first** — add a temporary edge function the client can call that reports `auth.uid()`, `current_user_org()`, `is_org_staff(...)` for the live session. Confirms whether the session is actually authenticated before changing policies.
2. **Service-role insert** — route solicitation creation through an edge function using the service role, bypassing RLS entirely. Heavier change; only worth it if we expect more policy churn.

Recommendation: ship the migration above (option 0). It's a small, targeted change that also closes the anon-grant hole.
