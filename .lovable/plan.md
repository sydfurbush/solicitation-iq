# Buyer format profiles — full rollout

Bring the empty `buyer_format_profiles` table to life in three sequenced steps so Phase 5 (compile & export) has real buyer-specific formatting rules instead of the generic table defaults.

## Step 1 — Seed a default federal profile per org

Insert one row per existing organization so every org starts with a usable baseline.

Per-row values:
- `name`: "Federal default"
- `vertical`: `federal`
- `is_default`: `true`
- `font`: Times New Roman, `size_pt`: 12, `margins_in`: 1.0, `line_spacing`: 1.0
- `page_number_format`: `{volume} - {page} of {pages}`
- `file_name_pattern`: `{firm}_{solnumber}_{volume}`
- `volume_page_limits`: `{}` (none enforced by default)
- `header_html` / `footer_html`: null
- `notes`: "Auto-seeded baseline. Edit in Settings → Format profiles."

Also enforce going forward: when a new organization is created, auto-seed the same row (database trigger on `organizations` insert).

## Step 2 — Settings UI to manage profiles

New tab **Settings → Format profiles** (admins/owners only; staff read-only).

List view:
- Table of org profiles with columns: Name, Vertical, Default, Font / size, Margins, Updated.
- Row actions: Edit, Duplicate, Set as default, Delete (blocked if it's the only profile or currently in use by a solicitation).
- "New profile" button.

Editor (drawer or dialog):
- Fields mirror the table columns: name, vertical (federal/utility/commercial), font, size_pt, margins_in, line_spacing, page_number_format, file_name_pattern, header_html, footer_html, volume_page_limits (key/value editor: volume name → max pages), notes.
- "Mark as default for this vertical" toggle — clears the flag on any sibling in the same vertical inside the same org.
- Live preview chip showing a rendered page-number sample and resolved file name using placeholder firm/sol values.

Behavior:
- All writes scoped to `current_user_org()` (existing RLS already enforces this).
- Cannot delete a profile that is referenced by `solicitations.format_profile_id`; show a friendly error listing the affected solicitations.

## Step 3 — Per-solicitation profile picker

On the Phase 5 tab in `SolicitationDeepDive` (and the compile/export entry point):
- Add a "Format profile" selector that lists the org's profiles, defaulting to the org's `is_default = true` federal row when unset.
- Persist to `solicitations.format_profile_id`.
- Surface the resolved font/size/margins inline so the analyst sees what will be applied.
- `compile-proposal` already reads `buyer_format_profiles`; update it to honor `solicitations.format_profile_id` first, then fall back to the org default, then to the schema defaults.

## Verification

- Step 1: `select count(*) from buyer_format_profiles where is_default` equals number of orgs; creating a brand-new org auto-creates its row.
- Step 2: New profile shows in list, edit persists, deleting an in-use profile is blocked, only one default per vertical per org.
- Step 3: Selecting a profile on a solicitation updates the row; compile output uses that profile's font/margins/page numbering; clearing the selection falls back to the org default.

## Technical notes

- Step 1 mixes a data insert (seed existing orgs — use the insert tool) and a schema change (new trigger on `organizations` — migration tool). Two separate calls.
- Trigger: `after insert on public.organizations` → `insert into public.buyer_format_profiles (organization_id, name, is_default) values (new.id, 'Federal default', true);` (other columns get table defaults).
- Add a partial unique index to keep one default per (organization_id, vertical): `create unique index bfp_one_default_per_vertical on buyer_format_profiles(organization_id, vertical) where is_default;`.
- New files (Step 2): `src/features/settings/components/FormatProfilesTab.tsx`, `src/features/formatProfiles/hooks/useFormatProfiles.ts`, plus a small editor component. Wire the tab into `src/pages/Settings.tsx`.
- Step 3 touches `src/pages/SolicitationDeepDive.tsx` (Phase 5 section), a new `useSolicitationFormatProfile` hook, and `supabase/functions/compile-proposal/index.ts` for the lookup order.
- No new RLS policies required — existing `staff manage format profiles` / `view org format profiles` policies cover all reads/writes.
