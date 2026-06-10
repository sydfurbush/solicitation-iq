## Goal

Figure out why jb4smith@gmail.com gets "Could not create — [object Object]" when creating a solicitation, and unblock them.

## What we already know

- They are an `owner` in org `256b…fd900` with 3 clients and prior successful solicitations (latest May 21). Permissions and data look correct.
- The toast message "[object Object]" is a **client-side bug**, not the real error. `CreateSolicitationDialog.tsx` does `e instanceof Error ? e.message : String(e)`, but Supabase's `PostgrestError` is a plain object — so the actual DB error (RLS violation? trigger failure? bad column?) is being thrown away before we see it.
- Until we see the real error message, any "fix" is a guess.

## Plan

### 1. Fix the error reporting (small, targeted change)

In every solicitation-create catch block, format Supabase errors properly so the toast shows `message`, `code`, `details`, and `hint`, and also log the full object to the browser console.

Files to touch:
- `src/features/solicitations/components/CreateSolicitationDialog.tsx`
- `src/features/solicitations/components/AddFinalSolicitationDialog.tsx`
- `src/features/solicitations/hooks/useFinalFromPreSol.ts`

Add a tiny helper (e.g. `src/lib/supabase/formatError.ts`) that returns a readable string for `Error`, `PostgrestError`, `FunctionsHttpError`, and anything else. Use it in those catch blocks and `console.error` the raw object alongside.

This is a UI/diagnostics change only — no business logic, no schema changes.

### 2. Ask jb4smith to retry and send the new error text

Once shipped, the toast will say something concrete like "new row violates row-level security policy for table solicitations" or "null value in column X violates not-null constraint". With that one line we can pinpoint the cause in minutes.

### 3. Fix the root cause

Based on what the real error says, the likely candidates (in order of probability) are:

- A required column added by a recent migration that the form isn't sending (e.g. an `organization_id` or similar not-null without a default). I checked — none of the current NOT NULL columns fit this, but a migration may land between now and the retry.
- A failing `AFTER INSERT` trigger. There is one: `copy_client_defaults_to_solicitation` copies `client_assignments` → `solicitation_assignments`. It looks safe (uses `ON CONFLICT DO NOTHING`), but if a `client_assignments.role` value ever fails the cast to `solicitation_assignment_role` enum, the whole insert aborts.
- A stale auth session where `auth.uid()` doesn't match (forces them to sign out / sign in).

We patch whichever the real error points at, in a follow-up turn.

### On the "push a new version when they log in" idea

Not recommended as a fix for this. Lovable's hosting already serves fresh hashed bundles on every page load, so a normal browser refresh is the existing "push new version" mechanism. Adding a forced-reload-on-login mechanism would be extra code that doesn't address the actual failure, which is server-side (the DB rejects the insert and our UI hides why). If you still want a "new version available, reload" banner as a separate product feature later, we can add it as its own task.

## Out of scope

- No database migrations in this step.
- No changes to RLS, the solicitation form fields, or the create-solicitation mutation logic.
- No version-pinning / service-worker / forced-reload work.

## Technical detail

The helper looks roughly like:

```ts
export function formatSupabaseError(e: unknown): string {
  if (!e) return "Unknown error";
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint, o.code]
      .filter(Boolean)
      .map(String);
    if (parts.length) return parts.join(" — ");
  }
  return String(e);
}
```

Used as:

```ts
} catch (e) {
  console.error("Create solicitation failed:", e);
  toast({
    title: "Could not create",
    description: formatSupabaseError(e),
    variant: "destructive",
  });
}
```
