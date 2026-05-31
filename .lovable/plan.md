## The actual problem

"Primary client" for Inverness is stored in two places, and the one you're trying to clear is the **client record's primary contact**, not a client portal user:

- `clients.primary_contact_email = jb4smith@gmail.com`
- `clients.primary_contact_name = Cindy Furbush`

The matching client portal user (`jb4smith@gmail.com`) is already revoked (`deleted_at` set, `is_primary = false`), so the "Client portal users" table is not the issue.

## Why clearing it from Edit Client doesn't work

In `src/lib/validators/client.ts`, the optional string fields (`primary_contact_email`, `primary_contact_name`, `industry`, `website`, `notes`, `logo_url`) all do:

```ts
.transform((v) => (v ? v : undefined))
```

When you delete the email and save, the value becomes `undefined`. In `useUpdateClient` the payload is handed straight to `supabase.from("clients").update(payload)`, and `undefined` fields are stripped from the JSON body — so PostgREST never receives the column and the existing value stays. The field looks editable but cannot actually be cleared.

## Fix

Change the optional-string transforms in `src/lib/validators/client.ts` from `undefined` to `null`, so cleared fields are sent as explicit `null` and actually wipe the column. Applies to: `optionalUrl`, `optionalEmail`, `industry`, `primary_contact_name`, `notes`, `logo_url`.

Also widen `ClientInput` consumers minimally: `useUpdateClient` already accepts `Partial<ClientInput>` and passes it to `.update()` — `null` is valid for these nullable columns, so no further change needed. `useCreateClient`'s `Insert` type also accepts `null`.

### Files touched
- `src/lib/validators/client.ts` — swap the six `(v ? v : undefined)` transforms to `(v ? v : null)` and adjust the zod types to `.nullable()` so the inferred `ClientInput` matches.

No DB migration, no UI changes, no changes to `client_users` / portal invitation flow.

## After the fix

You'll be able to open Edit on Inverness, clear the Primary contact name and email fields, save, and the columns will be nulled. The already-revoked `jb4smith@gmail.com` portal user row stays as-is (correctly revoked).