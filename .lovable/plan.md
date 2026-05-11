# Per-user SAM.gov API keys

Each user brings their own SAM.gov API key. Edge functions use the caller's key. If a user hasn't added one, SAM.gov actions (import URL, pull attachments, prior solicitation import) fail with a clear "Add your SAM.gov API key in Settings → Integrations" message and a link to the page. The shared `SAM_GOV_API_KEY` secret is no longer used at runtime.

## UX

- **Settings → Integrations tab** (currently a placeholder) becomes a real form:
  - Card "SAM.gov API key" with a masked input (show last 4 chars when set), Save / Remove buttons, and a help line linking to https://open.gsa.gov/api/get-opportunities-public-api/ for getting a key.
  - Status badge: "Connected" / "Not configured".
- **SAM import dialogs / buttons** (Create solicitation from SAM URL, "Pull attachments from SAM.gov", "Import from SAM.gov" in Comparison) detect the missing-key error and show a toast: *"Add your SAM.gov API key in Settings → Integrations"* with an action button that navigates to `/settings?tab=integrations`.

## Data

New table `user_integrations` (one row per user per provider; start with `sam_gov`):

```text
user_integrations
  id            uuid pk
  user_id       uuid not null  -- == auth.uid()
  provider      text not null  -- 'sam_gov'
  api_key       text not null  -- stored as-is (Postgres at-rest encrypted; RLS hides from others)
  last_four     text generated -- right(api_key, 4) for UI display
  created_at, updated_at
  unique (user_id, provider)
```

RLS: a user can `SELECT/INSERT/UPDATE/DELETE` only rows where `user_id = auth.uid()`. No cross-org visibility, no service-role policy needed for users (edge functions use service role which bypasses RLS).

## Edge functions

- `sam-import` and `sam-import-attachments`: stop reading `SAM_GOV_API_KEY`. Instead:
  1. Read the caller's JWT from the `Authorization` header, resolve `user_id` via `supabase.auth.getUser(jwt)`.
  2. With a service-role client, `select api_key from user_integrations where user_id = ? and provider='sam_gov'`.
  3. If missing, return HTTP 400 with `{ error: "SAM_KEY_MISSING", message: "Add your SAM.gov API key in Settings → Integrations." }`.
  4. Otherwise use that key for all SAM API calls in the request.
- Both functions already require auth (caller is signed in from the app), so this is straightforward.

## Frontend

- New `IntegrationsTab.tsx` replacing the placeholder in `src/pages/Settings.tsx`:
  - `useQuery` `['integration','sam_gov']` → `select last_four, updated_at from user_integrations`.
  - `useMutation` upsert and delete.
  - Validates a non-empty key; trims whitespace.
- New small hook `useSamKeyStatus()` (returns `{ hasKey, lastFour }`) used by:
  - `useSamPullAttachments`, `useImportPriorFromSam`, the "Create from SAM URL" dialog — to disable the button + show inline hint when not configured (avoids a round-trip to discover the error).
- Shared error handler: when an edge function returns `SAM_KEY_MISSING`, show a toast with a "Open Settings" action that routes to `/settings` and selects the Integrations tab (Tabs already supports `defaultValue`; switch to controlled `value` driven by `?tab=` search param).

## Migration / cleanup

- Migration creates `user_integrations` + RLS policies.
- Keep the `SAM_GOV_API_KEY` secret in place for now (harmless), but remove all reads in code. We can delete the secret after verification.
- Existing SAM-linked solicitations are unaffected; only future SAM API calls require a per-user key.

## Out of scope

- Per-org shared key (rejected — per-user only).
- Encrypting the key with pgsodium/Vault (can be added later; RLS already prevents cross-user reads).
- Other providers (structure leaves room via `provider` column).
