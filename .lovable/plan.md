## Findings

- Your data is still in the database: your account, organization, avatar URL/object, clients, and active solicitation records exist.
- The preview is failing all profile/client/solicitation requests with `stack depth limit exceeded`.
- The likely root cause is recursive Row Level Security helper functions: `current_user_org`, `has_role`, `is_org_staff`, and client helpers currently run as invoker functions, so policies call functions that query tables whose policies call the same functions again.

## Plan

1. **Repair backend access helpers**
   - Update the RLS helper functions to run as secure definer helpers with a fixed `public` search path.
   - Keep execution limited to authenticated users where appropriate.
   - This breaks the policy recursion while preserving organization-scoped access.

2. **Verify data visibility after the migration**
   - Re-check authenticated-style reads for:
     - user profile + organization
     - clients
     - solicitations
     - avatar storage object visibility
   - Confirm the dashboard should see the existing records instead of empty placeholders.

3. **Only adjust frontend if a separate issue remains**
   - If requests succeed after the backend fix, no UI changes are needed.
   - If the UI still hides successful results, inspect the specific hook/page and patch only that display logic.

## Technical details

- Primary database objects to update:
  - `public.current_user_org()`
  - `public.has_role(uuid, app_role)`
  - `public.is_org_staff(uuid)`
  - `public.current_client_id()`
  - `public.is_client_user(uuid)`
- The fix should not make data public; it should allow policies to evaluate without recursively applying themselves.