## 1. Contract Set-Aside field

**Migration**: add `set_aside text` (nullable) to `public.solicitations`. Plain text (not an enum) so values can be extended without a migration. Allowed values enforced in the app: `SDVOSB`, `SBA`, `8(a)`, `WOSB`, `Other`.

**Validator** (`src/lib/validators/solicitation.ts`):
- Export `SET_ASIDE_TYPES = ["SDVOSB","SBA","8(a)","WOSB","Other"] as const`.
- Add optional `set_aside: z.enum(SET_ASIDE_TYPES).optional()` to `solicitationBasicSchema`.

**Form** (`src/features/solicitations/components/SolicitationForm.tsx`):
- New `Select` on the **Basics** tab, placed beside Contract type.
- Add `set_aside` to `defaultValues` and to `STEP_FIELDS.basic`.

**Display**:
- Show set-aside on `SolicitationOverview` (Overview tab) when set.
- Show as a small badge on `SolicitationCard` when set.

No change to `useSolicitations` hook needed — the field flows through `toInsert(...rest)` automatically once it's on the schema.

## 2. Delete a solicitation

`useDeleteSolicitation` already exists (soft delete via `deleted_at`). Add UI entry points:

- **`SolicitationCard`** (grid view on `/solicitations`): add a kebab `DropdownMenu` in the card header with **Archive** and **Delete**. Expose `onArchive` / `onDelete` callbacks so `src/pages/Solicitations.tsx` reuses its existing `AlertDialog` confirm flow (same pattern as the table view).
- **`SolicitationDetail` page**: add a destructive "Delete solicitation" item to the page header actions, with `AlertDialog` confirmation; on success, toast + navigate to `/solicitations` and invalidate queries.
- **`ClientDetail` page** solicitations list: add a per-row kebab with Delete so a user can remove a solicitation from the client they just added it to.

## Out of scope
- No RLS changes (`staff manage solicitations` already permits update/delete).
- No hard delete; soft delete (`deleted_at`) is preserved so records can be restored.
- Existing rows keep `set_aside = null` and render as hidden/"—".

## Technical notes
- `src/integrations/supabase/types.ts` regenerates after the migration, so `set_aside` becomes typed automatically.
- The form's wizard `STEP_FIELDS.basic` must include `set_aside` so step validation triggers on it.
